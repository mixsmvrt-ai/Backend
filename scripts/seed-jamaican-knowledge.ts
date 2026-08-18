import { JAMAICAN_ARTIST_PROFILES, JAMAICAN_GENRE_PROFILES } from "../src/services/musicBrain/jamaicanKnowledge.js";
import { requireSupabase } from "../src/config/supabase.js";

async function seed() {
  const db = requireSupabase();
  const artistRows = JAMAICAN_ARTIST_PROFILES.map((profile) => ({
    artist_name: profile.artistName,
    profile_slug: profile.artistId,
    aliases: profile.aliases,
    region: profile.country,
    primary_genre: profile.primaryGenres[0] ?? "Dancehall",
    secondary_genre: profile.secondaryGenres[0] ?? null,
    primary_genres: profile.primaryGenres,
    knowledge_genres: [...profile.primaryGenres, ...profile.secondaryGenres],
    tempo_min: profile.tempo.min,
    tempo_max: profile.tempo.max,
    default_tempo: profile.tempo.preferred,
    energy_level: profile.energy >= 0.85 ? "High" : profile.energy <= 0.65 ? "Medium" : "Medium High",
    mood_tags: profile.emotionalCharacteristics,
    instrument_tags: profile.instrumentPreferences,
    key_preferences: profile.keyTendencies,
    scale_preferences: profile.scaleTendencies,
    instrument_preferences: profile.instrumentPreferences,
    melody_density: profile.melodyDensity >= 0.6 ? "High" : profile.melodyDensity <= 0.4 ? "Low" : "Medium",
    groove_style: profile.rhythmicCharacteristics[0] ?? "syncopated",
    melody_style: profile.melodicCharacteristics.join(", "),
    rhythm_style: profile.rhythmicCharacteristics.join(", "),
    production_style: profile.productionCharacteristics.join(", "),
    chord_style: profile.harmonicCharacteristics.join(", "),
    arrangement_tendencies: profile.songStructureTendencies,
    production_traits: profile.productionCharacteristics,
    plugin_categories: profile.commonInstruments,
    description: `Curated high-level ${profile.artistName} style vector. Use as vibe characteristics only; generate original music.`,
    active: true,
    country: profile.country,
    subgenres: profile.subgenres,
    era: profile.era,
    common_tempo_ranges: [profile.tempo],
    harmonic_characteristics: profile.harmonicCharacteristics,
    melodic_characteristics: profile.melodicCharacteristics,
    rhythmic_characteristics: profile.rhythmicCharacteristics,
    bass_characteristics: profile.bassCharacteristics,
    common_instruments: profile.commonInstruments,
    note_density: profile.noteDensity,
    phrase_length: profile.phraseLength,
    motif_repetition: profile.motifRepetition,
    syncopation_level: profile.syncopation,
    rhythmic_complexity: profile.rhythmicComplexity,
    chord_complexity: profile.chordComplexity,
    register_preferences: profile.register,
    octave_usage: profile.octaveUsage,
    tension_and_release: profile.tensionAndRelease,
    emotional_characteristics: profile.emotionalCharacteristics,
    energy_profile: profile.energy,
    song_structure_tendencies: profile.songStructureTendencies,
    reference_pack_weights: profile.referencePackWeights,
    confidence_score: profile.confidenceScore,
    source_metadata: profile.sourceMetadata,
    version: 1,
    status: "pending",
    last_verified: null,
  }));
  const { data: artists, error: artistError } = await db.from("artist_profiles").upsert(artistRows, { onConflict: "artist_name" }).select("id, artist_name, profile_slug");
  if (artistError) throw artistError;
  const artistIdBySlug = new Map((artists ?? []).map((row) => [row.profile_slug, row.id]));

  for (const profile of JAMAICAN_ARTIST_PROFILES) {
    const artistId = artistIdBySlug.get(profile.artistId);
    if (!artistId) continue;
    const { error: styleError } = await db.from("artist_style_features").upsert({ artist_id: artistId, style_vector: { tempo: profile.tempo, melody_density: profile.melodyDensity, note_density: profile.noteDensity, phrase_length: profile.phraseLength, motif_repetition: profile.motifRepetition, syncopation: profile.syncopation, rhythmic_complexity: profile.rhythmicComplexity, chord_complexity: profile.chordComplexity, register: profile.register, energy: profile.energy, instruments: profile.instruments }, key_tendencies: profile.keyTendencies, scale_tendencies: profile.scaleTendencies, instrument_preferences: profile.instrumentPreferences }, { onConflict: "artist_id" });
    if (styleError) throw styleError;
    const { data: songRows, error: songError } = await db.from("artist_songs").upsert(profile.songs.map((song) => ({ artist_id: artistId, song_id: song.songId, title: song.title, release_year: song.releaseYear, genre: song.genre, subgenre: song.subgenre, bpm_if_legally_available: song.bpm, key_if_legally_available: song.key, mode_if_legally_available: song.mode, duration_if_legally_available_seconds: song.durationSeconds, instrumentation: song.instrumentation, musical_features: song.musicalFeatures, source: song.source, source_type: song.sourceType, source_url: song.sourceUrl, license_status: song.licenseStatus, confidence: 0, status: "pending", last_verified: null, version: 1 })), { onConflict: "song_id" }).select("id, song_id");
    if (songError) throw songError;
    const songIds = new Map((songRows ?? []).map((row) => [row.song_id, row.id]));
    const evidenceRows = profile.songs.flatMap((song) => {
      const songId = songIds.get(song.songId);
      return songId ? [{ entity_type: "song", entity_id: songId, attribute_name: "song_metadata", value: { title: song.title, release_year: song.releaseYear, genre: song.genre, subgenre: song.subgenre }, source: song.source, source_url: song.sourceUrl, source_type: song.sourceType, confidence: 0, status: "pending", last_verified: null, version: 1 }] : [];
    });
    if (evidenceRows.length) {
      const { error: evidenceError } = await db.from("knowledge_attribute_evidence").upsert(evidenceRows, { onConflict: "entity_type,entity_id,attribute_name,version" });
      if (evidenceError) throw evidenceError;
    }
    const { error: weightError } = await db.from("artist_reference_weights").upsert(Object.entries(profile.referencePackWeights).map(([referencePack, weight]) => ({ artist_id: artistId, reference_pack: referencePack, weight, source: profile.sourceMetadata.source, confidence: profile.confidenceScore })), { onConflict: "artist_id,reference_pack" });
    if (weightError && !/constraint|unique/i.test(weightError.message)) throw weightError;
  }

  for (const profile of JAMAICAN_GENRE_PROFILES) {
    const { data: genreRow, error: genreError } = await db.from("genre_profiles").upsert({ name: profile.genreName, slug: profile.genreId, tempo_min: profile.tempoRange.min, tempo_max: profile.tempoRange.max, default_tempo: profile.tempoRange.preferred, primary_scales: profile.scaleTendencies, common_instruments: profile.instrumentation, melody_density: profile.melodyDensity > 0.55 ? "high" : profile.melodyDensity < 0.4 ? "low" : "medium", rhythm_complexity: profile.syncopation > 0.7 ? "high" : "medium", bass_style: profile.bassTendencies.join(", "), chord_complexity: profile.chordTendencies.length > 2 ? "medium" : "simple", energy: profile.energy > 0.8 ? "high" : "medium", groove: profile.rhythmCharacteristics[0] ?? "groove-led", active: true }, { onConflict: "name" }).select("id").single();
    if (genreError || !genreRow) throw genreError ?? new Error(`Genre ${profile.genreName} was not created.`);
    const { error: styleError } = await db.from("genre_style_features").upsert({ genre_id: genreRow.id, tempo_range: profile.tempoRange, key_tendencies: profile.keyTendencies, scale_tendencies: profile.scaleTendencies, rhythm_characteristics: profile.rhythmCharacteristics, melody_density: profile.melodyDensity, chord_tendencies: profile.chordTendencies, bass_tendencies: profile.bassTendencies, instrumentation: profile.instrumentation, phrase_structures: profile.phraseStructures, syncopation: profile.syncopation, energy: profile.energy, production_characteristics: profile.productionCharacteristics, reference_pack_weights: profile.referencePackWeights }, { onConflict: "genre_id" });
    if (styleError) throw styleError;
  }
}

await seed();