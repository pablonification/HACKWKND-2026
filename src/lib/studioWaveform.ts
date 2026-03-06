const WAVEFORM_MIN_LEVEL = 0.18;
const WAVEFORM_MAX_LEVEL = 0.96;

export const DEFAULT_STUDIO_WAVEFORM_BARS = [
  0.42, 0.64, 0.36, 0.55, 0.48, 0.6, 0.68, 0.58, 0.63, 0.34, 0.71, 0.29, 0.57, 0.44, 0.33, 0.86,
  0.74, 0.95, 0.67, 0.81, 0.53, 0.61, 0.47, 0.35, 0.49, 0.56, 0.38, 0.41, 0.28, 0.46, 0.52, 0.32,
] as const;

export const STUDIO_WAVEFORM_BAR_COUNT = DEFAULT_STUDIO_WAVEFORM_BARS.length;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const toRenderableLevel = (value: number): number => {
  const normalized = clamp(value, 0, 1);
  return WAVEFORM_MIN_LEVEL + normalized * (WAVEFORM_MAX_LEVEL - WAVEFORM_MIN_LEVEL);
};

const getFallbackBars = (barCount: number): number[] => {
  if (barCount === STUDIO_WAVEFORM_BAR_COUNT) {
    return [...DEFAULT_STUDIO_WAVEFORM_BARS];
  }

  const sourceLength = DEFAULT_STUDIO_WAVEFORM_BARS.length;
  return Array.from({ length: barCount }, (_, index) => {
    const sourceIndex = Math.floor((index / Math.max(1, barCount - 1)) * (sourceLength - 1));
    return DEFAULT_STUDIO_WAVEFORM_BARS[sourceIndex] ?? DEFAULT_STUDIO_WAVEFORM_BARS[0];
  });
};

export const buildStudioWaveformBarsFromLevels = (
  levels: ArrayLike<number>,
  barCount: number = STUDIO_WAVEFORM_BAR_COUNT,
): number[] => {
  if (barCount <= 0) {
    return [];
  }

  if (levels.length === 0) {
    return getFallbackBars(barCount);
  }

  const groupedPeaks = Array.from({ length: barCount }, (_, index) => {
    const start = Math.floor((index * levels.length) / barCount);
    const end = Math.max(start + 1, Math.floor(((index + 1) * levels.length) / barCount));
    let peak = 0;

    for (let cursor = start; cursor < end; cursor += 1) {
      peak = Math.max(peak, Number(levels[cursor] ?? 0));
    }

    return peak;
  });

  const maxPeak = Math.max(...groupedPeaks, 0);
  if (maxPeak <= 0) {
    return groupedPeaks.map(() => toRenderableLevel(0));
  }

  return groupedPeaks.map((value) => toRenderableLevel(value / maxPeak));
};

export const buildStudioWaveformBarsFromChannels = (
  channels: ArrayLike<ArrayLike<number>>,
  sampleCount: number,
  barCount: number = STUDIO_WAVEFORM_BAR_COUNT,
): number[] => {
  if (barCount <= 0) {
    return [];
  }

  if (channels.length === 0 || sampleCount <= 0) {
    return getFallbackBars(barCount);
  }

  const channelCount = channels.length;
  const groupedPeaks = Array.from({ length: barCount }, (_, index) => {
    const start = Math.floor((index * sampleCount) / barCount);
    const end = Math.max(start + 1, Math.floor(((index + 1) * sampleCount) / barCount));
    const stride = Math.max(1, Math.floor((end - start) / 64));
    let peak = 0;

    for (let cursor = start; cursor < end; cursor += stride) {
      let mixedSample = 0;
      for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
        mixedSample += Math.abs(Number(channels[channelIndex]?.[cursor] ?? 0));
      }
      peak = Math.max(peak, mixedSample / channelCount);
    }

    return peak;
  });

  const maxPeak = Math.max(...groupedPeaks, 0);
  if (maxPeak <= 0) {
    return groupedPeaks.map(() => toRenderableLevel(0));
  }

  return groupedPeaks.map((value) => toRenderableLevel(value / maxPeak));
};
