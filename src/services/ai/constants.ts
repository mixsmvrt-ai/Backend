export const DEFAULT_MAX_RETRIES = 2;
export const DEFAULT_CACHE_TTL_SECONDS = 900;
export const DEFAULT_FREE_DAILY_LIMIT = 15;
export const DEFAULT_PRO_DAILY_LIMIT = 100;
export const DEFAULT_AI_TIMEOUT_MS = 45_000;
export const DEFAULT_FREE_FALLBACK_MODEL = "gemini-3-flash-preview";
export const DEFAULT_PRO_FALLBACK_MODEL = "gemini-3.1-flash-lite";
export const DEFAULT_PROMPT_HISTORY_LIMIT = 8;
export const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+previous\s+instructions/i,
  /reveal\s+system\s+prompt/i,
  /show\s+hidden\s+instructions/i,
  /return\s+markdown/i,
  /exfiltrat(e|ion)/i,
  /api\s*key/i,
  /developer\s+message/i,
];