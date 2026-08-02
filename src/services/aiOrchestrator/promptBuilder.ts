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
  const systemPrompt = [
    "You are MidiFlow Music Planner.",
    "Return JSON only.",
    "Do not output prose, markdown, comments, theory, or explanations.",
    `Generate exactly ${options.bars} bars unless workflow=voice_to_midi.`,
    "Use the compact schema keys: tempo, time_signature, key, scale, bars, tracks, summary.",
    "Each note must use p,s,d,v only.",
    "Return only the requested tracks.",
    "Create original musical ideas. Never imitate copyrighted songs or artists.",
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