// CAGED scoring and utility functions

const TARGET_TIME_SECONDS = 20; // Baseline target time for completing all 5 shapes

interface CAGEDScoreInput {
  shapes: string[];
  accuracy: number; // 1-5 scale
  time_seconds: number;
}

export function computeCAGEDScore({ shapes, accuracy, time_seconds }: CAGEDScoreInput): number {
  // 1) Shape coverage (0–1): how many of the 5 shapes were completed
  const shapeCoverage = Math.min(shapes.length / 5, 1);

  // 2) Accuracy (1–5 → 0–1): normalize accuracy score
  const accuracyScore = (accuracy - 1) / 4; // Convert 1-5 to 0-1 scale

  // 3) Speed: faster than target time gets bonus, slower gets penalty
  const speedScore = time_seconds > 0
    ? Math.min(TARGET_TIME_SECONDS / time_seconds, 1)
    : 0;

  // Weighted sum: shape coverage and accuracy are most important
  const rawScore = (shapeCoverage * 0.4)
                 + (accuracyScore * 0.4)
                 + (speedScore * 0.2);

  return Math.round(rawScore * 100); // Return 0-100 score
}

export function getAccuracyLabel(accuracy: number): string {
  const labels = {
    1: 'Poor - Many mistakes',
    2: 'Fair - Some mistakes', 
    3: 'Good - Few mistakes',
    4: 'Very Good - Rare mistakes',
    5: 'Perfect - No mistakes'
  };
  return labels[accuracy as keyof typeof labels] || 'Unknown';
}

export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-red-400';
}

export function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}