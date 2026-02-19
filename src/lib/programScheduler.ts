import type { WorkoutType } from '../types/exercise';
import type { WorkoutLog } from '../types/workout';

const TOTAL_WEEKS = 12;

/**
 * Calculate the current week number based on the program start date.
 */
export function getCurrentWeek(programStartDate: string): number {
  const start = new Date(programStartDate);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const week = Math.floor(diffDays / 7) + 1;
  return Math.min(Math.max(week, 1), TOTAL_WEEKS);
}

/**
 * Determine which workout comes next (A, B, or C) within the current week.
 */
export function getNextWorkout(
  currentWeek: number,
  logs: WorkoutLog[],
): { weekNumber: number; dayInWeek: 1 | 2 | 3; type: WorkoutType } | null {
  const weekLogs = logs.filter(
    l => l.weekNumber === currentWeek && l.completedAt !== null,
  );

  const completedTypes = new Set(weekLogs.map(l => l.workoutType));

  const schedule: Array<{ dayInWeek: 1 | 2 | 3; type: WorkoutType }> = [
    { dayInWeek: 1, type: 'A' },
    { dayInWeek: 2, type: 'B' },
    { dayInWeek: 3, type: 'C' },
  ];

  for (const entry of schedule) {
    if (!completedTypes.has(entry.type)) {
      return { weekNumber: currentWeek, ...entry };
    }
  }

  // All workouts done this week
  if (currentWeek < TOTAL_WEEKS) {
    return { weekNumber: currentWeek + 1, dayInWeek: 1, type: 'A' };
  }

  return null; // Program complete
}

/**
 * Count completed workouts in total.
 */
export function getCompletedWorkoutCount(logs: WorkoutLog[]): number {
  return logs.filter(l => l.completedAt !== null).length;
}

/**
 * Get completed unique workout types for a specific week (out of 3: A, B, C).
 */
export function getWeekCompletionCount(logs: WorkoutLog[], weekNumber: number): number {
  const types = new Set(
    logs.filter(l => l.weekNumber === weekNumber && l.completedAt !== null)
      .map(l => l.workoutType),
  );
  return types.size;
}

/**
 * Calculate streak: consecutive completed weeks (all 3 workouts done)
 * counting backwards from the latest fully completed week.
 */
export function getWeekStreak(logs: WorkoutLog[], currentWeek: number): number {
  const uniqueTypesForWeek = (week: number) => {
    const types = new Set(
      logs.filter(l => l.weekNumber === week && l.completedAt !== null)
        .map(l => l.workoutType),
    );
    return types.size;
  };

  let streak = 0;
  for (let w = currentWeek - 1; w >= 1; w--) {
    if (uniqueTypesForWeek(w) >= 3) {
      streak++;
    } else {
      break;
    }
  }
  if (uniqueTypesForWeek(currentWeek) >= 3) {
    streak++;
  }
  return streak;
}
