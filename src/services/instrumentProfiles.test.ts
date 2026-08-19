import { describe, expect, it } from "vitest";
import { constrainNotesToInstrument, instrumentProfile, instrumentProfilePrompt } from "./instrumentProfiles.js";

describe("instrument profiles", () => {
  it("distinguishes Spanish guitar from generic guitar", () => {
    expect(instrumentProfile("Spanish Guitar").id).toBe("spanish_guitar");
    expect(instrumentProfile("Spanish Guitar").midiProgram).toBe(25);
    expect(instrumentProfilePrompt("Spanish Guitar")).toContain("nylon-string guitar");
  });

  it.each([
    ["Spanish Guitar", 40, 88],
    ["Piano", 21, 108],
    ["808", 24, 55],
  ])("constrains %s to its playable range", (name, min, max) => {
    const notes = constrainNotesToInstrument([{ pitch: 0 }, { pitch: 127 }], name);
    expect(notes.map((note) => note.pitch)).toEqual([min, max]);
  });
});
