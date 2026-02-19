import { create } from 'zustand';
import type { ProgramState, WeekPlan } from '../types/program';
import type { WorkoutType } from '../types/exercise';

interface ProgramStoreState {
  program: ProgramState | null;
  initializeProgram: (startDate: string) => void;
  markWorkoutComplete: (weekNumber: number, dayInWeek: 1 | 2 | 3, logId: string) => void;
  reset: () => void;
}

function createWeeks(): WeekPlan[] {
  return Array.from({ length: 12 }, (_, i) => ({
    weekNumber: i + 1,
    status: i === 0 ? 'current' as const : 'upcoming' as const,
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

  initializeProgram: (startDate) => {
    set({
      program: {
        currentWeek: 1,
        totalWeeks: 12,
        startDate,
        weeks: createWeeks(),
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

  reset: () => set({ program: null }),
}));
