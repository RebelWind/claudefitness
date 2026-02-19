import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '../stores/authStore';
import { useUserStore } from '../stores/userStore';
import { useWorkoutStore } from '../stores/workoutStore';
import { useProgramStore } from '../stores/programStore';
import { useProgramDetailsStore } from '../stores/programDetailsStore';
import { EXERCISES, GROUP_LABELS, GROUP_COLORS } from '../constants/exercises';
import { getExcelMapping } from '../constants/exerciseMapping';
import { insertBaslangic } from '../lib/n8nService';
import type { BaslangicInput } from '../lib/n8nService';
import { saveBaselines } from '../lib/supabaseSync';
import type { ExerciseGroup, ExerciseId } from '../types/exercise';
import Badge from '../components/ui/Badge';
import Header from '../components/layout/Header';
import PageContainer from '../components/layout/PageContainer';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';

export default function ProfilePage() {
  const navigate = useNavigate();
  const logout = useAuthStore(s => s.logout);
  const user = useUserStore(s => s.user);
  const baselines = useUserStore(s => s.baselines);
  const updateBaseline = useUserStore(s => s.updateBaseline);
  const logs = useWorkoutStore(s => s.logs);
  const resetProgram = useProgramStore(s => s.reset);
  const googleFileId = useProgramDetailsStore(s => s.googleFileId);

  const [showResetModal, setShowResetModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editBodyWeight, setEditBodyWeight] = useState(0);

  // Edit state: group-exerciseId → { kg, reps }
  const [editValues, setEditValues] = useState<Record<string, { kg: number; reps: number }>>({});

  const completedLogs = logs.filter(l => l.completedAt);
  const totalDuration = completedLogs.reduce(
    (sum, l) => sum + (l.durationSeconds || 0),
    0,
  );
  const totalHours = Math.floor(totalDuration / 3600);
  const totalMins = Math.floor((totalDuration % 3600) / 60);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const handleReset = () => {
    resetProgram();
    useWorkoutStore.getState().setLogs([]);
    setShowResetModal(false);
    navigate('/setup', { replace: true });
  };

  const handleStartEdit = () => {
    const values: Record<string, { kg: number; reps: number }> = {};
    for (const b of baselines) {
      values[`${b.group}-${b.exerciseId}`] = {
        kg: b.initialWeightKg,
        reps: b.initialReps,
      };
    }
    setEditValues(values);
    setEditBodyWeight(user?.bodyWeightKg || 0);
    setEditMode(true);
  };

  const handleEditValue = (group: ExerciseGroup, exerciseId: ExerciseId, field: 'kg' | 'reps', value: number) => {
    const key = `${group}-${exerciseId}`;
    setEditValues(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: Math.max(0, value) },
    }));
  };

  const handleSaveEdits = async () => {
    setIsSaving(true);
    try {
      // Update local store
      for (const b of baselines) {
        const key = `${b.group}-${b.exerciseId}`;
        const edited = editValues[key];
        if (edited && (edited.kg !== b.initialWeightKg || edited.reps !== b.initialReps)) {
          updateBaseline(b.group, b.exerciseId, edited.kg, edited.reps);
        }
      }

      // Save body weight to user profile
      if (user && editBodyWeight !== user.bodyWeightKg) {
        useUserStore.getState().setUser({ ...user, bodyWeightKg: editBodyWeight });
      }

      // Build n8n payload from edited values
      if (googleFileId) {
        const inputs: BaslangicInput[] = [];
        for (const b of baselines) {
          const key = `${b.group}-${b.exerciseId}`;
          const edited = editValues[key];
          const mapping = getExcelMapping(b.group, b.exerciseId);
          if (mapping && edited) {
            inputs.push({
              search_key: mapping.search_key,
              girilen_agirlik: edited.kg,
              girilen_tekrar: edited.reps,
              excel_satir_no: mapping.excel_satir_no,
            });
          }
        }
        if (inputs.length > 0) {
          // Wait for Excel to be updated before invalidating cache
          await insertBaslangic(googleFileId, editBodyWeight, inputs);

          // Excel recalculated — clear cached weekly programs so workouts fetch fresh data
          useProgramDetailsStore.setState({ weeklyPrograms: {} });
        }
      }

      // Save to Supabase
      const userId = user?.id;
      if (userId) {
        const updatedBaselines = useUserStore.getState().baselines;
        saveBaselines(userId, updatedBaselines).catch(() => {});
      }

      setEditMode(false);
    } catch {
      // ignore
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Header title="Profil" />
      <PageContainer>
        {/* User Info */}
        <Card className="mb-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center">
              <span className="text-xl font-bold text-white">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div>
              <h2 className="font-bold text-text text-lg">{user?.name}</h2>
              <p className="text-sm text-text-muted">{user?.email}</p>
              {user?.programStartDate && (
                <p className="text-xs text-text-muted mt-0.5">
                  Başlangıç: {new Date(user.programStartDate).toLocaleDateString('tr-TR')}
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Stats */}
        <Card className="mb-4">
          <h3 className="font-bold text-text mb-3">İstatistikler</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-2xl font-bold text-primary-light">
                {completedLogs.length}
              </div>
              <div className="text-xs text-text-muted">Toplam Antrenman</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-success">
                {totalHours > 0 ? `${totalHours}s ${totalMins}d` : `${totalMins}d`}
              </div>
              <div className="text-xs text-text-muted">Toplam Süre</div>
            </div>
          </div>
        </Card>

        {/* Baselines grouped by G1-G4 */}
        {baselines.length > 0 && (() => {
          const groups = (['G1', 'G2', 'G3', 'G4'] as ExerciseGroup[]).filter(
            g => baselines.some(b => b.group === g),
          );
          return (
            <Card className="mb-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-text">Başlangıç Değerleri</h3>
                {!editMode ? (
                  <button
                    onClick={handleStartEdit}
                    className="text-xs font-semibold text-primary-light active:text-primary"
                  >
                    Düzenle
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditMode(false)}
                      disabled={isSaving}
                      className="text-xs font-semibold text-text-muted active:text-text"
                    >
                      İptal
                    </button>
                    <button
                      onClick={handleSaveEdits}
                      disabled={isSaving}
                      className="text-xs font-semibold text-success active:text-success/80"
                    >
                      {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
                    </button>
                  </div>
                )}
              </div>
              {/* Body Weight */}
              <div className="flex items-center justify-between py-2 mb-2 border-b border-surface-light">
                <span className="text-sm text-text-muted">Vücut Ağırlığı</span>
                {editMode ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      value={editBodyWeight || ''}
                      onChange={e => setEditBodyWeight(parseFloat(e.target.value) || 0)}
                      className="w-20 h-9 text-center text-sm font-bold rounded-lg bg-background
                        border border-surface-light text-text focus:outline-none focus:border-primary-light"
                    />
                    <span className="text-xs text-text-muted">kg</span>
                  </div>
                ) : (
                  <span className="text-sm text-text font-medium">
                    {user?.bodyWeightKg ? `${user.bodyWeightKg} kg` : '—'}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-4">
                {groups.map(g => {
                  const colors = GROUP_COLORS[g];
                  const groupBaselines = baselines.filter(b => b.group === g);
                  return (
                    <div key={g}>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge group={g}>{g}</Badge>
                        <span className={`text-xs font-medium ${colors.text}`}>{GROUP_LABELS[g]}</span>
                      </div>
                      <div className={`flex flex-col gap-2 pl-2 border-l-2 ${colors.border}`}>
                        {groupBaselines.map(b => {
                          const key = `${b.group}-${b.exerciseId}`;
                          const edited = editValues[key];
                          const isSeconds = EXERCISES[b.exerciseId].trackingUnit === 'seconds';
                          const unit = isSeconds ? 'sn' : 'tekrar';

                          return (
                            <div key={key}>
                              <div className="text-sm text-text-muted mb-1">{EXERCISES[b.exerciseId].name}</div>
                              {editMode && edited ? (
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      step="0.5"
                                      value={edited.kg || ''}
                                      onChange={e => handleEditValue(b.group, b.exerciseId, 'kg', parseFloat(e.target.value) || 0)}
                                      className="w-20 h-9 text-center text-sm font-bold rounded-lg bg-background
                                        border border-surface-light text-text focus:outline-none focus:border-primary-light"
                                    />
                                    <span className="text-xs text-text-muted">kg</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      inputMode="numeric"
                                      value={edited.reps || ''}
                                      onChange={e => handleEditValue(b.group, b.exerciseId, 'reps', parseInt(e.target.value) || 0)}
                                      className="w-16 h-9 text-center text-sm font-bold rounded-lg bg-background
                                        border border-surface-light text-text focus:outline-none focus:border-primary-light"
                                    />
                                    <span className="text-xs text-text-muted">{unit}</span>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-sm text-text font-medium">
                                  {b.initialWeightKg > 0 && `${b.initialWeightKg} kg - `}
                                  {isSeconds
                                    ? `${b.initialReps} sn`
                                    : `${b.initialReps} tekrar`}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })()}

        {/* Actions */}
        <div className="flex flex-col gap-3 mb-4">
          <Button
            variant="danger"
            fullWidth
            onClick={() => setShowResetModal(true)}
          >
            Programı Sıfırla
          </Button>
          <Button
            variant="secondary"
            fullWidth
            onClick={handleLogout}
          >
            Çıkış Yap
          </Button>
        </div>
      </PageContainer>

      <Modal open={showResetModal} onClose={() => setShowResetModal(false)} title="Programı Sıfırla">
        <p className="text-text-muted mb-4">
          Tüm ilerlemeniz silinecek ve baştan başlayacaksınız. Bu işlem geri alınamaz.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setShowResetModal(false)} className="flex-1">
            İptal
          </Button>
          <Button variant="danger" onClick={handleReset} className="flex-1">
            Sıfırla
          </Button>
        </div>
      </Modal>
    </>
  );
}
