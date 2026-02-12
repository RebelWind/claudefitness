import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WorkoutType, ExerciseId } from '../types/exercise';
import type { ActiveWorkoutSession, WorkoutLog, ExerciseLog } from '../types/workout';
import type { ExerciseBaseline } from '../types/user';
import { WORKOUT_TEMPLATES } from '../constants/workouts';
import { EXERCISES } from '../constants/exercises';
import { calculateWeightForWeek } from '../lib/weightCalculator';

interface WorkoutState {
  activeSession: ActiveWorkoutSession | null;
  logs: WorkoutLog[];
  startWorkout: (
    type: WorkoutType,
    weekNumber: number,
    dayInWeek: 1 | 2 | 3,
    baselines: ExerciseBaseline[],
  ) => void;
  updateSet: (exerciseIndex: number, setIndex: number, reps: number) => void;
  completeExercise: (exerciseIndex: number) => void;
  nextExercise: () => void;
  prevExercise: () => void;
  completeWorkout: () => void;
  abandonWorkout: () => void;
  setLogs: (logs: WorkoutLog[]) => void;
}

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set, get) => ({
      activeSession: null,
      logs: [],

      startWorkout: (type, weekNumber, dayInWeek, baselines) => {
        const template = WORKOUT_TEMPLATES[type];
        const exercises: ExerciseLog[] = template.exercises.map((exId: ExerciseId) => {
          const exercise = EXERCISES[exId];
          const baseline = baselines.find(b => b.exerciseId === exId);
          const weight = baseline
            ? calculateWeightForWeek(baseline, exercise, weekNumber)
            : 0;

          return {
            exerciseId: exId,
            weightKg: weight,
            sets: Array(exercise.defaultSets).fill(0),
            completed: false,
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
          userId: 'current-user',
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
    }),
    { name: 'fitness-workout' },
  ),
);
