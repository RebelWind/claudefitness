import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WorkoutType } from '../types/exercise';
import type { ActiveWorkoutSession, WorkoutLog, ExerciseLog } from '../types/workout';
import type { ProgramExercise } from '../lib/n8nService';
import { exerciseIdFromSearchKey } from '../constants/exerciseMapping';
import { useUserStore } from './userStore';

/** Parse "4x5+" → 4, "3x10" → 3, "3xmax" → 3 */
function parseSetCount(setxTekrar: string): number {
  const match = setxTekrar.match(/^(\d+)x/);
  return match ? parseInt(match[1]) : 3;
}

interface WorkoutState {
  activeSession: ActiveWorkoutSession | null;
  logs: WorkoutLog[];
  startWorkoutFromProgram: (
    type: WorkoutType,
    weekNumber: number,
    dayInWeek: 1 | 2 | 3,
    programExercises: ProgramExercise[],
  ) => void;
  updateSet: (exerciseIndex: number, setIndex: number, reps: number) => void;
  completeExercise: (exerciseIndex: number) => void;
  nextExercise: () => void;
  prevExercise: () => void;
  completeWorkout: () => void;
  abandonWorkout: () => void;
  setLogs: (logs: WorkoutLog[]) => void;
  updateLogSets: (logId: string, searchKey: string, sets: number[]) => void;
  /** Patch weightKg=0 exercises in a specific log using a search_key→kg map. Returns patched log or null. */
  healLogWeights: (logId: string, kgMap: Record<string, number>) => WorkoutLog | null;
}

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set, get) => ({
      activeSession: null,
      logs: [],

      startWorkoutFromProgram: (type, weekNumber, dayInWeek, programExercises) => {
        const workoutGroup = `W${type}`;
        const filtered = programExercises.filter(e => e.grup === workoutGroup);

        const exercises: ExerciseLog[] = filtered.map(pe => {
          const exId = exerciseIdFromSearchKey(pe.search_key);
          const setCount = parseSetCount(pe.set_x_tekrar);

          return {
            exerciseId: exId || ('bench_press' as any),
            weightKg: typeof pe.kg === 'number' ? pe.kg : Number(pe.kg) || 0,
            weightLabel: typeof pe.kg === 'string' && isNaN(Number(pe.kg)) ? pe.kg : undefined,
            sets: Array(setCount).fill(0),
            completed: false,
            searchKey: pe.search_key,
            exerciseName: pe.egzersiz_adi,
            targetSetsTekrar: pe.set_x_tekrar,
            rpe: pe.rpe,
            warmupSets: pe.isinma_setleri,
          };
        });

        set({
          activeSession: {
            workoutType: type,
            weekNumber,
            dayInWeek,
            exercises,
            currentExerciseIndex: 0,
            startedAt: new Date().toISOString(),
            isComplete: false,
          },
        });
      },

      updateSet: (exerciseIndex, setIndex, reps) => {
        const session = get().activeSession;
        if (!session) return;

        const exercises = [...session.exercises];
        const exercise = { ...exercises[exerciseIndex] };
        const sets = [...exercise.sets];
        sets[setIndex] = Math.max(0, reps);
        exercise.sets = sets;
        exercises[exerciseIndex] = exercise;

        set({ activeSession: { ...session, exercises } });
      },

      completeExercise: (exerciseIndex) => {
        const session = get().activeSession;
        if (!session) return;

        const exercises = [...session.exercises];
        exercises[exerciseIndex] = { ...exercises[exerciseIndex], completed: true };

        set({ activeSession: { ...session, exercises } });
      },

      nextExercise: () => {
        const session = get().activeSession;
        if (!session) return;
        const nextIdx = Math.min(
          session.currentExerciseIndex + 1,
          session.exercises.length - 1,
        );
        set({ activeSession: { ...session, currentExerciseIndex: nextIdx } });
      },

      prevExercise: () => {
        const session = get().activeSession;
        if (!session) return;
        const prevIdx = Math.max(session.currentExerciseIndex - 1, 0);
        set({ activeSession: { ...session, currentExerciseIndex: prevIdx } });
      },

      completeWorkout: () => {
        const session = get().activeSession;
        if (!session) return;

        const now = new Date().toISOString();
        const startTime = new Date(session.startedAt).getTime();
        const duration = Math.floor((Date.now() - startTime) / 1000);

        const log: WorkoutLog = {
          id: `log-${Date.now()}`,
          userId: useUserStore.getState().user?.id || 'current-user',
          weekNumber: session.weekNumber,
          workoutType: session.workoutType,
          dayInWeek: session.dayInWeek,
          date: new Date().toISOString().split('T')[0],
          exercises: session.exercises.map(e => ({ ...e, completed: true })),
          startedAt: session.startedAt,
          completedAt: now,
          durationSeconds: duration,
        };

        set({
          activeSession: null,
          logs: [...get().logs, log],
        });
      },

      abandonWorkout: () => {
        set({ activeSession: null });
      },

      setLogs: (logs) => set({ logs }),

      healLogWeights: (logId, kgMap) => {
        let patched: WorkoutLog | null = null;
        const logs = get().logs.map(log => {
          if (log.id !== logId) return log;
          const needsHeal = log.exercises.some(ex => ex.weightKg === 0 && ex.searchKey && kgMap[ex.searchKey] > 0);
          if (!needsHeal) return log;
          patched = {
            ...log,
            exercises: log.exercises.map(ex => {
              if (ex.weightKg > 0 || !ex.searchKey) return ex;
              const kg = kgMap[ex.searchKey];
              return kg > 0 ? { ...ex, weightKg: kg } : ex;
            }),
          };
          return patched;
        });
        if (patched) set({ logs });
        return patched;
      },

      updateLogSets: (logId, searchKey, newSets) => {
        const logs = get().logs.map(log => {
          if (log.id !== logId) return log;
          return {
            ...log,
            exercises: log.exercises.map(ex =>
              ex.searchKey === searchKey ? { ...ex, sets: newSets } : ex,
            ),
          };
        });
        set({ logs });
      },
    }),
    { name: 'fitness-workout' },
  ),
);
