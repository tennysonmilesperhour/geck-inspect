/**
 * useWeightHealthScore — analyzes a gecko's weight records to produce
 * a health score (green/yellow/red) and trend data.
 *
 * Algorithm:
 *   1. Sort records by date ascending
 *   2. Compute a 3-point moving average (smoothed curve)
 *   3. Compare the latest weight to the average of the last 30 days
 *   4. Flag drops > 5% as "warning", > 10% as "critical"
 *   5. Return a color-coded health badge + trend direction
 */
import { useMemo } from 'react';

function movingAverage(records, window = 3) {
  return records.map((r, i) => {
    const start = Math.max(0, i - Math.floor(window / 2));
    const end = Math.min(records.length, i + Math.ceil(window / 2));
    const slice = records.slice(start, end);
    const avg = slice.reduce((sum, s) => sum + s.weight, 0) / slice.length;
    return { ...r, smoothed: Math.round(avg * 10) / 10 };
  });
}

export function useWeightHealthScore(weightRecords) {
  return useMemo(() => {
    if (!weightRecords || weightRecords.length < 2) {
      return {
        score: 'unknown',
        color: 'slate',
        label: 'Not enough data',
        trend: null,
        percentChange: null,
        smoothedRecords: [],
      };
    }

    // Sort by date ascending
    const sorted = [...weightRecords]
      .filter(r => r.weight > 0 && r.date)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (sorted.length < 2) {
      return {
        score: 'unknown',
        color: 'slate',
        label: 'Not enough data',
        trend: null,
        percentChange: null,
        smoothedRecords: [],
      };
    }

    const smoothed = movingAverage(sorted);
    const latest = smoothed[smoothed.length - 1].smoothed;

    // Compare to average of previous entries (up to last 5)
    const prevEntries = smoothed.slice(-6, -1);
    const prevAvg = prevEntries.reduce((s, r) => s + r.smoothed, 0) / prevEntries.length;

    const percentChange = prevAvg > 0
      ? Math.round(((latest - prevAvg) / prevAvg) * 1000) / 10
      : 0;

    let score, color, label;
    if (percentChange <= -10) {
      score = 'critical';
      color = 'red';
      label = `Dropped ${Math.abs(percentChange)}% — check in immediately`;
    } else if (percentChange <= -5) {
      score = 'warning';
      color = 'amber';
      label = `Down ${Math.abs(percentChange)}% — monitor closely`;
    } else if (percentChange >= 5) {
      score = 'growing';
      color = 'emerald';
      label = `Up ${percentChange}% — healthy growth`;
    } else {
      score = 'stable';
      color = 'emerald';
      label = 'Weight is stable';
    }

    const trend = percentChange > 1 ? 'up' : percentChange < -1 ? 'down' : 'stable';

    return {
      score,
      color,
      label,
      trend,
      percentChange,
      latestWeight: latest,
      smoothedRecords: smoothed,
    };
  }, [weightRecords]);
}
