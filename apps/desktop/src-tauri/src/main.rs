// Windows desktop shell. Registers the native media commands and owns job lifecycle.
// The UI never executes FFmpeg directly (technical-architecture.md §6.1); it only sends
// versioned requests across this boundary and receives structured results and events.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod storage_commands;

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use desktop_media::encode::{
    discard, export_to_temp, finalise, generate_proxy as encode_proxy, EncodeProgress,
};
use desktop_media::error::{MediaError, MediaErrorCode};
use desktop_media::inspect::{inspect, InspectResult};
use desktop_media::plan::RenderPlan;
use desktop_media::validate::{validate_output, ExpectedOutput, OutputValidationResult};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};

/// Cancellation flags keyed by job id.
#[derive(Default)]
struct Jobs(Mutex<HashMap<String, Arc<AtomicBool>>>);

impl Jobs {
    fn register(&self, job_id: &str) -> Arc<AtomicBool> {
        let flag = Arc::new(AtomicBool::new(false));
        if let Ok(mut map) = self.0.lock() {
            map.insert(job_id.to_string(), Arc::clone(&flag));
        }
        flag
    }

    fn finish(&self, job_id: &str) {
        if let Ok(mut map) = self.0.lock() {
            map.remove(job_id);
        }
    }

    fn cancel(&self, job_id: &str) {
        if let Ok(map) = self.0.lock() {
            // "current" cancels whatever is running, which is all the M1 slice can run.
            if job_id == "current" {
                for flag in map.values() {
                    flag.store(true, Ordering::Relaxed);
                }
            } else if let Some(flag) = map.get(job_id) {
                flag.store(true, Ordering::Relaxed);
            }
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct InspectRequest {
    #[allow(dead_code)]
    protocol_version: u32,
    request_id: String,
    path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProxyArgs {
    job_id: String,
    source_path: String,
    output_path: String,
    max_width: u32,
    max_height: u32,
    total_ticks: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportArgs {
    job_id: String,
    plan: RenderPlan,
    output_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct JobProgressEvent {
    job_id: String,
    stage: String,
    fraction: f64,
}

/// Reject paths that are empty or obviously not a file. Path validation belongs in the
/// native layer (technical-architecture.md §12).
fn validated_path(raw: &str, code: MediaErrorCode) -> Result<PathBuf, MediaError> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(MediaError::new(code, "No file path was provided."));
    }
    Ok(PathBuf::from(trimmed))
}

#[tauri::command]
fn ffmpeg_available() -> bool {
    desktop_media::ffbin::probe_availability().is_ok()
}

#[tauri::command]
async fn inspect_media(request: InspectRequest) -> Result<InspectResult, MediaError> {
    let path = validated_path(&request.path, MediaErrorCode::MediaUnreadable)?;
    let request_id = request.request_id.clone();
    tauri::async_runtime::spawn_blocking(move || inspect(&request_id, &path))
        .await
        .map_err(|e| {
            MediaError::new(
                MediaErrorCode::MediaInspectFailed,
                "Inspection did not complete.",
            )
            .with_cause(e.to_string())
        })?
}

#[tauri::command]
async fn generate_proxy(
    app: AppHandle,
    jobs: State<'_, Jobs>,
    args: ProxyArgs,
) -> Result<String, MediaError> {
    let source = validated_path(&args.source_path, MediaErrorCode::MediaProxyFailed)?;
    let output = validated_path(&args.output_path, MediaErrorCode::MediaProxyFailed)?;
    let cancel = jobs.register(&args.job_id);
    let job_id = args.job_id.clone();
    let out_for_result = output.clone();

    let handle = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let mut on_progress = |p: EncodeProgress| {
            let _ = handle.emit(
                "job://progress",
                JobProgressEvent {
                    job_id: p.job_id.clone(),
                    stage: p.stage.to_string(),
                    fraction: p.fraction(),
                },
            );
        };
        encode_proxy(
            &job_id,
            &source,
            &output,
            args.max_width,
            args.max_height,
            args.total_ticks,
            &cancel,
            &mut on_progress,
        )
    })
    .await
    .map_err(|e| {
        MediaError::new(
            MediaErrorCode::MediaProxyFailed,
            "Proxy generation did not complete.",
        )
        .with_cause(e.to_string())
    })?;

    jobs.finish(&args.job_id);
    result.map(|()| out_for_result.to_string_lossy().to_string())
}

#[tauri::command]
async fn export_sequence(
    app: AppHandle,
    jobs: State<'_, Jobs>,
    args: ExportArgs,
) -> Result<OutputValidationResult, MediaError> {
    let output = validated_path(&args.output_path, MediaErrorCode::ExportInvalidPlan)?;
    let cancel = jobs.register(&args.job_id);
    let job_id = args.job_id.clone();
    let plan = args.plan.clone();
    let handle = app.clone();

    let outcome = tauri::async_runtime::spawn_blocking(move || {
        let mut on_progress = |p: EncodeProgress| {
            let _ = handle.emit(
                "job://progress",
                JobProgressEvent {
                    job_id: p.job_id.clone(),
                    stage: p.stage.to_string(),
                    fraction: p.fraction(),
                },
            );
        };

        // Render to a temp file first; the final destination is only written after the
        // output validates (media-engine.md §17-18).
        let temp = export_to_temp(&job_id, &plan, &output, &cancel, &mut on_progress)?;

        let expected = ExpectedOutput {
            width: plan.video.width,
            height: plan.video.height,
            video_codec: plan.video.codec.clone(),
            duration_ticks: plan
                .tracks
                .iter()
                .filter(|t| t.kind == "video")
                .flat_map(|t| t.clips.iter())
                .map(|c| c.timeline_duration_ticks)
                .next()
                .unwrap_or(0),
            expect_audio: true,
        };

        let validation = validate_output(&temp, &expected)?;
        if validation.valid {
            finalise(&temp, &output)?;
        } else {
            // A failed export must not leave a usable-looking file behind.
            discard(&temp);
        }
        Ok::<OutputValidationResult, MediaError>(validation)
    })
    .await
    .map_err(|e| {
        MediaError::new(
            MediaErrorCode::ExportEncoderFailed,
            "Export did not complete.",
        )
        .with_cause(e.to_string())
    })?;

    jobs.finish(&args.job_id);
    outcome
}

#[tauri::command]
fn cancel_job(jobs: State<'_, Jobs>, job_id: String) {
    jobs.cancel(&job_id);
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            app.manage(Jobs::default());
            let index = storage_commands::build_index(app.handle());
            app.manage(storage_commands::IndexState(Mutex::new(index)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ffmpeg_available,
            inspect_media,
            generate_proxy,
            export_sequence,
            cancel_job,
            storage_commands::default_projects_dir,
            storage_commands::project_create,
            storage_commands::project_open,
            storage_commands::project_save,
            storage_commands::project_duplicate,
            storage_commands::project_delete,
            storage_commands::project_recovery_snapshots,
            storage_commands::project_recover_as_copy,
            storage_commands::project_detect_links,
            storage_commands::project_relink,
            storage_commands::recent_projects
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            eprintln!("Fatal: the desktop shell could not start: {e}");
            std::process::exit(1);
        });
}
