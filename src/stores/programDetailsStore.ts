import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProgramExercise } from '../lib/n8nService';
import { getProgramDetails } from '../lib/n8nService';
import { getUserProgram } from '../lib/programService';
import { supabase } from '../lib/supabase';

interface ProgramDetailsState {
  googleFileId: string | null;
  weeklyPrograms: Record<number, ProgramExercise[]>;
  loading: boolean;
  error: string | null;

  /** Resolve googleFileId from Supabase (cached after first call) */
  ensureGoogleFileId: () => Promise<string | null>;

  /** Fetch a week's program — returns from cache if available */
  fetchWeek: (week: number, force?: boolean) => Promise<ProgramExercise[]>;

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
        // Return cache hit
        const cached = get().weeklyPrograms[week];
        if (cached && !force) return cached;

        set({ loading: true, error: null });
        try {
          const fileId = await get().ensureGoogleFileId();
          if (!fileId) {
            set({ loading: false });
            return [];
          }

          const data = await getProgramDetails(fileId, `Hafta ${week}`);

          set(state => ({
            weeklyPrograms: { ...state.weeklyPrograms, [week]: data },
            loading: false,
          }));

          return data;
        } catch (err) {
          console.error('Program detayları alınamadı:', err);
          set({ loading: false, error: 'Program verileri yüklenemedi.' });
          return [];
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
      partialize: (state) => ({
        googleFileId: state.googleFileId,
        weeklyPrograms: state.weeklyPrograms,
      }),
    },
  ),
);
