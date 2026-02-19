import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useUserStore } from '../stores/userStore';
import { useProgramStore } from '../stores/programStore';
import { EXERCISE_GROUPS, GROUP_LABELS, GROUP_COLORS, EXERCISES } from '../constants/exercises';
import { getExcelMapping } from '../constants/exerciseMapping';
import { insertBaslangic } from '../lib/n8nService';
import type { BaslangicInput } from '../lib/n8nService';
import { getUserProgram } from '../lib/programService';
import { supabase } from '../lib/supabase';
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
  const [bodyWeight, setBodyWeight] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

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

  const inputKey = (group: ExerciseGroup, exId: ExerciseId) => `${group}-${exId}`;

  const updateInput = (exId: ExerciseId, field: 'weight' | 'reps', value: string) => {
    const key = inputKey(currentGroup, exId);
    setInputs(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  const isCurrentGroupValid = () => {
    // Body weight required on first step
    if (currentGroupIdx === 0 && (!bodyWeight || Number(bodyWeight) <= 0)) return false;

    return exerciseIds.every(exId => {
      const ex = EXERCISES[exId];
      const input = inputs[inputKey(currentGroup, exId)];
      if (ex.usesWeight && (!input.weight || Number(input.weight) <= 0)) return false;
      if (!input.reps || Number(input.reps) <= 0) return false;
      return true;
    });
  };

  const sendToN8n = async () => {
    // Get google_file_id from Supabase
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return;

    const program = await getUserProgram(userId);
    if (!program?.google_file_id) {
      console.warn('google_file_id bulunamadı, insertBaslangic atlanamıyor.');
      return;
    }

    // Build inputs array from all groups
    const baslangicInputs: BaslangicInput[] = [];

    for (const group of groupKeys) {
      for (const exId of EXERCISE_GROUPS[group]) {
        const mapping = getExcelMapping(group, exId);
        if (!mapping) continue;

        const input = inputs[inputKey(group, exId)];
        baslangicInputs.push({
          search_key: mapping.search_key,
          girilen_agirlik: Number(input.weight) || 0,
          girilen_tekrar: Number(input.reps) || 0,
          excel_satir_no: mapping.excel_satir_no,
        });
      }
    }

    await insertBaslangic(
      program.google_file_id,
      Number(bodyWeight),
      baslangicInputs,
    );
  };

  const handleNext = async () => {
    // Save baselines for current group
    exerciseIds.forEach(exId => {
      const input = inputs[inputKey(currentGroup, exId)];
      updateBaseline(
        exId,
        Number(input.weight) || 0,
        Number(input.reps) || 0,
      );
    });

    if (currentGroupIdx < groupKeys.length - 1) {
      setCurrentGroupIdx(prev => prev + 1);
    } else {
      // All groups done — send to n8n, then complete
      setSubmitting(true);
      try {
        setStatusMsg('Veriler Excel\'e gönderiliyor...');
        await sendToN8n();
      } catch (err) {
        console.error('insertBaslangic hatası:', err);
      }

      setStatusMsg('');
      setSubmitting(false);
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

        {/* Body weight input — shown on first step */}
        {currentGroupIdx === 0 && (
          <div className="bg-surface rounded-2xl border border-primary/30 p-4 mb-3">
            <h3 className="font-semibold text-text mb-2">Vücut Ağırlığınız</h3>
            <div className="flex-1">
              <label className="text-xs text-text-muted block mb-1">Kilo (kg)</label>
              <input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={bodyWeight}
                onChange={e => setBodyWeight(e.target.value)}
                className="w-full h-11 px-3 bg-background border border-primary/30 rounded-xl
                  text-text text-center text-lg font-semibold focus:outline-none focus:border-primary-light"
              />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {exerciseIds.map(exId => {
            const ex = EXERCISES[exId];
            const input = inputs[inputKey(currentGroup, exId)];
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

        {statusMsg && (
          <p className="text-sm text-primary-light text-center animate-pulse mt-4">{statusMsg}</p>
        )}

        <div className="flex gap-3 mt-6 mb-4">
          {currentGroupIdx > 0 && (
            <Button variant="secondary" onClick={handleBack} className="flex-1">
              Geri
            </Button>
          )}
          <Button
            onClick={handleNext}
            disabled={!isCurrentGroupValid() || submitting}
            className="flex-1"
          >
            {submitting ? 'Gönderiliyor...' : isLastGroup ? 'Programa Başla' : 'Devam'}
          </Button>
        </div>
      </PageContainer>
    </>
  );
}
