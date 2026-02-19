import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useUserStore } from '../stores/userStore';
import { useWorkoutStore } from '../stores/workoutStore';
import { useProgramStore } from '../stores/programStore';
import { useProgramDetailsStore } from '../stores/programDetailsStore';
import { getCurrentWeek, getCompletedWorkoutCount, getWeekCompletionCount, getWeekStreak } from '../lib/programScheduler';
import { insertProgram } from '../lib/n8nService';
import type { ProgramInput } from '../lib/n8nService';
import { EXERCISE_EXCEL_ROWS } from '../constants/exerciseRows';
import { saveWorkoutLog } from '../lib/supabaseSync';
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
  const updateLogSets = useWorkoutStore(s => s.updateLogSets);
  const program = useProgramStore(s => s.program);
  const googleFileId = useProgramDetailsStore(s => s.googleFileId);

  // Program details cache store
  const weeklyPrograms = useProgramDetailsStore(s => s.weeklyPrograms);
  const loading = useProgramDetailsStore(s => s.loading);
  const error = useProgramDetailsStore(s => s.error);
  const fetchWeek = useProgramDetailsStore(s => s.fetchWeek);

  const currentWeek = program?.startDate
    ? getCurrentWeek(program.startDate)
    : 1;

  const [selectedWeek, setSelectedWeek] = useState(currentWeek);
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutType>('A');
  const [editMode, setEditMode] = useState(false);
  const [editSets, setEditSets] = useState<Record<string, number[]>>({});
  const [isSaving, setIsSaving] = useState(false);

  const totalCompleted = getCompletedWorkoutCount(logs);
  const totalWorkouts = 36;
  const overallProgress = (totalCompleted / totalWorkouts) * 100;
  const weekStreak = getWeekStreak(logs, currentWeek);

  // Completed workouts for the selected week
  const selectedWeekLogs = logs.filter(l => l.weekNumber === selectedWeek && l.completedAt);
  const selectedWeekDone = getWeekCompletionCount(logs, selectedWeek);

  // Get program exercises from cache (or empty while loading)
  const programExercises = weeklyPrograms[selectedWeek] || [];

  // Auto-select first incomplete workout when week changes
  useEffect(() => {
    const completedTypes = new Set(selectedWeekLogs.map(l => l.workoutType));
    const firstIncomplete = WORKOUT_TYPES.find(t => !completedTypes.has(t));
    setSelectedWorkout(firstIncomplete || 'A');
  }, [selectedWeek, selectedWeekLogs.length]);

  // Fetch week data — store handles caching
  useEffect(() => {
    fetchWeek(selectedWeek);
  }, [selectedWeek, fetchWeek]);

  const handleRefresh = () => {
    fetchWeek(selectedWeek, true);
  };

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

  // Find the completed log for the selected workout/week
  const completedLog = useMemo(
    () => selectedWeekLogs.find(l => l.workoutType === selectedWorkout) || null,
    [selectedWeekLogs, selectedWorkout],
  );

  // Map search_key → logged sets for quick lookup
  const loggedSetsMap = useMemo(() => {
    if (!completedLog) return {};
    const map: Record<string, number[]> = {};
    for (const ex of completedLog.exercises) {
      if (ex.searchKey) map[ex.searchKey] = ex.sets;
    }
    return map;
  }, [completedLog]);

  // Map search_key → kg from program data (fallback for old logs with weightKg=0)
  const programKgMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const pe of workoutExercises) {
      const kgNum = typeof pe.kg === 'number' ? pe.kg : Number(pe.kg) || 0;
      if (kgNum > 0) map[pe.search_key] = kgNum;
    }
    return map;
  }, [workoutExercises]);

  // Reset edit mode when switching workout/week
  useEffect(() => {
    setEditMode(false);
    setEditSets({});
  }, [selectedWeek, selectedWorkout]);

  const handleStartEdit = () => {
    // Populate edit state from the logged data
    setEditSets({ ...loggedSetsMap });
    setEditMode(true);
  };

  const handleEditSetValue = (searchKey: string, setIdx: number, value: number) => {
    setEditSets(prev => {
      const current = [...(prev[searchKey] || [])];
      current[setIdx] = Math.max(0, value);
      return { ...prev, [searchKey]: current };
    });
  };

  const handleSaveEdits = async () => {
    if (!completedLog || !googleFileId) return;
    setIsSaving(true);
    try {
      // Build ProgramInput[] from edited sets
      const inputs: ProgramInput[] = Object.entries(editSets).map(([key, sets]) => {
        const input: ProgramInput = {
          search_key: key,
          set1: sets[0] || 0,
          set2: sets[1] || 0,
          set3: sets[2] || 0,
          excel_satir_no: EXERCISE_EXCEL_ROWS[key] || 0,
        };
        if (sets.length >= 4) {
          input.set4 = sets[3] || 0;
        }
        return input;
      });

      await insertProgram(googleFileId, `Hafta ${selectedWeek}`, inputs);

      // Update local log
      for (const [key, sets] of Object.entries(editSets)) {
        updateLogSets(completedLog.id, key, sets);
      }

      // Sync updated log to Supabase
      const userId = user?.id;
      const updatedLog = useWorkoutStore.getState().logs.find(l => l.id === completedLog.id);
      if (userId && updatedLog) {
        saveWorkoutLog(userId, updatedLog).catch(() => {});
      }

      setEditMode(false);
    } catch (err) {
      console.error('Düzenleme kaydetme hatası:', err);
    } finally {
      setIsSaving(false);
    }
  };

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
            <div className="flex items-center gap-2">
              {isWorkoutDone && (
                <Badge variant="success">Tamamlandı</Badge>
              )}
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="w-8 h-8 rounded-lg bg-surface-light flex items-center justify-center
                  text-text-muted text-sm active:bg-surface transition-colors disabled:opacity-50"
                title="Yenile"
              >
                &#8635;
              </button>
            </div>
          </div>

          {loading && programExercises.length === 0 && (
            <p className="text-sm text-primary-light text-center animate-pulse py-4">
              Program yükleniyor...
            </p>
          )}

          {error && programExercises.length === 0 && (
            <p className="text-sm text-error text-center py-2">{error}</p>
          )}

          {/* Completed workout → render from log (has kg, sets, etc.) */}
          {isWorkoutDone && completedLog && completedLog.exercises.length > 0 && (
            <div className="flex flex-col gap-1 mb-4">
              {completedLog.exercises.map((ex, idx) => {
                const editingSets = editSets[ex.searchKey || ''];
                const kg = ex.weightKg > 0 ? ex.weightKg : (programKgMap[ex.searchKey || ''] || 0);
                return (
                  <div key={ex.searchKey || idx} className="py-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-success" />
                        <span className="text-sm text-text">{ex.exerciseName || ex.exerciseId}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {kg > 0 && (
                          <span className="text-xs font-bold text-primary-light bg-primary/10 px-2 py-0.5 rounded">
                            {kg} kg
                          </span>
                        )}
                        {ex.rpe != null && (
                          <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full font-semibold">
                            RPE {ex.rpe}
                          </span>
                        )}
                        {ex.targetSetsTekrar && (
                          <span className="text-xs text-text-muted font-medium">{ex.targetSetsTekrar}</span>
                        )}
                      </div>
                    </div>

                    {/* Logged sets (not editing) */}
                    {!editMode && (
                      <div className="flex items-center gap-1.5 mt-1.5 ml-3.5">
                        <span className="text-xs text-text-muted">Tekrar:</span>
                        {ex.sets.map((reps, i) => (
                          <span key={i} className="text-sm font-semibold text-success bg-success/10 px-2 py-0.5 rounded">
                            {reps}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Editable sets */}
                    {editMode && editingSets && (
                      <div className="flex items-center gap-1.5 mt-1.5 ml-3.5">
                        <span className="text-xs text-text-muted">Set:</span>
                        {editingSets.map((reps, i) => (
                          <input
                            key={i}
                            type="number"
                            inputMode="numeric"
                            value={reps || ''}
                            onChange={e => handleEditSetValue(ex.searchKey || '', i, parseInt(e.target.value) || 0)}
                            className="w-14 h-8 text-center text-sm font-bold rounded-lg bg-background
                              border border-surface-light text-text focus:outline-none focus:border-primary-light"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Upcoming workout → render from n8n program data */}
          {!isWorkoutDone && workoutExercises.length > 0 && (
            <div className="flex flex-col gap-1 mb-4">
              {workoutExercises.map(pe => (
                <div key={pe.search_key} className="py-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary-light" />
                      <span className="text-sm text-text">{pe.egzersiz_adi}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {Number(pe.kg) > 0 && (
                        <span className="text-xs font-bold text-primary-light bg-primary/10 px-2 py-0.5 rounded">
                          {Number(pe.kg)} kg
                        </span>
                      )}
                      {pe.rpe !== null && (
                        <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full font-semibold">
                          RPE {pe.rpe}
                        </span>
                      )}
                      <span className="text-xs text-text-muted font-medium">{pe.set_x_tekrar}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          {isActiveForSelected ? (
            <Button
              fullWidth
              size="lg"
              onClick={() => navigate(`/workout/${selectedWorkout}`)}
            >
              Antrenmana Devam Et
            </Button>
          ) : editMode ? (
            /* Edit mode: Save / Cancel */
            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => { setEditMode(false); setEditSets({}); }}
                disabled={isSaving}
              >
                İptal
              </Button>
              <Button
                className="flex-1"
                onClick={handleSaveEdits}
                disabled={isSaving}
              >
                {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
            </div>
          ) : isWorkoutDone ? (
            /* Completed: Edit / Redo */
            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={handleStartEdit}
              >
                Düzenle
              </Button>
              <Button
                className="flex-1"
                onClick={() => handleStartWorkout(selectedWorkout)}
                disabled={hasActiveSession && !isActiveForSelected}
              >
                Tekrar Yap
              </Button>
            </div>
          ) : (
            <Button
              fullWidth
              size="lg"
              onClick={() => handleStartWorkout(selectedWorkout)}
              disabled={loading || programExercises.length === 0 || (hasActiveSession && !isActiveForSelected)}
            >
              Antrenmana Başla
            </Button>
          )}

          {hasActiveSession && !isActiveForSelected && !editMode && (
            <p className="text-[10px] text-text-muted text-center mt-2">
              Devam eden antrenmanı bitirin veya bırakın
            </p>
          )}
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="text-center">
            <div className={`text-2xl font-bold ${selectedWeekDone >= 3 ? 'text-success' : 'text-primary-light'}`}>{selectedWeekDone}/3</div>
            <div className="text-xs text-text-muted">Hafta {selectedWeek}</div>
          </Card>
          <Card className="text-center">
            <div className="text-2xl font-bold text-accent">%{Math.round(overallProgress)}</div>
            <div className="text-xs text-text-muted">İlerleme</div>
          </Card>
          <Card className="text-center">
            <div className="text-2xl font-bold text-success">{weekStreak}</div>
            <div className="text-xs text-text-muted">Streak{weekStreak > 0 ? ' 🔥' : ''}</div>
          </Card>
        </div>
      </PageContainer>
    </>
  );
}
