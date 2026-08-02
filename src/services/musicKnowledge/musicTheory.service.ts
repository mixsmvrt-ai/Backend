import { chordsKnowledgeService } from "./chords.service.js";
import { keysKnowledgeService } from "./keys.service.js";
import { scalesKnowledgeService } from "./scales.service.js";

export class MusicTheoryKnowledgeService {
  keys = keysKnowledgeService;
  scales = scalesKnowledgeService;
  chords = chordsKnowledgeService;
}

export const musicTheoryKnowledgeService = new MusicTheoryKnowledgeService();
