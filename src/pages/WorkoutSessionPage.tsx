import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useWorkoutStore } from '../stores/workoutStore';
import { useProgramStore } from '../stores/programStore';
import { EXERCISES } from '../constants/exercises';
import type { ExerciseLog } from '../types/workout';
import Header from '../components/layout/Header';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import ProgressBar from '../components/ui/ProgressBar';
import Modal from '../components/ui/Modal';

function RestTimer({ seconds, onComplete }: { seconds: number; onComplete: () => void }) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) {
      onComplete();
      return;
    }
    const timer = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining, onComplete]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <div className="text-center py-4">
      <p className="text-sm text-text-muted mb-2">Dinlenme Süresi</p>
      <div className="text-4xl font-bold text-primary-light font-mono">
        {mins}:{secs.toString().padStart(2, '0')}
      </div>
      <Button variant="ghost" size="sm" onClick={onComplete} className="mt-3">
        Atla
      </Button>
    </div>
  );
}

export default function WorkoutSessionPage() {
  const { workoutType } = useParams();
  const navigate = useNavigate();
  const activeSession = useWorkoutStore(s => s.activeSession);
  const updateSet = useWorkoutStore(s => s.updateSet);
  const completeExercise = useWorkoutStore(s => s.completeExercise);
  const nextExercise = useWorkoutStore(s => s.nextExercise);
  const prevExercise = useWorkoutStore(s => s.prevExercise);
  const completeWorkout = useWorkoutStore(s => s.completeWorkout);
  const abandonWorkout = useWorkoutStore(s => s.abandonWorkout);
  const markWorkoutComplete = useProgramStore(s => s.markWorkoutComplete);

  const [showRest, setShowRest] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);

  const handleRestComplete = useCallback(() => {
    setShowRest(false);
  }, []);

  useEffect(() => {
    if (!activeSession && !showSummary) {
      navigate('/dashboard', { replace: true });
    }
  }, [activeSession, navigate, showSummary]);

  if (!activeSession) return null;

  const currentExercise: ExerciseLog = activeSession.exercises[activeSession.currentExerciseIndex];
  const exerciseInfo = EXERCISES[currentExercise.exerciseId];
  const displayName = currentExercise.exerciseName || exerciseInfo?.name || 'Egzersiz';
  const progress = ((activeSession.currentExerciseIndex + 1) / activeSession.exercises.length) * 100;
  const isLastExercise = activeSession.currentExerciseIndex === activeSession.exercises.length - 1;

  const restDuration = exerciseInfo?.group === 'G1' || exerciseInfo?.group === 'G2' ? 90 : 60;

  const handleSetComplete = (setIdx: number, reps: number) => {
    updateSet(activeSession.currentExerciseIndex, setIdx, reps);
    // Show rest timer after each set (except the last one)
    if (setIdx < currentExercise.sets.length - 1) {
      setShowRest(true);
    }
  };

  const handleNextExercise = () => {
    completeExercise(activeSession.currentExerciseIndex);
    if (isLastExercise) {
      // Complete the workout
      const logId = `log-${Date.now()}`;
      completeWorkout();
      markWorkoutComplete(activeSession.weekNumber, activeSession.dayInWeek, logId);
      setShowSummary(true);
    } else {
      nextExercise();
    }
  };

  const handleQuit = () => {
    abandonWorkout();
    navigate('/dashboard', { replace: true });
  };

  const allSetsEntered = currentExercise.sets.every(s => s > 0);

  return (
    <>
      <Header
        title={`Workout ${workoutType}`}
        showBack={false}
        rightAction={
          <button
            onClick={() => setShowQuitConfirm(true)}
            className="text-sm text-error font-medium"
          >
            Bitir
          </button>
        }
      />

      <div className="flex-1 flex flex-col max-w-lg mx-auto w-full px-4">
        {/* Progress */}
        <div className="py-3">
          <div className="flex justify-between text-xs text-text-muted mb-1">
            <span>Hareket {activeSession.currentExerciseIndex + 1} / {activeSession.exercises.length}</span>
            <span>Hafta {activeSession.weekNumber}</span>
          </div>
          <ProgressBar value={progress} color="success" />
        </div>

        {/* Exercise Navigation Dots */}
        <div className="flex justify-center gap-1.5 mb-4">
          {activeSession.exercises.map((ex, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === activeSession.currentExerciseIndex
                  ? 'bg-primary-light'
                  : ex.completed
                    ? 'bg-success'
                    : 'bg-surface-light'
              }`}
            />
          ))}
        </div>

        {showRest ? (
          <Card className="flex-1 flex items-center justify-center">
            <RestTimer seconds={restDuration} onComplete={handleRestComplete} />
          </Card>
        ) : (
          <>
            {/* Exercise Card */}
            <Card className="mb-4">
              <div className="flex justify-between items-start mb-1">
                <h2 className="text-xl font-bold text-text">{displayName}</h2>
                {exerciseInfo?.group && (
                  <Badge group={exerciseInfo.group}>{exerciseInfo.group}</Badge>
                )}
              </div>

              {/* Target info from Excel */}
              <div className="flex items-center gap-3 mb-3">
                {currentExercise.targetSetsTekrar && (
                  <span className="text-primary-light font-semibold text-lg">
                    {currentExercise.targetSetsTekrar}
                  </span>
                )}
                {currentExercise.rpe !== null && currentExercise.rpe !== undefined && (
                  <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full font-semibold">
                    RPE {currentExercise.rpe}
                  </span>
                )}
              </div>

              {/* Warmup sets */}
              {currentExercise.warmupSets && currentExercise.warmupSets.length > 0 && (
                <div className="bg-surface-light/50 rounded-xl p-3 mb-4">
                  <p className="text-xs text-text-muted font-semibold mb-2">Isınma Setleri</p>
                  <div className="flex gap-2">
                    {currentExercise.warmupSets.map((w, i) => (
                      <div key={i} className="flex-1 text-center bg-background rounded-lg py-1.5">
                        <div className="text-xs text-text-muted">Set {i + 1}</div>
                        <div className="text-sm font-bold text-text">{w} kg</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Working Sets */}
              <p className="text-xs text-text-muted font-semibold mb-2">Çalışma Setleri</p>
              <div className="flex flex-col gap-3">
                {currentExercise.sets.map((reps, setIdx) => (
                  <div key={setIdx} className="flex items-center gap-3">
                    <div className="w-16 text-sm text-text-muted font-medium">
                      Set {setIdx + 1}
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <button
                        onClick={() => handleSetComplete(setIdx, Math.max(0, reps - 1))}
                        className="w-11 h-11 rounded-xl bg-surface-light text-text-muted font-bold text-xl
                          flex items-center justify-center active:bg-surface"
                      >
                        -
                      </button>
                      <div className="flex-1 relative">
                        <input
                          type="number"
                          inputMode="numeric"
                          value={reps || ''}
                          onChange={e => {
                            const val = parseInt(e.target.value) || 0;
                            updateSet(activeSession.currentExerciseIndex, setIdx, val);
                          }}
                          placeholder="0"
                          className="w-full h-11 bg-background border border-surface-light rounded-xl
                            text-text text-center text-lg font-bold focus:outline-none focus:border-primary-light"
                        />
                      </div>
                      <button
                        onClick={() => handleSetComplete(setIdx, reps + 1)}
                        className="w-11 h-11 rounded-xl bg-primary text-white font-bold text-xl
                          flex items-center justify-center active:bg-primary-dark"
                      >
                        +
                      </button>
                    </div>
                    <div className="w-10 text-xs text-text-muted text-right">
                      {exerciseInfo?.trackingUnit === 'seconds' ? 'sn' : 'rep'}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Navigation Buttons */}
            <div className="flex gap-3 mb-6">
              {activeSession.currentExerciseIndex > 0 && (
                <Button variant="secondary" onClick={prevExercise} className="flex-1">
                  Önceki
                </Button>
              )}
              <Button
                onClick={handleNextExercise}
                disabled={!allSetsEntered}
                className="flex-1"
              >
                {isLastExercise ? 'Antrenmanı Bitir' : 'Sonraki'}
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Summary Modal */}
      <Modal open={showSummary} onClose={() => navigate('/dashboard', { replace: true })} title="Antrenman Tamamlandı!">
        <div className="text-center py-4">
          <div className="text-5xl mb-4">&#128170;</div>
          <h3 className="text-lg font-bold text-text mb-2">Harika!</h3>
          <p className="text-text-muted mb-4">
            Workout {workoutType} tamamlandı.
          </p>
          <Button
            fullWidth
            onClick={() => navigate('/dashboard', { replace: true })}
          >
            Ana Sayfaya Dön
          </Button>
        </div>
      </Modal>

      {/* Quit Confirmation */}
      <Modal open={showQuitConfirm} onClose={() => setShowQuitConfirm(false)} title="Antrenmanı Bırak">
        <p className="text-text-muted mb-4">
          Antrenmanı bırakmak istediğinize emin misiniz? İlerlemeniz kaydedilmeyecek.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setShowQuitConfirm(false)} className="flex-1">
            İptal
          </Button>
          <Button variant="danger" onClick={handleQuit} className="flex-1">
            Bırak
          </Button>
        </div>
      </Modal>
    </>
  );
}
