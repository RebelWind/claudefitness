import type { WorkoutTemplate, WorkoutType } from '../types/exercise';

export const WORKOUT_TEMPLATES: Record<WorkoutType, WorkoutTemplate> = {
  A: {
    type: 'A',
    name: 'Workout A',
    exercises: [
      'bench_press',
      'shoulder_press_machine',
      'romanian_dl',
      'lat_pulldown',
      'leg_extension',
      'crunch',
    ],
  },
  B: {
    type: 'B',
    name: 'Workout B',
    exercises: [
      'squat',
      'bench_press',
      'assisted_pull_ups',
      'lateral_raises',
      'incline_dumbbell_curl',
      'leg_raises',
    ],
  },
  C: {
    type: 'C',
    name: 'Workout C',
    exercises: [
      'overhead_press',
      'squat',
      'barbell_row',
      'chest_fly_machine',
      'overhead_triceps_extension',
      'plank',
    ],
  },
};

export const WORKOUT_DAY_MAP: Record<1 | 2 | 3, WorkoutType> = {
  1: 'A',
  2: 'B',
  3: 'C',
};
