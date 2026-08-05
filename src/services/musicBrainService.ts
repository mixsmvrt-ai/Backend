import { loadMusicBrainKnowledge } from "../music-brain/loader.js";
import { requireSupabase } from "../config/supabase.js";
import { genreRecommendationService } from "./genreRecommendationService.js";
import type { MidiAnalysisSummary } from "./midiAnalysisService.js";
import { pluginRecommendationService } from "./pluginRecommendationService.js";

interface ConversationContext {
  projectId: string;
  userId: string;
  prompt: string;
  analysis: MidiAnalysisSummary;
  projectGenre: string | null;
  projectMood: string | null;
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function responseDelay(content: string) {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  if (words <= 45) return 2500;
  if (words <= 90) return 3500;
  if (words <= 140) return 4500;
  return 6000;
}

export class MusicBrainService {
  async preload() {
    await loadMusicBrainKnowledge();
  }

  async reply(input: ConversationContext) {
    const knowledge = await loadMusicBrainKnowledge();
    const genreAdvice = await genreRecommendationService.resolve(input.projectGenre);
    const lowerPrompt = input.prompt.toLowerCase();
    const pluginRecommendations = await pluginRecommendationService.recommend({ analysis: input.analysis, genre: genreAdvice.genre, question: input.prompt });

    let content = "";

    if (includesAny(lowerPrompt, ["plugin", "preset", "sound", "instrument", "bell", "piano", "pad"])) {
      const top = pluginRecommendations[0];
      const alternatives = pluginRecommendations.slice(1, 5).map((recommendation) => `${recommendation.rank}. ${recommendation.plugin} - ${recommendation.category}`).join("\n");
      content = [
        `This MIDI sits in the ${input.analysis.registerFocus} register with a ${input.analysis.emotionalProfile} feel, ${input.analysis.melodyContour} contour, and ${input.analysis.noteDensity.toFixed(2)} notes per beat, so I would not go for an overly bright pop patch.`,
        `My first choice is ${top?.plugin ?? "Keyscape"} in a ${top?.category ?? "soft grand"} category because that keeps the emotion intact and gives the rhythm enough definition without crowding the pocket.`,
        `Strong options:\n${alternatives || "1. Keyscape - soft grand\n2. Omnisphere - dark keys\n3. Nexus - dark piano\n4. Kontakt - felt piano"}`,
        `Workflow: start with the main keys dry, then test a quiet ${pluginRecommendations[1]?.category ?? "dark bell"} layer one octave above only on phrase endings so the melody gets width without becoming busy.`,
      ].join("\n\n");
    } else if (includesAny(lowerPrompt, ["layer", "counter", "pad", "texture"])) {
      content = [
        `The lead already has a ${input.analysis.complexity} amount of movement, so the supporting layer should fill space rather than compete with the rhythm.`,
        `I would add a low-volume cinematic pad or dark bell texture depending on whether you want width or more attack. Because the contour is ${input.analysis.melodyContour}, a sustained layer underneath the longest notes will sound more polished than doubling every hit.`,
        `Alternative: use a short pluck counter melody in a higher octave only during the last bar of each phrase.`,
        `Workflow: duplicate the motif, remove 60 to 70 percent of the notes, move it up an octave, and only keep the notes that answer the lead instead of shadowing it.`,
      ].join("\n\n");
    } else if (includesAny(lowerPrompt, ["bass", "808", "sub"])) {
      content = [
        `The melody feels ${input.analysis.emotionalProfile} and lives mostly in the ${input.analysis.registerFocus} register, so the bass should support the pocket instead of adding extra harmonic clutter.`,
        `Use a simple 808 pattern that locks to the root notes and only glides at phrase turns. ${genreAdvice.bassBehavior ? `For ${genreAdvice.genre}, the usual move is ${genreAdvice.bassBehavior}.` : "Keep the 808 sparse and let the drums create most of the bounce."}`,
        `Alternative: if you want more warmth than aggression, use a sub bass with a light top layer instead of a distorted 808.`,
        `Workflow: write the root on the strong beats first, then add one syncopated response note where the melody leaves a gap.`,
      ].join("\n\n");
    } else if (includesAny(lowerPrompt, ["scale", "key", "chord", "harmony"])) {
      content = [
        `From the MIDI itself, the strongest center is ${input.analysis.key} ${input.analysis.scale}. The note spread is ${input.analysis.pitchRange.min} to ${input.analysis.pitchRange.max}, and the repetition level is ${input.analysis.repetitionLevel.toFixed(2)}, which makes the tonal center read clearly.`,
        `If you want richer harmony, keep the current center and add voicings that reinforce the mood instead of changing scale. ${knowledge.musicTheory.minorMood[0]}`,
        `Alternative: if you want more tension, borrow one Phrygian color tone around the flat second for passing movement rather than reharmonizing the full loop.`,
        `Workflow: place the chord tones under the longest melody notes first, then test one extension per chord so the progression grows without losing the motif.`,
      ].join("\n\n");
    } else if (includesAny(lowerPrompt, ["arrangement", "chorus", "verse", "intro", "bridge"])) {
      const introHints = knowledge.arrangement.sections.intro.join(", ");
      const chorusHints = knowledge.arrangement.sections.chorus.join(", ");
      content = [
        `This idea reads best as a motif-led section, so arrangement should protect the melody instead of over-stacking around it.`,
        `For the intro: ${introHints}. For the chorus: ${chorusHints}. Because the energy is ${input.analysis.energyLevel}, the biggest lift will come from width and octave support, not from adding many new notes.`,
        `Alternative: if the beat needs more tension before the hook, mute the lead for half a bar and let a filtered pad carry the transition.`,
        `Workflow: keep verse instrumentation narrow, then open the chorus with one extra layer, wider voicing, and a slightly fuller bass sustain.`,
      ].join("\n\n");
    } else if (includesAny(lowerPrompt, ["eq", "reverb", "mix", "mask", "compression", "stereo"])) {
      content = [
        `The main risk here is masking, because a ${input.analysis.registerFocus}-register lead with ${input.analysis.noteDensity.toFixed(2)} notes per beat can lose clarity fast once you stack bright layers.`,
        `For a keys-based lead, ${knowledge.mixing.eq.piano} For reverb, ${knowledge.mixing.reverb.dark}`,
        `Alternative: instead of widening the lead, keep it centered and place width on the quieter support layer.`,
        `Workflow: balance dry first, carve overlap between the lead and any bell layer, then add a filtered send reverb so the atmosphere stays behind the melody.`,
      ].join("\n\n");
    } else {
      content = [
        `The MIDI is ${input.analysis.key} ${input.analysis.scale} at ${input.analysis.tempo} BPM with a ${input.analysis.emotionalProfile} profile, ${input.analysis.melodyContour} shape, and ${input.analysis.complexity} complexity.`,
        `Because the line lives in the ${input.analysis.registerFocus} register and repeats at a ${input.analysis.repetitionLevel.toFixed(2)} level, it wants a focused sound choice and a clean arrangement around it.`,
        `Practical move: keep the lead intimate, add only one support layer, and let the low end answer the melody instead of mirroring it.`,
        `Alternative: if you want it to hit harder, raise the BPM slightly toward ${genreAdvice.bpmRange ? genreAdvice.bpmRange[1] : input.analysis.tempo + 5} and shorten the note tails before changing instruments.`,
      ].join("\n\n");
    }

    return {
      content,
      recommendedDelayMs: responseDelay(content),
      pluginRecommendations,
    };
  }

  async updateConversationContext(input: { projectId: string; userId: string; question: string; assistantReply: string; pluginNames: string[] }) {
    const db = requireSupabase();
    const { data } = await db.from("project_music_contexts").select("previous_questions, previous_edits, plugins_recommended").eq("project_id", input.projectId).eq("user_id", input.userId).maybeSingle();
    const previousQuestions = Array.isArray(data?.previous_questions) ? [...data.previous_questions as string[], input.question].slice(-12) : [input.question];
    const previousEdits = input.question.toLowerCase().includes("make it") || input.question.toLowerCase().includes("change")
      ? Array.isArray(data?.previous_edits) ? [...data.previous_edits as string[], input.question].slice(-12) : [input.question]
      : Array.isArray(data?.previous_edits) ? data.previous_edits as string[] : [];
    const pluginsRecommended = Array.from(new Set([...(Array.isArray(data?.plugins_recommended) ? data.plugins_recommended as string[] : []), ...input.pluginNames])).slice(-16);

    const { error } = await db.from("project_music_contexts").upsert({
      project_id: input.projectId,
      user_id: input.userId,
      previous_questions: previousQuestions,
      previous_edits: previousEdits,
      plugins_recommended: pluginsRecommended,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  }
}

export const musicBrainService = new MusicBrainService();