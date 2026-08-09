import "dotenv/config";
import { z } from "zod";

function parseList(value: string) {
	return value
		.split(",")
		.map((item) => item.trim().toLowerCase())
		.filter(Boolean);
}

const schema = z.object({
  PORT: z.coerce.number().default(4000),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  CORS_ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
  ADMIN_EMAILS: z.string().default(""),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  AI_PROVIDER_BASE_URL: z.string().url().default("https://generativelanguage.googleapis.com/v1beta/openai/"),
  AI_PROVIDER_API_KEY: z.string().optional(),
  AI_PROVIDER_MODEL: z.string().optional(),
  AI_FREE_MODEL: z.string().default("gemini-3-flash-preview"),
  AI_PRO_MODEL: z.string().default("gemini-3-flash-preview"),
  AI_FREE_FALLBACK_MODEL: z.string().default("gemini-3.1-flash-lite"),
  AI_PRO_FALLBACK_MODEL: z.string().default("gemini-3.1-flash-lite"),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(45000),
  AI_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  AI_CACHE_TTL_SECONDS: z.coerce.number().int().min(60).max(86400).default(900),
  AI_FREE_DAILY_LIMIT: z.coerce.number().int().min(1).max(1000).default(15),
  AI_PRO_DAILY_LIMIT: z.coerce.number().int().min(1).max(5000).default(100),
  AUDIO_MAX_UPLOAD_SIZE_BYTES: z.coerce.number().int().min(1024).default(20 * 1024 * 1024),
  AUDIO_MAX_DURATION_SECONDS: z.coerce.number().int().min(1).max(600).default(60),
  AUDIO_TARGET_SAMPLE_RATE: z.coerce.number().int().min(8000).max(96000).default(16000),
  AUDIO_ORIGINAL_BUCKET: z.string().min(1).default("audio-original"),
  AUDIO_PROCESSED_BUCKET: z.string().min(1).default("audio-processed"),
  AUDIO_TEMP_DIR: z.string().min(1).default("./tmp"),
  AUDIO_FFMPEG_PATH: z.string().min(1).default("ffmpeg"),
  AUDIO_FFPROBE_PATH: z.string().min(1).default("ffprobe"),
  AUDIO_PROCESS_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300000).default(60000),
  REFERENCE_MIDI_DIRS: z.string().optional(),
  REFERENCE_MIDI_INDEX_PATH: z.string().min(1).default("./.cache/reference-midi-index.json"),
  AUDIO_ENABLE_HIGH_PASS_FILTER: z.coerce.boolean().default(true),
  PITCH_DEFAULT_PROVIDER: z.enum(["aubio", "crepe", "essentia"]).default("aubio"),
  PITCH_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.55),
  PITCH_ANALYSIS_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300000).default(45000),
  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  PAYPAL_WEBHOOK_ID: z.string().optional(),
  PAYPAL_ENVIRONMENT: z.enum(["sandbox", "live"]).default("sandbox"),
  PRO_MONTHLY_PRICE_CENTS: z.coerce.number().int().min(1).default(1200),
  PRO_PASS_PRICE_CENTS: z.coerce.number().int().min(1).optional(),
  GO_PLAN_PRICE_CENTS: z.coerce.number().int().min(1).default(599),
  PLUS_PLAN_PRICE_CENTS: z.coerce.number().int().min(1).default(1999),
  PRO_CURRENCY: z.string().length(3).default("USD"),
  API_KEY_PEPPER: z.string().min(1).default("development-only")
});

const parsed = schema.parse({
  ...process.env,
  AI_PROVIDER_API_KEY: process.env.AI_PROVIDER_API_KEY ?? process.env.GEMINI_API_KEY,
});

export const env = {
	...parsed,
	ADMIN_EMAILS: parseList(parsed.ADMIN_EMAILS),
};
