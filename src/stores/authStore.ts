import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useUserStore } from './userStore';
import { useWorkoutStore } from './workoutStore';
import { useProgramStore } from './programStore';
import { useProgramDetailsStore } from './programDetailsStore';
import { getUserProgram } from '../lib/programService';
import { getBaslangicDetails, getProgramDetails } from '../lib/n8nService';
import type { ProgramExercise } from '../lib/n8nService';
import { EXERCISE_EXCEL_MAPPING, exerciseIdFromSearchKey } from '../constants/exerciseMapping';
import { getCurrentWeek } from '../lib/programScheduler';
import type { ExerciseBaseline } from '../types/user';
import type { WorkoutLog, ExerciseLog } from '../types/workout';
import type { WorkoutType } from '../types/exercise';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface AuthState {
  userId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  register: (email: string, password: string, name: string) => Promise<string | null>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
  setFromSupabaseUser: (user: SupabaseUser | null) => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  userId: null,
  isAuthenticated: false,
  isLoading: true,

  setFromSupabaseUser: (user) => {
    if (user) {
      const userStore = useUserStore.getState();
      const existingUser = userStore.user;

      // Same user logging back in with local data — keep everything
      if (existingUser && existingUser.id === user.id) {
        set({ userId: user.id, isAuthenticated: true, isLoading: false });
        return;
      }

      // Different user — clear all stores for clean slate
      if (existingUser && existingUser.id !== user.id) {
        userStore.clear();
        const workoutStore = useWorkoutStore.getState();
        workoutStore.abandonWorkout();
        workoutStore.setLogs([]);
        useProgramStore.getState().reset();
        useProgramDetailsStore.getState().clearCache();
      }

      // Check localStorage first
      const existingProgram = useProgramStore.getState().program;
      if (existingProgram) {
        userStore.setUser({
          id: user.id,
          email: user.email || '',
          name: user.user_metadata?.name || user.email?.split('@')[0] || '',
          createdAt: user.created_at,
          hasCompletedSetup: true,
          programStartDate: existingProgram.startDate,
        });
        set({ userId: user.id, isAuthenticated: true, isLoading: false });
        return;
      }

      // No local data — keep loading while we check backend
      set({ userId: user.id, isAuthenticated: true, isLoading: true });

      getUserProgram(user.id).then(async backendProgram => {
        if (backendProgram?.google_file_id) {
          // User completed setup before — restore from backend
          userStore.setUser({
            id: user.id,
            email: user.email || '',
            name: user.user_metadata?.name || user.email?.split('@')[0] || '',
            createdAt: user.created_at,
            hasCompletedSetup: true,
            programStartDate: backendProgram.created_at,
          });
          // Re-create local program structure
          useProgramStore.getState().initializeProgram(backendProgram.created_at);

          // Restore baselines from Google Sheets (per-group)
          try {
            const details = await getBaslangicDetails(backendProgram.google_file_id);
            const baselines: ExerciseBaseline[] = [];
            for (const input of details.inputs) {
              const mapping = EXERCISE_EXCEL_MAPPING.find(m => m.search_key === input.search_key);
              if (mapping) {
                baselines.push({
                  group: mapping.grup,
                  exerciseId: mapping.exerciseId,
                  initialWeightKg: input.agirlik,
                  initialReps: input['tekrar sayisi'],
                });
              }
            }
            userStore.setBaselines(baselines);
          } catch {
            // Baselines couldn't be fetched — non-critical, profile will just be empty
          }

          // Restore completed workout logs from Google Sheets
          try {
            const weekCount = getCurrentWeek(backendProgram.created_at);
            const fileId = backendProgram.google_file_id;
            const restoredLogs: WorkoutLog[] = [];
            const programStore = useProgramStore.getState();
            const detailsStore = useProgramDetailsStore.getState();
            const DAY_MAP: Record<string, 1 | 2 | 3> = { A: 1, B: 2, C: 3 };

            for (let w = 1; w <= Math.min(weekCount, 12); w++) {
              const exercises = await getProgramDetails(fileId, `Hafta ${w}`);

              // Cache in programDetailsStore for dashboard use
              useProgramDetailsStore.setState(s => ({
                googleFileId: fileId,
                weeklyPrograms: { ...s.weeklyPrograms, [w]: exercises },
              }));

              for (const type of ['A', 'B', 'C'] as WorkoutType[]) {
                const group = `W${type}`;
                const workoutExercises = exercises.filter((e: ProgramExercise) => e.grup === group);
                const hasSetData = workoutExercises.some((e: ProgramExercise) => (e.set1 ?? 0) > 0);
                if (!hasSetData) continue;

                const exerciseLogs: ExerciseLog[] = workoutExercises.map((pe: ProgramExercise) => {
                  const setCount = parseInt(pe.set_x_tekrar.match(/^(\d+)x/)?.[1] || '3');
                  const allSets = [pe.set1 ?? 0, pe.set2 ?? 0, pe.set3 ?? 0];
                  if (pe.set4 != null) allSets.push(pe.set4);
                  return {
                    exerciseId: exerciseIdFromSearchKey(pe.search_key) || 'bench_press' as any,
                    weightKg: typeof pe.kg === 'number' ? pe.kg : 0,
                    sets: allSets.slice(0, setCount),
                    completed: true,
                    searchKey: pe.search_key,
                    exerciseName: pe.egzersiz_adi,
                    targetSetsTekrar: pe.set_x_tekrar,
                    rpe: pe.rpe,
                    warmupSets: pe.isinma_setleri,
                  };
                });

                const logId = `restored-w${w}-${type}`;
                restoredLogs.push({
                  id: logId,
                  userId: user.id,
                  weekNumber: w,
                  workoutType: type,
                  dayInWeek: DAY_MAP[type],
                  date: backendProgram.created_at.split('T')[0],
                  exercises: exerciseLogs,
                  startedAt: backendProgram.created_at,
                  completedAt: backendProgram.created_at,
                  durationSeconds: null,
                });

                // Mark workout as completed in program store
                programStore.markWorkoutComplete(w, DAY_MAP[type], logId);
              }
            }

            if (restoredLogs.length > 0) {
              useWorkoutStore.getState().setLogs(restoredLogs);
            }
          } catch {
            // Workout logs couldn't be restored — non-critical
          }
        } else {
          // Truly new user — needs onboarding
          userStore.setUser({
            id: user.id,
            email: user.email || '',
            name: user.user_metadata?.name || user.email?.split('@')[0] || '',
            createdAt: user.created_at,
            hasCompletedSetup: false,
            programStartDate: null,
          });
        }
        set({ isLoading: false });
      }).catch(() => {
        // On error, default to new user flow
        userStore.setUser({
          id: user.id,
          email: user.email || '',
          name: user.user_metadata?.name || user.email?.split('@')[0] || '',
          createdAt: user.created_at,
          hasCompletedSetup: false,
          programStartDate: null,
        });
        set({ isLoading: false });
      });
    } else {
      set({ userId: null, isAuthenticated: false, isLoading: false });
    }
  },

  initialize: async () => {
    set({ isLoading: true });
    const { data: { session } } = await supabase.auth.getSession();
    const setUser = useAuthStore.getState().setFromSupabaseUser;
    setUser(session?.user ?? null);

    supabase.auth.onAuthStateChange((_event, session) => {
      const setUser = useAuthStore.getState().setFromSupabaseUser;
      setUser(session?.user ?? null);
    });
  },

  login: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      return error.message;
    }
    return null;
  },

  register: async (email, password, name) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });
    if (error) {
      return error.message;
    }
    // Set the new user as not having completed setup
    const userStore = useUserStore.getState();
    const currentUser = userStore.user;
    if (currentUser) {
      userStore.setUser({ ...currentUser, hasCompletedSetup: false, programStartDate: null });
    }
    return null;
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ userId: null, isAuthenticated: false });
    // Data is preserved in localStorage — restored when same user logs back in
  },
}));
