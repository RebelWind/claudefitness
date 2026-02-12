export type ExerciseGroup = 'G1' | 'G2' | 'G3' | 'G4';

export type ExerciseId =
  | 'bench_press'
  | 'squat'
  | 'overhead_press'
  | 'shoulder_press_machine'
  | 'romanian_dl'
  | 'barbell_row'
  | 'assisted_pull_ups'
  | 'lateral_raises'
  | 'lat_pulldown'
  | 'chest_fly_machine'
  | 'leg_extension'
  | 'overhead_triceps_extension'
  | 'incline_dumbbell_curl'
  | 'crunch'
  | 'leg_raises'
  | 'plank';

export interface Exercise {
  id: ExerciseId;
  name: string;
  group: ExerciseGroup;
  usesWeight: boolean;
  defaultSets: number;
  trackingUnit: 'reps' | 'seconds';
}

export type WorkoutType = 'A' | 'B' | 'C';

export interface WorkoutTemplate {
  type: WorkoutType;
  name: string;
  exercises: ExerciseId[];
}
