import midiPackage from "@tonejs/midi";
import { randomUUID } from "node:crypto";
import { requireSupabase } from "../config/supabase.js";
import { midiAnalysisService } from "./midiAnalysisService.js";

const { Midi } = midiPackage;

type EnhancementMode = "harder";

type SourceFile = {
  generationId: string;
  projectId: string | null;
  storagePath: string;
  fileName: string;
};

function enhancedFileName(fileName: string) {
  return fileName.replace(/\.mid(i)?$/i, "") + "-harder.mid";
}

export function enhanceMidiBuffer(buffer: Buffer, mode: EnhancementMode = "harder") {
  const midi = new Midi(buffer);
  if (mode !== "harder") return buffer;
  for (const track of midi.tracks) {
    const notes = [...track.notes].sort((left, right) => left.ticks - right.ticks || left.midi - right.midi);
    notes.forEach((note, index) => {
      const accent = index % 4 === 0 || note.ticks % ((midi.header.ppq || 480) * 2) >= (midi.header.ppq || 480);
      note.velocity = Math.min(1, note.velocity + (accent ? 0.08 : 0.02));
      if (index === notes.length - 1) note.velocity = Math.min(1, note.velocity + 0.05);
    });
  }
  return Buffer.from(midi.toArray());
}

async function sourceFile(userId: string, midiId: string): Promise<SourceFile> {
  const db = requireSupabase();
  const byFile = await db.from("generation_files").select("generation_id, storage_path, file_name, generations(project_id)").eq("id", midiId).eq("user_id", userId).maybeSingle();
  const row = byFile.data ?? (await db.from("generation_files").select("generation_id, storage_path, file_name, generations(project_id)").eq("generation_id", midiId).eq("user_id", userId).order("created_at", { ascending: true }).limit(1).maybeSingle()).data;
  if (!row) throw new Error("MIDI source not found.");
  const project = Array.isArray(row.generations) ? row.generations[0] : row.generations;
  return { generationId: String(row.generation_id), projectId: project?.project_id ? String(project.project_id) : null, storagePath: String(row.storage_path), fileName: String(row.file_name) };
}

export async function enhanceGeneration(userId: string, midiId: string, mode: EnhancementMode = "harder") {
  const db = requireSupabase();
  const source = await sourceFile(userId, midiId);
  const { data, error } = await db.storage.from("midi-exports").download(source.storagePath);
  if (error || !data) throw error ?? new Error("Unable to download MIDI source.");
  const enhanced = enhanceMidiBuffer(Buffer.from(await data.arrayBuffer()), mode);
  const generationId = randomUUID();
  const fileName = enhancedFileName(source.fileName);
  const storagePath = `${userId}/${generationId}/${fileName}`;
  const { error: uploadError } = await db.storage.from("midi-exports").upload(storagePath, enhanced, { contentType: "audio/midi", upsert: false });
  if (uploadError) throw uploadError;
  const { error: generationError } = await db.from("generations").insert({ id: generationId, user_id: userId, project_id: source.projectId, status: "completed", completed_at: new Date().toISOString() });
  if (generationError) throw generationError;
  const { error: fileError } = await db.from("generation_files").insert({ generation_id: generationId, user_id: userId, storage_path: storagePath, file_name: fileName, mime_type: "audio/midi", file_size_bytes: enhanced.length });
  if (fileError) throw fileError;
  await midiAnalysisService.persistAnalysis(enhanced, { generationId, projectId: source.projectId, userId, fileName });
  if (source.projectId) {
    const { count, error: countError } = await db.from("project_versions").select("id", { count: "exact", head: true }).eq("project_id", source.projectId).eq("user_id", userId);
    if (countError) throw countError;
    const { error: versionError } = await db.from("project_versions").insert({ project_id: source.projectId, user_id: userId, version_number: (count ?? 0) + 1, prompt: `Make it harder: ${source.fileName}`, parameters: { mode, sourceGenerationId: source.generationId }, generation_id: generationId });
    if (versionError) throw versionError;
  }
  const { data: signed, error: signError } = await db.storage.from("midi-exports").createSignedUrl(storagePath, 900);
  if (signError) throw signError;
  return { id: generationId, status: "completed", fileName, midiFileUrl: signed.signedUrl, sourceGenerationId: source.generationId };
}
