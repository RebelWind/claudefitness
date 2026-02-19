import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useUserStore } from '../stores/userStore';
import { useWorkoutStore } from '../stores/workoutStore';
import { useProgramStore } from '../stores/programStore';
import { getCurrentWeek, getNextWorkout, getCompletedWorkoutCount } from '../lib/programScheduler';
import { getProgramDetails } from '../lib/n8nService';
import type { ProgramExercise } from '../lib/n8nService';
import { getUserProgram } from '../lib/programService';
import { supabase } from '../lib/supabase';
import Header from '../components/layout/Header';
import PageContainer from '../components/layout/PageContainer';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import ProgressBar from '../components/ui/ProgressBar';

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = useUserStore(s => s.user);
  const logs = useWorkoutStore(s => s.logs);
  const startWorkoutFromProgram = useWorkoutStore(s => s.startWorkoutFromProgram);
  const activeSession = useWorkoutStore(s => s.activeSession);
  const program = useProgramStore(s => s.program);

  const [programExercises, setProgramExercises] = useState<ProgramExercise[]>([]);
  const [loadingProgram, setLoadingProgram] = useState(false);
  const [programError, setProgramError] = useState('');

  const currentWeek = program?.startDate
    ? getCurrentWeek(program.startDate)
    : 1;

  const nextWorkout = getNextWorkout(currentWeek, logs);
  const totalCompleted = getCompletedWorkoutCount(logs);
  const totalWorkouts = 36; // 12 weeks * 3
  const overallProgress = (totalCompleted / totalWorkouts) * 100;

  // Check completed workouts for this week
  const thisWeekLogs = logs.filter(l => l.weekNumber === currentWeek && l.completedAt);
  const completedThisWeek = thisWeekLogs.length;

  // Fetch program details from Excel for current week
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
          `Hafta ${currentWeek}`,
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
  }, [currentWeek]);

  const handleStartWorkout = () => {
    if (activeSession) {
      navigate(`/workout/${activeSession.workoutType}`);
      return;
    }
    if (nextWorkout && programExercises.length > 0) {
      startWorkoutFromProgram(
        nextWorkout.type,
        nextWorkout.weekNumber,
        nextWorkout.dayInWeek,
        programExercises,
      );
      navigate(`/workout/${nextWorkout.type}`);
    }
  };

  // Filter exercises for the next workout type
  const nextWorkoutGroup = nextWorkout ? `W${nextWorkout.type}` : '';
  const nextWorkoutExercises = programExercises.filter(e => e.grup === nextWorkoutGroup);

  return (
    <>
      <Header
        title={`Merhaba, ${user?.name?.split(' ')[0] || 'Sporcu'}`}
      />
      <PageContainer>
        {/* Week Overview */}
        <Card className="mb-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-bold text-text">Hafta {currentWeek} / 12</h2>
            <Badge variant={completedThisWeek === 3 ? 'success' : 'accent'}>
              {completedThisWeek}/3 antrenman
            </Badge>
          </div>
          <ProgressBar value={overallProgress} color="accent" className="mb-2" />
          <p className="text-xs text-text-muted">
            Toplam {totalCompleted} / {totalWorkouts} antrenman tamamlandı
          </p>
        </Card>

        {/* This Week's Status */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {(['A', 'B', 'C'] as const).map(type => {
            const done = thisWeekLogs.some(l => l.workoutType === type);
            return (
              <Card
                key={type}
                className={`text-center ${done ? 'border-success/30' : ''}`}
              >
                <div className={`text-lg font-bold ${done ? 'text-success' : 'text-text-muted'}`}>
                  {type}
                </div>
                <div className="text-[10px] text-text-muted mt-1">
                  {done ? 'Tamamlandı' : 'Bekliyor'}
                </div>
              </Card>
            );
          })}
        </div>

        {/* Next Workout Card */}
        {nextWorkout && (
          <Card className="mb-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-bold text-text">
                  Sıradaki: Workout {nextWorkout.type}
                </h3>
                <p className="text-sm text-text-muted">
                  Hafta {nextWorkout.weekNumber} - Gün {nextWorkout.dayInWeek}
                </p>
              </div>
              <Badge variant="accent">{nextWorkoutExercises.length} hareket</Badge>
            </div>

            {loadingProgram && (
              <p className="text-sm text-primary-light text-center animate-pulse py-4">
                Program yükleniyor...
              </p>
            )}

            {programError && (
              <p className="text-sm text-error text-center py-2">{programError}</p>
            )}

            {!loadingProgram && nextWorkoutExercises.length > 0 && (
              <div className="flex flex-col gap-1.5 mb-4">
                {nextWorkoutExercises.map(pe => (
                  <div key={pe.search_key} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary-light" />
                      <span className="text-text-muted">{pe.egzersiz_adi}</span>
                    </div>
                    <span className="text-xs text-text-muted">{pe.set_x_tekrar}</span>
                  </div>
                ))}
              </div>
            )}

            <Button
              fullWidth
              size="lg"
              onClick={handleStartWorkout}
              disabled={loadingProgram || programExercises.length === 0}
            >
              {activeSession ? 'Antrenmana Devam Et' : 'Antrenmana Başla'}
            </Button>
          </Card>
        )}

        {!nextWorkout && (
          <Card className="text-center py-8">
            <div className="text-4xl mb-3">&#127942;</div>
            <h3 className="font-bold text-text text-lg">Tebrikler!</h3>
            <p className="text-text-muted mt-1">
              {program?.isComplete
                ? '12 haftalık programı tamamladınız!'
                : 'Bu haftanın tüm antrenmanları tamamlandı!'}
            </p>
          </Card>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3 mt-4">
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
