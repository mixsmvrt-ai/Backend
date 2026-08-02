export class TrimSilenceService {
  filters() {
    return ["silenceremove=start_periods=1:start_duration=0.05:start_threshold=-45dB:stop_periods=-1:stop_duration=0.2:stop_threshold=-45dB"];
  }
}

export const trimSilenceService = new TrimSilenceService();