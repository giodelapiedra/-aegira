export type ReadinessStatus = 'GREEN' | 'YELLOW' | 'RED';

export interface CheckinData {
  mood: number;
  stress: number;
  sleep: number;
  physicalHealth: number;
}

export interface ReadinessResult {
  status: ReadinessStatus;
  score: number;
}

export function calculateReadiness(data: CheckinData): ReadinessResult {
  // Normalize values to 0-100 scale
  const moodScore = (data.mood / 10) * 100;
  const stressScore = ((10 - data.stress) / 10) * 100; // Invert stress (high stress = low score)
  const sleepScore = (data.sleep / 10) * 100;
  const physicalScore = (data.physicalHealth / 10) * 100;

  // Weighted average
  const weights = {
    mood: 0.25,
    stress: 0.25,
    sleep: 0.25,
    physical: 0.25,
  };

  const score = Math.round(
    moodScore * weights.mood +
    stressScore * weights.stress +
    sleepScore * weights.sleep +
    physicalScore * weights.physical
  );

  let status: ReadinessStatus;
  if (score >= 70) {
    status = 'GREEN';
  } else if (score >= 40) {
    status = 'YELLOW';
  } else {
    status = 'RED';
  }

  return { status, score };
}
