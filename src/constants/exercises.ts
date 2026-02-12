import type { Exercise, ExerciseId } from '../types/exercise';

export const EXERCISES: Record<ExerciseId, Exercise> = {
  bench_press:                { id: 'bench_press', name: 'Bench Press', group: 'G1', usesWeight: true, defaultSets: 3, trackingUnit: 'reps' },
  squat:                      { id: 'squat', name: 'Squat', group: 'G1', usesWeight: true, defaultSets: 3, trackingUnit: 'reps' },
  overhead_press:             { id: 'overhead_press', name: 'Over Head Press', group: 'G1', usesWeight: true, defaultSets: 3, trackingUnit: 'reps' },
  shoulder_press_machine:     { id: 'shoulder_press_machine', name: 'Shoulder Press Machine', group: 'G2', usesWeight: true, defaultSets: 3, trackingUnit: 'reps' },
  romanian_dl:                { id: 'romanian_dl', name: 'Romanian DL', group: 'G2', usesWeight: true, defaultSets: 3, trackingUnit: 'reps' },
  barbell_row:                { id: 'barbell_row', name: 'Barbell Row', group: 'G2', usesWeight: true, defaultSets: 3, trackingUnit: 'reps' },
  assisted_pull_ups:          { id: 'assisted_pull_ups', name: 'Assisted Pull Ups', group: 'G2', usesWeight: true, defaultSets: 3, trackingUnit: 'reps' },
  lateral_raises:             { id: 'lateral_raises', name: 'Lateral Raises', group: 'G3', usesWeight: true, defaultSets: 3, trackingUnit: 'reps' },
  lat_pulldown:               { id: 'lat_pulldown', name: 'Lat Pulldown', group: 'G3', usesWeight: true, defaultSets: 3, trackingUnit: 'reps' },
  chest_fly_machine:          { id: 'chest_fly_machine', name: 'Chest Fly Machine', group: 'G3', usesWeight: true, defaultSets: 3, trackingUnit: 'reps' },
  leg_extension:              { id: 'leg_extension', name: 'Leg Extension', group: 'G3', usesWeight: true, defaultSets: 3, trackingUnit: 'reps' },
  overhead_triceps_extension: { id: 'overhead_triceps_extension', name: 'Overhead Triceps Extension', group: 'G4', usesWeight: true, defaultSets: 3, trackingUnit: 'reps' },
  incline_dumbbell_curl:      { id: 'incline_dumbbell_curl', name: 'Incline Dumbbell Curl', group: 'G4', usesWeight: true, defaultSets: 3, trackingUnit: 'reps' },
  crunch:                     { id: 'crunch', name: 'Crunch', group: 'G4', usesWeight: false, defaultSets: 3, trackingUnit: 'reps' },
  leg_raises:                 { id: 'leg_raises', name: 'Leg Raises', group: 'G4', usesWeight: false, defaultSets: 3, trackingUnit: 'reps' },
  plank:                      { id: 'plank', name: 'Plank', group: 'G4', usesWeight: false, defaultSets: 3, trackingUnit: 'seconds' },
};

export const EXERCISE_LIST = Object.values(EXERCISES);

export const EXERCISE_GROUPS = {
  G1: EXERCISE_LIST.filter(e => e.group === 'G1'),
  G2: EXERCISE_LIST.filter(e => e.group === 'G2'),
  G3: EXERCISE_LIST.filter(e => e.group === 'G3'),
  G4: EXERCISE_LIST.filter(e => e.group === 'G4'),
};

export const GROUP_LABELS: Record<string, string> = {
  G1: 'Ana Bileşik Hareketler',
  G2: 'İkincil Hareketler',
  G3: 'Aksesuar Hareketler',
  G4: 'İzolasyon & Core',
};
