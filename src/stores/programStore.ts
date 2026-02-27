import { create } from 'zustand';
import type { ProgramState, WeekPlan } from '../types/program';
import type { WorkoutType } from '../types/exercise';

interface ProgramStoreState {
  program: ProgramState | null;
  initializeProgram: (startDate: string, currentWeek?: number) => void;
  markWorkoutComplete: (weekNumber: number, dayInWeek: 1 | 2 | 3, logId: string) => void;
  setCurrentWeek: (week: number) => void;
  reset: () => void;
}

function createWeeks(currentWeek: number = 1): WeekPlan[] {
  return Array.from({ length: 12 }, (_, i) => ({
    weekNumber: i + 1,
    status: i + 1 < currentWeek
      ? 'completed' as const
      : i + 1 === currentWeek
        ? 'current' as const
        : 'upcoming' as const,
    workouts: ([1, 2, 3] as const).map(day => ({
      dayInWeek: day,
      type: (['A', 'B', 'C'] as const)[day - 1] as WorkoutType,
      completed: false,
      logId: null,
    })),
  }));
}

export const useProgramStore = create<ProgramStoreState>()((set, get) => ({
  program: null,

  initializeProgram: (startDate, currentWeek = 1) => {
    set({
      program: {
        currentWeek,
        totalWeeks: 12,
        startDate,
        weeks: createWeeks(currentWeek),
        isComplete: false,
      },
    });
  },

  markWorkoutComplete: (weekNumber, dayInWeek, logId) => {
    const program = get().program;
    if (!program) return;

    const weeks = program.weeks.map(week => {
      if (week.weekNumber !== weekNumber) return week;
      return {
        ...week,
        workouts: week.workouts.map(w => {
          if (w.dayInWeek !== dayInWeek) return w;
          return { ...w, completed: true, logId };
        }),
      };
    });

    // Check if all workouts in current week are done
    const currentWeekPlan = weeks.find(w => w.weekNumber === weekNumber);
    const allDone = currentWeekPlan?.workouts.every(w => w.completed) ?? false;

    let newCurrentWeek = program.currentWeek;
    if (allDone && weekNumber === program.currentWeek && weekNumber < 12) {
      newCurrentWeek = weekNumber + 1;
      // Update week statuses
      weeks.forEach(w => {
        if (w.weekNumber < newCurrentWeek) w.status = 'completed';
        else if (w.weekNumber === newCurrentWeek) w.status = 'current';
      });
    }

    set({
      program: {
        ...program,
        currentWeek: newCurrentWeek,
        weeks,
        isComplete: newCurrentWeek === 12 && allDone,
      },
    });
  },

  setCurrentWeek: (week) => {
    const program = get().program;
    if (!program) return;

    const weeks = program.weeks.map(w => ({
      ...w,
      status: w.weekNumber < week
        ? 'completed' as const
        : w.weekNumber === week
          ? 'current' as const
          : 'upcoming' as const,
    }));

    set({
      program: {
        ...program,
        currentWeek: week,
        weeks,
      },
    });
  },

  reset: () => set({ program: null }),
}));
