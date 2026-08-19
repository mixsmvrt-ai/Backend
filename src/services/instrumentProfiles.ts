export type InstrumentProfile = {
  id: string;
  aliases: string[];
  midiProgram: number;
  register: { min: number; max: number };
  writing: string;
  avoid: string;
  density: "sparse" | "moderate" | "dense";
};

const profiles: InstrumentProfile[] = [
  {
    id: "spanish_guitar",
    aliases: ["spanish guitar", "nylon guitar", "flamenco guitar", "classical guitar", "flamenco", "nylon"],
    midiProgram: 25,
    register: { min: 40, max: 88 },
    writing: "Write idiomatic nylon-string guitar: playable arpeggios, picked syncopation, open-string-friendly motion, compact fretboard voicings, bass-to-treble voice leading, and intentional rests.",
    avoid: "Avoid piano block chords, impossible four-octave jumps, dense constant sixteenth-note filling, and unrelated synth-style leads.",
    density: "moderate",
  },
  {
    id: "acoustic_guitar",
    aliases: ["acoustic guitar", "steel string guitar"],
    midiProgram: 24,
    register: { min: 40, max: 88 },
    writing: "Write playable steel-string guitar parts with strums, picked chord tones, open voicings, rhythmic accents, and natural register movement.",
    avoid: "Avoid orchestral voicings, piano-wide chord stacks, and continuous lead-note density.",
    density: "moderate",
  },
  {
    id: "piano",
    aliases: ["piano", "keys", "dark piano", "soft piano", "grand piano"],
    midiProgram: 0,
    register: { min: 21, max: 108 },
    writing: "Write playable piano voicings with intentional hand spacing, inversions, voice leading, velocity dynamics, and melodic space.",
    avoid: "Avoid every chord as a dense root-position block and avoid uncontrolled octave doubling.",
    density: "moderate",
  },
  {
    id: "808",
    aliases: ["808", "sub bass", "sub", "808 bass"],
    midiProgram: 38,
    register: { min: 24, max: 55 },
    writing: "Write sparse low-register 808 phrases that lock with the kick, use strong rests, controlled slides implied by interval movement, and clear root/tension resolution.",
    avoid: "Avoid mid-register melodies, fast scale runs, excessive notes, and chord stacks.",
    density: "sparse",
  },
  {
    id: "bell",
    aliases: ["bell", "bells", "bell pluck", "mallet", "music box"],
    midiProgram: 9,
    register: { min: 60, max: 108 },
    writing: "Write short, memorable bell motifs with upper-register space, repeated hooks, varied velocity accents, and selective syncopation.",
    avoid: "Avoid sustained pad chords, low bass writing, and filling every subdivision.",
    density: "sparse",
  },
  {
    id: "pad",
    aliases: ["pad", "dark pad", "ambient pad", "atmosphere"],
    midiProgram: 88,
    register: { min: 36, max: 84 },
    writing: "Write sparse sustained pad voicings with smooth voice leading, wide but playable spacing, and long musical rests.",
    avoid: "Avoid busy melodies, constant rhythmic attacks, and excessive register jumps.",
    density: "sparse",
  },
  {
    id: "electric_guitar",
    aliases: ["electric guitar", "clean guitar", "guitar riff"],
    midiProgram: 27,
    register: { min: 40, max: 96 },
    writing: "Write playable electric-guitar riffs with short rhythmic attacks, rests, repeated figures, and controlled bends or register lifts represented as note motion.",
    avoid: "Avoid orchestral stacks and piano-like sustained voicings.",
    density: "moderate",
  },
];

export function resolveInstrumentProfile(value: string | undefined, prompt = "") {
  const text = `${value ?? ""} ${prompt}`.toLowerCase();
  return profiles.find((profile) => profile.aliases.some((alias) => text.includes(alias))) ?? profiles.find((profile) => profile.id === "piano")!;
}

export function instrumentProfilePrompt(value: string | undefined, prompt = "") {
  const profile = resolveInstrumentProfile(value, prompt);
  return `Instrument contract (${profile.id}): MIDI program=${profile.midiProgram}; playable range=${profile.register.min}-${profile.register.max}; density=${profile.density}. ${profile.writing} ${profile.avoid}`;
}

export function instrumentProfile(value: string | undefined, prompt = "") {
  return resolveInstrumentProfile(value, prompt);
}

export function constrainNotesToInstrument<T extends { pitch: number }>(notes: T[], value: string | undefined, prompt = "") {
  const profile = resolveInstrumentProfile(value, prompt);
  return notes.map((note) => ({
    ...note,
    pitch: Math.max(profile.register.min, Math.min(profile.register.max, note.pitch)),
  }));
}
