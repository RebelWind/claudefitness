import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, ExerciseBaseline } from '../types/user';
import type { ExerciseId } from '../types/exercise';

interface UserState {
  user: User | null;
  baselines: ExerciseBaseline[];
  setUser: (user: User) => void;
  setBaselines: (baselines: ExerciseBaseline[]) => void;
  updateBaseline: (exerciseId: ExerciseId, weightKg: number, reps: number) => void;
  completeSetup: () => void;
  clear: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: null,
      baselines: [],

      setUser: (user) => set({ user }),

      setBaselines: (baselines) => set({ baselines }),

      updateBaseline: (exerciseId, weightKg, reps) => {
        const current = get().baselines;
        const existing = current.findIndex(b => b.exerciseId === exerciseId);
        if (existing >= 0) {
          const updated = [...current];
          updated[existing] = { exerciseId, initialWeightKg: weightKg, initialReps: reps };
          set({ baselines: updated });
        } else {
          set({ baselines: [...current, { exerciseId, initialWeightKg: weightKg, initialReps: reps }] });
        }
      },

      completeSetup: () => {
        const user = get().user;
        if (user) {
          set({
            user: {
              ...user,
              hasCompletedSetup: true,
              programStartDate: new Date().toISOString(),
            },
          });
        }
      },

      clear: () => set({ user: null, baselines: [] }),
    }),
    { name: 'fitness-user' },
  ),
);
