import type { ModelSelectionResult } from "./types.js";

export class FallbackService {
  sequence(selection: ModelSelectionResult) {
    return [selection.primaryModel, selection.fallbackModel].filter((model, index, values): model is string => Boolean(model) && values.indexOf(model) === index);
  }
}

export const fallbackService = new FallbackService();