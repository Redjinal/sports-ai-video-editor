// User templates (M5): save a selection of timeline objects as a reusable, portable bundle and
// stamp it back onto any sequence at a chosen tick. A template is pure data — normalised so its
// earliest object starts at tick 0 and carrying only template-local ids — so it round-trips
// through the same JSON persistence as everything else and is platform-neutral (no I/O here;
// the storage adapter persists the returned object).
import type { Sequence, TimelineObject } from "./model";
import type { AddObjectCommand, BatchCommand, CommandMeta } from "./commands";
import { type Ticks, asTicks, ZERO_TICKS } from "./ticks";

export interface Template {
  id: string;
  name: string;
  /** Objects normalised so the earliest start is tick 0; ids/refs are template-local. */
  objects: TimelineObject[];
  /** ISO timestamp; display + ordering only. */
  createdAt: string;
}

export interface CreateTemplateOptions {
  id: string;
  name: string;
  createdAt: string;
}

export interface InstantiateTemplateOptions {
  /** Where the template's tick-0 lands on the target sequence. */
  atTicks: Ticks;
  /** Meta for the enclosing batch; inner AddObject metas are derived from it. */
  meta: CommandMeta;
  /** Produces a fresh, unique object id for each template object. */
  idFactory: (templateLocalId: string, index: number) => string;
  /** Optional remap of template track ids onto the target sequence's tracks. */
  trackMap?: Record<string, string>;
}

/** Detached deep copy via the portable JSON shape (the model is JSON by construction). */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function remapRef(id: string | undefined, map: Map<string, string>): string | undefined {
  if (id === undefined) return undefined;
  // Only rewrite references that point inside the template; drop dangling ones.
  return map.get(id);
}

/**
 * Capture the given objects (by id, in their sequence order) as a template. Time is normalised
 * so the earliest selected object starts at tick 0, preserving all relative offsets. References
 * between selected objects (transition from/to, link groups) are kept; references pointing
 * outside the selection are dropped so the template is self-contained. Throws if any id is
 * missing or the selection is empty.
 */
export function createTemplate(
  seq: Sequence,
  objectIds: readonly string[],
  opts: CreateTemplateOptions,
): Template {
  if (objectIds.length === 0) {
    throw Object.assign(new Error("A template needs at least one object."), {
      code: "TEMPLATE_EMPTY",
    });
  }
  const wanted = new Set(objectIds);
  const selected = seq.objects.filter((o) => wanted.has(o.id));
  const found = new Set(selected.map((o) => o.id));
  const missing = objectIds.find((id) => !found.has(id));
  if (missing !== undefined) {
    throw Object.assign(new Error(`Object "${missing}" is not in the sequence.`), {
      code: "TIMELINE_OBJECT_NOT_FOUND",
    });
  }

  const base = Math.min(...selected.map((o) => o.startTicks));
  const inSet = new Set(selected.map((o) => o.id));
  const objects = selected.map((o) => {
    const copy = clone(o);
    copy.startTicks = asTicks(o.startTicks - base);
    // Drop references that leave the selection so the bundle stands alone.
    if (copy.linkGroupId !== undefined && !inSet.has(copy.linkGroupId)) delete copy.linkGroupId;
    if (copy.kind === "transition") {
      if (copy.fromId !== undefined && !inSet.has(copy.fromId)) delete copy.fromId;
      if (copy.toId !== undefined && !inSet.has(copy.toId)) delete copy.toId;
    }
    return copy;
  });

  return { id: opts.id, name: opts.name, objects, createdAt: opts.createdAt };
}

/**
 * Build the atomic command that stamps a template onto a sequence at `atTicks`. Every object
 * gets a fresh id (via `idFactory`); intra-template references (transition from/to, link groups)
 * are rewritten to the new ids, and track ids are remapped when a `trackMap` is given. Returns a
 * Batch so the whole stamp is one undo step.
 */
export function instantiateTemplate(
  template: Template,
  opts: InstantiateTemplateOptions,
): BatchCommand {
  // First pass: allocate new ids so references can be rewritten in the second pass.
  const idMap = new Map<string, string>();
  template.objects.forEach((o, i) => idMap.set(o.id, opts.idFactory(o.id, i)));

  const commands: AddObjectCommand[] = template.objects.map((o, i) => {
    const object = clone(o);
    object.id = idMap.get(o.id)!;
    object.startTicks = asTicks(opts.atTicks + o.startTicks);
    if (opts.trackMap && opts.trackMap[o.trackId]) object.trackId = opts.trackMap[o.trackId]!;
    const link = remapRef(object.linkGroupId, idMap);
    if (link !== undefined) object.linkGroupId = link;
    else delete object.linkGroupId;
    if (object.kind === "transition") {
      const from = remapRef(object.fromId, idMap);
      const to = remapRef(object.toId, idMap);
      if (from !== undefined) object.fromId = from;
      else delete object.fromId;
      if (to !== undefined) object.toId = to;
      else delete object.toId;
    }
    return {
      type: "AddObject",
      meta: { ...opts.meta, id: `${opts.meta.id}:${i}` },
      object,
    };
  });

  return { type: "Batch", meta: opts.meta, commands };
}

export const TEMPLATE_BASE_TICK: Ticks = ZERO_TICKS;
