import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Turno, Local, Colaborador } from '@/lib/types';

interface SessionState {
  turnoActivo?: Turno;
  local?: Local;
  colaborador?: Colaborador;
  token?: string;

  // Actions
  setTurnoActivo: (turno: Turno) => void;
  setLocal: (local: Local) => void;
  setColaborador: (colaborador: Colaborador) => void;
  setToken: (token: string) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      turnoActivo: undefined,
      local: undefined,
      colaborador: undefined,
      token: undefined,

      setTurnoActivo: (turno) => set({ turnoActivo: turno }),
      setLocal: (local) => set({ local }),
      setColaborador: (colaborador) => set({ colaborador }),
      setToken: (token) => {
        localStorage.setItem('pos_token', token);
        set({ token });
      },
      clearSession: () => {
        localStorage.removeItem('pos_token');
        set({
          turnoActivo: undefined,
          local: undefined,
          colaborador: undefined,
          token: undefined,
        });
      },
    }),
    {
      name: 'pos-session-storage',
    }
  )
);
