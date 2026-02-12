import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useUserStore } from '../stores/userStore';
import { useProgramStore } from '../stores/programStore';
import { EXERCISE_GROUPS, GROUP_LABELS, EXERCISES } from '../constants/exercises';
import type { ExerciseId } from '../types/exercise';
import Header from '../components/layout/Header';
import PageContainer from '../components/layout/PageContainer';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import ProgressBar from '../components/ui/ProgressBar';

interface ExerciseInput {
  weight: string;
  reps: string;
}

const groupKeys = ['G1', 'G2', 'G3', 'G4'] as const;

export default function InitialSetupPage() {
  const navigate = useNavigate();
  const updateBaseline = useUserStore(s => s.updateBaseline);
  const completeSetup = useUserStore(s => s.completeSetup);
  const initializeProgram = useProgramStore(s => s.initializeProgram);
  const [currentGroupIdx, setCurrentGroupIdx] = useState(0);

  const [inputs, setInputs] = useState<Record<string, ExerciseInput>>(() => {
    const initial: Record<string, ExerciseInput> = {};
    Object.keys(EXERCISES).forEach(id => {
      initial[id] = { weight: '', reps: '' };
    });
    return initial;
  });

  const currentGroup = groupKeys[currentGroupIdx];
  const exercises = EXERCISE_GROUPS[currentGroup];
  const progress = ((currentGroupIdx) / groupKeys.length) * 100;

  const updateInput = (id: string, field: 'weight' | 'reps', value: string) => {
    setInputs(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const isCurrentGroupValid = () => {
    return exercises.every(ex => {
      const input = inputs[ex.id];
      if (ex.usesWeight && (!input.weight || Number(input.weight) <= 0)) return false;
      if (!input.reps || Number(input.reps) <= 0) return false;
      return true;
    });
  };

  const handleNext = () => {
    // Save baselines for current group
    exercises.forEach(ex => {
      const input = inputs[ex.id];
      updateBaseline(
        ex.id as ExerciseId,
        Number(input.weight) || 0,
        Number(input.reps) || 0,
      );
    });

    if (currentGroupIdx < groupKeys.length - 1) {
      setCurrentGroupIdx(prev => prev + 1);
    } else {
      // All groups done
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
      <Header title="Başlangıç Ayarları" />
      <PageContainer noBottomNav>
        <div className="mb-6">
          <div className="flex justify-between text-sm text-text-muted mb-2">
            <span>Adım {currentGroupIdx + 1} / {groupKeys.length}</span>
            <span>{GROUP_LABELS[currentGroup]}</span>
          </div>
          <ProgressBar value={progress} />
        </div>

        <p className="text-sm text-text-muted mb-4">
          Her hareket için yapabildiğiniz ağırlık (kg) ve tekrar sayısını girin.
          {currentGroup === 'G4' && ' (Plank için saniye cinsinden girin)'}
        </p>

        <div className="flex flex-col gap-3">
          {exercises.map(ex => (
            <Card key={ex.id}>
              <h3 className="font-semibold text-text mb-3">{ex.name}</h3>
              <div className="flex gap-3">
                {ex.usesWeight && (
                  <div className="flex-1">
                    <label className="text-xs text-text-muted block mb-1">Ağırlık (kg)</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="0"
                      value={inputs[ex.id].weight}
                      onChange={e => updateInput(ex.id, 'weight', e.target.value)}
                      className="w-full h-11 px-3 bg-background border border-surface-light rounded-xl
                        text-text text-center text-lg font-semibold focus:outline-none focus:border-primary-light"
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
                    value={inputs[ex.id].reps}
                    onChange={e => updateInput(ex.id, 'reps', e.target.value)}
                    className="w-full h-11 px-3 bg-background border border-surface-light rounded-xl
                      text-text text-center text-lg font-semibold focus:outline-none focus:border-primary-light"
                  />
                </div>
              </div>
            </Card>
          ))}
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
