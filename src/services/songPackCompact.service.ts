import { z } from "zod";
import { buildZipArchive } from "./midiGeneration/archive.js";
import { compactAiOrchestratorService, type CompactMusicPlan } from "./aiOrchestrator/index.js";
import { requireSupabase } from "../config/supabase.js";
import { assertCreditsAvailable, monthlyCreditSummary, recordCreditUsage } from "./credit.service.js";
import { membershipFor } from "./membership.service.js";
import { renderCompactPlan } from "./midiEngine.js";

const songPackPartKeys = [
  "main_melody",
  "counter_melody",
  "chord_progression",
  "bassline",
  "lead",
  "pluck",
  "bell_layer",
  "strings",
  "pads",
  "brass",
  "synth_layer",
  "arpeggio",
  "guitar",
  "piano_layer",
  "choir_layer",
  "top_melody",
  "harmony_layer",
  "drum_guide",
] as const;

export type SongPackPartKey = (typeof songPackPartKeys)[number];

export const songPackCreateSchema = z.object({
  prompt: z.string().trim().min(8).max(1200),
  genre: z.string().trim().max(120).optional(),
  mood: z.string().trim().max(120).optional(),
  tempo: z.number().int().min(40).max(240).optional(),
  key: z.string().trim().max(16).optional(),
  scale: z.string().trim().max(40).optional(),
  energy: z.enum(["auto", "low", "medium", "high"]).default("auto"),
  complexity: z.enum(["auto", "low", "medium", "high"]).default("auto"),
  swing: z.number().min(0).max(0.75).optional(),
  humanization: z.number().min(0).max(1).optional(),
  lengthBars: z.number().int().min(4).max(128).default(8),
  selectedParts: z.array(z.enum(songPackPartKeys)).min(1).max(songPackPartKeys.length),
  projectId: z.string().uuid().optional(),
});

export const songPackRegeneratePartSchema = z.object({
  promptOverride: z.string().trim().min(3).max(1200).optional(),
});

type SongPackCreateInput = z.infer<typeof songPackCreateSchema>;

type SongPackConfig = {
  enabled: boolean;
  defaultCredits: number;
  costs: { single: number; small: number; medium: number; large: number; regeneratePart: number };
};

type PartDefinition = {
  key: SongPackPartKey;
  label: string;
  role: string;
  instrument: string;
  instruction: string;
};

const PART_DEFINITIONS: Record<SongPackPartKey, PartDefinition> = {
  main_melody: { key: "main_melody", label: "Main Melody", role: "melody", instrument: "Piano", instruction: "Generate the core melodic idea." },
  counter_melody: { key: "counter_melody", label: "Counter Melody", role: "counter_melody", instrument: "Pluck", instruction: "Generate a complementary counter melody." },
  chord_progression: { key: "chord_progression", label: "Chord Progression", role: "chords", instrument: "Keys", instruction: "Generate the harmonic progression." },
  bassline: { key: "bassline", label: "Bassline", role: "bassline", instrument: "Bass", instruction: "Generate the foundational bassline." },
  lead: { key: "lead", label: "Lead", role: "melody", instrument: "Lead", instruction: "Generate a lead line layer." },
  pluck: { key: "pluck", label: "Pluck", role: "melody", instrument: "Pluck", instruction: "Generate a pluck layer." },
  bell_layer: { key: "bell_layer", label: "Bell Layer", role: "melody", instrument: "Bell", instruction: "Generate a bell layer." },
  strings: { key: "strings", label: "Strings", role: "chords", instrument: "Strings", instruction: "Generate a supportive strings layer." },
  pads: { key: "pads", label: "Pads", role: "chords", instrument: "Pad", instruction: "Generate a pad layer." },
  brass: { key: "brass", label: "Brass", role: "chords", instrument: "Brass", instruction: "Generate a brass layer." },
  synth_layer: { key: "synth_layer", label: "Synth Layer", role: "counter_melody", instrument: "Synth", instruction: "Generate a synth support layer." },
  arpeggio: { key: "arpeggio", label: "Arpeggio", role: "melody", instrument: "Arpeggio", instruction: "Generate an arpeggiated layer." },
  guitar: { key: "guitar", label: "Guitar", role: "chords", instrument: "Guitar", instruction: "Generate a guitar layer." },
  piano_layer: { key: "piano_layer", label: "Piano Layer", role: "melody", instrument: "Piano", instruction: "Generate a piano layer." },
  choir_layer: { key: "choir_layer", label: "Choir Layer", role: "chords", instrument: "Choir", instruction: "Generate a choir support layer." },
  top_melody: { key: "top_melody", label: "Top Melody", role: "melody", instrument: "Lead", instruction: "Generate a top-line melody." },
  harmony_layer: { key: "harmony_layer", label: "Harmony Layer", role: "chords", instrument: "Harmony", instruction: "Generate a harmonic support layer." },
  drum_guide: { key: "drum_guide", label: "Optional Drum Guide MIDI", role: "drums", instrument: "Drums", instruction: "Generate a drum guide MIDI layer." },
};

const SONG_PACK_CREDIT_COST = 75;

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9._ -]/g, "").trim().replace(/\s+/g, " ") || "Song Pack";
}

function slugName(value: string) {
  return safeName(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "song-pack";
}

function projectTitleFromPrompt(prompt: string) {
  const clean = prompt.trim().replace(/\s+/g, " ");
  return clean.length <= 70 ? clean : `${clean.slice(0, 67).trim()}...`;
}

function defaultConfig(): SongPackConfig {
  return { enabled: true, defaultCredits: 1500, costs: { single: SONG_PACK_CREDIT_COST, small: SONG_PACK_CREDIT_COST, medium: SONG_PACK_CREDIT_COST, large: SONG_PACK_CREDIT_COST, regeneratePart: SONG_PACK_CREDIT_COST } };
}

async function loadConfig() {
  const db = requireSupabase();
  const base = defaultConfig();
  const { data, error } = await db.from("system_settings").select("value").eq("key", "song_pack_generator_config").maybeSingle();
  if (error || !data?.value) return base;
  const value = data.value as Record<string, unknown>;
  const costs = (value.costs ?? {}) as Record<string, unknown>;
  return {
    enabled: typeof value.enabled === "boolean" ? value.enabled : base.enabled,
    defaultCredits: base.defaultCredits,
    costs: {
      single: typeof costs.single === "number" ? costs.single : base.costs.single,
      small: typeof costs.small === "number" ? costs.small : base.costs.small,
      medium: typeof costs.medium === "number" ? costs.medium : base.costs.medium,
      large: typeof costs.large === "number" ? costs.large : base.costs.large,
      regeneratePart: typeof costs.regeneratePart === "number" ? costs.regeneratePart : base.costs.regeneratePart,
    },
  };
}

function creditsForPartCount(count: number, config: SongPackConfig) {
  if (count <= 1) return config.costs.single;
  if (count <= 3) return config.costs.small;
  if (count <= 6) return config.costs.medium;
  return config.costs.large;
}

async function requirePackAccess(userId: string) {
  const config = await loadConfig();
  if (!config.enabled) {
    const error = new Error("Song Pack Generator is disabled.");
    Object.assign(error, { statusCode: 403 });
    throw error;
  }
  const membership = await membershipFor(userId);
  if (!membership.active) {
    const error = new Error("Active Pro access is required for Song Pack Generator.");
    Object.assign(error, { statusCode: 403, code: "MEMBERSHIP_EXPIRED", redirectTo: "/upgrade" });
    throw error;
  }
  return { membership, config };
}

async function createOrLoadProject(userId: string, input: SongPackCreateInput) {
  if (input.projectId) return input.projectId;
  const db = requireSupabase();
  const { data, error } = await db.from("projects").insert({ user_id: userId, title: projectTitleFromPrompt(input.prompt), description: `Song pack: ${input.prompt}`, genre: input.genre ?? null, bpm: input.tempo ?? null, musical_key: input.key ?? null }).select().single();
  if (error || !data) throw error ?? new Error("Unable to create project.");
  const { error: tagError } = await db.from("project_tags").insert([{ project_id: data.id, user_id: userId, tag: "song-pack" }]);
  if (tagError) throw tagError;
  return String(data.id);
}

function requestedTracks(selectedParts: SongPackPartKey[]) {
  return selectedParts.map((key) => {
    const definition = PART_DEFINITIONS[key];
    return { name: definition.label, role: definition.role, instrument: definition.instrument, instruction: definition.instruction };
  });
}

async function signStoragePath(storagePath: string, fileName: string) {
  const { data, error } = await requireSupabase().storage.from("midi-exports").createSignedUrl(storagePath, 900, { download: fileName });
  if (error || !data) throw error ?? new Error("Unable to sign file download.");
  return data.signedUrl;
}

function normalizeSummary(plan: CompactMusicPlan, track: CompactMusicPlan["tracks"][number]) {
  const notes = track.notes.slice(0, 64).map((note) => ({ pitch: note.p, startBeat: note.s, durationBeats: note.d, velocity: note.v }));
  return {
    noteCount: track.notes.length,
    minPitch: track.notes.reduce((min, note) => Math.min(min, note.p), track.notes[0]?.p ?? 0),
    maxPitch: track.notes.reduce((max, note) => Math.max(max, note.p), track.notes[0]?.p ?? 0),
    tempo: plan.tempo,
    key: plan.key,
    scale: plan.scale,
    previewNotes: notes,
  };
}

async function persistRenderedSongPack(userId: string, packId: string, projectId: string, title: string, prompt: string, selectedParts: SongPackPartKey[], plan: CompactMusicPlan) {
  const db = requireSupabase();
  const rendered = renderCompactPlan(plan, slugName(title));
  const filesForArchive = [] as Array<{ fileName: string; buffer: Buffer }>;
  const partResults = [] as Array<{ id: string; key: SongPackPartKey; label: string; generationId: string; fileName: string; url: string; summary: { noteCount: number; minPitch: number; maxPitch: number; tempo: number; key: string; scale: string }; previewNotes: Array<{ pitch: number; startBeat: number; durationBeats: number; velocity: number }> }>;

  for (let index = 0; index < selectedParts.length; index += 1) {
    const partKey = selectedParts[index];
    const definition = PART_DEFINITIONS[partKey];
    const trackPlan = plan.tracks[index];
    const trackFile = rendered.perTrack[index];
    if (!trackPlan || !trackFile) {
      throw new Error(`Song pack plan did not return the requested track: ${definition.label}`);
    }
    const storagePath = `${userId}/song-packs/${packId}/${trackFile.fileName}`;
    const { error: uploadError } = await db.storage.from("midi-exports").upload(storagePath, trackFile.buffer, { contentType: trackFile.mimeType, upsert: true });
    if (uploadError) throw uploadError;
    const summary = normalizeSummary(plan, trackPlan);
    const generationId = `song-pack-${packId}-${definition.key}`;
    const { data: partRow, error: partError } = await db.from("song_pack_parts").upsert({
      song_pack_id: packId,
      user_id: userId,
      project_id: projectId,
      generation_id: null,
      part_key: definition.key,
      label: definition.label,
      kind: definition.role,
      prompt,
      status: "completed",
      file_name: trackFile.fileName,
      storage_path: storagePath,
      preview_notes: summary.previewNotes,
      summary: { noteCount: summary.noteCount, minPitch: summary.minPitch, maxPitch: summary.maxPitch, tempo: summary.tempo, key: summary.key, scale: summary.scale },
      updated_at: new Date().toISOString(),
    }, { onConflict: "song_pack_id,part_key" }).select().single();
    if (partError || !partRow) throw partError ?? new Error("Unable to persist song pack part.");
    await db.from("downloads").upsert({ user_id: userId, project_id: projectId, file_name: trackFile.fileName, storage_path: storagePath, file_size_bytes: trackFile.buffer.length, song_pack_id: packId, song_pack_part_id: partRow.id, metadata: { kind: "song-pack-part", partKey: definition.key, label: definition.label } }, { onConflict: "id" as never });
    filesForArchive.push({ fileName: trackFile.fileName, buffer: trackFile.buffer });
    partResults.push({ id: String(partRow.id), key: definition.key, label: definition.label, generationId, fileName: trackFile.fileName, url: await signStoragePath(storagePath, trackFile.fileName), summary: { noteCount: summary.noteCount, minPitch: summary.minPitch, maxPitch: summary.maxPitch, tempo: summary.tempo, key: summary.key, scale: summary.scale }, previewNotes: summary.previewNotes });
  }

  filesForArchive.push({ fileName: "Metadata.json", buffer: Buffer.from(JSON.stringify({ title, prompt, tempo: plan.tempo, key: plan.key, scale: plan.scale, bars: plan.bars, tracks: partResults.map((part) => ({ key: part.key, label: part.label, fileName: part.fileName })) }, null, 2), "utf8") });
  const archiveBuffer = buildZipArchive(filesForArchive);
  const packFileName = `${slugName(title)}.zip`;
  const packStoragePath = `${userId}/song-packs/${packId}/${packFileName}`;
  const { error: archiveUploadError } = await db.storage.from("midi-exports").upload(packStoragePath, archiveBuffer, { contentType: "application/zip", upsert: true });
  if (archiveUploadError) throw archiveUploadError;
  await db.from("song_packs").update({ pack_file_name: packFileName, pack_storage_path: packStoragePath, plan_json: plan, updated_at: new Date().toISOString() }).eq("id", packId).eq("user_id", userId);
  const { data: existingArchive } = await db.from("downloads").select("id").eq("song_pack_id", packId).eq("user_id", userId).is("song_pack_part_id", null).maybeSingle();
  if (existingArchive?.id) {
    await db.from("downloads").update({ file_name: packFileName, storage_path: packStoragePath, file_size_bytes: archiveBuffer.length, metadata: { kind: "song-pack", includedParts: partResults.map((part) => part.label) } }).eq("id", existingArchive.id).eq("user_id", userId);
  } else {
    await db.from("downloads").insert({ user_id: userId, project_id: projectId, file_name: packFileName, storage_path: packStoragePath, file_size_bytes: archiveBuffer.length, song_pack_id: packId, metadata: { kind: "song-pack", includedParts: partResults.map((part) => part.label) } });
  }
  await db.from("project_messages").insert([
    { project_id: projectId, user_id: userId, role: "user", content: prompt },
    { project_id: projectId, user_id: userId, role: "assistant", content: `Generated song pack ${title} with ${partResults.length} parts in ${plan.key} at ${plan.tempo} BPM.` },
  ]);
  const { count } = await db.from("project_versions").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("user_id", userId);
  await db.from("project_versions").insert({ project_id: projectId, user_id: userId, version_number: (count ?? 0) + 1, prompt, parameters: { workflow: "song_pack", selectedParts, lengthBars: 8 }, generation_id: null });
  return { parts: partResults, download: { fileName: packFileName, storagePath: packStoragePath, url: await signStoragePath(packStoragePath, packFileName), includedParts: partResults.map((part) => part.label) } };
}

function inputFromPack(pack: Record<string, unknown>) {
  return {
    prompt: String(pack.prompt),
    genre: typeof pack.genre === "string" ? pack.genre : undefined,
    mood: typeof pack.mood === "string" ? pack.mood : undefined,
    tempo: typeof pack.tempo === "number" ? pack.tempo : undefined,
    key: typeof pack.musical_key === "string" ? pack.musical_key : undefined,
    scale: typeof pack.scale === "string" ? pack.scale : undefined,
    energy: (typeof pack.energy === "string" ? pack.energy : "auto") as SongPackCreateInput["energy"],
    complexity: (typeof pack.complexity === "string" ? pack.complexity : "auto") as SongPackCreateInput["complexity"],
    swing: typeof pack.swing === "number" ? pack.swing : undefined,
    humanization: typeof pack.humanization === "number" ? pack.humanization : undefined,
    lengthBars: 8,
    selectedParts: (Array.isArray(pack.selected_parts) ? pack.selected_parts : []) as SongPackPartKey[],
    projectId: String(pack.project_id),
  } satisfies SongPackCreateInput;
}

export async function songPackCredits(userId: string) {
  const { config } = await requirePackAccess(userId);
  const summary = await monthlyCreditSummary(userId);
  return { balance: summary.balance, monthlyAllocation: summary.monthlyAllocation, used: summary.used, usagePercent: summary.usagePercent, resetsOn: summary.resetsOn, config: { ...config, defaultCredits: summary.monthlyAllocation } };
}

export async function listSongPacks(userId: string) {
  const { config } = await requirePackAccess(userId);
  await monthlyCreditSummary(userId);
  const { data, error } = await requireSupabase().from("song_packs").select("*, song_pack_parts(id, part_key, label, status, file_name, preview_notes, summary), projects(title)").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function readSongPack(userId: string, packId: string) {
  const db = requireSupabase();
  const { data, error } = await db.from("song_packs").select("*, song_pack_parts(id, part_key, label, status, file_name, storage_path, preview_notes, summary), projects(title)").eq("id", packId).eq("user_id", userId).single();
  if (error || !data) throw error ?? new Error("Song pack not found.");
  const { config } = await requirePackAccess(userId);
  const summary = await monthlyCreditSummary(userId);
  const downloadUrl = data.pack_storage_path && data.pack_file_name ? await signStoragePath(data.pack_storage_path, data.pack_file_name) : null;
  const song_pack_parts = await Promise.all(((data.song_pack_parts ?? []) as Array<{ file_name?: string | null; storage_path?: string | null }>).map(async (part) => ({ ...part, url: part.file_name && part.storage_path ? await signStoragePath(part.storage_path, part.file_name) : null })));
  return { data: { ...data, song_pack_parts, downloadUrl, creditsRemaining: summary.balance, config: { ...config, defaultCredits: summary.monthlyAllocation } } };
}

export async function generateSongPack(userId: string, input: SongPackCreateInput) {
  const db = requireSupabase();
  const { config } = await requirePackAccess(userId);
  const cost = creditsForPartCount(input.selectedParts.length, config);
  const summary = await assertCreditsAvailable(userId, cost);
  const balance = summary.balance;
  const projectId = await createOrLoadProject(userId, input);
  const title = `${safeName(projectTitleFromPrompt(input.prompt))} Pack`;
  const { data: pack, error: packError } = await db.from("song_packs").insert({ user_id: userId, project_id: projectId, prompt: input.prompt, title, genre: input.genre ?? null, mood: input.mood ?? null, tempo: input.tempo ?? null, musical_key: input.key ?? null, scale: input.scale ?? null, energy: input.energy === "auto" ? null : input.energy, complexity: input.complexity === "auto" ? null : input.complexity, swing: input.swing ?? null, humanization: input.humanization ?? null, length_bars: 8, selected_parts: input.selectedParts, credits_used: cost, status: "processing" }).select().single();
  if (packError || !pack) throw packError ?? new Error("Unable to create song pack.");
  const startedAt = Date.now();
  try {
    const planner = await compactAiOrchestratorService.plan(userId, {
      prompt: input.prompt,
      kind: "full_composition",
      genre: input.genre,
      mood: input.mood,
      tempo: input.tempo,
      key: input.key,
      scale: input.scale,
      projectId,
      lengthBars: 8,
      complexity: input.complexity === "auto" ? "medium" : input.complexity,
      variationAmount: 0.35,
      timeSignature: [4, 4],
      pluginSuggestions: true,
      workflow: "song_pack",
      requestedTracks: requestedTracks(input.selectedParts),
      forceRefresh: false,
    });
    const { parts, download } = await persistRenderedSongPack(userId, String(pack.id), projectId, title, input.prompt, input.selectedParts, planner.plan);
    const { data: tracking, error: trackingError } = await db.from("song_pack_generations").insert({ song_pack_id: pack.id, user_id: userId, project_id: projectId, generation_id: null, action: "pack_generation", credits_used: cost, status: "completed", duration_ms: planner.responseTimeMs }).select().single();
    if (trackingError || !tracking) throw trackingError ?? new Error("Unable to create song pack generation tracking.");
    await recordCreditUsage(userId, cost, "song_pack_generation", { partCount: input.selectedParts.length, selectedParts: input.selectedParts, totalTokens: planner.usage.totalTokens }, { songPackId: String(pack.id), songPackGenerationId: String(tracking.id) });
    await db.from("song_packs").update({ status: "completed", summary: planner.plan.summary, generation_time_ms: Date.now() - startedAt, plan_json: planner.plan, updated_at: new Date().toISOString() }).eq("id", pack.id).eq("user_id", userId);
    return { id: String(pack.id), projectId, title, status: "completed", summary: planner.plan.summary, genre: planner.plan.genre, mood: planner.plan.mood, tempo: planner.plan.tempo, key: planner.plan.key, scale: planner.plan.scale, creditsUsed: cost, creditsRemaining: balance - cost, download, parts };
  } catch (error) {
    await db.from("song_packs").update({ status: "failed", summary: error instanceof Error ? error.message : "Song pack generation failed", updated_at: new Date().toISOString() }).eq("id", pack.id).eq("user_id", userId);
    throw error;
  }
}

export async function regenerateSongPackPart(userId: string, packId: string, partId: string, promptOverride?: string) {
  const db = requireSupabase();
  const { config } = await requirePackAccess(userId);
  const summary = await assertCreditsAvailable(userId, config.costs.regeneratePart);
  const balance = summary.balance;
  const { data: pack, error: packError } = await db.from("song_packs").select("*").eq("id", packId).eq("user_id", userId).single();
  if (packError || !pack) throw packError ?? new Error("Song pack not found.");
  const { data: part, error: partError } = await db.from("song_pack_parts").select("*").eq("id", partId).eq("song_pack_id", packId).eq("user_id", userId).single();
  if (partError || !part) throw partError ?? new Error("Song pack part not found.");
  const definition = PART_DEFINITIONS[part.part_key as SongPackPartKey];
  const sourcePlan = pack.plan_json as CompactMusicPlan;
  const baseInput = inputFromPack(pack as Record<string, unknown>);
  const planner = await compactAiOrchestratorService.plan(userId, { prompt: promptOverride?.trim() || `${baseInput.prompt}\n\nKeep tempo ${sourcePlan.tempo}, key ${sourcePlan.key}, scale ${sourcePlan.scale}, and preserve compatibility with the existing song pack. Regenerate only the ${definition.label}.`, kind: definition.role === "bassline" ? "bassline" : definition.role === "chords" ? "chords" : definition.role === "drums" ? "drums" : definition.role === "counter_melody" ? "counter_melody" : "melody", genre: baseInput.genre, mood: baseInput.mood, tempo: sourcePlan.tempo, key: sourcePlan.key, scale: sourcePlan.scale, projectId: baseInput.projectId, lengthBars: 8, complexity: baseInput.complexity === "auto" ? "medium" : baseInput.complexity, variationAmount: 0.35, timeSignature: sourcePlan.timeSignature, pluginSuggestions: true, workflow: "song_pack", requestedTracks: requestedTracks([definition.key]), forceRefresh: true });
  const nextPlan: CompactMusicPlan = { ...sourcePlan, tracks: sourcePlan.tracks.map((track, index) => index === baseInput.selectedParts.indexOf(definition.key) ? planner.plan.tracks[0] : track), summary: planner.plan.summary || sourcePlan.summary };
  const { parts, download } = await persistRenderedSongPack(userId, packId, String(pack.project_id), String(pack.title), promptOverride?.trim() || baseInput.prompt, baseInput.selectedParts, nextPlan);
  const regenerated = parts.find((entry) => entry.key === definition.key);
  const { data: tracking, error: trackingError } = await db.from("song_pack_generations").insert({ song_pack_id: packId, song_pack_part_id: partId, user_id: userId, project_id: pack.project_id, generation_id: null, action: "part_regeneration", credits_used: config.costs.regeneratePart, status: "completed", duration_ms: planner.responseTimeMs }).select().single();
  if (trackingError || !tracking) throw trackingError ?? new Error("Unable to track regenerated part.");
  await recordCreditUsage(userId, config.costs.regeneratePart, "song_pack_part_regeneration", { partKey: definition.key, totalTokens: planner.usage.totalTokens }, { songPackId: packId, songPackGenerationId: String(tracking.id) });
  await db.from("song_packs").update({ plan_json: nextPlan, updated_at: new Date().toISOString() }).eq("id", packId).eq("user_id", userId);
  if (!regenerated) throw new Error("Regenerated part was not found in the rendered song pack.");
  return { part: regenerated, download, creditsRemaining: balance - config.costs.regeneratePart };
}

export async function regenerateEntireSongPack(userId: string, packId: string) {
  const db = requireSupabase();
  const { data: pack, error: packError } = await db.from("song_packs").select("*").eq("id", packId).eq("user_id", userId).single();
  if (packError || !pack) throw packError ?? new Error("Song pack not found.");
  const input = inputFromPack(pack as Record<string, unknown>);
  const { config } = await requirePackAccess(userId);
  const cost = creditsForPartCount(input.selectedParts.length, config);
  const summary = await assertCreditsAvailable(userId, cost);
  const balance = summary.balance;
  const planner = await compactAiOrchestratorService.plan(userId, { prompt: input.prompt, kind: "full_composition", genre: input.genre, mood: input.mood, tempo: input.tempo, key: input.key, scale: input.scale, projectId: input.projectId, lengthBars: 8, complexity: input.complexity === "auto" ? "medium" : input.complexity, variationAmount: 0.35, timeSignature: [4, 4], pluginSuggestions: true, workflow: "song_pack", requestedTracks: requestedTracks(input.selectedParts), forceRefresh: true });
  const { parts, download } = await persistRenderedSongPack(userId, packId, String(pack.project_id), String(pack.title), input.prompt, input.selectedParts, planner.plan);
  const { data: tracking, error: trackingError } = await db.from("song_pack_generations").insert({ song_pack_id: packId, user_id: userId, project_id: pack.project_id, generation_id: null, action: "pack_regeneration", credits_used: cost, status: "completed", duration_ms: planner.responseTimeMs }).select().single();
  if (trackingError || !tracking) throw trackingError ?? new Error("Unable to track regenerated song pack.");
  await recordCreditUsage(userId, cost, "song_pack_regeneration", { partCount: input.selectedParts.length, totalTokens: planner.usage.totalTokens }, { songPackId: packId, songPackGenerationId: String(tracking.id) });
  await db.from("song_packs").update({ plan_json: planner.plan, status: "completed", summary: planner.plan.summary, updated_at: new Date().toISOString() }).eq("id", packId).eq("user_id", userId);
  return { parts, download, creditsRemaining: balance - cost };
}

export async function songPackAdminOverview() {
  const db = requireSupabase();
  const [packs, transactions, genres, parts] = await Promise.all([
    db.from("song_packs").select("id, genre", { count: "exact", head: false }).order("created_at", { ascending: false }).limit(500),
    db.from("credit_transactions").select("amount, transaction_type"),
    db.from("song_packs").select("genre"),
    db.from("song_pack_parts").select("part_key"),
  ]);
  [packs, transactions, genres, parts].forEach(({ error }) => { if (error) throw error; });
  const creditsUsed = (transactions.data ?? []).filter((row) => row.transaction_type === "usage").reduce((sum, row) => sum + Math.abs(Number(row.amount ?? 0)), 0);
  const genreCounts = new Map<string, number>();
  for (const row of genres.data ?? []) {
    const key = row.genre ?? "Unspecified";
    genreCounts.set(key, (genreCounts.get(key) ?? 0) + 1);
  }
  const partCounts = new Map<string, number>();
  for (const row of parts.data ?? []) {
    partCounts.set(row.part_key, (partCounts.get(row.part_key) ?? 0) + 1);
  }
  return {
    totalSongPacks: packs.count ?? (packs.data ?? []).length,
    creditsUsed,
    topGenres: [...genreCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([genre, count]) => ({ genre, count })),
    topParts: [...partCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([part, count]) => ({ part, count })),
  };
}