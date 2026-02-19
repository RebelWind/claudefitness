/**
 * Static mapping: search_key → excel_satir_no
 * Used when POSTing workout results to n8n (insertProgram action).
 * These row numbers correspond to the fixed layout in the Google Sheet.
 */
export const EXERCISE_EXCEL_ROWS: Record<string, number> = {
  // WA – Workout A
  'wa-benchpress': 5,
  'wa-shoulderpressmachine': 6,
  'wa-romaniandl': 7,
  'wa-latpulldown': 8,
  'wa-legextension': 9,
  'wa-crunch': 10,
  // WB – Workout B
  'wb-squat': 15,
  'wb-benchpress': 16,
  'wb-pullups': 17,
  'wb-lateralraises': 18,
  'wb-inclinedumbbellcurl': 19,
  'wb-legraises': 20,
  // WC – Workout C
  'wc-overheadpress': 25,
  'wc-squat': 26,
  'wc-barbellrow': 27,
  'wc-chestflymachine': 28,
  'wc-overheadtricepsextension': 29,
  'wc-plank': 30,
};
