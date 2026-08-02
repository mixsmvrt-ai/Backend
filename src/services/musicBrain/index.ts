import type { MusicBrainInput } from "./types.js";
import { MusicBrainAnalyzer } from "./analyzer.js";
import { MusicBrainEnricher } from "./enricher.js";
import { MusicBrainPromptBuilder } from "./promptBuilder.js";

export class MusicBrainService {
  constructor(
    private readonly analyzer = new MusicBrainAnalyzer(),
    private readonly enricher = new MusicBrainEnricher(),
    private readonly promptBuilder = new MusicBrainPromptBuilder(),
  ) {}

  async prepare(input: MusicBrainInput) {
    const analyzed = await this.analyzer.analyze(input);
    const context = await this.enricher.enrich(analyzed);
    return { context, providerPrompt: this.promptBuilder.build(context) };
  }
}

export const musicBrainService = new MusicBrainService();
export * from "./types.js";
