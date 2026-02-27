import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useUserStore } from './userStore';
import { useWorkoutStore } from './workoutStore';
import { useProgramStore } from './programStore';
import { useProgramDetailsStore } from './programDetailsStore';
import { getUserProgram } from '../lib/programService';
import { getBaslangicDetails, getProgramDetails } from '../lib/n8nService';
import { EXERCISE_EXCEL_MAPPING } from '../constants/exerciseMapping';
import { getCurrentWeek } from '../lib/programScheduler';
import {
  getBaselinesFromDb, saveBaselines,
  getWorkoutLogsFromDb,
} from '../lib/supabaseSync';
import type { ExerciseBaseline } from '../types/user';
import type { User as SupabaseUser } from '@supabase/supabase-js';

/**
 * Rebuild programStore from startDate + workout logs (no API call).
 * Filters out unreliable "restored-*" logs that were created by the
 * old n8n restore logic (which falsely detected completed workouts
 * from Excel default/formula values).
 */
function rebuildProgramFromLogs(startDate: string) {
  const programStore = useProgramStore.getState();
  programStore.initializeProgram(startDate);

  const workoutStore = useWorkoutStore.getState();
  const allLogs = workoutStore.logs;

  // Remove fake "restored-*" logs created by old n8n restore
  const cleanLogs = allLogs.filter(log => !log.id.startsWith('restored-'));
  if (cleanLogs.length !== allLogs.length) {
    workoutStore.setLogs(cleanLogs);
  }

  for (const log of cleanLogs) {
    if (log.completedAt) {
      programStore.markWorkoutComplete(log.weekNumber, log.dayInWeek, log.id);
    }
  }
}

/**
 * Restore from Supabase DB (fast: 2 queries).
 * Returns true if data was found, false if Supabase is empty.
 */
async function restoreFromSupabase(userId: string, startDate: string): Promise<boolean> {
  const userStore = useUserStore.getState();
  let hasData = false;

  // Baselines
  try {
    const baselines = await getBaselinesFromDb(userId);
    if (baselines.length > 0) {
      userStore.setBaselines(baselines);
      hasData = true;
    }
  } catch { /* ignore */ }

  // Workout logs
  try {
    const logs = await getWorkoutLogsFromDb(userId);
    if (logs.length > 0) {
      useWorkoutStore.getState().setLogs(logs);
      hasData = true;
    }
  } catch { /* ignore */ }

  // Rebuild program from logs
  if (hasData) {
    rebuildProgramFromLogs(startDate);
  }

  return hasData;
}

/**
 * Fallback restore from n8n webhooks (slow: N+1 calls).
 * Also backfills Supabase DB for future fast restores.
 */
async function restoreFromN8n(
  supabaseUser: SupabaseUser,
  googleFileId: string,
  createdAt: string,
) {
  const userStore = useUserStore.getState();

  // ── Restore baselines ──
  try {
    const details = await getBaslangicDetails(googleFileId);
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

    // Backfill to Supabase
    saveBaselines(supabaseUser.id, baselines).catch(() => {});
  } catch { /* ignore */ }

  // ── Cache program details (no workout logs — Excel set values are unreliable) ──
  try {
    const weekCount = getCurrentWeek(createdAt);

    for (let w = 1; w <= Math.min(weekCount, 12); w++) {
      const exercises = await getProgramDetails(googleFileId, `Hafta ${w}`);

      // Cache in programDetailsStore
      useProgramDetailsStore.setState(s => ({
        googleFileId,
        weeklyPrograms: { ...s.weeklyPrograms, [w]: exercises },
      }));
    }
  } catch { /* ignore */ }
}

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
    if (!user) {
      set({ userId: null, isAuthenticated: false, isLoading: false });
      return;
    }

    const userStore = useUserStore.getState();
    const existingUser = userStore.user;

    // ── Different user → clear all stores ──
    if (existingUser && existingUser.id !== user.id) {
      userStore.clear();
      useWorkoutStore.getState().abandonWorkout();
      useWorkoutStore.getState().setLogs([]);
      useProgramStore.getState().reset();
      useProgramDetailsStore.getState().clearCache();
    }

    // ── Same user check with full data validation ──
    const localUser = useUserStore.getState().user;
    if (localUser && localUser.id === user.id) {
      if (!localUser.hasCompletedSetup) {
        set({ userId: user.id, isAuthenticated: true, isLoading: false });
        return;
      }

      // Rebuild programStore (no persist, always needed)
      if (localUser.programStartDate) {
        rebuildProgramFromLogs(localUser.programStartDate);
      }

      // All critical data present → fast path
      if (useUserStore.getState().baselines.length > 0) {
        set({ userId: user.id, isAuthenticated: true, isLoading: false });
        return;
      }
    }

    // ── Backend restore ──
    set({ userId: user.id, isAuthenticated: true, isLoading: true });

    getUserProgram(user.id).then(async backendProgram => {
      if (backendProgram?.google_file_id) {
        userStore.setUser({
          id: user.id,
          email: user.email || '',
          name: user.user_metadata?.name || user.email?.split('@')[0] || '',
          createdAt: user.created_at,
          hasCompletedSetup: true,
          programStartDate: backendProgram.created_at,
        });

        useProgramStore.getState().initializeProgram(backendProgram.created_at);

        // Try Supabase first (fast: 2 queries)
        const restored = await restoreFromSupabase(user.id, backendProgram.created_at);

        if (!restored) {
          // Supabase empty → fallback to n8n (slow, also backfills Supabase)
          await restoreFromN8n(user, backendProgram.google_file_id, backendProgram.created_at);
        }
      } else {
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
      userStore.setUser({
        id: user.id,
        email: user.email || '',
        name: user.user_metadata?.name || user.email?.split('@')[0] || '',
        createdAt: user.created_at,
        hasCompletedSetup: false,
        programStartDate: null,
        bodyWeightKg: 0,
      });
      set({ isLoading: false });
    });
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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    return null;
  },

  register: async (email, password, name) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) return error.message;
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
  },
}));
