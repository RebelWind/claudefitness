import type { WorkoutType } from './exercise';

export type WeekStatus = 'upcoming' | 'current' | 'completed' | 'missed';

export interface WeekPlan {
  weekNumber: number;
  status: WeekStatus;
  workouts: {
    dayInWeek: 1 | 2 | 3;
    type: WorkoutType;
    completed: boolean;
    logId: string | null;
  }[];
}

export interface ProgramState {
  currentWeek: number;
  totalWeeks: number;
  startDate: string;
  weeks: WeekPlan[];
  isComplete: boolean;
}
