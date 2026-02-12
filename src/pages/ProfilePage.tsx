import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '../stores/authStore';
import { useUserStore } from '../stores/userStore';
import { useWorkoutStore } from '../stores/workoutStore';
import { useProgramStore } from '../stores/programStore';
import { EXERCISES } from '../constants/exercises';
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
  const logs = useWorkoutStore(s => s.logs);
  const resetProgram = useProgramStore(s => s.reset);
  const [showResetModal, setShowResetModal] = useState(false);

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

        {/* Baselines */}
        <Card className="mb-4">
          <h3 className="font-bold text-text mb-3">Başlangıç Değerleri</h3>
          <div className="flex flex-col gap-2">
            {baselines.map(b => (
              <div key={b.exerciseId} className="flex justify-between text-sm">
                <span className="text-text-muted">{EXERCISES[b.exerciseId].name}</span>
                <span className="text-text font-medium">
                  {b.initialWeightKg > 0 && `${b.initialWeightKg}kg - `}
                  {EXERCISES[b.exerciseId].trackingUnit === 'seconds'
                    ? `${b.initialReps}sn`
                    : `${b.initialReps} tekrar`}
                </span>
              </div>
            ))}
          </div>
        </Card>

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
