import {
  buildStudioWaveformBarsFromChannels,
  buildStudioWaveformBarsFromLevels,
  DEFAULT_STUDIO_WAVEFORM_BARS,
  STUDIO_WAVEFORM_BAR_COUNT,
} from './studioWaveform';

describe('studioWaveform', () => {
  it('returns the fallback profile when no live levels exist', () => {
    expect(buildStudioWaveformBarsFromLevels([])).toEqual([...DEFAULT_STUDIO_WAVEFORM_BARS]);
  });

  it('maps arbitrary live levels into the configured bar count', () => {
    const bars = buildStudioWaveformBarsFromLevels([0, 1, 0.5, 0.25, 0.9, 0.1], 6);

    expect(bars).toHaveLength(6);
    expect(Math.max(...bars)).toBeLessThanOrEqual(0.96);
    expect(Math.min(...bars)).toBeGreaterThanOrEqual(0.18);
    expect(bars[1]).toBeGreaterThan(bars[0]);
  });

  it('derives waveform peaks from channel data without changing the output count', () => {
    const channelA = new Float32Array([0, 0.2, 0.6, 0.1, 0.8, 0.1, 0.4, 0]);
    const channelB = new Float32Array([0.1, 0.4, 0.2, 0.1, 0.7, 0.2, 0.3, 0]);

    const bars = buildStudioWaveformBarsFromChannels([channelA, channelB], channelA.length, 4);

    expect(bars).toHaveLength(4);
    expect(bars[2]).toBeGreaterThan(bars[0]);
  });

  it('keeps the default bar count for decoded audio', () => {
    const channel = new Float32Array(STUDIO_WAVEFORM_BAR_COUNT * 2).fill(0.35);
    const bars = buildStudioWaveformBarsFromChannels([channel], channel.length);

    expect(bars).toHaveLength(STUDIO_WAVEFORM_BAR_COUNT);
  });
});
