import type { ExerciseId } from './exercise';

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  hasCompletedSetup: boolean;
  programStartDate: string | null;
}

export interface ExerciseBaseline {
  exerciseId: ExerciseId;
  initialWeightKg: number;
  initialReps: number;
}

export interface UserProfile {
  user: User;
  baselines: ExerciseBaseline[];
}
