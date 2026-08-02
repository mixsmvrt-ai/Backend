import type { PitchAnalysisRecord, PitchAnalysisRequest, PitchAnalysisResult, PitchAudioSource, PitchProviderName } from "./types.js";

export interface PitchDetectionProvider {
  readonly name: PitchProviderName;
  analyze(filePath: string, source: PitchAudioSource, threshold: number): Promise<PitchAnalysisResult>;
}

export interface PitchAnalysisRepository {
  getAudioSource(userId: string, audioId: string): Promise<PitchAudioSource>;
  downloadProcessedAudio(source: PitchAudioSource): Promise<string>;
  createAnalysis(userId: string, source: PitchAudioSource, provider: PitchProviderName, analysis: PitchAnalysisResult): Promise<PitchAnalysisRecord>;
  getAnalysis(userId: string, analysisId: string): Promise<PitchAnalysisRecord>;
  deleteAnalysis(userId: string, analysisId: string): Promise<void>;
}

export interface PitchDetectionService {
  analyze(userId: string, request: PitchAnalysisRequest): Promise<PitchAnalysisRecord>;
  get(userId: string, analysisId: string): Promise<PitchAnalysisRecord>;
  remove(userId: string, analysisId: string): Promise<void>;
}