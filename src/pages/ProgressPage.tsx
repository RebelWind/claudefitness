import { useState } from 'react';
import { useWorkoutStore } from '../stores/workoutStore';
import { useProgramStore } from '../stores/programStore';
import { EXERCISES } from '../constants/exercises';
import type { ExerciseId } from '../types/exercise';
import Header from '../components/layout/Header';
import PageContainer from '../components/layout/PageContainer';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';

export default function ProgressPage() {
  const logs = useWorkoutStore(s => s.logs);
  const program = useProgramStore(s => s.program);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseId | null>(null);

  const completedLogs = logs.filter(l => l.completedAt);

  // Get all unique exercises from logs
  const exerciseIds = [...new Set(completedLogs.flatMap(l => l.exercises.map(e => e.exerciseId)))];

  // Get history for selected exercise
  const exerciseHistory = selectedExercise
    ? completedLogs
        .flatMap(l =>
          l.exercises
            .filter(e => e.exerciseId === selectedExercise)
            .map(e => ({
              week: l.weekNumber,
              workoutType: l.workoutType,
              date: l.date,
              weight: e.weightKg,
              sets: e.sets,
              totalReps: e.sets.reduce((a, b) => a + b, 0),
            })),
        )
        .sort((a, b) => a.week - b.week)
    : [];

  // Max reps bar chart data per week
  const weeklyData = completedLogs.reduce(
    (acc, log) => {
      const key = log.weekNumber;
      if (!acc[key]) acc[key] = { week: key, totalReps: 0, workouts: 0 };
      acc[key].totalReps += log.exercises.reduce(
        (sum, ex) => sum + ex.sets.reduce((a, b) => a + b, 0),
        0,
      );
      acc[key].workouts += 1;
      return acc;
    },
    {} as Record<number, { week: number; totalReps: number; workouts: number }>,
  );

  const weeklyArray = Object.values(weeklyData).sort((a, b) => a.week - b.week);
  const maxReps = Math.max(...weeklyArray.map(w => w.totalReps), 1);

  return (
    <>
      <Header title="İlerleme" />
      <PageContainer>
        {/* Program Timeline */}
        {program && (
          <Card className="mb-4">
            <h3 className="font-bold text-text mb-3">Program Zaman Çizelgesi</h3>
            <div className="flex gap-1.5 overflow-x-auto pb-2">
              {program.weeks.map(week => (
                <div
                  key={week.weekNumber}
                  className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                    week.status === 'completed'
                      ? 'bg-success/20 border-success text-success'
                      : week.status === 'current'
                        ? 'bg-primary/20 border-primary-light text-primary-light'
                        : 'bg-surface-light border-surface-light text-text-muted'
                  }`}
                >
                  {week.weekNumber}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Weekly Reps Chart */}
        {weeklyArray.length > 0 && (
          <Card className="mb-4">
            <h3 className="font-bold text-text mb-3">Haftalık Toplam Tekrar</h3>
            <div className="flex items-end gap-2 h-32">
              {weeklyArray.map(w => (
                <div key={w.week} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-text-muted">{w.totalReps}</span>
                  <div
                    className="w-full bg-primary-light/80 rounded-t-lg transition-all"
                    style={{ height: `${(w.totalReps / maxReps) * 100}%`, minHeight: '4px' }}
                  />
                  <span className="text-[10px] text-text-muted">H{w.week}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Exercise Selector */}
        <Card className="mb-4">
          <h3 className="font-bold text-text mb-3">Hareket Detayı</h3>
          <div className="flex flex-wrap gap-2 mb-4">
            {exerciseIds.map(id => (
              <button
                key={id}
                onClick={() => setSelectedExercise(id === selectedExercise ? null : id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  id === selectedExercise
                    ? 'bg-primary text-white'
                    : 'bg-surface-light text-text-muted'
                }`}
              >
                {EXERCISES[id].name}
              </button>
            ))}
          </div>

          {/* Exercise History Table */}
          {selectedExercise && exerciseHistory.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-light">
                    <th className="text-left py-2 text-text-muted font-medium">Hafta</th>
                    <th className="text-center py-2 text-text-muted font-medium">Ağırlık</th>
                    <th className="text-center py-2 text-text-muted font-medium">Setler</th>
                    <th className="text-right py-2 text-text-muted font-medium">Toplam</th>
                  </tr>
                </thead>
                <tbody>
                  {exerciseHistory.map((h, i) => (
                    <tr key={i} className="border-b border-surface-light/50">
                      <td className="py-2">
                        <span className="text-text">H{h.week}</span>
                        <Badge variant="default">{h.workoutType}</Badge>
                      </td>
                      <td className="text-center text-text">
                        {h.weight > 0 ? `${h.weight}kg` : '-'}
                      </td>
                      <td className="text-center text-text-muted">
                        {h.sets.join(' / ')}
                      </td>
                      <td className="text-right font-semibold text-text">
                        {h.totalReps}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedExercise && exerciseHistory.length === 0 && (
            <p className="text-sm text-text-muted text-center py-4">
              Bu hareket için henüz veri yok.
            </p>
          )}
        </Card>

        {completedLogs.length === 0 && (
          <div className="text-center py-8">
            <p className="text-text-muted">Henüz tamamlanmış antrenman yok.</p>
            <p className="text-sm text-text-muted mt-1">İlk antrenmanını tamamladıktan sonra ilerleme burada görünecek.</p>
          </div>
        )}
      </PageContainer>
    </>
  );
}
