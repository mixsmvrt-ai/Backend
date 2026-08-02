import { requireSupabase, supabase } from "../../config/supabase.js";
import { GENRE_KEYWORDS } from "./constants.js";
import type { GenreProfile } from "./types.js";

const CACHE_TTL_MS = 5 * 60 * 1000;

type GenreProfileRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  tempo_min: number;
  tempo_max: number;
  default_tempo: number;
  primary_scales: string[];
  secondary_scales: string[];
  common_time_signatures: string[];
  common_instruments: string[];
  melody_density: string;
  rhythm_complexity: string;
  common_intervals: string[];
  typical_note_lengths: string[];
  swing_amount: number;
  bass_style: string;
  chord_complexity: string;
  velocity_range: number[];
  humanization_amount: number;
  energy: string;
  brightness: string;
  aggressiveness: string;
  groove: string;
  mood: string[];
  active: boolean;
};

const fallbackProfiles: GenreProfile[] = [
  {
    id: "fallback-modern-trap-dancehall",
    name: "Modern Trap Dancehall",
    slug: "modern-trap-dancehall",
    description: "Dark, aggressive, minimal, bouncy, and spacious fusion of trap and dancehall aesthetics.",
    tempoMin: 95,
    tempoMax: 110,
    defaultTempo: 100,
    primaryScales: ["Natural Minor", "Minor Pentatonic"],
    secondaryScales: ["Phrygian"],
    commonTimeSignatures: ["4/4"],
    commonInstruments: ["Piano", "Bells", "Dark Keys", "Plucks", "Synth Lead", "808", "Sub Bass"],
    melodyDensity: "medium",
    rhythmComplexity: "high",
    commonIntervals: ["minor second", "minor third", "perfect fifth"],
    typicalNoteLengths: ["1/8", "1/16", "dotted 1/8"],
    swingAmount: 0.22,
    bassStyle: "syncopated 808 and sub-bass bounce",
    chordComplexity: "medium",
    velocityRange: [78, 118],
    humanizationAmount: 0.42,
    energy: "high",
    brightness: "dark",
    aggressiveness: "high",
    groove: "bouncy",
    mood: ["Dark", "Aggressive", "Minimal", "Bouncy", "Spacious"],
    active: true,
  },
  {
    id: "fallback-dancehall",
    name: "Dancehall",
    slug: "dancehall",
    description: "Rhythmic, groovy, minimal, and catchy Caribbean groove writing.",
    tempoMin: 95,
    tempoMax: 105,
    defaultTempo: 100,
    primaryScales: ["Major", "Mixolydian"],
    secondaryScales: ["Natural Minor"],
    commonTimeSignatures: ["4/4"],
    commonInstruments: ["Guitar", "Pluck", "Bass", "Percussion"],
    melodyDensity: "medium",
    rhythmComplexity: "high",
    commonIntervals: ["major second", "perfect fourth", "perfect fifth"],
    typicalNoteLengths: ["1/8", "1/16"],
    swingAmount: 0.34,
    bassStyle: "syncopated round bass movement",
    chordComplexity: "simple",
    velocityRange: [82, 116],
    humanizationAmount: 0.38,
    energy: "medium",
    brightness: "bright",
    aggressiveness: "medium",
    groove: "groovy",
    mood: ["Rhythmic", "Groovy", "Minimal", "Catchy"],
    active: true,
  },
  {
    id: "fallback-afrobeats",
    name: "Afrobeats",
    slug: "afrobeats",
    description: "Melodic, groovy, warm, and percussive contemporary Afro-pop writing.",
    tempoMin: 95,
    tempoMax: 115,
    defaultTempo: 105,
    primaryScales: ["Major", "Pentatonic Major"],
    secondaryScales: ["Mixolydian"],
    commonTimeSignatures: ["4/4"],
    commonInstruments: ["Guitar", "Bell", "Bass", "Percussion", "Keys"],
    melodyDensity: "medium",
    rhythmComplexity: "medium",
    commonIntervals: ["major second", "major third", "perfect fifth"],
    typicalNoteLengths: ["1/8", "1/16"],
    swingAmount: 0.28,
    bassStyle: "elastic melodic bass groove",
    chordComplexity: "simple",
    velocityRange: [80, 114],
    humanizationAmount: 0.34,
    energy: "medium",
    brightness: "warm",
    aggressiveness: "balanced",
    groove: "groovy",
    mood: ["Melodic", "Groovy", "Warm", "Percussive"],
    active: true,
  },
  {
    id: "fallback-amapiano",
    name: "Amapiano",
    slug: "amapiano",
    description: "Deep chordal groove driven by log drum, spacious pads, and minimal piano phrasing.",
    tempoMin: 110,
    tempoMax: 115,
    defaultTempo: 112,
    primaryScales: ["Major", "Natural Minor"],
    secondaryScales: ["Dorian"],
    commonTimeSignatures: ["4/4"],
    commonInstruments: ["Log Drum", "Deep Chords", "Wide Pads", "Minimal Piano"],
    melodyDensity: "low",
    rhythmComplexity: "medium",
    commonIntervals: ["major second", "perfect fourth"],
    typicalNoteLengths: ["1/4", "1/8"],
    swingAmount: 0.18,
    bassStyle: "log drum call-and-response bassline",
    chordComplexity: "medium",
    velocityRange: [74, 108],
    humanizationAmount: 0.26,
    energy: "medium",
    brightness: "warm",
    aggressiveness: "balanced",
    groove: "rolling",
    mood: ["Deep", "Minimal", "Groovy", "Spacious"],
    active: true,
  },
  {
    id: "fallback-trap",
    name: "Trap",
    slug: "trap",
    description: "Dark trap profile with fast hi-hats, sparse melodies, and wide 808s.",
    tempoMin: 130,
    tempoMax: 155,
    defaultTempo: 140,
    primaryScales: ["Natural Minor", "Harmonic Minor"],
    secondaryScales: ["Phrygian"],
    commonTimeSignatures: ["4/4"],
    commonInstruments: ["Piano", "Bells", "808", "Pad", "Lead Synth"],
    melodyDensity: "medium",
    rhythmComplexity: "high",
    commonIntervals: ["minor second", "minor third", "perfect fifth"],
    typicalNoteLengths: ["1/8", "1/16", "1/32"],
    swingAmount: 0.08,
    bassStyle: "long 808 glides and punchy sub emphasis",
    chordComplexity: "simple",
    velocityRange: [84, 122],
    humanizationAmount: 0.3,
    energy: "high",
    brightness: "dark",
    aggressiveness: "high",
    groove: "driving",
    mood: ["Dark", "Fast Hi-Hats", "Wide 808s"],
    active: true,
  },
  {
    id: "fallback-drill",
    name: "Drill",
    slug: "drill",
    description: "Aggressive drill profile with sliding 808s and sparse dark melodies.",
    tempoMin: 135,
    tempoMax: 145,
    defaultTempo: 140,
    primaryScales: ["Natural Minor", "Harmonic Minor"],
    secondaryScales: ["Phrygian"],
    commonTimeSignatures: ["4/4"],
    commonInstruments: ["Piano", "Strings", "808", "Choir"],
    melodyDensity: "low",
    rhythmComplexity: "high",
    commonIntervals: ["minor second", "minor third", "tritone"],
    typicalNoteLengths: ["1/8", "1/16"],
    swingAmount: 0.12,
    bassStyle: "sliding 808 phrases with sparse support",
    chordComplexity: "simple",
    velocityRange: [86, 124],
    humanizationAmount: 0.32,
    energy: "high",
    brightness: "dark",
    aggressiveness: "high",
    groove: "menacing",
    mood: ["Dark", "Sliding 808s", "Sparse Melodies", "Aggressive"],
    active: true,
  },
  {
    id: "fallback-rnb",
    name: "R&B",
    slug: "r-and-b",
    description: "Smooth and emotional profile with rich chords and long note values.",
    tempoMin: 65,
    tempoMax: 85,
    defaultTempo: 75,
    primaryScales: ["Natural Minor", "Dorian"],
    secondaryScales: ["Major"],
    commonTimeSignatures: ["4/4", "6/8"],
    commonInstruments: ["Electric Piano", "Pad", "Bass", "Soft Guitar"],
    melodyDensity: "low",
    rhythmComplexity: "medium",
    commonIntervals: ["major second", "major seventh", "minor third"],
    typicalNoteLengths: ["1/4", "1/2", "dotted 1/4"],
    swingAmount: 0.14,
    bassStyle: "smooth supportive bassline",
    chordComplexity: "rich",
    velocityRange: [62, 102],
    humanizationAmount: 0.4,
    energy: "low",
    brightness: "warm",
    aggressiveness: "low",
    groove: "smooth",
    mood: ["Smooth", "Emotional", "Rich Chords", "Long Notes"],
    active: true,
  },
  {
    id: "fallback-pop",
    name: "Pop",
    slug: "pop",
    description: "Catchy, bright, commercially focused songwriting with simple harmony.",
    tempoMin: 100,
    tempoMax: 125,
    defaultTempo: 115,
    primaryScales: ["Major", "Pentatonic Major"],
    secondaryScales: ["Natural Minor"],
    commonTimeSignatures: ["4/4"],
    commonInstruments: ["Piano", "Guitar", "Synth", "Bass"],
    melodyDensity: "medium",
    rhythmComplexity: "medium",
    commonIntervals: ["major second", "major third", "perfect fifth"],
    typicalNoteLengths: ["1/8", "1/4"],
    swingAmount: 0.1,
    bassStyle: "clean supportive pop bass",
    chordComplexity: "simple",
    velocityRange: [76, 116],
    humanizationAmount: 0.22,
    energy: "medium",
    brightness: "bright",
    aggressiveness: "balanced",
    groove: "steady",
    mood: ["Catchy", "Simple", "Bright", "Commercial"],
    active: true,
  },
  {
    id: "fallback-lofi",
    name: "Lo-Fi",
    slug: "lo-fi",
    description: "Relaxed, soft, vintage, jazz-influenced beatmaking with humanized feel.",
    tempoMin: 60,
    tempoMax: 90,
    defaultTempo: 75,
    primaryScales: ["Major", "Dorian"],
    secondaryScales: ["Natural Minor"],
    commonTimeSignatures: ["4/4"],
    commonInstruments: ["Rhodes", "Soft Piano", "Pad", "Bass"],
    melodyDensity: "low",
    rhythmComplexity: "low",
    commonIntervals: ["major second", "minor seventh", "perfect fourth"],
    typicalNoteLengths: ["1/8", "1/4", "swing 1/8"],
    swingAmount: 0.3,
    bassStyle: "soft rounded bass support",
    chordComplexity: "medium",
    velocityRange: [58, 92],
    humanizationAmount: 0.48,
    energy: "low",
    brightness: "warm",
    aggressiveness: "low",
    groove: "lazy",
    mood: ["Relaxed", "Soft", "Vintage", "Jazz Influenced"],
    active: true,
  },
];

function normalize(value: string) {
  return value.toLowerCase();
}

function tokenize(value: string) {
  return normalize(value).split(/[^a-z0-9#&]+/).filter(Boolean);
}

function mapRow(row: GenreProfileRow): GenreProfile {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    tempoMin: row.tempo_min,
    tempoMax: row.tempo_max,
    defaultTempo: row.default_tempo,
    primaryScales: row.primary_scales,
    secondaryScales: row.secondary_scales,
    commonTimeSignatures: row.common_time_signatures,
    commonInstruments: row.common_instruments,
    melodyDensity: row.melody_density,
    rhythmComplexity: row.rhythm_complexity,
    commonIntervals: row.common_intervals,
    typicalNoteLengths: row.typical_note_lengths,
    swingAmount: Number(row.swing_amount ?? 0),
    bassStyle: row.bass_style,
    chordComplexity: row.chord_complexity,
    velocityRange: row.velocity_range,
    humanizationAmount: Number(row.humanization_amount ?? 0.35),
    energy: row.energy,
    brightness: row.brightness,
    aggressiveness: row.aggressiveness,
    groove: row.groove,
    mood: row.mood,
    active: row.active,
  };
}

class GenreProfilesService {
  private cache?: GenreProfile[];
  private cacheExpiresAt = 0;
  private inFlight?: Promise<GenreProfile[]>;

  async list(activeOnly = true): Promise<GenreProfile[]> {
    const snapshot = await this.snapshot();
    return activeOnly ? snapshot.filter((profile) => profile.active) : snapshot;
  }

  async byName(value: string): Promise<GenreProfile | null> {
    const normalized = normalize(value);
    const profiles = await this.list(false);
    return profiles.find((profile) => normalize(profile.name) === normalized || normalize(profile.slug) === normalized) ?? null;
  }

  async detect(prompt: string, explicitGenre?: string): Promise<GenreProfile> {
    const profiles = await this.list(true);
    if (explicitGenre) {
      const exact = profiles.find((profile) => {
        const normalized = normalize(explicitGenre);
        return normalize(profile.name) === normalized || normalize(profile.slug) === normalized;
      });
      if (exact) return exact;
    }

    const text = normalize(prompt);
    let best: { profile: GenreProfile; score: number } | null = null;

    for (const profile of profiles) {
      const aliases = new Set<string>([
        profile.name,
        profile.slug,
        ...tokenize(profile.name),
        ...tokenize(profile.slug),
        ...profile.mood,
        ...profile.commonInstruments,
        ...profile.primaryScales,
        ...profile.secondaryScales,
        profile.bassStyle,
        profile.groove,
      ]);

      const directNameBonus = text.includes(normalize(profile.name)) || text.includes(normalize(profile.slug.replace(/-/g, " "))) ? 30 : 0;
      const aliasScore = [...aliases].reduce((total, alias) => {
        const candidate = normalize(alias);
        return candidate && text.includes(candidate) ? total + Math.max(2, candidate.length) : total;
      }, 0);

      const legacyScore = Object.entries(GENRE_KEYWORDS).reduce((total, [genre, keywords]) => {
        if (normalize(genre) !== normalize(profile.name)) return total;
        return total + keywords.reduce((sum, keyword) => sum + (text.includes(normalize(keyword)) ? keyword.length : 0), 0);
      }, 0);

      const score = directNameBonus + aliasScore + legacyScore;
      if (score > 0 && (!best || score > best.score)) best = { profile, score };
    }

    if (best) return best.profile;
    return profiles.find((profile) => normalize(profile.slug) === "pop") ?? profiles[0] ?? fallbackProfiles[0];
  }

  private async snapshot(): Promise<GenreProfile[]> {
    const now = Date.now();
    if (this.cache && now < this.cacheExpiresAt) return this.cache;
    if (this.inFlight) return this.inFlight;

    this.inFlight = this.load();
    const result = await this.inFlight;
    this.cache = result;
    this.cacheExpiresAt = now + CACHE_TTL_MS;
    this.inFlight = undefined;
    return result;
  }

  private async load(): Promise<GenreProfile[]> {
    if (!supabase) {
      return fallbackProfiles;
    }
    const { data, error } = await requireSupabase()
      .from("genre_profiles")
      .select("id, name, slug, description, tempo_min, tempo_max, default_tempo, primary_scales, secondary_scales, common_time_signatures, common_instruments, melody_density, rhythm_complexity, common_intervals, typical_note_lengths, swing_amount, bass_style, chord_complexity, velocity_range, humanization_amount, energy, brightness, aggressiveness, groove, mood, active")
      .order("name");
    if (error || !data?.length) {
      return fallbackProfiles;
    }
    return (data as GenreProfileRow[]).map(mapRow);
  }
}

export const genreProfilesService = new GenreProfilesService();