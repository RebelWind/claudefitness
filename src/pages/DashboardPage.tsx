import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useUserStore } from '../stores/userStore';
import { useWorkoutStore } from '../stores/workoutStore';
import { useProgramStore } from '../stores/programStore';
import { getCurrentWeek, getCompletedWorkoutCount } from '../lib/programScheduler';
import { getProgramDetails } from '../lib/n8nService';
import type { ProgramExercise } from '../lib/n8nService';
import { getUserProgram } from '../lib/programService';
import { supabase } from '../lib/supabase';
import type { WorkoutType } from '../types/exercise';
import Header from '../components/layout/Header';
import PageContainer from '../components/layout/PageContainer';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import ProgressBar from '../components/ui/ProgressBar';

const WORKOUT_TYPES: WorkoutType[] = ['A', 'B', 'C'];
const DAY_MAP: Record<WorkoutType, 1 | 2 | 3> = { A: 1, B: 2, C: 3 };

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = useUserStore(s => s.user);
  const logs = useWorkoutStore(s => s.logs);
  const startWorkoutFromProgram = useWorkoutStore(s => s.startWorkoutFromProgram);
  const activeSession = useWorkoutStore(s => s.activeSession);
  const program = useProgramStore(s => s.program);

  const currentWeek = program?.startDate
    ? getCurrentWeek(program.startDate)
    : 1;

  const [selectedWeek, setSelectedWeek] = useState(currentWeek);
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutType>('A');
  const [programExercises, setProgramExercises] = useState<ProgramExercise[]>([]);
  const [loadingProgram, setLoadingProgram] = useState(false);
  const [programError, setProgramError] = useState('');

  const totalCompleted = getCompletedWorkoutCount(logs);
  const totalWorkouts = 36;
  const overallProgress = (totalCompleted / totalWorkouts) * 100;

  // Completed workouts for the selected week
  const selectedWeekLogs = logs.filter(l => l.weekNumber === selectedWeek && l.completedAt);

  // Auto-select first incomplete workout when week changes
  useEffect(() => {
    const completedTypes = new Set(selectedWeekLogs.map(l => l.workoutType));
    const firstIncomplete = WORKOUT_TYPES.find(t => !completedTypes.has(t));
    setSelectedWorkout(firstIncomplete || 'A');
  }, [selectedWeek, selectedWeekLogs.length]);

  // Fetch program details when selected week changes
  useEffect(() => {
    let cancelled = false;
    async function fetchProgram() {
      setLoadingProgram(true);
      setProgramError('');
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) return;

        const userProgram = await getUserProgram(userId);
        if (!userProgram?.google_file_id) return;

        const data = await getProgramDetails(
          userProgram.google_file_id,
          `Hafta ${selectedWeek}`,
        );
        if (!cancelled) setProgramExercises(data);
      } catch (err) {
        console.error('Program detayları alınamadı:', err);
        if (!cancelled) setProgramError('Program verileri yüklenemedi.');
      } finally {
        if (!cancelled) setLoadingProgram(false);
      }
    }
    fetchProgram();
    return () => { cancelled = true; };
  }, [selectedWeek]);

  const handleStartWorkout = (type: WorkoutType) => {
    if (activeSession) {
      navigate(`/workout/${activeSession.workoutType}`);
      return;
    }
    if (programExercises.length > 0) {
      startWorkoutFromProgram(type, selectedWeek, DAY_MAP[type], programExercises);
      navigate(`/workout/${type}`);
    }
  };

  // Filter exercises for the selected workout
  const workoutGroup = `W${selectedWorkout}`;
  const workoutExercises = programExercises.filter(e => e.grup === workoutGroup);
  const isWorkoutDone = selectedWeekLogs.some(l => l.workoutType === selectedWorkout);

  // Check if there's an active session for this specific workout
  const hasActiveSession = activeSession !== null;
  const isActiveForSelected = activeSession?.workoutType === selectedWorkout
    && activeSession?.weekNumber === selectedWeek;

  return (
    <>
      <Header
        title={`Merhaba, ${user?.name?.split(' ')[0] || 'Sporcu'}`}
      />
      <PageContainer>
        {/* Overall Progress */}
        <Card className="mb-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-bold text-text">Program Durumu</h2>
            <Badge variant={totalCompleted >= 36 ? 'success' : 'accent'}>
              {totalCompleted}/36
            </Badge>
          </div>
          <ProgressBar value={overallProgress} color="accent" className="mb-2" />
          <p className="text-xs text-text-muted">
            Toplam {totalCompleted} / {totalWorkouts} antrenman tamamlandı
          </p>
        </Card>

        {/* Active Session Banner */}
        {hasActiveSession && !isActiveForSelected && (
          <div
            className="bg-primary/10 border border-primary/30 rounded-2xl p-3 mb-4 cursor-pointer active:scale-[0.99] transition-transform"
            onClick={() => navigate(`/workout/${activeSession!.workoutType}`)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-primary-light">
                  Devam eden antrenman
                </p>
                <p className="text-xs text-text-muted">
                  Hafta {activeSession!.weekNumber} - Workout {activeSession!.workoutType}
                </p>
              </div>
              <Button size="sm">Devam Et</Button>
            </div>
          </div>
        )}

        {/* Week Selector */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setSelectedWeek(w => Math.max(1, w - 1))}
            disabled={selectedWeek <= 1}
            className="w-10 h-10 rounded-xl bg-surface border border-surface-light flex items-center justify-center
              text-text-muted font-bold text-lg disabled:opacity-30 active:bg-surface-light transition-colors"
          >
            &lt;
          </button>
          <div className="text-center">
            <h3 className="text-lg font-bold text-text">Hafta {selectedWeek}</h3>
            {selectedWeek === currentWeek && (
              <span className="text-[10px] text-primary-light font-semibold">Aktif Hafta</span>
            )}
          </div>
          <button
            onClick={() => setSelectedWeek(w => Math.min(12, w + 1))}
            disabled={selectedWeek >= 12}
            className="w-10 h-10 rounded-xl bg-surface border border-surface-light flex items-center justify-center
              text-text-muted font-bold text-lg disabled:opacity-30 active:bg-surface-light transition-colors"
          >
            &gt;
          </button>
        </div>

        {/* Workout Type Tabs */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {WORKOUT_TYPES.map(type => {
            const done = selectedWeekLogs.some(l => l.workoutType === type);
            const isSelected = selectedWorkout === type;
            const count = programExercises.filter(e => e.grup === `W${type}`).length;
            return (
              <button
                key={type}
                onClick={() => setSelectedWorkout(type)}
                className={`rounded-2xl border p-3 text-center transition-all ${
                  isSelected
                    ? 'bg-primary/10 border-primary/50'
                    : 'bg-surface border-surface-light'
                }`}
              >
                <div className="flex items-center justify-center gap-1">
                  <span className={`text-lg font-bold ${
                    done ? 'text-success' : isSelected ? 'text-primary-light' : 'text-text-muted'
                  }`}>
                    {type}
                  </span>
                  {done && <span className="text-success text-xs">&#10003;</span>}
                </div>
                <div className="text-[10px] text-text-muted mt-0.5">
                  {done ? 'Tamamlandı' : `${count} hareket`}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Workout Details */}
        <Card className="mb-4">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="font-bold text-text">Workout {selectedWorkout}</h3>
              <p className="text-sm text-text-muted">
                Hafta {selectedWeek} - Gün {DAY_MAP[selectedWorkout]}
              </p>
            </div>
            {isWorkoutDone && (
              <Badge variant="success">Tamamlandı</Badge>
            )}
          </div>

          {loadingProgram && (
            <p className="text-sm text-primary-light text-center animate-pulse py-4">
              Program yükleniyor...
            </p>
          )}

          {programError && (
            <p className="text-sm text-error text-center py-2">{programError}</p>
          )}

          {!loadingProgram && workoutExercises.length > 0 && (
            <div className="flex flex-col gap-1.5 mb-4">
              {workoutExercises.map(pe => (
                <div key={pe.search_key} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary-light" />
                    <span className="text-sm text-text">{pe.egzersiz_adi}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {pe.rpe !== null && (
                      <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full font-semibold">
                        RPE {pe.rpe}
                      </span>
                    )}
                    <span className="text-xs text-text-muted font-medium">{pe.set_x_tekrar}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action Button */}
          {isActiveForSelected ? (
            <Button
              fullWidth
              size="lg"
              onClick={() => navigate(`/workout/${selectedWorkout}`)}
            >
              Antrenmana Devam Et
            </Button>
          ) : (
            <Button
              fullWidth
              size="lg"
              onClick={() => handleStartWorkout(selectedWorkout)}
              disabled={loadingProgram || programExercises.length === 0 || (hasActiveSession && !isActiveForSelected)}
            >
              {isWorkoutDone ? 'Tekrar Yap' : 'Antrenmana Başla'}
            </Button>
          )}

          {hasActiveSession && !isActiveForSelected && (
            <p className="text-[10px] text-text-muted text-center mt-2">
              Devam eden antrenmanı bitirin veya bırakın
            </p>
          )}
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <div className="text-2xl font-bold text-primary-light">{totalCompleted}</div>
            <div className="text-xs text-text-muted">Toplam Antrenman</div>
          </Card>
          <Card>
            <div className="text-2xl font-bold text-success">{currentWeek}</div>
            <div className="text-xs text-text-muted">Aktif Hafta</div>
          </Card>
        </div>
      </PageContainer>
    </>
  );
}
