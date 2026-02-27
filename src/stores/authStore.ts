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
 * Rebuild programStore from startDate + workout logs.
 * Uses Supabase current_week as the authoritative source — logs only
 * determine which individual workouts show as completed within weeks.
 */
function rebuildProgramFromLogs(startDate: string, currentWeek: number = 1) {
  const programStore = useProgramStore.getState();
  programStore.initializeProgram(startDate, currentWeek);

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

  // Override currentWeek with the Supabase value (source of truth)
  // markWorkoutComplete may have incorrectly advanced it based on log data
  programStore.setCurrentWeek(currentWeek);
}

/**
 * Restore from Supabase DB (fast: 2 queries).
 * Returns true if data was found, false if Supabase is empty.
 */
async function restoreFromSupabase(userId: string, startDate: string, currentWeek: number): Promise<boolean> {
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

  // Workout logs — merge Supabase logs with local logs for cross-device sync
  try {
    const remoteLogs = await getWorkoutLogsFromDb(userId);
    if (remoteLogs.length > 0) {
      const localLogs = useWorkoutStore.getState().logs;
      // Build a map of remote logs by unique key (week + workout type)
      const remoteMap = new Map(remoteLogs.map(l => [`${l.weekNumber}-${l.workoutType}`, l]));
      // Add any local-only logs (not yet synced to Supabase)
      for (const local of localLogs) {
        const key = `${local.weekNumber}-${local.workoutType}`;
        if (!remoteMap.has(key)) {
          remoteMap.set(key, local);
        }
      }
      useWorkoutStore.getState().setLogs(Array.from(remoteMap.values()));
      hasData = true;
    }
  } catch { /* ignore */ }

  // Rebuild program from logs with Supabase current_week as source of truth
  if (hasData) {
    rebuildProgramFromLogs(startDate, currentWeek);
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

      // hasCompletedSetup is true locally — verify program actually exists in Supabase
      set({ userId: user.id, isAuthenticated: true, isLoading: true });
      getUserProgram(user.id).then(async backendProgram => {
        if (!backendProgram?.google_file_id) {
          // Program doesn't exist in Supabase — reset setup flag
          userStore.setUser({
            ...localUser,
            hasCompletedSetup: false,
            programStartDate: null,
          });
          userStore.setBaselines([]);
          useProgramStore.getState().reset();
          set({ isLoading: false });
          return;
        }

        // Program exists — always sync from Supabase to ensure cross-device data
        const currentWeek = backendProgram.current_week ?? localUser.currentWeek ?? 1;
        await restoreFromSupabase(user.id, backendProgram.created_at, currentWeek);
        set({ isLoading: false });
      }).catch(() => {
        // Offline fallback — use whatever localStorage has
        if (localUser.programStartDate) {
          rebuildProgramFromLogs(localUser.programStartDate, localUser.currentWeek ?? 1);
        }
        set({ isLoading: false });
      });
      return;
    }

    // ── Backend restore ──
    set({ userId: user.id, isAuthenticated: true, isLoading: true });

    getUserProgram(user.id).then(async backendProgram => {
      if (backendProgram?.google_file_id) {
        const currentWeek = backendProgram.current_week ?? 1;

        userStore.setUser({
          id: user.id,
          email: user.email || '',
          name: user.user_metadata?.name || user.email?.split('@')[0] || '',
          createdAt: user.created_at,
          hasCompletedSetup: true,
          programStartDate: backendProgram.created_at,
          currentWeek,
        });

        useProgramStore.getState().initializeProgram(backendProgram.created_at, currentWeek);

        // Try Supabase first (fast: 2 queries)
        const restored = await restoreFromSupabase(user.id, backendProgram.created_at, currentWeek);

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
