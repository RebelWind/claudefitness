import type { Exercise } from '../types/exercise';
import type { ExerciseBaseline } from '../types/user';

/**
 * Calculates the weight for a given exercise at a specific week.
 * Progression rules (mock, will be replaced by API):
 * - G1: +2.5kg every 2 weeks
 * - G2: +2.5kg every 3 weeks
 * - G3: +1.25kg every 3 weeks
 * - G4: No weight increase
 */
export function calculateWeightForWeek(
  baseline: ExerciseBaseline,
  exercise: Exercise,
  weekNumber: number,
): number {
  if (!exercise.usesWeight) return 0;

  const { initialWeightKg } = baseline;
  const weeksElapsed = weekNumber - 1;

  switch (exercise.group) {
    case 'G1': {
      const increments = Math.floor(weeksElapsed / 2);
      return initialWeightKg + increments * 2.5;
    }
    case 'G2': {
      const increments = Math.floor(weeksElapsed / 3);
      return initialWeightKg + increments * 2.5;
    }
    case 'G3': {
      const increments = Math.floor(weeksElapsed / 3);
      return initialWeightKg + increments * 1.25;
    }
    case 'G4':
    default:
      return initialWeightKg;
  }
}
