import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, ExerciseBaseline } from '../types/user';
import type { ExerciseId, ExerciseGroup } from '../types/exercise';

interface UserState {
  user: User | null;
  baselines: ExerciseBaseline[];
  setUser: (user: User) => void;
  setBaselines: (baselines: ExerciseBaseline[]) => void;
  updateBaseline: (group: ExerciseGroup, exerciseId: ExerciseId, weightKg: number, reps: number) => void;
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

      updateBaseline: (group, exerciseId, weightKg, reps) => {
        const current = get().baselines;
        const existing = current.findIndex(b => b.group === group && b.exerciseId === exerciseId);
        if (existing >= 0) {
          const updated = [...current];
          updated[existing] = { group, exerciseId, initialWeightKg: weightKg, initialReps: reps };
          set({ baselines: updated });
        } else {
          set({ baselines: [...current, { group, exerciseId, initialWeightKg: weightKg, initialReps: reps }] });
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
