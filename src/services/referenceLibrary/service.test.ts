import { describe, expect, it } from "vitest";
import { diagnoseReferenceContext, formatReferenceContext, type RetrievedReference } from "./service.js";

function reference(fileName: string, events: RetrievedReference["midiEvents"]): RetrievedReference {
  return {
    collection: "spanish-guitar",
    fileName,
    tempo: 100,
    key: "G",
    scale: "Minor",
    score: 4.2,
    influence: 0.7,
    profile: {
      noteDensity: 1,
      rhythmicDensity: 1,
      restRatio: 0.5,
      durationDistribution: "0.5-1 beats",
      velocityVariation: 0.1,
      pitchRange: { min: 60, max: 72 },
      register: "mid",
      phraseLength: 2,
      repetitionLevel: 0.5,
      complexity: 0.4,
      syncopationLevel: 0.5,
      chordVoicingStyle: "compact voicings",
    },
    midiEvents: events,
    byteLength: 150,
  };
}

describe("reference event context", () => {
  it("proves distinctive event data reaches the model context", () => {
    const primary = reference("Spanish_Guitar_01.mid", [{
      pitch: 67,
      startBeat: 0,
      durationBeats: 0.5,
      velocity: 92,
      track: "Guitar",
      bar: 1,
      beatPosition: 0,
      phrasePosition: 1,
      role: "harmony",
    }]);

    const diagnostic = diagnoseReferenceContext([primary]);

    expect(diagnostic.references).toEqual([{ fileName: "Spanish_Guitar_01.mid", byteLength: 150, eventCount: 1 }]);
    expect(diagnostic.serializedBytes).toBeGreaterThan(0);
    expect(diagnostic.modelReceivesReferenceData).toBe(true);
    expect(diagnostic.context).toContain('"pitch":67');
  });

  it("keeps the primary reference complete and bounds secondary event samples", () => {
    const primary = reference("primary.mid", Array.from({ length: 3 }, (_, index) => ({
      pitch: 60 + index,
      startBeat: index,
      durationBeats: 0.5,
      velocity: 90,
      track: "Primary",
      bar: 1,
      beatPosition: index,
      phrasePosition: 1,
      role: "melody",
    })));
    const secondary = { ...reference("secondary.mid", primary.midiEvents), influence: 0.2 };

    const context = formatReferenceContext([primary, secondary], 3, 1);

    expect(context).toContain("PRIMARY");
    expect(context).toContain("SECONDARY");
    expect(context).toContain("event_count=3");
    expect(context).toContain("note_events_json_sample_first_1");
  });
});