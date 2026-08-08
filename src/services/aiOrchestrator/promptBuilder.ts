import type { BuiltAiContext } from "../ai/types.js";
import type { PlannerWorkflow } from "./types.js";

type CompactPromptOptions = {
  workflow: PlannerWorkflow;
  bars: number;
  requestedTracks: Array<{ name: string; instrument?: string; role?: string; instruction?: string }>;
};

function summarizeKnowledge(context: BuiltAiContext) {
  const primary = context.knowledge[0];
  if (!primary) return "none";
  return [
    `genre=${primary.genre.name}`,
    `tempo=${primary.tempo.minBpm}-${primary.tempo.maxBpm}/${primary.tempo.defaultBpm}`,
    `keys=${primary.keys.slice(0, 4).map((entry) => entry.name).join(",")}`,
    `scales=${primary.scales.slice(0, 4).map((entry) => entry.name).join(",")}`,
    `inst=${primary.instruments.slice(0, 6).map((entry) => entry.name).join(",")}`,
  ].join("; ");
}

function interpretationHint(context: BuiltAiContext) {
  const interpretation = context.interpretation?.interpretation;
  if (!interpretation) return "none";
  return [
    interpretation.musicalSummary.concise,
    interpretation.musicalSummary.groove,
    interpretation.musicalSummary.harmony,
  ].join(" | ");
}

export function buildCompactPlannerPrompt(context: BuiltAiContext, options: CompactPromptOptions) {
  const requestedTracks = options.requestedTracks.map((track) => `${track.name}${track.instrument ? `(${track.instrument})` : ""}${track.role ? `:${track.role}` : ""}${track.instruction ? `=${track.instruction}` : ""}`).join("; ");
  const guitarChordRequest = /\b(spanish|flamenco|nylon|guitar)\b/i.test(context.sanitizedPrompt) && /\b(chord|harmony|progression|melody)\b/i.test(context.sanitizedPrompt);
  const systemPrompt = [
    "You are MidiFlow Generation Engine: a world-class melody composer, chord writer, producer, arranger, and MIDI composition specialist.",
    "Return JSON only.",
    "Do not output prose, markdown, comments, theory, or explanations.",
    `Generate exactly ${options.bars} bars unless workflow=voice_to_midi.`,
    "Use the compact schema keys: tempo, time_signature, key, scale, bars, tracks, summary.",
    "Each note must use p,s,d,v only.",
    "Return only the requested tracks.",
    "Create original, producer-level MIDI that is memorable, intentional, emotionally compelling, groove-driven, and immediately usable in a commercial beat.",
    "Build a strong hook with a repeating motif that develops through rhythm, ending notes, register, intervals, or tasteful ornamentation.",
    "Use 2-bar and 4-bar phrasing, call-and-response, question-and-answer, and deliberate repetition with variation; avoid continuous note spam and random scale runs.",
    "Prioritize syncopation, off-beat accents, anticipation, delayed resolution, rhythmic pockets, and vocal space. Leave intentional gaps and do not fill every beat.",
    "Use chord tones as targets with tasteful passing, neighbor, suspended, and delayed-resolution tones. Keep register controlled and avoid unnecessary octave jumps.",
    "Use modern harmonic color where appropriate: minor chords, 7ths, 9ths, suspended/add9 voicings, inversions, open voicings, spread voicings, and smooth voice leading; avoid generic root-position triad loops.",
    guitarChordRequest ? "For the Spanish/nylon guitar chord request, write a playable melodic chord part: arpeggiate or break chord tones into intentional picking patterns, add hammer-on/pull-off or passing-tone color as tasteful MIDI movement, use syncopated muted or off-beat attacks, varied note lengths, bass-to-treble voice leading, and a memorable 2-bar guitar motif. Do not return only sustained block chords." : "When a guitar chord part is requested, make the chord voicing playable and rhythmically expressive rather than a sustained block.",
    "Humanize the musical intent with varied velocities, natural note lengths, and subtle timing feel while preserving a usable MIDI pocket.",
    "Adapt density, instrumentation, tempo, harmony, register, and groove to the detected genre. Modern trap dancehall favors dark minor piano/guitar/bells, sparse aggressive bounce, repetitive hooks, and wide spacing; dancehall favors syncopated catchy motifs and vocal space; afrobeats favors warm guitar/plucks and circular rhythmic melodies; trap favors bouncy piano/bells, atmospheric pads, and strong rhythmic emphasis; R&B favors rich extended chords and smooth phrasing; cinematic favors wide intervals, suspense, and dynamic contrast.",
    "Artist references are vibe descriptors only. Extract high-level characteristics and create a completely original composition; never reproduce a melody, hook, lyric, or copyrighted song.",
    "Before returning JSON, internally check for a memorable hook, bounce, vocal space, intentional phrasing, interesting rhythm, modern harmony, and realistic producer usability. Rewrite weak material internally.",
  ].join(" ");

  const userPrompt = [
    `workflow=${options.workflow}`,
    `request=${context.sanitizedPrompt}`,
    `music_brain=genre:${context.musicBrain.context.genre};mood:${context.musicBrain.context.mood};tempo:${context.musicBrain.context.tempo};key:${context.musicBrain.context.key};scale:${context.musicBrain.context.scale};time:${context.musicBrain.context.timeSignature.join("/")};energy:${context.musicBrain.context.energy};complexity:${context.musicBrain.context.complexity}`,
    context.musicBrain.context.tempoAdvisory ? `tempo_note=${context.musicBrain.context.tempoAdvisory.message}` : "",
    `artist=${context.artist.translatedGenre};groove=${context.artist.grooveStyle};melody=${context.artist.melodyStyle};production=${context.artist.productionStyle}`,
    `knowledge=${summarizeKnowledge(context)}`,
    `interpretation=${interpretationHint(context)}`,
    context.projectHistory.length ? `project_history=${context.projectHistory.slice(-4).join(" || ")}` : "",
    `requested_tracks=${requestedTracks}`,
    `json_shape={"tempo":100,"time_signature":"4/4","key":"F Minor","scale":"Natural Minor","bars":${options.bars},"tracks":[{"name":"Main Melody","instrument":"Piano","role":"melody","notes":[{"p":65,"s":0,"d":1,"v":92}]}],"summary":"short summary"}`,
  ].filter(Boolean).join("\n");

  return { systemPrompt, userPrompt, cacheKeyMaterial: JSON.stringify({ systemPrompt, userPrompt, workflow: options.workflow, bars: options.bars, requestedTracks: options.requestedTracks }) };
}