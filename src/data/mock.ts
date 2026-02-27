import type { User, ExerciseBaseline } from '../types/user';
import type { WorkoutLog } from '../types/workout';

export const MOCK_CREDENTIALS = [
  { email: 'demo@fitness.app', password: 'demo1234', userId: 'user-1' },
];

export const MOCK_USER: User = {
  id: 'user-1',
  email: 'demo@fitness.app',
  name: 'Demo User',
  createdAt: '2026-01-05T10:00:00Z',
  hasCompletedSetup: true,
  programStartDate: '2026-01-06T00:00:00Z',
};

export const MOCK_BASELINES: ExerciseBaseline[] = [
  { exerciseId: 'bench_press', group: 'G1', initialWeightKg: 60, initialReps: 8 },
  { exerciseId: 'squat', group: 'G1', initialWeightKg: 80, initialReps: 8 },
  { exerciseId: 'overhead_press', group: 'G1', initialWeightKg: 40, initialReps: 8 },
  { exerciseId: 'shoulder_press_machine', group: 'G2', initialWeightKg: 30, initialReps: 10 },
  { exerciseId: 'romanian_dl', group: 'G2', initialWeightKg: 60, initialReps: 10 },
  { exerciseId: 'barbell_row', group: 'G2', initialWeightKg: 50, initialReps: 10 },
  { exerciseId: 'assisted_pull_ups', group: 'G2', initialWeightKg: 20, initialReps: 8 },
  { exerciseId: 'lateral_raises', group: 'G3', initialWeightKg: 8, initialReps: 12 },
  { exerciseId: 'lat_pulldown', group: 'G3', initialWeightKg: 40, initialReps: 12 },
  { exerciseId: 'chest_fly_machine', group: 'G3', initialWeightKg: 25, initialReps: 12 },
  { exerciseId: 'leg_extension', group: 'G3', initialWeightKg: 35, initialReps: 12 },
  { exerciseId: 'overhead_triceps_extension', group: 'G4', initialWeightKg: 12, initialReps: 12 },
  { exerciseId: 'incline_dumbbell_curl', group: 'G4', initialWeightKg: 10, initialReps: 12 },
  { exerciseId: 'crunch', group: 'G4', initialWeightKg: 0, initialReps: 20 },
  { exerciseId: 'leg_raises', group: 'G4', initialWeightKg: 0, initialReps: 15 },
  { exerciseId: 'plank', group: 'G4', initialWeightKg: 0, initialReps: 45 },
];

export const MOCK_WORKOUT_LOGS: WorkoutLog[] = [
  {
    id: 'log-1',
    userId: 'user-1',
    weekNumber: 1,
    workoutType: 'A',
    dayInWeek: 1,
    date: '2026-01-06',
    exercises: [
      { exerciseId: 'bench_press', weightKg: 60, sets: [8, 8, 7], completed: true },
      { exerciseId: 'shoulder_press_machine', weightKg: 30, sets: [10, 10, 9], completed: true },
      { exerciseId: 'romanian_dl', weightKg: 60, sets: [10, 10, 10], completed: true },
      { exerciseId: 'lat_pulldown', weightKg: 40, sets: [12, 11, 10], completed: true },
      { exerciseId: 'leg_extension', weightKg: 35, sets: [12, 12, 11], completed: true },
      { exerciseId: 'crunch', weightKg: 0, sets: [20, 18, 15], completed: true },
    ],
    startedAt: '2026-01-06T07:00:00Z',
    completedAt: '2026-01-06T08:05:00Z',
    durationSeconds: 3900,
  },
  {
    id: 'log-2',
    userId: 'user-1',
    weekNumber: 1,
    workoutType: 'B',
    dayInWeek: 2,
    date: '2026-01-08',
    exercises: [
      { exerciseId: 'squat', weightKg: 80, sets: [8, 8, 7], completed: true },
      { exerciseId: 'bench_press', weightKg: 60, sets: [8, 7, 7], completed: true },
      { exerciseId: 'assisted_pull_ups', weightKg: 20, sets: [8, 7, 6], completed: true },
      { exerciseId: 'lateral_raises', weightKg: 8, sets: [12, 12, 10], completed: true },
      { exerciseId: 'incline_dumbbell_curl', weightKg: 10, sets: [12, 11, 10], completed: true },
      { exerciseId: 'leg_raises', weightKg: 0, sets: [15, 14, 12], completed: true },
    ],
    startedAt: '2026-01-08T07:00:00Z',
    completedAt: '2026-01-08T08:10:00Z',
    durationSeconds: 4200,
  },
  {
    id: 'log-3',
    userId: 'user-1',
    weekNumber: 1,
    workoutType: 'C',
    dayInWeek: 3,
    date: '2026-01-10',
    exercises: [
      { exerciseId: 'overhead_press', weightKg: 40, sets: [8, 8, 6], completed: true },
      { exerciseId: 'squat', weightKg: 80, sets: [8, 8, 7], completed: true },
      { exerciseId: 'barbell_row', weightKg: 50, sets: [10, 10, 9], completed: true },
      { exerciseId: 'chest_fly_machine', weightKg: 25, sets: [12, 12, 11], completed: true },
      { exerciseId: 'overhead_triceps_extension', weightKg: 12, sets: [12, 11, 10], completed: true },
      { exerciseId: 'plank', weightKg: 0, sets: [45, 40, 35], completed: true },
    ],
    startedAt: '2026-01-10T07:00:00Z',
    completedAt: '2026-01-10T08:00:00Z',
    durationSeconds: 3600,
  },
];
