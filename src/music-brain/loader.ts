import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export interface PluginKnowledge {
  name: string;
  instrumentTypes: string[];
  strengths: string[];
  genres: string[];
  moods: string[];
  cpu: string;
  soundCategories: string[];
  producerUseCases: string[];
}

export interface InstrumentKnowledge {
  name: string;
  aliases: string[];
  moods: string[];
  bestFor: string[];
  register: string;
  layering: string[];
}

export interface GenreKnowledge {
  name: string;
  bpm: [number, number];
  commonScales: string[];
  commonChordMovement: string[];
  typicalInstruments: string[];
  layeringTechniques: string[];
  melodyDensity: string;
  rhythmStyle: string;
  bassBehavior: string;
  arrangementTendencies: string[];
}

export interface ArrangementKnowledge {
  sections: Record<string, string[]>;
  transitions: string[];
}

export interface SoundDesignKnowledge {
  layeringStrategies: string[];
  darkeningMoves: string[];
  energyMoves: string[];
}

export interface MixingKnowledge {
  eq: Record<string, string>;
  reverb: Record<string, string>;
  masking: string[];
}

export interface MasteringKnowledge {
  basics: string[];
}

export interface MusicTheoryKnowledge {
  minorMood: string[];
  melodyRules: string[];
  counterMelody: string[];
}

export interface MusicBrainKnowledge {
  plugins: PluginKnowledge[];
  instruments: InstrumentKnowledge[];
  genres: GenreKnowledge[];
  arrangement: ArrangementKnowledge;
  soundDesign: SoundDesignKnowledge;
  mixing: MixingKnowledge;
  mastering: MasteringKnowledge;
  musicTheory: MusicTheoryKnowledge;
}

let cachedKnowledge: MusicBrainKnowledge | null = null;

function modulePath(...segments: string[]) {
  return resolve(process.cwd(), "src", "music-brain", ...segments);
}

async function loadJson<T>(...segments: string[]) {
  const raw = await readFile(modulePath(...segments), "utf8");
  return JSON.parse(raw) as T;
}

export async function loadMusicBrainKnowledge() {
  if (cachedKnowledge) return cachedKnowledge;
  const [plugins, instruments, genres, arrangement, soundDesign, mixing, mastering, musicTheory] = await Promise.all([
    loadJson<PluginKnowledge[]>("modules", "plugins", "knowledge.json"),
    loadJson<InstrumentKnowledge[]>("modules", "instruments", "knowledge.json"),
    loadJson<GenreKnowledge[]>("modules", "genre", "knowledge.json"),
    loadJson<ArrangementKnowledge>("modules", "arrangement", "knowledge.json"),
    loadJson<SoundDesignKnowledge>("modules", "sound-design", "knowledge.json"),
    loadJson<MixingKnowledge>("modules", "mixing", "knowledge.json"),
    loadJson<MasteringKnowledge>("modules", "mastering", "knowledge.json"),
    loadJson<MusicTheoryKnowledge>("modules", "music-theory", "knowledge.json"),
  ]);

  cachedKnowledge = { plugins, instruments, genres, arrangement, soundDesign, mixing, mastering, musicTheory };
  return cachedKnowledge;
}

export function clearMusicBrainKnowledgeCache() {
  cachedKnowledge = null;
}