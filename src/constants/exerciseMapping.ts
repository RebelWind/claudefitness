import type { ExerciseGroup, ExerciseId } from '../types/exercise';

export interface ExerciseExcelMapping {
  id: number;
  grup: ExerciseGroup;
  egzersiz_adi: string;
  excel_satir_no: number;
  search_key: string;
  exerciseId: ExerciseId;
}

/**
 * Maps each exercise (per group) to its Excel row and search_key
 * for the n8n webhook insertBaslangic action.
 */
export const EXERCISE_EXCEL_MAPPING: ExerciseExcelMapping[] = [
  { id: 1,  grup: 'G1', egzersiz_adi: 'Bench Press',                exerciseId: 'bench_press',                excel_satir_no: 7,  search_key: 'g1-benchpress' },
  { id: 2,  grup: 'G1', egzersiz_adi: 'Squat',                      exerciseId: 'squat',                      excel_satir_no: 8,  search_key: 'g1-squat' },
  { id: 3,  grup: 'G1', egzersiz_adi: 'Over Head Press',             exerciseId: 'overhead_press',             excel_satir_no: 9,  search_key: 'g1-overheadpress' },
  { id: 4,  grup: 'G2', egzersiz_adi: 'Shoulder Press Machine',      exerciseId: 'shoulder_press_machine',     excel_satir_no: 12, search_key: 'g2-shoulderpressmachine' },
  { id: 5,  grup: 'G2', egzersiz_adi: 'Romanian DL',                 exerciseId: 'romanian_dl',                excel_satir_no: 13, search_key: 'g2-romaniandl' },
  { id: 6,  grup: 'G2', egzersiz_adi: 'Bench Press',                 exerciseId: 'bench_press',                excel_satir_no: 14, search_key: 'g2-benchpress' },
  { id: 7,  grup: 'G2', egzersiz_adi: 'Barbell Row',                 exerciseId: 'barbell_row',                excel_satir_no: 15, search_key: 'g2-barbellrow' },
  { id: 8,  grup: 'G2', egzersiz_adi: 'Squat',                      exerciseId: 'squat',                      excel_satir_no: 16, search_key: 'g2-squat' },
  { id: 9,  grup: 'G2', egzersiz_adi: 'Pull Ups',                   exerciseId: 'assisted_pull_ups',          excel_satir_no: 17, search_key: 'g2-pullups' },
  { id: 10, grup: 'G3', egzersiz_adi: 'Lateral Raises',              exerciseId: 'lateral_raises',             excel_satir_no: 20, search_key: 'g3-lateralraises' },
  { id: 11, grup: 'G3', egzersiz_adi: 'Lat Pulldown',                exerciseId: 'lat_pulldown',               excel_satir_no: 21, search_key: 'g3-latpulldown' },
  { id: 12, grup: 'G3', egzersiz_adi: 'Chest Fly Machine',           exerciseId: 'chest_fly_machine',          excel_satir_no: 22, search_key: 'g3-chestflymachine' },
  { id: 13, grup: 'G3', egzersiz_adi: 'Leg Extension',               exerciseId: 'leg_extension',              excel_satir_no: 23, search_key: 'g3-legextension' },
  { id: 14, grup: 'G4', egzersiz_adi: 'Overhead Triceps Extension',  exerciseId: 'overhead_triceps_extension', excel_satir_no: 26, search_key: 'g4-overheadtricepsextension' },
  { id: 15, grup: 'G4', egzersiz_adi: 'Incline Dumbbell Curl',       exerciseId: 'incline_dumbbell_curl',      excel_satir_no: 27, search_key: 'g4-inclinedumbbellcurl' },
  { id: 16, grup: 'G4', egzersiz_adi: 'Crunch',                      exerciseId: 'crunch',                     excel_satir_no: 28, search_key: 'g4-crunch' },
  { id: 17, grup: 'G4', egzersiz_adi: 'Leg Raises',                  exerciseId: 'leg_raises',                 excel_satir_no: 29, search_key: 'g4-legraises' },
  { id: 18, grup: 'G4', egzersiz_adi: 'Plank',                       exerciseId: 'plank',                      excel_satir_no: 30, search_key: 'g4-plank' },
];

/** Lookup: "G1-bench_press" → mapping entry */
export function getExcelMapping(group: ExerciseGroup, exerciseId: ExerciseId): ExerciseExcelMapping | undefined {
  return EXERCISE_EXCEL_MAPPING.find(m => m.grup === group && m.exerciseId === exerciseId);
}

/**
 * Maps the slug part of a search_key (after the dash) to an ExerciseId.
 * Works for both setup keys (g1-benchpress) and program keys (wa-benchpress).
 */
const SLUG_TO_EXERCISE_ID: Record<string, ExerciseId> = {
  'benchpress': 'bench_press',
  'squat': 'squat',
  'overheadpress': 'overhead_press',
  'shoulderpressmachine': 'shoulder_press_machine',
  'romaniandl': 'romanian_dl',
  'barbellrow': 'barbell_row',
  'pullups': 'assisted_pull_ups',
  'lateralraises': 'lateral_raises',
  'latpulldown': 'lat_pulldown',
  'chestflymachine': 'chest_fly_machine',
  'legextension': 'leg_extension',
  'overheadtricepsextension': 'overhead_triceps_extension',
  'inclinedumbbellcurl': 'incline_dumbbell_curl',
  'crunch': 'crunch',
  'legraises': 'leg_raises',
  'plank': 'plank',
};

export function exerciseIdFromSearchKey(searchKey: string): ExerciseId | undefined {
  const slug = searchKey.split('-').slice(1).join('-');
  return SLUG_TO_EXERCISE_ID[slug];
}
