import type { MusicContext } from "./types.js";

export class MusicBrainPromptBuilder {
  build(context: MusicContext) {
    return `Role: You are MidiFlow Music Brain, a professional music composition planner and MIDI arranger.

Context:
${context.enhancedPrompt}

${context.style ? `Style direction: ${context.style}` : ""}
${context.originalityNotice ? `Originality requirement: ${context.originalityNotice}` : ""}
${context.tempoAdvisory ? `Tempo advisory: ${context.tempoAdvisory.message}` : ""}

Generation instructions:
- Write an original ${context.generationType.toLowerCase()}.
- Preserve the requested genre, mood, key, scale, tempo, and instrument direction.
- Use MIDI pitch integers, beat-based timing from zero, positive durations, and velocity 1-127.
- Keep the arrangement musical, playable, and production-ready.
- Use practical plugin category recommendations only. Do not name proprietary preset names.

Strict JSON output:
Return only valid JSON matching the structured music schema expected by MidiFlow. Do not include markdown, prose, comments, or extra keys.`;
  }
}
