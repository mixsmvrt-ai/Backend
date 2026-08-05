import MidiPackage from "@tonejs/midi";
import { requireSupabase } from "../config/supabase.js";

const { Midi } = MidiPackage;

export interface MidiAnalysisSummary {
  tempo: number;
  timeSignature: string;
  key: string;
  scale: string;
  pitchRange: { min: number; max: number };
  noteCount: number;
  noteDensity: number;
  rhythmicDensity: number;
  averageNoteLength: number;
  velocityRange: { min: number; max: number };
  repetitionLevel: number;
  melodyContour: string;
  emotionalProfile: string;
  energyLevel: string;
  complexity: string;
  registerFocus: string;
  summary: {
    uniquePitchClasses: number;
    averageInterval: number;
    pitchCenter: number;
    pitchSpread: number;
    barEstimate: number;
  };
}

interface PersistInput {
  generationId: string;
  projectId: string | null;
  userId: string;
  fileName: string;
  genre?: string | null;
  mood?: string | null;
}

type AnalysisRow = {
  generation_id: string;
  project_id: string | null;
  source_file_name: string;
  tempo: number;
  time_signature: string;
  musical_key: string;
  scale: string;
  pitch_range: { min: number; max: number };
  note_count: number;
  note_density: number;
  rhythmic_density: number;
  average_note_length: number;
  velocity_range: { min: number; max: number };
  repetition_level: number;
  melody_contour: string;
  emotional_profile: string;
  energy_level: string;
  complexity: string;
  register_focus: string;
  summary: MidiAnalysisSummary["summary"];
};

type GenerationAnalysisBackfillRow = {
  id: string;
  project_id: string | null;
  generation_requests: Array<{ prompt: string; kind: string; settings: { genre?: string; mood?: string } | null }> | null;
  generation_files: Array<{ file_name: string; storage_path: string }> | null;
};

const MAJOR_PROFILE = new Set([0, 2, 4, 5, 7, 9, 11]);
const MINOR_PROFILE = new Set([0, 2, 3, 5, 7, 8, 10]);
const PHRYGIAN_PROFILE = new Set([0, 1, 3, 5, 7, 8, 10]);
const PITCH_CLASS_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function detectKey(pitchClasses: number[]) {
  const counts = new Array<number>(12).fill(0);
  for (const pitch of pitchClasses) counts[pitch % 12] += 1;

  const scoreScale = (profile: Set<number>, root: number) => counts.reduce((score, count, pitchClass) => score + (profile.has((pitchClass - root + 12) % 12) ? count : 0), 0);

  let best = { root: 0, scale: "Major", score: -1 };
  for (let root = 0; root < 12; root += 1) {
    for (const candidate of [
      { name: "Major", profile: MAJOR_PROFILE },
      { name: "Minor", profile: MINOR_PROFILE },
      { name: "Phrygian", profile: PHRYGIAN_PROFILE },
    ]) {
      const score = scoreScale(candidate.profile, root);
      if (score > best.score) best = { root, scale: candidate.name, score };
    }
  }

  return { key: PITCH_CLASS_NAMES[best.root] ?? "C", scale: best.scale };
}

function classifyContour(firstPitch: number, lastPitch: number, peak: number, valley: number) {
  const delta = lastPitch - firstPitch;
  if (Math.abs(delta) <= 2 && peak - valley <= 7) return "mostly static";
  if (delta >= 5) return "rising";
  if (delta <= -5) return "falling";
  if (peak - valley >= 12) return "arched";
  return "wavelike";
}

function classifyRegister(center: number) {
  if (center < 52) return "low";
  if (center < 72) return "mid";
  return "high";
}

function classifyEmotion(scale: string, register: string, averageLength: number, repetition: number) {
  if (scale === "Phrygian") return "tense and moody";
  if (scale === "Minor" && register === "mid" && averageLength >= 0.5) return "dark and emotional";
  if (scale === "Minor") return "melancholic";
  if (repetition > 0.55) return "catchy and direct";
  return "uplifting";
}

function classifyEnergy(noteDensity: number, rhythmicDensity: number, averageLength: number, velocitySpread: number) {
  const score = noteDensity * 0.5 + rhythmicDensity * 0.35 + velocitySpread * 0.015 - averageLength * 0.2;
  if (score >= 5.5) return "high";
  if (score >= 3.3) return "medium";
  return "low";
}

function classifyComplexity(uniquePitchClasses: number, noteDensity: number, averageInterval: number, repetition: number) {
  const score = uniquePitchClasses * 0.35 + noteDensity * 0.4 + averageInterval * 0.1 + (1 - repetition) * 4;
  if (score >= 8) return "high";
  if (score >= 5) return "medium";
  return "low";
}

function buildSummary(buffer: Buffer) {
  const midi = new Midi(buffer);
  const notes = midi.tracks.flatMap((track) => track.notes).sort((left, right) => left.ticks - right.ticks);
  if (!notes.length) throw new Error("Generated MIDI does not contain note data.");

  const pitchValues = notes.map((note) => note.midi);
  const pitchClasses = pitchValues.map((pitch) => pitch % 12);
  const uniquePitchClasses = new Set(pitchClasses).size;
  const firstPitch = pitchValues[0] ?? 60;
  const lastPitch = pitchValues.at(-1) ?? firstPitch;
  const peak = Math.max(...pitchValues);
  const valley = Math.min(...pitchValues);
  const pitchCenter = pitchValues.reduce((sum, value) => sum + value, 0) / pitchValues.length;
  const pitchSpread = peak - valley;
  const totalBeats = Math.max(...notes.map((note) => note.ticks + note.durationTicks)) / (midi.header.ppq || 480);
  const uniqueOnsets = new Set(notes.map((note) => round(note.ticks / (midi.header.ppq || 480) * 4) / 4)).size;
  const velocityMin = Math.min(...notes.map((note) => Math.round(note.velocity * 127)));
  const velocityMax = Math.max(...notes.map((note) => Math.round(note.velocity * 127)));
  const averageNoteLength = notes.reduce((sum, note) => sum + note.duration, 0) / notes.length;
  const repeatedNotes = notes.slice(1).filter((note, index) => note.midi === notes[index].midi).length;
  const repetitionLevel = notes.length > 1 ? repeatedNotes / (notes.length - 1) : 0;
  const intervals = notes.slice(1).map((note, index) => Math.abs(note.midi - notes[index].midi));
  const averageInterval = intervals.length ? intervals.reduce((sum, value) => sum + value, 0) / intervals.length : 0;
  const { key, scale } = detectKey(pitchClasses);
  const registerFocus = classifyRegister(pitchCenter);
  const noteDensity = notes.length / Math.max(totalBeats, 1);
  const rhythmicDensity = uniqueOnsets / Math.max(totalBeats, 1);
  const melodyContour = classifyContour(firstPitch, lastPitch, peak, valley);
  const emotionalProfile = classifyEmotion(scale, registerFocus, averageNoteLength, repetitionLevel);
  const energyLevel = classifyEnergy(noteDensity, rhythmicDensity, averageNoteLength, velocityMax - velocityMin);
  const complexity = classifyComplexity(uniquePitchClasses, noteDensity, averageInterval, repetitionLevel);
  const tempo = Math.round(midi.header.tempos[0]?.bpm ?? 120);
  const timeSignatureEvent = midi.header.timeSignatures[0];
  const timeSignature = timeSignatureEvent ? `${timeSignatureEvent.timeSignature[0]}/${timeSignatureEvent.timeSignature[1]}` : "4/4";
  const barEstimate = Math.max(1, Math.ceil(totalBeats / 4));

  return {
    tempo,
    timeSignature,
    key,
    scale,
    pitchRange: { min: valley, max: peak },
    noteCount: notes.length,
    noteDensity: round(noteDensity),
    rhythmicDensity: round(rhythmicDensity),
    averageNoteLength: round(averageNoteLength),
    velocityRange: { min: velocityMin, max: velocityMax },
    repetitionLevel: round(repetitionLevel),
    melodyContour,
    emotionalProfile,
    energyLevel,
    complexity,
    registerFocus,
    summary: {
      uniquePitchClasses,
      averageInterval: round(averageInterval),
      pitchCenter: round(pitchCenter),
      pitchSpread,
      barEstimate,
    },
  } satisfies MidiAnalysisSummary;
}

function mapRow(row: AnalysisRow): MidiAnalysisSummary {
  return {
    tempo: row.tempo,
    timeSignature: row.time_signature,
    key: row.musical_key,
    scale: row.scale,
    pitchRange: row.pitch_range,
    noteCount: row.note_count,
    noteDensity: Number(row.note_density),
    rhythmicDensity: Number(row.rhythmic_density),
    averageNoteLength: Number(row.average_note_length),
    velocityRange: row.velocity_range,
    repetitionLevel: Number(row.repetition_level),
    melodyContour: row.melody_contour,
    emotionalProfile: row.emotional_profile,
    energyLevel: row.energy_level,
    complexity: row.complexity,
    registerFocus: row.register_focus,
    summary: row.summary,
  };
}

export class MidiAnalysisService {
  analyzeBuffer(buffer: Buffer) {
    return buildSummary(buffer);
  }

  async persistAnalysis(buffer: Buffer, input: PersistInput) {
    const analysis = this.analyzeBuffer(buffer);
    const db = requireSupabase();
    const { error } = await db.from("generation_analyses").upsert({
      generation_id: input.generationId,
      project_id: input.projectId,
      user_id: input.userId,
      source_file_name: input.fileName,
      tempo: analysis.tempo,
      time_signature: analysis.timeSignature,
      musical_key: analysis.key,
      scale: analysis.scale,
      pitch_range: analysis.pitchRange,
      note_count: analysis.noteCount,
      note_density: analysis.noteDensity,
      rhythmic_density: analysis.rhythmicDensity,
      average_note_length: analysis.averageNoteLength,
      velocity_range: analysis.velocityRange,
      repetition_level: analysis.repetitionLevel,
      melody_contour: analysis.melodyContour,
      emotional_profile: analysis.emotionalProfile,
      energy_level: analysis.energyLevel,
      complexity: analysis.complexity,
      register_focus: analysis.registerFocus,
      summary: analysis.summary,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;

    if (input.projectId) {
      const { error: contextError } = await db.from("project_music_contexts").upsert({
        project_id: input.projectId,
        user_id: input.userId,
        latest_generation_id: input.generationId,
        genre: input.genre ?? null,
        mood: input.mood ?? null,
        tempo: analysis.tempo,
        musical_key: analysis.key,
        scale: analysis.scale,
        time_signature: analysis.timeSignature,
        analysis_snapshot: analysis,
        updated_at: new Date().toISOString(),
      });
      if (contextError) throw contextError;
    }

    return analysis;
  }

  async getLatestProjectAnalysis(userId: string, projectId: string) {
    const db = requireSupabase();
    const { data, error } = await db
      .from("generation_analyses")
      .select("*")
      .eq("user_id", userId)
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data ? mapRow(data as AnalysisRow) : null;
  }

  async getOrCreateLatestProjectAnalysis(userId: string, projectId: string) {
    const existing = await this.getLatestProjectAnalysis(userId, projectId);
    if (existing) return existing;

    const db = requireSupabase();
    const { data: generationData, error } = await db
      .from("generations")
      .select("id, project_id, generation_requests(prompt, kind, settings), generation_files(file_name, storage_path)")
      .eq("user_id", userId)
      .eq("project_id", projectId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    const generation = generationData as GenerationAnalysisBackfillRow | null;
    const file = generation?.generation_files?.[0] as { file_name: string; storage_path: string } | undefined;
    if (!generation || !file) return null;

    const { data: download, error: downloadError } = await db.storage.from("midi-exports").download(file.storage_path);
    if (downloadError) throw downloadError;
    const buffer = Buffer.from(await download.arrayBuffer());
    const settings = generation.generation_requests?.[0]?.settings ?? undefined;
    return this.persistAnalysis(buffer, {
      generationId: generation.id,
      projectId: generation.project_id,
      userId,
      fileName: file.file_name,
      genre: settings?.genre ?? null,
      mood: settings?.mood ?? null,
    });
  }
}

export const midiAnalysisService = new MidiAnalysisService();