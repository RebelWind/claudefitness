import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useWorkoutStore } from '../stores/workoutStore';
import { useProgramStore } from '../stores/programStore';
import { useProgramDetailsStore } from '../stores/programDetailsStore';
import { insertProgram } from '../lib/n8nService';
import type { ProgramInput } from '../lib/n8nService';
import { EXERCISES } from '../constants/exercises';
import { EXERCISE_EXCEL_ROWS } from '../constants/exerciseRows';
import { saveWorkoutLog } from '../lib/supabaseSync';
import { useUserStore } from '../stores/userStore';
import type { ExerciseLog } from '../types/workout';
import Header from '../components/layout/Header';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import ProgressBar from '../components/ui/ProgressBar';
import Modal from '../components/ui/Modal';

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

  const googleFileId = useProgramDetailsStore(s => s.googleFileId);
  const invalidateNextWeek = useProgramDetailsStore(s => s.invalidateNextWeek);

  const [showSummary, setShowSummary] = useState(false);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (!activeSession && !showSummary) {
      navigate('/dashboard', { replace: true });
    }
  }, [activeSession, navigate, showSummary]);

  if (!activeSession && !showSummary) return null;

  // After the early return above, activeSession is guaranteed non-null when showSummary is false.
  // Use non-null assertion to satisfy TypeScript narrowing.
  const session = activeSession!;

  const currentExercise: ExerciseLog = session.exercises[session.currentExerciseIndex];
  const exerciseInfo = EXERCISES[currentExercise.exerciseId];
  const displayName = currentExercise.exerciseName || exerciseInfo?.name || 'Egzersiz';
  const progress = ((session.currentExerciseIndex + 1) / session.exercises.length) * 100;
  const isLastExercise = session.currentExerciseIndex === session.exercises.length - 1;

  // Returns max allowed reps for a given set index, or null if unlimited
  const getMaxReps = (setIdx: number): number | null => {
    const target = currentExercise.targetSetsTekrar || '';
    const tekrar = target.split('x')[1] || '';

    // "3xmax" → unlimited
    if (tekrar.toLowerCase() === 'max') return null;

    // "4x5+" → last set unlimited, others capped at 5
    if (tekrar.endsWith('+')) {
      const cap = parseInt(tekrar);
      if (setIdx === currentExercise.sets.length - 1) return null;
      return cap || null;
    }

    // "3x10-14" → capped at 14
    if (tekrar.includes('-')) {
      const upper = parseInt(tekrar.split('-')[1]);
      return upper || null;
    }

    // "3x10" → capped at 10
    const cap = parseInt(tekrar);
    return cap || null;
  };

  const clampReps = (setIdx: number, value: number): number => {
    const max = getMaxReps(setIdx);
    if (max !== null && value > max) return max;
    return Math.max(0, value);
  };

  const handleSetComplete = (setIdx: number, reps: number) => {
    updateSet(session.currentExerciseIndex, setIdx, reps);
  };

  const handleNextExercise = async () => {
    completeExercise(session.currentExerciseIndex);
    if (isLastExercise) {
      // Build inputs payload from all exercises
      const inputs: ProgramInput[] = session.exercises.map(ex => {
        const key = ex.searchKey || '';
        const input: ProgramInput = {
          search_key: key,
          set1: ex.sets[0] || 0,
          set2: ex.sets[1] || 0,
          set3: ex.sets[2] || 0,
          excel_satir_no: EXERCISE_EXCEL_ROWS[key] || 0,
        };
        // 4-set exercises (bench, squat, overhead, barbell row)
        if (ex.sets.length >= 4) {
          input.set4 = ex.sets[3] || 0;
        }
        return input;
      });

      // Show summary FIRST (activeSession is still alive)
      setShowSummary(true);

      // Send to n8n in background (don't block UI)
      if (googleFileId) {
        setIsSyncing(true);
        try {
          await insertProgram(
            googleFileId,
            `Hafta ${session.weekNumber}`,
            inputs,
          );
          // Weights for next week changed in Excel — invalidate cache
          await invalidateNextWeek(session.weekNumber);
        } catch (err) {
          console.error('Excel güncelleme hatası:', err);
        } finally {
          setIsSyncing(false);
        }
      }
    } else {
      nextExercise();
    }
  };

  /** Called when user dismisses the summary modal */
  const handleSummaryClose = () => {
    // Now it's safe to clear the session
    completeWorkout();

    // Get the newly created log from store
    const logs = useWorkoutStore.getState().logs;
    const completedLog = logs[logs.length - 1];
    if (completedLog) {
      const prevWeek = useProgramStore.getState().program?.currentWeek ?? 1;
      markWorkoutComplete(session.weekNumber, session.dayInWeek, completedLog.id);
      const newWeek = useProgramStore.getState().program?.currentWeek ?? 1;

      // Save to Supabase in background
      const userId = useUserStore.getState().user?.id;
      if (userId) {
        saveWorkoutLog(userId, completedLog).catch(() => {});

        // If week advanced, persist to Supabase + local userStore
        if (newWeek > prevWeek) {
          import('../lib/programService').then(({ updateCurrentWeek }) => {
            updateCurrentWeek(userId, newWeek).catch(() => {});
          });
          const userStore = useUserStore.getState();
          const currentUser = userStore.user;
          if (currentUser) {
            userStore.setUser({ ...currentUser, currentWeek: newWeek });
          }
        }
      }
    }

    navigate('/dashboard', { replace: true });
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
            <span>Hareket {session.currentExerciseIndex + 1} / {session.exercises.length}</span>
            <span>Hafta {session.weekNumber}</span>
          </div>
          <ProgressBar value={progress} color="success" />
        </div>

        {/* Exercise Navigation Dots */}
        <div className="flex justify-center gap-1.5 mb-4">
          {session.exercises.map((ex, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === session.currentExerciseIndex
                  ? 'bg-primary-light'
                  : ex.completed
                    ? 'bg-success'
                    : 'bg-surface-light'
              }`}
            />
          ))}
        </div>

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
                {(currentExercise.weightKg > 0 || currentExercise.weightLabel) && (
                  <span className="text-lg font-bold text-text">
                    {currentExercise.weightLabel || `${currentExercise.weightKg} kg`}
                  </span>
                )}
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
                {currentExercise.sets.map((reps, setIdx) => {
                  const maxReps = getMaxReps(setIdx);
                  const atMax = maxReps !== null && reps >= maxReps;

                  return (
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
                          max={maxReps ?? undefined}
                          onChange={e => {
                            const val = clampReps(setIdx, parseInt(e.target.value) || 0);
                            updateSet(session.currentExerciseIndex, setIdx, val);
                          }}
                          placeholder="0"
                          className="w-full h-11 bg-background border border-surface-light rounded-xl
                            text-text text-center text-lg font-bold focus:outline-none focus:border-primary-light"
                        />
                      </div>
                      <button
                        onClick={() => handleSetComplete(setIdx, clampReps(setIdx, reps + 1))}
                        disabled={atMax}
                        className={`w-11 h-11 rounded-xl font-bold text-xl flex items-center justify-center
                          ${atMax ? 'bg-surface-light text-text-muted opacity-40' : 'bg-primary text-white active:bg-primary-dark'}`}
                      >
                        +
                      </button>
                    </div>
                    <div className="w-10 text-xs text-text-muted text-right">
                      {exerciseInfo?.trackingUnit === 'seconds' ? 'sn' : 'rep'}
                    </div>
                  </div>
                  );
                })}
              </div>
            </Card>

            {/* Navigation Buttons */}
            <div className="flex gap-3 mb-6">
              {session.currentExerciseIndex > 0 && (
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
      </div>

      {/* Summary Modal */}
      <Modal open={showSummary} onClose={handleSummaryClose} title="Antrenman Tamamlandı!">
        <div className="py-4">
          <div className="text-center">
            <div className="text-5xl mb-3">&#128170;</div>
            <h3 className="text-lg font-bold text-text mb-1">Harika!</h3>
            <p className="text-text-muted text-sm mb-4">
              Workout {workoutType} - Hafta {session.weekNumber}
            </p>
          </div>

          {/* Exercise summary with kg + sets */}
          <div className="flex flex-col gap-2 mb-4 max-h-64 overflow-y-auto">
              {session.exercises.map((ex, idx) => {
                const exKgLabel = ex.weightLabel || (ex.weightKg > 0 ? `${ex.weightKg} kg` : '');
                return (
                <div key={idx} className="flex items-center justify-between bg-surface rounded-xl px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-text truncate block">
                      {ex.exerciseName || ex.exerciseId}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    {exKgLabel && (
                      <span className="text-xs font-bold text-primary-light bg-primary/10 px-2 py-0.5 rounded">
                        {exKgLabel}
                      </span>
                    )}
                    <div className="flex gap-1">
                      {ex.sets.map((reps, i) => (
                        <span key={i} className="text-sm font-bold text-success bg-success/10 px-2 py-0.5 rounded">
                          {reps}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>

          {isSyncing && (
            <p className="text-xs text-primary-light animate-pulse mb-3 text-center">
              Veriler kaydediliyor...
            </p>
          )}
          <Button
            fullWidth
            onClick={handleSummaryClose}
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
