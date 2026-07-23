import { describe, expect, it } from "vitest";
import { asTicks } from "@sve/timeline-domain";
import { applyTranslation, createTranslationProposal } from "./translation";
import { DEFAULT_CAPTION_STYLE, type CaptionTrack } from "./caption";

function baseTrack(): CaptionTrack {
  return {
    id: "captions",
    defaultStyle: DEFAULT_CAPTION_STYLE,
    captions: [
      { id: "c1", startTicks: asTicks(0), endTicks: asTicks(1_000), lines: ["Hello"] },
      { id: "c2", startTicks: asTicks(1_000), endTicks: asTicks(2_000), lines: ["World"] },
    ],
  };
}

describe("createTranslationProposal", () => {
  it("builds one unaccepted, unedited item per caption", () => {
    const track = baseTrack();
    const proposal = createTranslationProposal({
      id: "prop-1",
      trackId: track.id,
      sourceLanguage: "en",
      targetLanguage: "es",
      captions: track.captions,
      proposedTextByCaptionId: new Map([
        ["c1", ["Hola"]],
        ["c2", ["Mundo"]],
      ]),
    });
    expect(proposal.items).toHaveLength(2);
    expect(proposal.items.every((i) => i.accepted === false && i.edited === false)).toBe(true);
    expect(proposal.items[0]?.proposedText).toEqual(["Hola"]);
  });
});

describe("applyTranslation", () => {
  it("swaps text for accepted items but preserves timing and style exactly", () => {
    const track = baseTrack();
    const proposal = createTranslationProposal({
      id: "prop-1",
      trackId: track.id,
      sourceLanguage: "en",
      targetLanguage: "es",
      captions: track.captions,
      proposedTextByCaptionId: new Map([
        ["c1", ["Hola"]],
        ["c2", ["Mundo"]],
      ]),
    });
    const accepted = {
      ...proposal,
      items: proposal.items.map((i) => ({ ...i, accepted: true })),
    };
    const translated = applyTranslation(track, accepted);

    expect(translated.captions[0]?.lines).toEqual(["Hola"]);
    expect(translated.captions[1]?.lines).toEqual(["Mundo"]);
    // Timing preserved exactly.
    expect(translated.captions[0]?.startTicks).toBe(track.captions[0]?.startTicks);
    expect(translated.captions[0]?.endTicks).toBe(track.captions[0]?.endTicks);
    expect(translated.captions[1]?.startTicks).toBe(track.captions[1]?.startTicks);
    expect(translated.captions[1]?.endTicks).toBe(track.captions[1]?.endTicks);
    // Style/id preserved.
    expect(translated.defaultStyle).toEqual(track.defaultStyle);
    expect(translated.id).toBe(track.id);
    // Pure: original track untouched.
    expect(track.captions[0]?.lines).toEqual(["Hello"]);
  });

  it("leaves unaccepted items' text untouched — AI proposes, the user decides", () => {
    const track = baseTrack();
    const proposal = createTranslationProposal({
      id: "prop-1",
      trackId: track.id,
      sourceLanguage: "en",
      targetLanguage: "es",
      captions: track.captions,
      proposedTextByCaptionId: new Map([
        ["c1", ["Hola"]],
        ["c2", ["Mundo"]],
      ]),
    });
    // Only accept the first item.
    const partiallyAccepted = {
      ...proposal,
      items: proposal.items.map((i) => (i.captionId === "c1" ? { ...i, accepted: true } : i)),
    };
    const translated = applyTranslation(track, partiallyAccepted);
    expect(translated.captions[0]?.lines).toEqual(["Hola"]);
    expect(translated.captions[1]?.lines).toEqual(["World"]); // unaccepted, unchanged
  });
});
