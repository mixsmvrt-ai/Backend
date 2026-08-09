import { randomUUID } from "node:crypto";
import type { OrchestrationInput } from "../domain/music.js";
import { buildMusicPrompt } from "../ai/prompt-builder.js";
import { OpenAiCompatibleProvider } from "../ai/provider.js";
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

function midiFileNameFromTrackName(trackName: string) {
  const cleaned = trackName
    .trim()
    .replace(/[^a-zA-Z0-9\s_-]+/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 64);
  const fallback = cleaned || "midiflow-idea";
  return `${fallback}.mid`;
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
  });
  const { data: request, error: requestError } = await db.from("generation_requests").insert({ user_id: userId, prompt: input.prompt, kind: input.kind, settings: input }).select().single();
  if (requestError) throw requestError;
  const { data: generation, error: generationError } = await db.from("generations").insert({ user_id: userId, request_id: request.id, project_id: input.projectId ?? null, status: "processing" }).select().single();
  if (generationError) throw generationError;
  try {
    const models = [selection.primaryModel, selection.fallbackModel].filter((model, index, values): model is string => Boolean(model) && values.indexOf(model) === index);
    let music;
    let lastError: unknown;
    for (const model of models) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), env.AI_REQUEST_TIMEOUT_MS);
      try {
        const provider = new OpenAiCompatibleProvider(env.AI_PROVIDER_BASE_URL, env.AI_PROVIDER_API_KEY, model);
        music = await provider.compose(buildMusicPrompt(resolvedInput, `${musicBrain.providerPrompt}\n${referencePrompt}\nCurated MIDI reference DNA: ${referenceBlend.featureSummary}`), controller.signal);
        break;
      } catch (error) {
        lastError = error;
      } finally {
        clearTimeout(timer);
      }
    }
    if (!music) throw lastError instanceof Error ? lastError : new Error("AI generation failed.");
    const { error: parametersError } = await db.from("generation_parameters").insert({ generation_id: generation.id, user_id: userId, genre: resolvedInput.genre ?? null, mood: resolvedInput.mood ?? null, musical_key: music.key, scale: music.scale, tempo: music.tempo, time_signature: music.timeSignature.join("/"), length_bars: input.lengthBars, complexity: input.complexity, variation_amount: input.variationAmount, random_seed: input.randomSeed ?? null }); if (parametersError) throw parametersError;
    const file = writeMidi(music); const fileName = midiFileNameFromTrackName(music.trackName); const storagePath = `${userId}/${generation.id}/${fileName}`;
    const { error: storageError } = await db.storage.from("midi-exports").upload(storagePath, file, { contentType: "audio/midi", upsert: false }); if (storageError) throw storageError;
    const { error: fileError } = await db.from("generation_files").insert({ generation_id: generation.id, user_id: userId, storage_path: storagePath, file_name: fileName, mime_type: "audio/midi", file_size_bytes: file.length }); if (fileError) throw fileError;
    await midiAnalysisService.persistAnalysis(file, { generationId: generation.id, projectId: input.projectId ?? null, userId, fileName, genre: input.genre ?? null, mood: input.mood ?? null });
    await recordCreditUsage(userId, creditCost, workflow === "voice_to_midi" ? "voice_to_midi_generation" : "text_to_midi_generation", { generationId: generation.id, workflow, kind: input.kind, projectId: input.projectId ?? null, promptLength: input.prompt.length });
    if (music.pluginRecommendations.length) { const { error: recommendationsError } = await db.from("plugin_recommendations").insert(music.pluginRecommendations.map((recommendation) => ({ generation_id: generation.id, instrument_type: recommendation.instrumentType, preset_type: recommendation.presetType, genre_match: recommendation.genreMatch, mood_match: recommendation.moodMatch, alternative_plugin: recommendation.alternative }))); if (recommendationsError) throw recommendationsError; }
    if (input.projectId) { const { count, error: countError } = await db.from("project_versions").select("id", { count: "exact", head: true }).eq("project_id", input.projectId).eq("user_id", userId); if (countError) throw countError; const { error: versionError } = await db.from("project_versions").insert({ project_id: input.projectId, user_id: userId, version_number: (count ?? 0) + 1, prompt: input.prompt, parameters: input, generation_id: generation.id }); if (versionError) throw versionError; }
    const { error: finishError } = await db.from("generations").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", generation.id); if (finishError) throw finishError;
    const { data: signed, error: signError } = await db.storage.from("midi-exports").createSignedUrl(storagePath, 900); if (signError) throw signError;
    if (input.projectId) { const { error: assistantMessageError } = await db.from("project_messages").insert({ project_id: input.projectId, user_id: userId, role: "assistant", content: `${fileName} · ${music.key} · ${music.tempo} BPM`, generation_id: generation.id }); if (assistantMessageError) throw assistantMessageError; }
    return { id: generation.id, status: "completed", prompt: input.prompt, genre: resolvedInput.genre ?? null, key: music.key, tempo: music.tempo, fileName, generationTimeMs: Date.now() - new Date(generation.created_at).getTime(), midiFileUrl: signed.signedUrl, chordProgression: music.chordProgression, structure: music.structure, pluginRecommendations: music.pluginRecommendations };
  } catch (error) { await db.from("generations").update({ status: "failed", error_message: error instanceof Error ? error.message : "Generation failed" }).eq("id", generation.id); throw error; }
}
export function voiceUploadPath(userId: string, fileName: string) { return `${userId}/${randomUUID()}/${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`; }
