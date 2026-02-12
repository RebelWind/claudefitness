import { useNavigate } from 'react-router';
import { useUserStore } from '../stores/userStore';
import { useWorkoutStore } from '../stores/workoutStore';
import { useProgramStore } from '../stores/programStore';
import { getCurrentWeek, getNextWorkout, getCompletedWorkoutCount } from '../lib/programScheduler';
import { WORKOUT_TEMPLATES } from '../constants/workouts';
import { EXERCISES, GROUP_COLORS } from '../constants/exercises';
import Header from '../components/layout/Header';
import PageContainer from '../components/layout/PageContainer';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import ProgressBar from '../components/ui/ProgressBar';

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = useUserStore(s => s.user);
  const baselines = useUserStore(s => s.baselines);
  const logs = useWorkoutStore(s => s.logs);
  const startWorkout = useWorkoutStore(s => s.startWorkout);
  const activeSession = useWorkoutStore(s => s.activeSession);
  const program = useProgramStore(s => s.program);

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

  const handleStartWorkout = () => {
    if (activeSession) {
      navigate(`/workout/${activeSession.workoutType}`);
      return;
    }
    if (nextWorkout) {
      startWorkout(nextWorkout.type, nextWorkout.weekNumber, nextWorkout.dayInWeek, baselines);
      navigate(`/workout/${nextWorkout.type}`);
    }
  };

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
              <Badge variant="accent">{WORKOUT_TEMPLATES[nextWorkout.type].exercises.length} hareket</Badge>
            </div>

            <div className="flex flex-col gap-1.5 mb-4">
              {WORKOUT_TEMPLATES[nextWorkout.type].exercises.map(exId => {
                const ex = EXERCISES[exId];
                const dotColor = GROUP_COLORS[ex.group].dot;
                return (
                  <div key={exId} className="flex items-center gap-2 text-sm">
                    <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                    <span className="text-text-muted">{ex.name}</span>
                    <span className={`text-[10px] ${GROUP_COLORS[ex.group].text}`}>{ex.group}</span>
                  </div>
                );
              })}
            </div>

            <Button
              fullWidth
              size="lg"
              onClick={handleStartWorkout}
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
