export class NormalizerService {
  filters() {
    return ["loudnorm=I=-16:LRA=11:TP=-1.5", "alimiter=limit=0.95"];
  }
}

export const normalizerService = new NormalizerService();