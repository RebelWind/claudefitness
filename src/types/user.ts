import type { ExerciseId, ExerciseGroup } from './exercise';

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  hasCompletedSetup: boolean;
  programStartDate: string | null;
  currentWeek?: number;
}

export interface ExerciseBaseline {
  exerciseId: ExerciseId;
  group: ExerciseGroup;
  initialWeightKg: number;
  initialReps: number;
}

export interface UserProfile {
  user: User;
  baselines: ExerciseBaseline[];
}
