import { readFileSync } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import midiPackage from "@tonejs/midi";
import { env } from "../../config/env.js";
import { requireSupabase } from "../../config/supabase.js";

export interface ReferenceFeatures {
  id: string;
  filePath: string;
  collection: string;
  fileName: string;
  modifiedAt: number;
  tempo: number;
  timeSignature: [number, number];
  key: string | null;
  scale: string | null;
  pitchRange: { min: number; max: number };
  register: "low" | "mid" | "high" | "wide";
  noteDensity: number;
  rhythmicDensity: number;
  swingAmount: number;
  syncopationLevel: number;
  phraseLength: number;
  motifStructure: string;
  intervalTendencies: string[];
  chordVoicingStyle: string;
  chordExtensions: string[];
  repetitionLevel: number;
  velocityProfile: string;
  humanizationProfile: string;
  ornamentation: string[];
  instrumentCategory: string;
  genreTags: string[];
  moodTags: string[];
  energyLevel: "low" | "medium" | "high";
  artistInfluenceTags: string[];
  storagePath?: string;
}

interface CachedIndex {
  version: 1;
  sources: string[];
  entries: ReferenceFeatures[];
}

interface ReferenceQuery {
  prompt: string;
  genre?: string;
  mood?: string;
  instrument?: string;
  artist?: string;
  tempo?: number;
  key?: string;
  scale?: string;
  includeMidi?: boolean;
}

export interface ReferenceBlend {
  retrieved: Array<Pick<ReferenceFeatures, "collection" | "fileName" | "tempo" | "key" | "scale"> & { score: number; midiBase64?: string; byteLength?: number }>;
  featureSummary: string;
}

const CACHE_VERSION = 1;
const MIN_REFERENCES = 3;
const MAX_REFERENCES = 5;
const DEFAULT_REPOSITORY_ROOT = path.resolve(process.cwd(), "reference-midi");
const DEFAULT_DESKTOP_ROOT = path.join(os.homedir(), "OneDrive", "Desktop", "Midi References");

function sourceRoots() {
  const configured = env.REFERENCE_MIDI_DIRS?.split(",").map((value) => value.trim()).filter(Boolean);
  return configured?.length ? configured.map((value) => path.resolve(value)) : [DEFAULT_REPOSITORY_ROOT, DEFAULT_DESKTOP_ROOT];
}

function cachePath() {
  return path.resolve(process.cwd(), env.REFERENCE_MIDI_INDEX_PATH);
}

async function midiFiles(root: string): Promise<string[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    const nested = await Promise.all(entries.map(async (entry) => {
      const filePath = path.join(root, entry.name);
      if (entry.isDirectory()) return midiFiles(filePath);
      return /\.mid(i)?$/i.test(entry.name) ? [filePath] : [];
    }));
    return nested.flat();
  } catch {
    return [];
  }
}

interface StorageReferenceFile {
  storagePath: string;
  modifiedAt: number;
}

async function storageMidiFiles(prefix = ""): Promise<StorageReferenceFile[]> {
  const { data, error } = await requireSupabase().storage.from(env.REFERENCE_MIDI_BUCKET).list(prefix, { limit: 1000, offset: 0, sortBy: { column: "name", order: "asc" } });
  if (error) throw error;
  const files: StorageReferenceFile[] = [];
  for (const item of data ?? []) {
    const storagePath = prefix ? `${prefix}/${item.name}` : item.name;
    if (/\.mid(i)?$/i.test(item.name)) {
      files.push({ storagePath, modifiedAt: item.updated_at ? Date.parse(item.updated_at) : 0 });
      continue;
    }
    if (!item.metadata) files.push(...await storageMidiFiles(storagePath));
  }
  return files;
}

function storageIsConfigured() {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

async function downloadStorageMidi(storagePath: string) {
  const { data, error } = await requireSupabase().storage.from(env.REFERENCE_MIDI_BUCKET).download(storagePath);
  if (error || !data) throw error ?? new Error(`Reference MIDI is missing from ${env.REFERENCE_MIDI_BUCKET}/${storagePath}.`);
  return Buffer.from(await data.arrayBuffer());
}

function collectionFor(filePath: string, root: string) {
  if (filePath.startsWith("storage://")) {
    const storagePath = filePath.split("/").slice(3).join("/");
    return storagePath?.split("/")[0] || env.REFERENCE_MIDI_BUCKET;
  }
  const relative = path.relative(root, filePath);
  const [folder] = relative.split(path.sep);
  return folder && path.extname(folder) === "" ? folder : path.basename(root);
}

function keyAndScale(fileName: string) {
  const match = fileName.match(/\b([A-G](?:#|b)?)[ _-]*(major|minor|maj|min|harmonic|phrygian|lydian|hirajoshi|japanese|dorian)\b/i);
  if (!match) return { key: null, scale: null };
  const key = match[1];
  const mode = match[2].toLowerCase();
  const scale = mode === "min" || mode === "minor" ? "Minor" : mode === "maj" || mode === "major" ? "Major" : `${mode[0].toUpperCase()}${mode.slice(1)}`;
  return { key, scale };
}

function tempoFromName(fileName: string) {
  const match = fileName.match(/\b(\d{2,3})\s*(?:bpm|BPM)\b/i);
  return match ? Number(match[1]) : null;
}

function collectionTags(collection: string, fileName: string) {
  const text = `${collection} ${fileName}`.toLowerCase();
  const genreTags = [
    /afro/.test(text) ? "Afrobeats" : null,
    /dancehall/.test(text) ? "Dancehall" : null,
    /trap|808/.test(text) ? "Trap" : null,
    /drill/.test(text) ? "Drill" : null,
    /rnb|r&b/.test(text) ? "R&B" : null,
    /guitar|spanish/.test(text) ? "Guitar" : null,
  ].filter((tag): tag is string => Boolean(tag));
  const moodTags = [
    /dark|guilt|hurt|pain|dead|bloody|apocalypse|emotional/.test(text) ? "Dark" : null,
    /emotional|feeling|utopia|hope/.test(text) ? "Emotional" : null,
    /afro|dancehall|rnb/.test(text) ? "Groovy" : null,
  ].filter((tag): tag is string => Boolean(tag));
  return { genreTags: [...new Set(genreTags)], moodTags: [...new Set(moodTags)] };
}

function registerFor(pitchRange: { min: number; max: number }) {
  if (pitchRange.min < 45 && pitchRange.max > 84) return "wide" as const;
  const center = (pitchRange.min + pitchRange.max) / 2;
  return center < 52 ? "low" as const : center > 76 ? "high" as const : "mid" as const;
}

function quantizedDistance(value: number, grid = 0.25) {
  return Math.abs(value - Math.round(value / grid) * grid);
}

function extractFeatures(filePath: string, root: string, modifiedAt: number, bytes = readFileSync(filePath), fileName = path.basename(filePath), storagePath?: string): ReferenceFeatures {
  const midi = new midiPackage.Midi(bytes);
  const notes = midi.tracks.flatMap((track) => track.notes);
  const ppq = midi.header.ppq || 480;
  const maxTick = Math.max(1, ...notes.map((note) => note.ticks + note.durationTicks));
  const beats = maxTick / ppq;
  const tempos = midi.header.tempos;
  const tempo = tempoFromName(fileName) ?? Math.round(tempos[0]?.bpm ?? 100);
  const time = midi.header.timeSignatures[0]?.timeSignature ?? [4, 4];
  const pitchRange = { min: Math.min(...notes.map((note) => note.midi), 60), max: Math.max(...notes.map((note) => note.midi), 60) };
  const starts = notes.map((note) => note.ticks / ppq);
  const uniqueStarts = [...new Set(starts.map((start) => Math.round(start * 16) / 16))];
  const offGrid = starts.filter((start) => quantizedDistance(start, 0.25) > 0.025).length;
  const shortNotes = notes.filter((note) => note.durationTicks / ppq <= 0.5).length;
  const repeatedPitches = notes.length - new Set(notes.map((note) => `${note.midi}:${Math.round(note.ticks / ppq * 4)}`)).size;
  const { key, scale } = keyAndScale(fileName);
  const { genreTags, moodTags } = collectionTags(collectionFor(filePath, root), fileName);
  const intervalTendencies = [...new Set(notes.slice(1).map((note, index) => Math.abs(note.midi - notes[index].midi)).filter((interval) => interval > 0 && interval <= 12).map((interval) => interval <= 2 ? "stepwise" : interval <= 5 ? "thirds/fourths" : "wide leaps"))];
  const chordExtensions = notes.length > 2 && new Set(notes.filter((note) => note.durationTicks / ppq >= 1).map((note) => note.midi % 12)).size >= 4 ? ["7ths", "9ths/color tones"] : ["open intervals"];
  const collection = collectionFor(filePath, root);
  const lower = `${collection} ${fileName}`.toLowerCase();
  return {
    id: `${filePath}:${modifiedAt}`,
    filePath,
    collection,
    fileName,
    modifiedAt,
    tempo,
    timeSignature: [Number(time[0] ?? 4), Number(time[1] ?? 4)],
    key,
    scale,
    pitchRange,
    register: registerFor(pitchRange),
    noteDensity: Number((notes.length / Math.max(1, beats)).toFixed(3)),
    rhythmicDensity: Number((uniqueStarts.length / Math.max(1, beats)).toFixed(3)),
    swingAmount: Number((offGrid / Math.max(1, notes.length)).toFixed(3)),
    syncopationLevel: Number((notes.filter((note) => (note.ticks / ppq) % 1 > 0.01).length / Math.max(1, notes.length)).toFixed(3)),
    phraseLength: Math.max(1, Math.round(beats / Math.max(1, time[0] ?? 4))),
    motifStructure: notes.length > 0 && repeatedPitches / notes.length > 0.35 ? "repeating motif with controlled variation" : "developing phrase",
    intervalTendencies: intervalTendencies.length ? intervalTendencies : ["stepwise"],
    chordVoicingStyle: notes.length > 0 && pitchRange.max - pitchRange.min > 24 ? "open and spread voicings" : "compact voicings",
    chordExtensions,
    repetitionLevel: Number((repeatedPitches / Math.max(1, notes.length)).toFixed(3)),
    velocityProfile: notes.length ? `range ${Math.round(Math.min(...notes.map((note) => note.velocity)) * 127)}-${Math.round(Math.max(...notes.map((note) => note.velocity)) * 127)}` : "moderate dynamics",
    humanizationProfile: offGrid > notes.length * 0.05 ? "played timing with loose attacks" : "tight pocket with subtle variation",
    ornamentation: shortNotes / Math.max(1, notes.length) > 0.35 ? ["short passing notes", "pickup accents"] : ["selective passing tones"],
    instrumentCategory: /guitar/.test(lower) ? "guitar" : /808|bass/.test(lower) ? "bass/808" : /piano|keys/.test(lower) ? "piano/keys" : /chord/.test(lower) ? "chords" : "melodic MIDI",
    genreTags,
    moodTags,
    energyLevel: notes.length / Math.max(1, beats) > 3 ? "high" : notes.length / Math.max(1, beats) < 1 ? "low" : "medium",
    artistInfluenceTags: [/@soundwrld/i.test(fileName) ? "Soundwrld" : null, /@helpsisleet/i.test(fileName) ? "helpsisleet" : null, /@dpebeats/i.test(fileName) ? "dpebeats" : null].filter((tag): tag is string => Boolean(tag)),
    ...(storagePath ? { storagePath } : {}),
  };
}

function tokenScore(entry: ReferenceFeatures, query: ReferenceQuery) {
  const text = `${query.prompt} ${query.genre ?? ""} ${query.mood ?? ""} ${query.instrument ?? ""} ${query.artist ?? ""} ${query.key ?? ""} ${query.scale ?? ""}`.toLowerCase();
  const tokens = text.split(/[^a-z0-9#&]+/).filter((token) => token.length > 2);
  const haystack = `${entry.collection} ${entry.fileName} ${entry.genreTags.join(" ")} ${entry.moodTags.join(" ")} ${entry.instrumentCategory} ${entry.artistInfluenceTags.join(" ")} ${entry.key ?? ""} ${entry.scale ?? ""}`.toLowerCase();
  let score = tokens.reduce((total, token) => total + (haystack.includes(token) ? 1 : 0), 0);
  if (query.tempo) score += Math.max(0, 1 - Math.abs(entry.tempo - query.tempo) / 50);
  if (query.key && entry.key?.toLowerCase() === query.key.toLowerCase()) score += 2;
  if (query.scale && entry.scale?.toLowerCase().includes(query.scale.toLowerCase())) score += 1.5;
  if (entry.phraseLength === 8) score += 0.35;
  return score + Math.random() * 0.15;
}

async function blend(entries: ReferenceFeatures[], scores = new Map<string, number>(), includeMidi = false): Promise<ReferenceBlend> {
  if (!entries.length) return { retrieved: [], featureSummary: "No MIDI references were available; use the genre profile while preserving hook-first, original composition." };
  const average = (selector: (entry: ReferenceFeatures) => number) => Number((entries.reduce((sum, entry) => sum + selector(entry), 0) / entries.length).toFixed(2));
  const collections = [...new Set(entries.map((entry) => entry.collection))];
  const genres = [...new Set(entries.flatMap((entry) => entry.genreTags))];
  const moods = [...new Set(entries.flatMap((entry) => entry.moodTags))];
  return {
    retrieved: await Promise.all(entries.map(async (entry) => {
      const midi = includeMidi ? entry.storagePath ? await downloadStorageMidi(entry.storagePath) : await readFile(entry.filePath) : undefined;
      return {
        collection: entry.collection,
        fileName: entry.fileName,
        tempo: entry.tempo,
        key: entry.key,
        scale: entry.scale,
        score: Number((scores.get(entry.id) ?? 0).toFixed(3)),
        ...(midi ? { midiBase64: midi.toString("base64"), byteLength: midi.byteLength } : {}),
      };
    })),
    featureSummary: [
      `reference_collections=${collections.join(", ")}`,
      `reference_genres=${genres.join(", ") || "mixed"}`,
      `reference_moods=${moods.join(", ") || "mixed"}`,
      `tempo_center=${average((entry) => entry.tempo)} BPM`,
      `time_signature=${[...new Set(entries.map((entry) => entry.timeSignature.join("/")))].join(", ")}`,
      `keys_scales=${[...new Set(entries.map((entry) => entry.key && entry.scale ? `${entry.key} ${entry.scale}` : "unspecified"))].join(", ")}`,
      `pitch_range=${Math.round(average((entry) => entry.pitchRange.min))}-${Math.round(average((entry) => entry.pitchRange.max))}`,
      `instrument_categories=${[...new Set(entries.map((entry) => entry.instrumentCategory))].join(", ")}`,
      `energy=${[...new Set(entries.map((entry) => entry.energyLevel))].join(", ")}`,
      `note_density=${average((entry) => entry.noteDensity)} notes/beat`,
      `rhythmic_density=${average((entry) => entry.rhythmicDensity)} starts/beat`,
      `swing=${average((entry) => entry.swingAmount)}`,
      `syncopation=${average((entry) => entry.syncopationLevel)}`,
      `phrase_length=${Math.round(average((entry) => entry.phraseLength))} bars`,
      `repetition=${average((entry) => entry.repetitionLevel)}`,
      `register=${[...new Set(entries.map((entry) => entry.register))].join("/")}`,
      `motif_language=${[...new Set(entries.map((entry) => entry.motifStructure))].join("; ")}`,
      `interval_language=${[...new Set(entries.flatMap((entry) => entry.intervalTendencies))].join(", ")}`,
      `voicing=${[...new Set(entries.map((entry) => entry.chordVoicingStyle))].join("; ")}`,
      `extensions=${[...new Set(entries.flatMap((entry) => entry.chordExtensions))].join(", ")}`,
      `velocity=${[...new Set(entries.map((entry) => entry.velocityProfile))].join("; ")}`,
      `humanization=${[...new Set(entries.map((entry) => entry.humanizationProfile))].join("; ")}`,
      `ornamentation=${[...new Set(entries.flatMap((entry) => entry.ornamentation))].join(", ")}`,
      `artist_influence_tags=${[...new Set(entries.flatMap((entry) => entry.artistInfluenceTags))].join(", ") || "none"}`,
      "Use these as producer-DNA feature constraints only. Never copy note sequences, rhythms, motifs, hooks, or progressions.",
    ].join("; "),
  };
}

export class ReferenceLibraryService {
  private entries: ReferenceFeatures[] | null = null;
  private loading: Promise<ReferenceFeatures[]> | null = null;

  async preload() {
    await this.load();
  }

  async retrieve(query: ReferenceQuery): Promise<ReferenceBlend> {
    const entries = await this.load();
    const ranked = entries.map((entry) => ({ entry, score: tokenScore(entry, query) })).sort((left, right) => right.score - left.score);
    const selected: ReferenceFeatures[] = [];
    const selectedScores = new Map<string, number>();
    const usedCollections = new Set<string>();
    for (const candidate of ranked) {
      if (selected.length >= MAX_REFERENCES) break;
      const { entry } = candidate;
      if (usedCollections.size < 4 && usedCollections.has(entry.collection)) continue;
      selected.push(entry);
      selectedScores.set(entry.id, candidate.score);
      usedCollections.add(entry.collection);
    }
    if (selected.length < MIN_REFERENCES) {
      for (const entry of entries) {
        if (selected.length >= MIN_REFERENCES) break;
        if (!selected.includes(entry)) {
          selected.push(entry);
          selectedScores.set(entry.id, tokenScore(entry, query));
        }
      }
    }
    return blend(selected, selectedScores, query.includeMidi ?? false);
  }

  private async load() {
    if (this.entries) return this.entries;
    if (this.loading) return this.loading;
    this.loading = this.buildIndex().finally(() => { this.loading = null; });
    this.entries = await this.loading;
    return this.entries;
  }

  private async buildIndex(): Promise<ReferenceFeatures[]> {
    const roots = sourceRoots();
    const storageFiles = storageIsConfigured() ? await storageMidiFiles() : [];
    const files = (await Promise.all(roots.map((root) => midiFiles(root)))).flat();
    let cached: CachedIndex | null = null;
    try {
      cached = JSON.parse(await readFile(cachePath(), "utf8")) as CachedIndex;
    } catch {
      cached = null;
    }
    const cachedByPath = new Map((cached?.version === CACHE_VERSION ? cached.entries : []).map((entry) => [entry.filePath, entry]));
    const entries: ReferenceFeatures[] = [];
    if (storageFiles.length) {
      for (const file of storageFiles) {
        const filePath = `storage://${env.REFERENCE_MIDI_BUCKET}/${file.storagePath}`;
        const previous = cachedByPath.get(filePath);
        if (previous?.modifiedAt === file.modifiedAt && previous.storagePath === file.storagePath) {
          entries.push(previous);
          continue;
        }
        try {
          const bytes = await downloadStorageMidi(file.storagePath);
          entries.push(extractFeatures(filePath, env.REFERENCE_MIDI_BUCKET, file.modifiedAt, bytes, path.posix.basename(file.storagePath), file.storagePath));
        } catch { }
      }
    } else {
      for (const filePath of files) {
        const fileStat = await stat(filePath);
        const previous = cachedByPath.get(filePath);
        if (previous?.modifiedAt === fileStat.mtimeMs) {
          entries.push(previous);
          continue;
        }
        try {
          entries.push(extractFeatures(filePath, roots.find((root) => filePath.startsWith(root)) ?? path.dirname(filePath), fileStat.mtimeMs));
        } catch { }
      }
    }
    await mkdir(path.dirname(cachePath()), { recursive: true });
    await writeFile(cachePath(), JSON.stringify({ version: CACHE_VERSION, sources: storageFiles.length ? [`supabase://${env.REFERENCE_MIDI_BUCKET}`] : roots, entries } satisfies CachedIndex), "utf8");
    return entries;
  }
}

export const referenceLibraryService = new ReferenceLibraryService();
