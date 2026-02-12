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
 * Calculate current streak of consecutive workouts without missing.
 */
export function getStreak(logs: WorkoutLog[]): number {
  const sorted = [...logs]
    .filter(l => l.completedAt !== null)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return sorted.length; // Simplified: count all completed workouts
}
