import type { ExerciseId, WorkoutType } from './exercise';

export interface ExerciseLog {
  exerciseId: ExerciseId;
  weightKg: number;
  sets: number[];
  completed: boolean;
}

export interface WorkoutLog {
  id: string;
  userId: string;
  weekNumber: number;
  workoutType: WorkoutType;
  dayInWeek: 1 | 2 | 3;
  date: string;
  exercises: ExerciseLog[];
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number | null;
}

export interface ActiveWorkoutSession {
  workoutType: WorkoutType;
  weekNumber: number;
  dayInWeek: 1 | 2 | 3;
  exercises: ExerciseLog[];
  currentExerciseIndex: number;
  startedAt: string;
  isComplete: boolean;
}
