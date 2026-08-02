export class ResamplerService {
  filters(sampleRate: number) {
    return ["aformat=channel_layouts=mono", `aresample=${sampleRate}`];
  }
}

export const resamplerService = new ResamplerService();