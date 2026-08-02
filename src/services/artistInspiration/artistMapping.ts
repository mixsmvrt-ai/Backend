import { requireSupabase, supabase } from "../../config/supabase.js";
import { ARTIST_PROFILES } from "./constants.js";
import type { ArtistCharacteristic, ArtistProfile, ArtistProfileRepository, ArtistProfileSnapshot, ArtistTranslationLogRecord } from "./types.js";

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

type ArtistProfileRow = {
  id: string;
  artist_name: string;
  aliases: string[];
  primary_genre: string;
  secondary_genre: string | null;
  knowledge_genres: string[];
  tempo_min: number;
  tempo_max: number;
  default_tempo: number;
  energy_level: ArtistProfile["energyLevel"];
  mood_tags: string[];
  instrument_tags: string[];
  groove_style: string;
  melody_style: string;
  rhythm_style: string;
  production_style: string;
  chord_style: string;
  description: string;
};

type ArtistCharacteristicRow = {
  profile_id: string;
  characteristic_type: ArtistCharacteristic["type"];
  characteristic_value: string;
  priority: number;
};

function staticSnapshot(): ArtistProfileSnapshot {
  return { profiles: structuredClone(ARTIST_PROFILES) };
}

class StaticArtistProfileRepository implements ArtistProfileRepository {
  async loadSnapshot(): Promise<ArtistProfileSnapshot> {
    return staticSnapshot();
  }

  async logTranslation(): Promise<void> {
    return undefined;
  }
}

class SupabaseArtistProfileRepository implements ArtistProfileRepository {
  async loadSnapshot(): Promise<ArtistProfileSnapshot> {
    const db = requireSupabase();
    const [profilesResult, characteristicsResult] = await Promise.all([
      db.from("artist_profiles").select("id, artist_name, aliases, primary_genre, secondary_genre, knowledge_genres, tempo_min, tempo_max, default_tempo, energy_level, mood_tags, instrument_tags, groove_style, melody_style, rhythm_style, production_style, chord_style, description").order("artist_name"),
      db.from("artist_characteristics").select("profile_id, characteristic_type, characteristic_value, priority").order("priority"),
    ]);

    if (profilesResult.error) throw profilesResult.error;
    if (characteristicsResult.error) throw characteristicsResult.error;

    const characteristicsByProfileId = new Map<string, ArtistCharacteristic[]>();
    for (const row of (characteristicsResult.data ?? []) as ArtistCharacteristicRow[]) {
      const items = characteristicsByProfileId.get(row.profile_id) ?? [];
      items.push({ type: row.characteristic_type, value: row.characteristic_value, priority: row.priority });
      characteristicsByProfileId.set(row.profile_id, items);
    }

    return {
      profiles: ((profilesResult.data ?? []) as ArtistProfileRow[]).map((row) => ({
        artistName: row.artist_name,
        aliases: row.aliases,
        primaryGenre: row.primary_genre,
        secondaryGenre: row.secondary_genre ?? undefined,
        knowledgeGenres: row.knowledge_genres,
        tempoMin: row.tempo_min,
        tempoMax: row.tempo_max,
        defaultTempo: row.default_tempo,
        energyLevel: row.energy_level,
        moodTags: row.mood_tags,
        instrumentTags: row.instrument_tags,
        grooveStyle: row.groove_style,
        melodyStyle: row.melody_style,
        rhythmStyle: row.rhythm_style,
        productionStyle: row.production_style,
        chordStyle: row.chord_style,
        description: row.description,
        characteristics: characteristicsByProfileId.get(row.id) ?? [],
      })),
    };
  }

  async logTranslation(record: ArtistTranslationLogRecord): Promise<void> {
    const db = requireSupabase();
    const { error } = await db.from("artist_translation_logs").insert({
      user_id: record.userId ?? null,
      original_prompt: record.originalPrompt,
      sanitized_prompt: record.sanitizedPrompt,
      detected_artists: record.detectedArtists,
      translated_context: record.translatedContext,
      rejected: record.rejected,
      rejection_reason: record.rejectionReason ?? null,
    });

    if (error) throw error;
  }
}

function defaultRepository(): ArtistProfileRepository {
  return supabase ? new SupabaseArtistProfileRepository() : new StaticArtistProfileRepository();
}

export class ArtistProfileCatalog {
  private repository: ArtistProfileRepository;
  private cacheTtlMs: number;
  private snapshotCache?: ArtistProfileSnapshot;
  private cacheExpiresAt = 0;
  private inFlight?: Promise<ArtistProfileSnapshot>;

  constructor(repository: ArtistProfileRepository = defaultRepository(), cacheTtlMs = DEFAULT_CACHE_TTL_MS) {
    this.repository = repository;
    this.cacheTtlMs = cacheTtlMs;
  }

  configure(repository: ArtistProfileRepository, cacheTtlMs = this.cacheTtlMs) {
    this.repository = repository;
    this.cacheTtlMs = cacheTtlMs;
    this.snapshotCache = undefined;
    this.cacheExpiresAt = 0;
    this.inFlight = undefined;
  }

  async snapshot(forceRefresh = false): Promise<ArtistProfileSnapshot> {
    const now = Date.now();
    if (!forceRefresh && this.snapshotCache && now < this.cacheExpiresAt) return this.snapshotCache;
    if (!forceRefresh && this.inFlight) return this.inFlight;

    const load = this.repository.loadSnapshot().then((snapshot) => {
      this.snapshotCache = snapshot;
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

  async profiles() {
    return (await this.snapshot()).profiles;
  }

  async findByName(name: string) {
    const needle = name.trim().toLowerCase();
    return (await this.profiles()).find((profile) => profile.artistName.toLowerCase() === needle || profile.aliases.some((alias) => alias.toLowerCase() === needle));
  }

  async search(query: string) {
    const text = query.trim().toLowerCase();
    return (await this.profiles()).filter((profile) =>
      profile.artistName.toLowerCase().includes(text)
      || profile.aliases.some((alias) => alias.toLowerCase().includes(text))
      || profile.knowledgeGenres.some((genre) => genre.toLowerCase().includes(text))
      || profile.moodTags.some((mood) => mood.toLowerCase().includes(text))
      || profile.instrumentTags.some((instrument) => instrument.toLowerCase().includes(text))
      || profile.description.toLowerCase().includes(text),
    );
  }

  async log(record: ArtistTranslationLogRecord) {
    try {
      await this.repository.logTranslation(record);
    } catch {
      return undefined;
    }
  }
}

export const artistProfileCatalog = new ArtistProfileCatalog();

export function createStaticArtistProfileRepository(snapshot = staticSnapshot()): ArtistProfileRepository {
  return {
    loadSnapshot: async () => structuredClone(snapshot),
    logTranslation: async () => undefined,
  };
}

export function configureArtistProfileRepository(repository: ArtistProfileRepository, cacheTtlMs?: number) {
  artistProfileCatalog.configure(repository, cacheTtlMs);
}