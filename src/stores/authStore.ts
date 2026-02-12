import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MOCK_CREDENTIALS, MOCK_USER, MOCK_BASELINES } from '../data/mock';
import { useUserStore } from './userStore';

interface AuthState {
  token: string | null;
  userId: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => boolean;
  register: (email: string, password: string, name: string) => boolean;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      userId: null,
      isAuthenticated: false,

      login: (email: string, password: string) => {
        const cred = MOCK_CREDENTIALS.find(
          c => c.email === email && c.password === password,
        );
        if (cred) {
          set({
            token: `mock-token-${cred.userId}`,
            userId: cred.userId,
            isAuthenticated: true,
          });
          // Load mock user data
          const userStore = useUserStore.getState();
          userStore.setUser(MOCK_USER);
          userStore.setBaselines(MOCK_BASELINES);
          return true;
        }
        return false;
      },

      register: (email: string, _password: string, name: string) => {
        const newUserId = `user-${Date.now()}`;
        set({
          token: `mock-token-${newUserId}`,
          userId: newUserId,
          isAuthenticated: true,
        });
        const userStore = useUserStore.getState();
        userStore.setUser({
          id: newUserId,
          email,
          name,
          createdAt: new Date().toISOString(),
          hasCompletedSetup: false,
          programStartDate: null,
        });
        return true;
      },

      logout: () => {
        set({ token: null, userId: null, isAuthenticated: false });
        useUserStore.getState().clear();
      },
    }),
    { name: 'fitness-auth' },
  ),
);
