import { supabase } from './supabase';
import type { ExerciseBaseline } from '../types/user';
import type { ExerciseGroup } from '../types/exercise';
import type { WorkoutLog } from '../types/workout';

// ── Baselines ──

export async function saveBaselines(userId: string, baselines: ExerciseBaseline[]): Promise<void> {
  if (baselines.length === 0) return;

  const rows = baselines.map(b => ({
    user_id: userId,
    exercise_group: b.group,
    exercise_id: b.exerciseId,
    initial_weight_kg: b.initialWeightKg,
    initial_reps: b.initialReps,
  }));

  const { error } = await supabase
    .from('baselines')
    .upsert(rows, { onConflict: 'user_id,exercise_group,exercise_id' });

  if (error) throw error;
}

export async function getBaselinesFromDb(userId: string): Promise<ExerciseBaseline[]> {
  const { data, error } = await supabase
    .from('baselines')
    .select()
    .eq('user_id', userId);

  if (error) throw error;

  return (data || []).map(row => ({
    exerciseId: row.exercise_id,
    group: row.exercise_group as ExerciseGroup,
    initialWeightKg: row.initial_weight_kg,
    initialReps: row.initial_reps,
  }));
}

// ── Workout Logs ──

export async function saveWorkoutLog(userId: string, log: WorkoutLog): Promise<void> {
  const { error } = await supabase
    .from('workout_logs')
    .upsert({
      id: log.id,
      user_id: userId,
      week_number: log.weekNumber,
      workout_type: log.workoutType,
      day_in_week: log.dayInWeek,
      date: log.date,
      exercises: log.exercises,
      started_at: log.startedAt,
      completed_at: log.completedAt,
      duration_seconds: log.durationSeconds,
    }, { onConflict: 'user_id,week_number,workout_type' });

  if (error) throw error;
}

export async function getWorkoutLogsFromDb(userId: string): Promise<WorkoutLog[]> {
  const { data, error } = await supabase
    .from('workout_logs')
    .select()
    .eq('user_id', userId)
    .order('week_number', { ascending: true });

  if (error) throw error;

  return (data || []).map(row => ({
    id: row.id,
    userId: row.user_id,
    weekNumber: row.week_number,
    workoutType: row.workout_type,
    dayInWeek: row.day_in_week,
    date: row.date,
    exercises: row.exercises,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    durationSeconds: row.duration_seconds,
  }));
}
