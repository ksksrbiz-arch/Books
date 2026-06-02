/**
 * Centralised Gemini / fallback model identifiers.
 *
 * Update model names here in one place when Google promotes a preview model
 * to GA, deprecates a model, or you want to point at a different vendor.
 *
 * The names below favour Generally Available models. The older preview names
 * used in earlier revisions of this codebase (e.g. `gemini-3.1-pro-preview`,
 * `gemini-3.5-flash`) had no SLA and are kept only as last-resort fallbacks.
 */

// ----- Primary text generation -----
export const TEXT_PRIMARY_MODEL = process.env.GEMINI_TEXT_PRIMARY_MODEL || "gemini-2.5-pro";
export const TEXT_FALLBACK_MODEL = process.env.GEMINI_TEXT_FALLBACK_MODEL || "gemini-2.5-flash";

// ----- "Light" / fast text generation (creative prompts, summaries) -----
export const TEXT_LIGHT_MODEL = process.env.GEMINI_TEXT_LIGHT_MODEL || "gemini-2.5-flash";

// ----- Image generation -----
// `imagen-3.0-generate-002` is the GA Imagen model. The preview
// `gemini-2.5-flash-image-preview` is kept as a fallback because it is what
// the original AI Studio scaffolding targeted.
export const IMAGE_PRIMARY_MODEL = process.env.GEMINI_IMAGE_PRIMARY_MODEL || "imagen-3.0-generate-002";
export const IMAGE_FALLBACK_MODEL = process.env.GEMINI_IMAGE_FALLBACK_MODEL || "gemini-2.5-flash-image-preview";

// ----- Video generation -----
// Veo is currently in preview; surface as env-overridable.
export const VIDEO_MODEL = process.env.GEMINI_VIDEO_MODEL || "veo-2.0-generate-001";

// ----- Cross-vendor fallback (OpenAI) -----
export const OPENAI_FALLBACK_MODEL = process.env.OPENAI_FALLBACK_MODEL || "gpt-4o-mini";

export const MODEL_IDS = {
  TEXT_PRIMARY_MODEL,
  TEXT_FALLBACK_MODEL,
  TEXT_LIGHT_MODEL,
  IMAGE_PRIMARY_MODEL,
  IMAGE_FALLBACK_MODEL,
  VIDEO_MODEL,
  OPENAI_FALLBACK_MODEL,
} as const;
