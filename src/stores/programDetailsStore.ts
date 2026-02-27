import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProgramExercise } from '../lib/n8nService';
import { getProgramDetails } from '../lib/n8nService';
import { getUserProgram } from '../lib/programService';
import { getWeeklyProgram, saveWeeklyProgram, invalidateWeeklyProgram } from '../lib/supabaseSync';
import { supabase } from '../lib/supabase';

interface ProgramDetailsState {
  googleFileId: string | null;
  weeklyPrograms: Record<number, ProgramExercise[]>;
  loading: boolean;
  error: string | null;

  /** Resolve googleFileId from Supabase (cached after first call) */
  ensureGoogleFileId: () => Promise<string | null>;

  /** Fetch a week's program: in-memory → Supabase → N8N (saves to Supabase) */
  fetchWeek: (week: number, force?: boolean) => Promise<ProgramExercise[]>;

  /** Invalidate next week's cache after workout completion */
  invalidateNextWeek: (completedWeek: number) => Promise<void>;

  /** Clear all cached data */
  clearCache: () => void;
}

export const useProgramDetailsStore = create<ProgramDetailsState>()(
  persist(
    (set, get) => ({
      googleFileId: null,
      weeklyPrograms: {},
      loading: false,
      error: null,

      ensureGoogleFileId: async () => {
        const cached = get().googleFileId;
        if (cached) return cached;

        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) return null;

        const program = await getUserProgram(userId);
        const fileId = program?.google_file_id || null;
        if (fileId) set({ googleFileId: fileId });
        return fileId;
      },

      fetchWeek: async (week, force = false) => {
        // 1. In-memory cache hit
        const cached = get().weeklyPrograms[week];
        if (cached && !force) return cached;

        set({ loading: true, error: null });
        try {
          // 2. Try Supabase (fast)
          if (!force) {
            const { data: { session } } = await supabase.auth.getSession();
            const userId = session?.user?.id;
            if (userId) {
              const dbData = await getWeeklyProgram(userId, week);
              if (dbData && dbData.length > 0) {
                set(state => ({
                  weeklyPrograms: { ...state.weeklyPrograms, [week]: dbData },
                  loading: false,
                }));
                return dbData;
              }
            }
          }

          // 3. Fetch from N8N (slow)
          const fileId = await get().ensureGoogleFileId();
          if (!fileId) {
            set({ loading: false });
            return [];
          }

          const data = await getProgramDetails(fileId, `Hafta ${week}`);

          // Save to in-memory cache
          set(state => ({
            weeklyPrograms: { ...state.weeklyPrograms, [week]: data },
            loading: false,
          }));

          // Save to Supabase in background for next time
          const { data: { session } } = await supabase.auth.getSession();
          const userId = session?.user?.id;
          if (userId && data.length > 0) {
            saveWeeklyProgram(userId, week, data).catch(() => {
              // Non-critical — data still works from in-memory
            });
          }

          return data;
        } catch (err) {
          console.error('Program detayları alınamadı:', err);
          set({ loading: false, error: 'Program verileri yüklenemedi.' });
          return [];
        }
      },

      invalidateNextWeek: async (completedWeek) => {
        const nextWeek = completedWeek + 1;
        if (nextWeek > 12) return;

        // Clear in-memory cache for next week
        set(state => {
          const { [nextWeek]: _, ...rest } = state.weeklyPrograms;
          return { weeklyPrograms: rest };
        });

        // Clear from Supabase
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const userId = session?.user?.id;
          if (userId) {
            await invalidateWeeklyProgram(userId, nextWeek);
          }
        } catch {
          // Non-critical
        }
      },

      clearCache: () => set({
        googleFileId: null,
        weeklyPrograms: {},
        loading: false,
        error: null,
      }),
    }),
    {
      name: 'fitness-program-details',
      version: 2,
      migrate: () => ({ googleFileId: null }),
      partialize: (state) => ({
        googleFileId: state.googleFileId,
      }),
    },
  ),
);
