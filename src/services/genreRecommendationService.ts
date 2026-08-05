import { loadMusicBrainKnowledge } from "../music-brain/loader.js";
import { requireSupabase } from "../config/supabase.js";

export interface GenreAdvice {
  genre: string | null;
  bpmRange: [number, number] | null;
  scaleHints: string[];
  instrumentHints: string[];
  arrangementHints: string[];
  bassBehavior: string | null;
}

export class GenreRecommendationService {
  async resolve(projectGenre: string | null) {
    const knowledge = await loadMusicBrainKnowledge();
    const direct = projectGenre ? knowledge.genres.find((genre) => genre.name.toLowerCase() === projectGenre.toLowerCase()) : null;
    if (direct) {
      return {
        genre: direct.name,
        bpmRange: direct.bpm,
        scaleHints: direct.commonScales,
        instrumentHints: direct.typicalInstruments,
        arrangementHints: direct.arrangementTendencies,
        bassBehavior: direct.bassBehavior,
      } satisfies GenreAdvice;
    }

    const { data } = await requireSupabase().from("genre_profiles").select("name, tempo_min, tempo_max, primary_scales, common_instruments, bass_style").eq("active", true).limit(6);
    const fallback = data?.[0];
    return {
      genre: typeof fallback?.name === "string" ? fallback.name : projectGenre,
      bpmRange: fallback ? [fallback.tempo_min, fallback.tempo_max] as [number, number] : null,
      scaleHints: Array.isArray(fallback?.primary_scales) ? fallback.primary_scales as string[] : [],
      instrumentHints: Array.isArray(fallback?.common_instruments) ? fallback.common_instruments as string[] : [],
      arrangementHints: [],
      bassBehavior: typeof fallback?.bass_style === "string" ? fallback.bass_style : null,
    } satisfies GenreAdvice;
  }
}

export const genreRecommendationService = new GenreRecommendationService();