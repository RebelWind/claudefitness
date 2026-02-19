import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useUserStore } from './userStore';
import { useWorkoutStore } from './workoutStore';
import { useProgramStore } from './programStore';
import { useProgramDetailsStore } from './programDetailsStore';
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
      set({ userId: user.id, isAuthenticated: true, isLoading: false });
      const userStore = useUserStore.getState();
      const existingUser = userStore.user;

      if (existingUser && existingUser.id === user.id) {
        // Same user logging back in — keep all data as-is
        return;
      }

      if (existingUser && existingUser.id !== user.id) {
        // Different user — clear all stores for clean slate
        userStore.clear();
        const workoutStore = useWorkoutStore.getState();
        workoutStore.abandonWorkout();
        workoutStore.setLogs([]);
        useProgramStore.getState().reset();
        useProgramDetailsStore.getState().clearCache();
      }

      // Set user info (new user or first login)
      userStore.setUser({
        id: user.id,
        email: user.email || '',
        name: user.user_metadata?.name || user.email?.split('@')[0] || '',
        createdAt: user.created_at,
        hasCompletedSetup: false,
        programStartDate: null,
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
