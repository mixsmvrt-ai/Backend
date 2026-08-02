import type { ComplexityLevel, GenerationType, HumanizationLevel, SupportedGenre, SupportedMood } from "./types.js";

export const SUPPORTED_GENRES: SupportedGenre[] = [
  "Trap", "Drill", "Hip Hop", "Boom Bap", "LoFi", "House", "EDM", "Future Bass",
  "Dubstep", "Techno", "Afrobeats", "Dancehall", "Reggae", "R&B", "Soul",
  "Jazz", "Pop", "Rock", "Classical", "Orchestral", "Latin", "Gospel",
  "Country", "Synthwave", "Phonk", "Cinematic",
];

export const SUPPORTED_MOODS: SupportedMood[] = [
  "Dark", "Happy", "Sad", "Aggressive", "Dreamy", "Epic", "Relaxed",
  "Melancholy", "Energetic", "Calm", "Emotional", "Hopeful", "Mysterious",
];

export const GENRE_KEYWORDS: Record<SupportedGenre, string[]> = {
  Trap: ["trap", "rage", "plugg", "dark bell", "808"],
  Drill: ["drill", "uk drill", "brooklyn drill"],
  "Hip Hop": ["hip hop", "hip-hop", "rap"],
  "Boom Bap": ["boom bap", "boombap"],
  LoFi: ["lofi", "lo-fi", "lo fi"],
  House: ["house", "deep house"],
  EDM: ["edm", "festival"],
  "Future Bass": ["future bass"],
  Dubstep: ["dubstep", "riddim"],
  Techno: ["techno"],
  Afrobeats: ["afrobeats", "afrobeat", "afro"],
  Dancehall: ["dancehall"],
  Reggae: ["reggae"],
  "R&B": ["r&b", "rnb", "r b"],
  Soul: ["soul"],
  Jazz: ["jazz"],
  Pop: ["pop"],
  Rock: ["rock"],
  Classical: ["classical"],
  Orchestral: ["orchestral", "orchestra"],
  Latin: ["latin", "reggaeton", "salsa", "bachata"],
  Gospel: ["gospel"],
  Country: ["country"],
  Synthwave: ["synthwave", "retrowave"],
  Phonk: ["phonk"],
  Cinematic: ["cinematic", "trailer", "score"],
};

export const MOOD_KEYWORDS: Record<SupportedMood, string[]> = {
  Dark: ["dark", "evil", "sinister", "menacing"],
  Happy: ["happy", "bright", "uplifting"],
  Sad: ["sad", "pain", "lonely", "heartbreak"],
  Aggressive: ["aggressive", "hard", "angry", "violent"],
  Dreamy: ["dreamy", "floating", "ethereal", "ambient"],
  Epic: ["epic", "huge", "anthemic", "triumphant"],
  Relaxed: ["relaxed", "chill", "laid back", "smooth"],
  Melancholy: ["melancholy", "nostalgic", "bittersweet"],
  Energetic: ["energetic", "bouncy", "dance", "hype"],
  Calm: ["calm", "peaceful", "soft"],
  Emotional: ["emotional", "feeling", "soulful"],
  Hopeful: ["hopeful", "inspiring"],
  Mysterious: ["mysterious", "spacey", "unknown"],
};

export const TEMPO_BY_GENRE: Record<SupportedGenre, [number, number]> = {
  Trap: [140, 150],
  Drill: [138, 144],
  "Hip Hop": [85, 100],
  "Boom Bap": [82, 94],
  LoFi: [65, 85],
  House: [120, 128],
  EDM: [126, 130],
  "Future Bass": [140, 160],
  Dubstep: [140, 150],
  Techno: [126, 135],
  Afrobeats: [95, 115],
  Dancehall: [90, 110],
  Reggae: [70, 90],
  "R&B": [65, 90],
  Soul: [70, 95],
  Jazz: [90, 140],
  Pop: [95, 125],
  Rock: [100, 140],
  Classical: [70, 120],
  Orchestral: [70, 120],
  Latin: [90, 120],
  Gospel: [75, 110],
  Country: [85, 120],
  Synthwave: [90, 115],
  Phonk: [140, 165],
  Cinematic: [70, 120],
};

export const DEFAULT_INSTRUMENTS_BY_GENRE: Record<SupportedGenre, string[]> = {
  Trap: ["Bell", "Piano", "808"],
  Drill: ["Piano", "Strings", "808"],
  "Hip Hop": ["Rhodes", "Bass", "Drums"],
  "Boom Bap": ["Rhodes", "Brass", "Drums"],
  LoFi: ["Rhodes", "Soft Piano", "Pad"],
  House: ["Piano", "Synth Bass", "Pad"],
  EDM: ["Lead Synth", "Pluck", "Supersaw"],
  "Future Bass": ["Supersaw", "Vocal Chop", "Pad"],
  Dubstep: ["Growl Bass", "Lead Synth", "Sub Bass"],
  Techno: ["Synth", "Bass", "Percussion"],
  Afrobeats: ["Guitar", "Marimba", "Bass"],
  Dancehall: ["Pluck", "Guitar", "Bass"],
  Reggae: ["Organ", "Guitar", "Bass"],
  "R&B": ["Electric Piano", "Pad", "Bass"],
  Soul: ["Organ", "Rhodes", "Bass"],
  Jazz: ["Piano", "Upright Bass", "Brass"],
  Pop: ["Piano", "Guitar", "Synth"],
  Rock: ["Guitar", "Bass", "Strings"],
  Classical: ["Piano", "Strings", "Flute"],
  Orchestral: ["Strings", "Brass", "Choir"],
  Latin: ["Guitar", "Piano", "Brass"],
  Gospel: ["Organ", "Piano", "Choir"],
  Country: ["Guitar", "Piano", "Strings"],
  Synthwave: ["Analog Synth", "Pad", "Bass"],
  Phonk: ["Cowbell", "808", "Pad"],
  Cinematic: ["Strings", "Choir", "Brass"],
};

export const INSTRUMENT_KEYWORDS: Record<string, string[]> = {
  Bell: ["bell", "bells", "glockenspiel", "music box"],
  Piano: ["piano", "keys"],
  Pad: ["pad", "pads", "atmosphere"],
  Lead: ["lead", "lead synth"],
  Strings: ["strings", "violin", "cello"],
  Choir: ["choir", "vocal", "voices"],
  "808": ["808", "sub"],
  Synth: ["synth", "synthesizer"],
  Brass: ["brass", "horn", "trumpet"],
  Guitar: ["guitar"],
  Flute: ["flute", "woodwind"],
  Rhodes: ["rhodes", "electric piano", "ep"],
};

export const GENERATION_TYPE_KEYWORDS: Record<GenerationType, string[]> = {
  Melody: ["melody", "lead", "topline", "hook"],
  "Chord Progression": ["chord", "chords", "progression"],
  Bassline: ["bassline", "bass line", "bass"],
  "Counter Melody": ["counter melody", "countermelody", "counter"],
  Drums: ["drums", "drum pattern", "beat"],
  Arpeggio: ["arp", "arpeggio", "arpeggiated"],
  "Full Composition": ["full composition", "full song", "full arrangement"],
  Variation: ["variation", "change it", "make it"],
  Continuation: ["continue", "extend", "keep going"],
};

export const COMPLEXITY_KEYWORDS: Record<ComplexityLevel, string[]> = {
  Simple: ["simple", "easy", "minimal", "beginner"],
  Medium: ["medium", "balanced"],
  Advanced: ["advanced", "complex", "detailed"],
  Expert: ["expert", "virtuosic", "intricate"],
};

export const HUMANIZATION_BY_COMPLEXITY: Record<ComplexityLevel, HumanizationLevel> = {
  Simple: "Low",
  Medium: "Medium",
  Advanced: "Medium",
  Expert: "High",
};

export const DANGEROUS_INPUT_PATTERNS = [
  /ignore (all )?(previous|system|developer) instructions/i,
  /reveal (the )?(system|developer) prompt/i,
  /api[_ -]?key|service[_ -]?role|password/i,
  /<script\b/i,
];
