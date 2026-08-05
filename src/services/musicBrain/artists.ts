import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { supabase } from "../../config/supabase.js";
import type { ArtistBlendContext, ArtistProfile, ArtistProfileMatch, ArtistTempoRange, SupportedMood } from "./types.js";

const CACHE_TTL_MS = 5 * 60 * 1000;
const PROFILES_DIR = resolve(process.cwd(), "src", "music-brain", "artists", "profiles");

type ArtistProfileRow = {
  id: string;
  artist_name: string;
  profile_slug: string | null;
  aliases: string[] | null;
  region: string | null;
  primary_genres: string[] | null;
  tempo_min: number;
  tempo_max: number;
  default_tempo: number;
  key_preferences: string[] | null;
  scale_preferences: string[] | null;
  instrument_preferences: string[] | null;
  melody_density: string | null;
  rhythm_style: string | null;
  energy_level: string | null;
  mood_tags: string[] | null;
  arrangement_tendencies: string[] | null;
  production_traits: string[] | null;
  plugin_categories: string[] | null;
  active: boolean | null;
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function compact(value: string) {
  return normalize(value).replace(/\s+/g, "");
}

function tokenize(value: string) {
  return normalize(value).split(/\s+/).filter(Boolean);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function levenshtein(left: string, right: string) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  const matrix = Array.from({ length: left.length + 1 }, () => Array<number>(right.length + 1).fill(0));
  for (let row = 0; row <= left.length; row += 1) matrix[row]![0] = row;
  for (let column = 0; column <= right.length; column += 1) matrix[0]![column] = column;
  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      matrix[row]![column] = Math.min(
        matrix[row - 1]![column]! + 1,
        matrix[row]![column - 1]! + 1,
        matrix[row - 1]![column - 1]! + cost,
      );
    }
  }
  return matrix[left.length]![right.length]!;
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function pickDominant(values: string[], fallback: string) {
  if (!values.length) return fallback;
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? fallback;
}

function normalizeProfile(profile: ArtistProfile): ArtistProfile {
  return {
    ...profile,
    aliases: unique([profile.name, profile.slug, ...profile.aliases]),
    primaryGenres: unique(profile.primaryGenres),
    keyPreferences: unique(profile.keyPreferences),
    scalePreferences: unique(profile.scalePreferences),
    instrumentPreferences: unique(profile.instrumentPreferences),
    mood: unique(profile.mood),
    arrangementTendencies: unique(profile.arrangementTendencies),
    productionTraits: unique(profile.productionTraits),
    pluginCategories: unique(profile.pluginCategories),
  };
}

async function readJsonProfiles() {
  const fileNames = (await readdir(PROFILES_DIR)).filter((fileName) => fileName.endsWith(".json"));
  const profiles = await Promise.all(fileNames.map(async (fileName) => {
    const raw = await readFile(resolve(PROFILES_DIR, fileName), "utf8");
    const parsed = JSON.parse(raw) as {
      slug: string;
      name: string;
      aliases?: string[];
      region: string;
      primary_genres: string[];
      tempo_range: ArtistTempoRange;
      key_preferences?: string[];
      scale_preferences?: string[];
      instrument_preferences?: string[];
      melody_density: string;
      rhythm_style: string;
      energy: string;
      mood?: string[];
      arrangement_tendencies?: string[];
      production_traits?: string[];
      plugin_categories?: string[];
      active?: boolean;
    };

    return normalizeProfile({
      slug: parsed.slug,
      name: parsed.name,
      aliases: parsed.aliases ?? [],
      region: parsed.region,
      primaryGenres: parsed.primary_genres,
      tempoRange: parsed.tempo_range,
      keyPreferences: parsed.key_preferences ?? [],
      scalePreferences: parsed.scale_preferences ?? [],
      instrumentPreferences: parsed.instrument_preferences ?? [],
      melodyDensity: parsed.melody_density,
      rhythmStyle: parsed.rhythm_style,
      energy: parsed.energy,
      mood: parsed.mood ?? [],
      arrangementTendencies: parsed.arrangement_tendencies ?? [],
      productionTraits: parsed.production_traits ?? [],
      pluginCategories: parsed.plugin_categories ?? [],
      active: parsed.active ?? true,
    });
  }));

  return profiles.sort((left, right) => left.name.localeCompare(right.name));
}

function normalizeDbProfile(row: ArtistProfileRow): ArtistProfile {
  return normalizeProfile({
    slug: row.profile_slug?.trim() || normalize(row.artist_name).replace(/\s+/g, "-"),
    name: row.artist_name,
    aliases: row.aliases ?? [],
    region: row.region?.trim() || "Unknown",
    primaryGenres: row.primary_genres?.length ? row.primary_genres : ["Contemporary"],
    tempoRange: { min: row.tempo_min, max: row.tempo_max, default: row.default_tempo },
    keyPreferences: row.key_preferences ?? [],
    scalePreferences: row.scale_preferences ?? [],
    instrumentPreferences: row.instrument_preferences ?? [],
    melodyDensity: row.melody_density?.trim() || "Medium",
    rhythmStyle: row.rhythm_style?.trim() || "Balanced",
    energy: row.energy_level?.trim() || "Medium",
    mood: row.mood_tags ?? [],
    arrangementTendencies: row.arrangement_tendencies ?? [],
    productionTraits: row.production_traits ?? [],
    pluginCategories: row.plugin_categories ?? [],
    active: row.active ?? true,
  });
}

async function readDatabaseProfiles() {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("artist_profiles")
      .select("id, artist_name, profile_slug, aliases, region, primary_genres, tempo_min, tempo_max, default_tempo, key_preferences, scale_preferences, instrument_preferences, melody_density, rhythm_style, energy_level, mood_tags, arrangement_tendencies, production_traits, plugin_categories, active")
      .order("artist_name");
    if (error || !data) return [];
    return (data as ArtistProfileRow[]).map(normalizeDbProfile);
  } catch {
    return [];
  }
}

function mergeProfiles(baseProfiles: ArtistProfile[], overrideProfiles: ArtistProfile[]) {
  const merged = new Map<string, ArtistProfile>();
  for (const profile of baseProfiles) merged.set(profile.slug, profile);
  for (const profile of overrideProfiles) {
    const current = merged.get(profile.slug) ?? merged.get(normalize(profile.name).replace(/\s+/g, "-"));
    merged.set(profile.slug, normalizeProfile(current ? { ...current, ...profile } : profile));
  }
  return [...merged.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function aliasScore(prompt: string, promptTokens: string[], promptCompact: string, alias: string) {
  const normalizedAlias = normalize(alias);
  const aliasCompact = compact(alias);
  if (!normalizedAlias) return 0;
  if (prompt.includes(normalizedAlias)) return 140 + normalizedAlias.length;
  if (promptCompact.includes(aliasCompact)) return 130 + aliasCompact.length;

  const aliasTokens = tokenize(alias);
  if (aliasTokens.length > 1) {
    const allPresent = aliasTokens.every((part) => promptTokens.some((token) => token === part || token.startsWith(part) || part.startsWith(token)));
    if (allPresent) return 110 + aliasTokens.length;
  }

  if (aliasTokens.length === 1) {
    const [single] = aliasTokens;
    if (!single) return 0;
    for (const token of promptTokens) {
      if (token === single) return 120 + token.length;
      if (single.length >= 4 && (token.startsWith(single) || single.startsWith(token))) return 95 + Math.min(token.length, single.length);
      if (single.length >= 4 && levenshtein(token, single) <= 1) return 80 - levenshtein(token, single);
    }
  }

  return 0;
}

function toSupportedMood(moods: string[]): SupportedMood | undefined {
  const map = new Map<string, SupportedMood>([
    ["dark", "Dark"],
    ["aggressive", "Aggressive"],
    ["dreamy", "Dreamy"],
    ["relaxed", "Relaxed"],
    ["warm", "Hopeful"],
    ["emotional", "Emotional"],
    ["melancholic", "Melancholy"],
    ["melancholy", "Melancholy"],
    ["smooth", "Calm"],
    ["romantic", "Dreamy"],
    ["mysterious", "Mysterious"],
    ["focused", "Energetic"],
    ["confident", "Energetic"],
    ["street", "Aggressive"],
    ["cold", "Mysterious"],
    ["menacing", "Aggressive"],
  ]);
  for (const mood of moods) {
    const match = map.get(normalize(mood));
    if (match) return match;
  }
  return undefined;
}

function blendTempo(ranges: ArtistTempoRange[]): ArtistTempoRange {
  const overlapMin = Math.max(...ranges.map((range) => range.min));
  const overlapMax = Math.min(...ranges.map((range) => range.max));
  const min = overlapMin <= overlapMax ? overlapMin : Math.round(ranges.reduce((sum, range) => sum + range.min, 0) / ranges.length);
  const max = overlapMin <= overlapMax ? overlapMax : Math.round(ranges.reduce((sum, range) => sum + range.max, 0) / ranges.length);
  const averageDefault = Math.round(ranges.reduce((sum, range) => sum + range.default, 0) / ranges.length);
  return { min, max, default: clamp(averageDefault, min, max) };
}

function energyRank(value: string) {
  switch (normalize(value)) {
    case "low": return 1;
    case "medium": return 2;
    case "medium high": return 3;
    case "high": return 4;
    case "extreme": return 5;
    default: return 2;
  }
}

export class MusicBrainArtistCatalog {
  private cache?: ArtistProfile[];
  private cacheExpiresAt = 0;
  private inFlight?: Promise<ArtistProfile[]>;

  async profiles(forceRefresh = false): Promise<ArtistProfile[]> {
    const now = Date.now();
    if (!forceRefresh && this.cache && now < this.cacheExpiresAt) return this.cache;
    if (!forceRefresh && this.inFlight) return this.inFlight;
    const load = Promise.all([readJsonProfiles(), readDatabaseProfiles()])
      .then(([jsonProfiles, databaseProfiles]) => mergeProfiles(jsonProfiles, databaseProfiles))
      .then((profiles) => {
        this.cache = profiles;
        this.cacheExpiresAt = Date.now() + CACHE_TTL_MS;
        this.inFlight = undefined;
        return profiles;
      })
      .catch((error) => {
        this.inFlight = undefined;
        throw error;
      });
    this.inFlight = load;
    return load;
  }

  async detect(prompt: string): Promise<ArtistProfileMatch[]> {
    const normalizedPrompt = normalize(prompt);
    const promptCompact = compact(prompt);
    const promptTokens = tokenize(prompt);
    const matches = (await this.profiles())
      .filter((profile) => profile.active)
      .map((profile) => {
        const score = Math.max(...profile.aliases.map((alias) => aliasScore(normalizedPrompt, promptTokens, promptCompact, alias)), 0);
        return score > 0 ? { profile, score } : null;
      })
      .filter((match): match is ArtistProfileMatch => Boolean(match))
      .sort((left, right) => right.score - left.score);

    const selected: ArtistProfileMatch[] = [];
    const seen = new Set<string>();
    for (const match of matches) {
      if (seen.has(match.profile.slug)) continue;
      selected.push(match);
      seen.add(match.profile.slug);
      if (selected.length === 3) break;
    }
    return selected;
  }

  async findByName(name: string) {
    const needle = normalize(name);
    return (await this.profiles()).find((profile) => normalize(profile.name) === needle || profile.aliases.some((alias) => normalize(alias) === needle)) ?? null;
  }

  async search(query: string) {
    const needle = normalize(query);
    if (!needle) return [];
    const directMatches = (await this.profiles()).filter((profile) =>
      normalize(profile.name).includes(needle)
      || profile.aliases.some((alias) => normalize(alias).includes(needle))
      || profile.primaryGenres.some((genre) => normalize(genre).includes(needle))
      || profile.mood.some((mood) => normalize(mood).includes(needle))
      || profile.instrumentPreferences.some((instrument) => normalize(instrument).includes(needle)),
    );
    if (directMatches.length) return directMatches;
    return (await this.detect(query)).map((match) => match.profile);
  }

  async resolvePrompt(prompt: string): Promise<ArtistBlendContext | null> {
    const matches = await this.detect(prompt);
    if (!matches.length) return null;
    const profiles = matches.map((match) => match.profile);
    const tempoRange = blendTempo(profiles.map((profile) => profile.tempoRange));
    const primaryGenres = unique(profiles.flatMap((profile) => profile.primaryGenres));
    const keyPreferences = unique(profiles.flatMap((profile) => profile.keyPreferences));
    const scalePreferences = unique(profiles.flatMap((profile) => profile.scalePreferences));
    const instrumentPreferences = unique(profiles.flatMap((profile) => profile.instrumentPreferences));
    const mood = unique(profiles.flatMap((profile) => profile.mood));
    const arrangementTendencies = unique(profiles.flatMap((profile) => profile.arrangementTendencies));
    const productionTraits = unique(profiles.flatMap((profile) => profile.productionTraits));
    const pluginCategories = unique(profiles.flatMap((profile) => profile.pluginCategories));
    const energy = profiles.slice().sort((left, right) => energyRank(right.energy) - energyRank(left.energy))[0]?.energy ?? "Medium";
    const melodyDensity = pickDominant(profiles.map((profile) => profile.melodyDensity), "Medium");
    const rhythmStyle = unique(profiles.map((profile) => profile.rhythmStyle)).slice(0, 2).join(" + ");
    const summary = [
      `Artists: ${profiles.map((profile) => profile.name).join(" x ")}.`,
      `Genres: ${primaryGenres.join(", ")}.`,
      `Tempo focus: ${tempoRange.min}-${tempoRange.max} BPM with ${tempoRange.default} BPM as the center.`,
      keyPreferences.length ? `Key tendencies: ${keyPreferences.slice(0, 4).join(", ")}.` : "",
      scalePreferences.length ? `Scale tendencies: ${scalePreferences.slice(0, 4).join(", ")}.` : "",
      instrumentPreferences.length ? `Instruments: ${instrumentPreferences.slice(0, 5).join(", ")}.` : "",
      `Melody density: ${melodyDensity}. Rhythm: ${rhythmStyle || "Balanced"}. Energy: ${energy}.`,
      mood.length ? `Mood palette: ${mood.slice(0, 6).join(", ")}.` : "",
      arrangementTendencies.length ? `Arrangement tendencies: ${arrangementTendencies.slice(0, 4).join(", ")}.` : "",
      productionTraits.length ? `Production traits: ${productionTraits.slice(0, 4).join(", ")}.` : "",
    ].filter(Boolean).join(" ");

    return {
      requestedArtists: profiles.map((profile) => profile.name),
      profiles,
      primaryGenres,
      tempoRange,
      keyPreferences,
      scalePreferences,
      instrumentPreferences,
      melodyDensity,
      rhythmStyle: rhythmStyle || "Balanced",
      energy,
      mood,
      arrangementTendencies,
      productionTraits,
      pluginCategories,
      summary,
      supportedMood: toSupportedMood(mood),
    };
  }
}

export const musicBrainArtistCatalog = new MusicBrainArtistCatalog();