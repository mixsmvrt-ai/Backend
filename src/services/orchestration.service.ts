import { randomUUID } from "node:crypto";
import type { OrchestrationInput } from "../domain/music.js";
import { buildMusicPrompt } from "../ai/prompt-builder.js";
import { OpenAiCompatibleProvider } from "../ai/provider.js";
import { validateStructuredMusicQuality } from "./ai/responseValidator.js";
import { env } from "../config/env.js";
import { requireSupabase } from "../config/supabase.js";
import { writeMidi } from "../midi/midi-writer.js";
import { assertCreditsAvailable, recordCreditUsage, TEXT_TO_MIDI_CREDIT_COST, VOICE_TO_MIDI_CREDIT_COST } from "./credit.service.js";
import { drumReferencePrompt } from "./drumReference.service.js";
import { midiAnalysisService } from "./midiAnalysisService.js";
import { modelSelector } from "./ai/modelSelector.js";
import { assertPlusMembership } from "./membership.service.js";
import { musicBrainService } from "./musicBrain/index.js";
import { referenceLibraryService } from "./referenceLibrary/service.js";

function workflowCreditCost(workflow: OrchestrationInput["workflow"] | undefined) {
  if (workflow === "voice_to_midi") return VOICE_TO_MIDI_CREDIT_COST;
  return TEXT_TO_MIDI_CREDIT_COST;
}

export function titleFromGenerationRequest(prompt: string) {
  const cleaned = prompt
    .trim()
    .replace(/^(please\s+)?(create|generate|make|write|compose|produce|give me)\s+(a\s+|an\s+|the\s+)?/i, "")
    .split(/[.!?\n]/)[0]
    .replace(/[^a-zA-Z0-9\s_-]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 64)
    .trim();
  return cleaned || "MidiFlow Idea";
}

function midiFileNameFromRequest(prompt: string) {
  return `${titleFromGenerationRequest(prompt)}.mid`;
}

export async function orchestrateGeneration(userId: string, input: OrchestrationInput) {
  if (!env.AI_PROVIDER_BASE_URL || !env.AI_PROVIDER_API_KEY) throw new Error("AI generation is unavailable because the provider is not configured.");
  const workflow = input.workflow ?? "text_to_midi";
  if (workflow === "voice_to_midi") await assertPlusMembership(userId);
  const creditCost = workflowCreditCost(workflow);
  await assertCreditsAvailable(userId, creditCost, workflow === "voice_to_midi" ? "shared" : "text_to_midi");
  const selection = await modelSelector.forUser(userId);
  const db = requireSupabase();
  let contextualPrompt = input.prompt;
  if (input.projectId) {
    const { data: messages, error: messagesError } = await db.from("project_messages").select("role, content").eq("project_id", input.projectId).eq("user_id", userId).order("created_at", { ascending: false }).limit(8);
    if (messagesError) throw messagesError;
    const history = (messages ?? []).reverse().map((message) => `${message.role}: ${message.content}`).join("\n");
    contextualPrompt = history ? `Project conversation so far:\n${history}\n\nLatest direction: ${input.prompt}` : input.prompt;
    const { error: userMessageError } = await db.from("project_messages").insert({ project_id: input.projectId, user_id: userId, role: "user", content: input.prompt });
    if (userMessageError) throw userMessageError;
  }
  const contextualInput = { ...input, prompt: contextualPrompt };
  const musicBrain = await musicBrainService.prepare({
    prompt: contextualPrompt,
    kind: input.kind,
    genre: input.genre,
    mood: input.mood,
    tempo: input.tempo,
    key: input.key,
    scale: input.scale,
    complexity: input.complexity,
    lengthBars: input.lengthBars,
    timeSignature: input.timeSignature,
    originalityNotice: "Create an original composition from high-level musical characteristics only.",
  });
  const resolvedInput = {
    ...contextualInput,
    genre: input.genre ?? musicBrain.context.genre,
    mood: input.mood ?? musicBrain.context.mood,
    tempo: input.tempo ?? musicBrain.context.tempo,
    key: input.key ?? musicBrain.context.key,
    scale: input.scale ?? musicBrain.context.scale,
  };
  const referencePrompt = await drumReferencePrompt(input);
  const referenceBlend = await referenceLibraryService.retrieve({
    prompt: contextualPrompt,
    genre: resolvedInput.genre,
    mood: resolvedInput.mood,
    instrument: musicBrain.context.instrumentSuggestions[0],
    tempo: resolvedInput.tempo,
    key: resolvedInput.key,
    scale: resolvedInput.scale,
    includeMidi: true,
    referencePackWeights: musicBrain.context.jamaicanKnowledge?.referenceFeatures.reduce<Record<string, number>>((weights, reference) => ({ ...weights, [reference.pack]: reference.weight }), {}),
  });
  const { data: request, error: requestError } = await db.from("generation_requests").insert({ user_id: userId, prompt: input.prompt, kind: input.kind, settings: input }).select().single();
  if (requestError) throw requestError;
  const { data: generation, error: generationError } = await db.from("generations").insert({ user_id: userId, request_id: request.id, project_id: input.projectId ?? null, status: "processing" }).select().single();
  if (generationError) throw generationError;
  let usedModel: string | null = null;
  let attemptedModel: string | null = null;
  try {
    const models = [selection.primaryModel, selection.fallbackModel].filter((model, index, values): model is string => Boolean(model) && values.indexOf(model) === index);
    let music;
    let lastError: unknown;
    let qualityFeedback = "";
    for (const model of models) {
      attemptedModel = model;
      for (let attempt = 0; attempt <= env.AI_QUALITY_RETRIES; attempt += 1) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), env.AI_REQUEST_TIMEOUT_MS);
        try {
          const provider = new OpenAiCompatibleProvider(env.AI_PROVIDER_BASE_URL, env.AI_PROVIDER_API_KEY, model);
          const referenceAttachments = referenceBlend.retrieved.map((reference, index) => [
            `REFERENCE ${index + 1} (${index === 0 ? "PRIMARY" : "SECONDARY"}): ${reference.collection}/${reference.fileName}`,
            `metadata: tempo=${reference.tempo}; key=${reference.key ?? "unspecified"}; scale=${reference.scale ?? "unspecified"}; score=${reference.score}; bytes=${reference.byteLength ?? "unknown"}`,
            `conceptual_influence: ${reference.influence}`,
            `note_events_json: ${JSON.stringify(reference.midiEvents)}`,
          ].join("\n")).join("\n\n");
          const correction = qualityFeedback ? `\n\nPrevious draft failed quality control: ${qualityFeedback}\nRewrite the entire composition and return a complete replacement. Do not shorten the form.` : "";
          music = validateStructuredMusicQuality(await provider.compose(buildMusicPrompt(resolvedInput, `${musicBrain.providerPrompt}\n${referencePrompt}\nCurated MIDI reference feature profiles: ${referenceBlend.featureSummary}\n\nREFERENCE-FIRST RULE: use the PRIMARY reference event list as the compositional foundation. Reconstruct its note density, rests, pocket, phrase length, motif repetition, duration distribution, velocity contour, register, and role before applying controlled changes requested by the user. Preserve approximately 95% of its construction quality, but mutate selected pitches, phrase endings, voicings, octaves, durations, and motif responses so the result is new. Do not add notes to increase complexity; if the reference is sparse, remain sparse. Keep the requested musical role. ${referenceAttachments}${correction}`), controller.signal), input.lengthBars, input.kind);
          usedModel = model;
          break;
        } catch (error) {
          lastError = error;
          if (error instanceof Error && /AI_(NOTE_FORM_INCOMPLETE|STRUCTURE_INCOMPLETE)/.test(String((error as Error & { code?: string }).code ?? ""))) {
            qualityFeedback = error.message;
            continue;
          }
          if (error instanceof Error && (error as { retryable?: boolean }).retryable && attempt < env.AI_QUALITY_RETRIES) continue;
          break;
        } finally {
          clearTimeout(timer);
        }
      }
      if (music) break;
    }
    if (!music) throw lastError instanceof Error ? lastError : new Error("AI generation failed.");
    const { error: parametersError } = await db.from("generation_parameters").insert({ generation_id: generation.id, user_id: userId, genre: resolvedInput.genre ?? null, mood: resolvedInput.mood ?? null, musical_key: music.key, scale: music.scale, tempo: music.tempo, time_signature: music.timeSignature.join("/"), length_bars: input.lengthBars, complexity: input.complexity, variation_amount: input.variationAmount, random_seed: input.randomSeed ?? null }); if (parametersError) throw parametersError;
    const requestTitle = titleFromGenerationRequest(input.prompt);
    const namedMusic = { ...music, trackName: requestTitle };
    const file = writeMidi(namedMusic); const fileName = midiFileNameFromRequest(input.prompt); const storagePath = `${userId}/${generation.id}/${fileName}`;
    const { error: storageError } = await db.storage.from("midi-exports").upload(storagePath, file, { contentType: "audio/midi", upsert: false }); if (storageError) throw storageError;
    const { error: fileError } = await db.from("generation_files").insert({ generation_id: generation.id, user_id: userId, storage_path: storagePath, file_name: fileName, mime_type: "audio/midi", file_size_bytes: file.length }); if (fileError) throw fileError;
    await midiAnalysisService.persistAnalysis(file, { generationId: generation.id, projectId: input.projectId ?? null, userId, fileName, genre: input.genre ?? null, mood: input.mood ?? null });
    await recordCreditUsage(userId, creditCost, workflow === "voice_to_midi" ? "voice_to_midi_generation" : "text_to_midi_generation", { generationId: generation.id, workflow, kind: input.kind, projectId: input.projectId ?? null, promptLength: input.prompt.length });
    if (music.pluginRecommendations.length) { const { error: recommendationsError } = await db.from("plugin_recommendations").insert(music.pluginRecommendations.map((recommendation) => ({ generation_id: generation.id, instrument_type: recommendation.instrumentType, preset_type: recommendation.presetType, genre_match: recommendation.genreMatch, mood_match: recommendation.moodMatch, alternative_plugin: recommendation.alternative }))); if (recommendationsError) throw recommendationsError; }
    if (input.projectId) { const { count, error: countError } = await db.from("project_versions").select("id", { count: "exact", head: true }).eq("project_id", input.projectId).eq("user_id", userId); if (countError) throw countError; const { error: versionError } = await db.from("project_versions").insert({ project_id: input.projectId, user_id: userId, version_number: (count ?? 0) + 1, prompt: input.prompt, parameters: input, generation_id: generation.id }); if (versionError) throw versionError; }
    const { error: finishError } = await db.from("generations").update({ status: "completed", model_used: usedModel, used_fallback: usedModel === selection.fallbackModel, completed_at: new Date().toISOString() }).eq("id", generation.id); if (finishError) throw finishError;
    const { data: signed, error: signError } = await db.storage.from("midi-exports").createSignedUrl(storagePath, 900); if (signError) throw signError;
    if (input.projectId) { const { error: assistantMessageError } = await db.from("project_messages").insert({ project_id: input.projectId, user_id: userId, role: "assistant", content: `${fileName} · ${music.key} · ${music.tempo} BPM`, generation_id: generation.id }); if (assistantMessageError) throw assistantMessageError; }
    return { id: generation.id, status: "completed", prompt: input.prompt, genre: resolvedInput.genre ?? null, key: music.key, tempo: music.tempo, fileName, generationTimeMs: Date.now() - new Date(generation.created_at).getTime(), midiFileUrl: signed.signedUrl, chordProgression: music.chordProgression, structure: music.structure, pluginRecommendations: music.pluginRecommendations };
  } catch (error) { await db.from("generations").update({ status: "failed", model_used: usedModel ?? attemptedModel, used_fallback: (usedModel ?? attemptedModel) === selection.fallbackModel, error_message: error instanceof Error ? error.message : "Generation failed" }).eq("id", generation.id); throw error; }
}
export function voiceUploadPath(userId: string, fileName: string) { return `${userId}/${randomUUID()}/${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`; }
