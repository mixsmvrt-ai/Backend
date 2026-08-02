import { requireSupabase, supabase } from "../../config/supabase.js";
import { CHORD_PROGRESSIONS, GENRES, INSTRUMENTS, KEYS, MOODS, PLUGINS, SCALES, SONG_STRUCTURES, TEMPO_RANGES, TIME_SIGNATURES } from "./constants.js";
import type { ChordProgression, EnergyLevel, GenreKnowledge, InstrumentKnowledge, KeyKnowledge, KnowledgeRepository, KnowledgeSnapshot, MoodKnowledge, MusicRule, PluginRecommendationKnowledge, ScaleDifficulty, ScaleKnowledge, SongSection, SongStructureKnowledge, TempoRange, TimeSignatureKnowledge, TonalityPreference } from "./types.js";

const DEFAULT_KNOWLEDGE_CACHE_TTL_MS = 5 * 60 * 1000;

type GenreRow = {
  id: string;
  name: string;
  description: string;
  bpm_min: number;
  bpm_max: number;
  default_bpm: number;
  common_keys: string[];
  tonality_preference: TonalityPreference;
  recommended_scales: string[];
  typical_structure: string;
  chord_progressions: string[][];
  energy_level: EnergyLevel;
  mood_tags: string[];
  instrument_recommendations: string[];
  plugin_categories: string[];
  difficulty: ScaleDifficulty;
};

type MoodRow = {
  name: string;
  suggested_keys: string[];
  suggested_scales: string[];
  suggested_bpm: string;
  suggested_chords: string[][];
  suggested_instruments: string[];
};

type ScaleRow = {
  name: string;
  intervals: number[];
  mood_tags: string[];
  genres: string[];
  difficulty: ScaleDifficulty;
};

type KeyRow = {
  name: string;
  tonality: "Major" | "Minor" | "Mode";
  popularity: number;
  genre_match: string[];
  mood_match: string[];
  difficulty: ScaleDifficulty;
};

type TimeSignatureRow = {
  numerator: number;
  denominator: number;
  description: string;
  genre_recommendations: string[];
};

type TempoRangeRow = {
  genre_id: string;
  min_bpm: number;
  max_bpm: number;
  default_bpm: number;
};

type InstrumentCategoryRow = {
  id: string;
  name: string;
};

type InstrumentRecommendationRow = {
  id: string;
  name: string;
  category_id: string;
  genres: string[];
  mood_match: string[];
  energy_match: EnergyLevel[];
};

type PluginCategoryRow = {
  id: string;
  name: string;
  description: string;
};

type PluginRecommendationRow = {
  category_id: string;
  instruments: string[];
  genres: string[];
  moods: string[];
};

type GenreChordRow = {
  genre_id: string;
  roman_numerals: string[];
  example_key: string;
  mood_tags: string[];
  energy: EnergyLevel;
  complexity: ScaleDifficulty;
  popularity: number;
};

type GenreStructureRow = {
  genre_id: string;
  name: string;
  sections: SongSection[];
};

type GenreEnergyRow = {
  genre_id: string;
  energy_level: EnergyLevel;
};

type GenreInstrumentRow = {
  genre_id: string;
  instrument_id: string;
  priority: number;
};

type GenrePluginRow = {
  genre_id: string;
  plugin_category_id: string;
  priority: number;
};

type MusicRuleRow = {
  name: string;
  scope: string;
  rule: Record<string, unknown>;
  priority: number;
  active: boolean;
};

function staticSnapshot(): KnowledgeSnapshot {
  return {
    genres: structuredClone(GENRES),
    moods: structuredClone(MOODS),
    scales: structuredClone(SCALES),
    keys: structuredClone(KEYS),
    chords: structuredClone(CHORD_PROGRESSIONS),
    instruments: structuredClone(INSTRUMENTS),
    plugins: structuredClone(PLUGINS),
    structures: structuredClone(SONG_STRUCTURES),
    tempoRanges: structuredClone(TEMPO_RANGES),
    timeSignatures: structuredClone(TIME_SIGNATURES),
    rules: [
      { name: "Minor moods prefer minor keys", scope: "key-selection", rule: { moods: ["Dark", "Sad", "Aggressive", "Melancholy", "Mysterious"], tonality: "Minor" }, priority: 10, active: true },
      { name: "Happy and hopeful moods prefer major keys", scope: "key-selection", rule: { moods: ["Happy", "Hopeful", "Inspirational"], tonality: "Major" }, priority: 10, active: true },
      { name: "Plugin recommendations use categories only", scope: "plugins", rule: { copyrightSafe: true, avoidPresetNames: true }, priority: 1, active: true },
    ],
  };
}

function parseIntRange(value: string): [number, number] {
  const match = value.match(/[[(](\d+),(\d+)[)\]]/);
  if (!match) {
    return [0, 0];
  }

  const lower = Number(match[1]);
  const upper = Number(match[2]);
  const inclusiveUpper = value.endsWith("]");
  return [lower, inclusiveUpper ? upper : upper - 1];
}

function sortByLabel<T extends { name?: string; category?: string }>(items: T[]) {
  return [...items].sort((left, right) => (left.name ?? left.category ?? "").localeCompare(right.name ?? right.category ?? ""));
}

class StaticKnowledgeRepository implements KnowledgeRepository {
  async loadSnapshot(): Promise<KnowledgeSnapshot> {
    return staticSnapshot();
  }
}

class SupabaseKnowledgeRepository implements KnowledgeRepository {
  async loadSnapshot(): Promise<KnowledgeSnapshot> {
    const db = requireSupabase();
    const [genresResult, moodsResult, scalesResult, keysResult, timeSignaturesResult, tempoRangesResult, instrumentCategoriesResult, instrumentRecommendationsResult, pluginCategoriesResult, pluginRecommendationsResult, genreChordsResult, genreStructuresResult, genreEnergyResult, genreInstrumentsResult, genrePluginsResult, musicRulesResult] = await Promise.all([
      db.from("genres").select("id, name, description, bpm_min, bpm_max, default_bpm, common_keys, tonality_preference, recommended_scales, typical_structure, chord_progressions, energy_level, mood_tags, instrument_recommendations, plugin_categories, difficulty").order("name"),
      db.from("moods").select("name, suggested_keys, suggested_scales, suggested_bpm, suggested_chords, suggested_instruments").order("name"),
      db.from("scales").select("name, intervals, mood_tags, genres, difficulty").order("name"),
      db.from("keys").select("name, tonality, popularity, genre_match, mood_match, difficulty").order("popularity", { ascending: false }),
      db.from("time_signatures").select("numerator, denominator, description, genre_recommendations").order("numerator"),
      db.from("tempo_ranges").select("genre_id, min_bpm, max_bpm, default_bpm"),
      db.from("instrument_categories").select("id, name").order("name"),
      db.from("instrument_recommendations").select("id, name, category_id, genres, mood_match, energy_match").order("name"),
      db.from("plugin_categories").select("id, name, description").order("name"),
      db.from("plugin_recommendations").select("category_id, instruments, genres, moods"),
      db.from("genre_chords").select("genre_id, roman_numerals, example_key, mood_tags, energy, complexity, popularity"),
      db.from("genre_structures").select("genre_id, name, sections"),
      db.from("genre_energy").select("genre_id, energy_level"),
      db.from("genre_instruments").select("genre_id, instrument_id, priority").order("priority"),
      db.from("genre_plugins").select("genre_id, plugin_category_id, priority").order("priority"),
      db.from("music_rules").select("name, scope, rule, priority, active").eq("active", true).order("priority"),
    ]);

    const results = [genresResult, moodsResult, scalesResult, keysResult, timeSignaturesResult, tempoRangesResult, instrumentCategoriesResult, instrumentRecommendationsResult, pluginCategoriesResult, pluginRecommendationsResult, genreChordsResult, genreStructuresResult, genreEnergyResult, genreInstrumentsResult, genrePluginsResult, musicRulesResult];
    for (const result of results) {
      if (result.error) {
        throw result.error;
      }
    }

    const genres = (genresResult.data ?? []) as GenreRow[];
    const moods = (moodsResult.data ?? []) as MoodRow[];
    const scales = (scalesResult.data ?? []) as ScaleRow[];
    const keys = (keysResult.data ?? []) as KeyRow[];
    const timeSignatures = (timeSignaturesResult.data ?? []) as TimeSignatureRow[];
    const tempoRanges = (tempoRangesResult.data ?? []) as TempoRangeRow[];
    const instrumentCategories = (instrumentCategoriesResult.data ?? []) as InstrumentCategoryRow[];
    const instrumentRecommendations = (instrumentRecommendationsResult.data ?? []) as InstrumentRecommendationRow[];
    const pluginCategories = (pluginCategoriesResult.data ?? []) as PluginCategoryRow[];
    const pluginRecommendations = (pluginRecommendationsResult.data ?? []) as PluginRecommendationRow[];
    const genreChords = (genreChordsResult.data ?? []) as GenreChordRow[];
    const genreStructures = (genreStructuresResult.data ?? []) as GenreStructureRow[];
    const genreEnergy = (genreEnergyResult.data ?? []) as GenreEnergyRow[];
    const genreInstruments = (genreInstrumentsResult.data ?? []) as GenreInstrumentRow[];
    const genrePlugins = (genrePluginsResult.data ?? []) as GenrePluginRow[];
    const musicRules = (musicRulesResult.data ?? []) as MusicRuleRow[];

    const genreById = new Map(genres.map((genre) => [genre.id, genre]));
    const instrumentCategoryById = new Map(instrumentCategories.map((category) => [category.id, category.name]));
    const instrumentById = new Map<string, InstrumentKnowledge>();
    const pluginCategoryById = new Map(pluginCategories.map((category) => [category.id, category]));

    const instrumentKnowledge = instrumentRecommendations.map((row) => {
      const item: InstrumentKnowledge = { name: row.name, category: instrumentCategoryById.get(row.category_id) ?? "Unknown", genres: row.genres, moodMatch: row.mood_match, energyMatch: row.energy_match };
      instrumentById.set(row.id, item);
      return item;
    });

    const pluginKnowledge = pluginRecommendations.map((row) => {
      const category = pluginCategoryById.get(row.category_id);
      return { category: category?.name ?? "Unknown", description: category?.description ?? "", instruments: row.instruments, genres: row.genres, moods: row.moods } satisfies PluginRecommendationKnowledge;
    });

    const energyByGenreId = new Map(genreEnergy.map((row) => [row.genre_id, row.energy_level]));
    const instrumentsByGenreId = new Map<string, InstrumentKnowledge[]>();
    const pluginsByGenreId = new Map<string, PluginRecommendationKnowledge[]>();

    for (const row of genreInstruments) {
      const instrument = instrumentById.get(row.instrument_id);
      if (!instrument) continue;
      const current = instrumentsByGenreId.get(row.genre_id) ?? [];
      current.push(instrument);
      instrumentsByGenreId.set(row.genre_id, current);
    }

    for (const row of genrePlugins) {
      const category = pluginCategoryById.get(row.plugin_category_id);
      if (!category) continue;
      const current = pluginsByGenreId.get(row.genre_id) ?? [];
      current.push({ category: category.name, description: category.description, instruments: [], genres: [genreById.get(row.genre_id)?.name ?? ""].filter(Boolean), moods: genreById.get(row.genre_id)?.mood_tags ?? [] });
      pluginsByGenreId.set(row.genre_id, current);
    }

    const chordKnowledge = genreChords.length
      ? genreChords.map((row) => ({ romanNumerals: row.roman_numerals, exampleKey: row.example_key, moodTags: row.mood_tags, genres: [genreById.get(row.genre_id)?.name ?? ""].filter(Boolean), energy: row.energy, complexity: row.complexity, popularity: row.popularity }))
      : genres.flatMap((genre) => genre.chord_progressions.map((progression) => ({ romanNumerals: progression, exampleKey: genre.common_keys[0] ?? "C Major", moodTags: genre.mood_tags, genres: [genre.name], energy: genre.energy_level, complexity: genre.difficulty, popularity: 80 } satisfies ChordProgression)));

    const structureKnowledge = genreStructures.length
      ? genreStructures.reduce<SongStructureKnowledge[]>((items, row) => {
          const genre = genreById.get(row.genre_id);
          if (!genre) return items;
          items.push({ name: row.name, genres: [genre.name], sections: row.sections });
          return items;
        }, [])
      : genres.map((genre) => ({ name: genre.typical_structure, genres: [genre.name], sections: [] }));

    return {
      genres: genres.map((genre) => ({ name: genre.name, description: genre.description, bpmRange: [genre.bpm_min, genre.bpm_max], defaultBpm: genre.default_bpm, commonKeys: genre.common_keys, tonalityPreference: genre.tonality_preference, recommendedScales: genre.recommended_scales, typicalStructure: genre.typical_structure, chordProgressions: genre.chord_progressions, energyLevel: energyByGenreId.get(genre.id) ?? genre.energy_level, moodTags: genre.mood_tags, instrumentRecommendations: instrumentsByGenreId.get(genre.id)?.map((instrument) => instrument.name) ?? genre.instrument_recommendations, pluginCategories: pluginsByGenreId.get(genre.id)?.map((plugin) => plugin.category) ?? genre.plugin_categories, difficulty: genre.difficulty })),
      moods: moods.map((mood) => ({ name: mood.name, suggestedKeys: mood.suggested_keys, suggestedScales: mood.suggested_scales, suggestedBpm: parseIntRange(mood.suggested_bpm), suggestedChords: mood.suggested_chords, suggestedInstruments: mood.suggested_instruments })),
      scales: scales.map((scale) => ({ name: scale.name, intervals: scale.intervals, moodTags: scale.mood_tags, genres: scale.genres, difficulty: scale.difficulty })),
      keys: keys.map((key) => ({ name: key.name, tonality: key.tonality, popularity: key.popularity, genreMatch: key.genre_match, moodMatch: key.mood_match, difficulty: key.difficulty })),
      chords: chordKnowledge,
      instruments: sortByLabel(instrumentKnowledge),
      plugins: sortByLabel(pluginKnowledge),
      structures: structureKnowledge,
      tempoRanges: tempoRanges.reduce<TempoRange[]>((items, row) => {
        const genre = genreById.get(row.genre_id);
        if (!genre) return items;
        items.push({ genre: genre.name, minBpm: row.min_bpm, maxBpm: row.max_bpm, defaultBpm: row.default_bpm });
        return items;
      }, []),
      timeSignatures: timeSignatures.map((signature) => ({ signature: [signature.numerator, signature.denominator], description: signature.description, genreRecommendations: signature.genre_recommendations })),
      rules: musicRules.map((rule): MusicRule => ({ name: rule.name, scope: rule.scope, rule: rule.rule, priority: rule.priority, active: rule.active })),
    };
  }
}

function defaultRepository(): KnowledgeRepository {
  return supabase ? new SupabaseKnowledgeRepository() : new StaticKnowledgeRepository();
}

export class KnowledgeService {
  private repository: KnowledgeRepository;
  private cacheTtlMs: number;
  private cachedSnapshot?: KnowledgeSnapshot;
  private cacheExpiresAt = 0;
  private inFlight?: Promise<KnowledgeSnapshot>;

  constructor(repository: KnowledgeRepository = defaultRepository(), cacheTtlMs = DEFAULT_KNOWLEDGE_CACHE_TTL_MS) {
    this.repository = repository;
    this.cacheTtlMs = cacheTtlMs;
  }

  configure(repository: KnowledgeRepository, cacheTtlMs = this.cacheTtlMs) {
    this.repository = repository;
    this.cacheTtlMs = cacheTtlMs;
    this.cachedSnapshot = undefined;
    this.cacheExpiresAt = 0;
    this.inFlight = undefined;
  }

  async snapshot(forceRefresh = false): Promise<KnowledgeSnapshot> {
    const now = Date.now();
    if (!forceRefresh && this.cachedSnapshot && now < this.cacheExpiresAt) return this.cachedSnapshot;
    if (!forceRefresh && this.inFlight) return this.inFlight;

    const load = this.repository.loadSnapshot().then((snapshot) => {
      this.cachedSnapshot = snapshot;
      this.cacheExpiresAt = Date.now() + this.cacheTtlMs;
      this.inFlight = undefined;
      return snapshot;
    }).catch((error) => {
      this.inFlight = undefined;
      throw error;
    });

    this.inFlight = load;
    return load;
  }

  async genres() { return (await this.snapshot()).genres; }
  async moods() { return (await this.snapshot()).moods; }
  async scales() { return (await this.snapshot()).scales; }
  async keys() { return (await this.snapshot()).keys; }
  async chords() { return (await this.snapshot()).chords; }
  async instruments() { return (await this.snapshot()).instruments; }
  async plugins() { return (await this.snapshot()).plugins; }
  async structures() { return (await this.snapshot()).structures; }
  async tempoRanges() { return (await this.snapshot()).tempoRanges; }
  async timeSignatures() { return (await this.snapshot()).timeSignatures; }
  async rules() { return (await this.snapshot()).rules; }
}

export const knowledgeService = new KnowledgeService();

export function createStaticKnowledgeRepository(snapshot = staticSnapshot()): KnowledgeRepository {
  return { loadSnapshot: async () => structuredClone(snapshot) };
}

export function configureKnowledgeRepository(repository: KnowledgeRepository, cacheTtlMs?: number) {
  knowledgeService.configure(repository, cacheTtlMs);
}
