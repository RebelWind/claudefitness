import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useUserStore } from '../stores/userStore';
import { useProgramStore } from '../stores/programStore';
import { EXERCISE_GROUPS, GROUP_LABELS, GROUP_COLORS, EXERCISES } from '../constants/exercises';
import type { ExerciseId, ExerciseGroup } from '../types/exercise';
import Header from '../components/layout/Header';
import PageContainer from '../components/layout/PageContainer';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import ProgressBar from '../components/ui/ProgressBar';

interface ExerciseInput {
  weight: string;
  reps: string;
}

const groupKeys: ExerciseGroup[] = ['G1', 'G2', 'G3', 'G4'];

export default function InitialSetupPage() {
  const navigate = useNavigate();
  const updateBaseline = useUserStore(s => s.updateBaseline);
  const completeSetup = useUserStore(s => s.completeSetup);
  const initializeProgram = useProgramStore(s => s.initializeProgram);
  const [currentGroupIdx, setCurrentGroupIdx] = useState(0);

  // Key inputs by "groupKey-exerciseId" to handle duplicates across groups
  const [inputs, setInputs] = useState<Record<string, ExerciseInput>>(() => {
    const initial: Record<string, ExerciseInput> = {};
    for (const gKey of groupKeys) {
      for (const exId of EXERCISE_GROUPS[gKey]) {
        const key = `${gKey}-${exId}`;
        initial[key] = { weight: '', reps: '' };
      }
    }
    return initial;
  });

  const currentGroup = groupKeys[currentGroupIdx];
  const exerciseIds = EXERCISE_GROUPS[currentGroup];
  const colors = GROUP_COLORS[currentGroup];
  const progress = ((currentGroupIdx) / groupKeys.length) * 100;

  const inputKey = (exId: ExerciseId) => `${currentGroup}-${exId}`;

  const updateInput = (exId: ExerciseId, field: 'weight' | 'reps', value: string) => {
    const key = inputKey(exId);
    setInputs(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  const isCurrentGroupValid = () => {
    return exerciseIds.every(exId => {
      const ex = EXERCISES[exId];
      const input = inputs[inputKey(exId)];
      if (ex.usesWeight && (!input.weight || Number(input.weight) <= 0)) return false;
      if (!input.reps || Number(input.reps) <= 0) return false;
      return true;
    });
  };

  const handleNext = () => {
    exerciseIds.forEach(exId => {
      const input = inputs[inputKey(exId)];
      updateBaseline(
        exId,
        Number(input.weight) || 0,
        Number(input.reps) || 0,
      );
    });

    if (currentGroupIdx < groupKeys.length - 1) {
      setCurrentGroupIdx(prev => prev + 1);
    } else {
      completeSetup();
      initializeProgram(new Date().toISOString());
      navigate('/dashboard', { replace: true });
    }
  };

  const handleBack = () => {
    if (currentGroupIdx > 0) {
      setCurrentGroupIdx(prev => prev - 1);
    }
  };

  const isLastGroup = currentGroupIdx === groupKeys.length - 1;

  return (
    <>
      <Header title="Başlangıç Ayarları" showBack />
      <PageContainer noBottomNav>
        {/* Group step indicator */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-text-muted">
              Adım {currentGroupIdx + 1} / {groupKeys.length}
            </span>
            <Badge group={currentGroup}>{currentGroup} - {GROUP_LABELS[currentGroup]}</Badge>
          </div>
          <ProgressBar value={progress} />
          {/* Group color dots */}
          <div className="flex gap-2 mt-3">
            {groupKeys.map((g, i) => (
              <div
                key={g}
                className={`flex-1 h-1.5 rounded-full transition-all ${
                  i <= currentGroupIdx ? GROUP_COLORS[g].dot : 'bg-surface-light'
                }`}
              />
            ))}
          </div>
        </div>

        <p className="text-sm text-text-muted mb-4">
          Her hareket için yapabildiğiniz ağırlık (kg) ve tekrar sayısını girin.
          {currentGroup === 'G4' && ' (Plank için saniye cinsinden girin)'}
        </p>

        <div className="flex flex-col gap-3">
          {exerciseIds.map(exId => {
            const ex = EXERCISES[exId];
            const input = inputs[inputKey(exId)];
            return (
              <div
                key={exId}
                className={`bg-surface rounded-2xl border p-4 ${colors.border}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className={`font-semibold ${colors.text}`}>{ex.name}</h3>
                  <Badge group={currentGroup}>{currentGroup}</Badge>
                </div>
                <div className="flex gap-3">
                  {ex.usesWeight && (
                    <div className="flex-1">
                      <label className="text-xs text-text-muted block mb-1">Ağırlık (kg)</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        placeholder="0"
                        value={input.weight}
                        onChange={e => updateInput(exId, 'weight', e.target.value)}
                        className={`w-full h-11 px-3 bg-background border rounded-xl
                          text-text text-center text-lg font-semibold focus:outline-none
                          ${colors.border} focus:border-current`}
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <label className="text-xs text-text-muted block mb-1">
                      {ex.trackingUnit === 'seconds' ? 'Süre (sn)' : 'Tekrar'}
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="0"
                      value={input.reps}
                      onChange={e => updateInput(exId, 'reps', e.target.value)}
                      className={`w-full h-11 px-3 bg-background border rounded-xl
                        text-text text-center text-lg font-semibold focus:outline-none
                        ${colors.border} focus:border-current`}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 mt-6 mb-4">
          {currentGroupIdx > 0 && (
            <Button variant="secondary" onClick={handleBack} className="flex-1">
              Geri
            </Button>
          )}
          <Button
            onClick={handleNext}
            disabled={!isCurrentGroupValid()}
            className="flex-1"
          >
            {isLastGroup ? 'Programa Başla' : 'Devam'}
          </Button>
        </div>
      </PageContainer>
    </>
  );
}
