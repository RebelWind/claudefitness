import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useUserStore } from './userStore';
import { useWorkoutStore } from './workoutStore';
import { useProgramStore } from './programStore';
import { useProgramDetailsStore } from './programDetailsStore';
import { getUserProgram } from '../lib/programService';
import { getBaslangicDetails } from '../lib/n8nService';
import { exerciseIdFromSearchKey } from '../constants/exerciseMapping';
import type { ExerciseBaseline } from '../types/user';
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

          // Restore baselines from Google Sheets
          try {
            const details = await getBaslangicDetails(backendProgram.google_file_id);
            const baselines: ExerciseBaseline[] = [];
            const seen = new Set<string>();
            for (const input of details.inputs) {
              const exerciseId = exerciseIdFromSearchKey(input.search_key);
              if (exerciseId && !seen.has(exerciseId)) {
                seen.add(exerciseId);
                baselines.push({
                  exerciseId,
                  initialWeightKg: input.agirlik,
                  initialReps: input['tekrar sayisi'],
                });
              }
            }
            userStore.setBaselines(baselines);
          } catch {
            // Baselines couldn't be fetched — non-critical, profile will just be empty
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
