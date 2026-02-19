import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useUserStore } from '../stores/userStore';
import { useProgramStore } from '../stores/programStore';
import { EXERCISE_GROUPS, GROUP_LABELS, GROUP_COLORS, EXERCISES, SETUP_SKIP_EXERCISES } from '../constants/exercises';
import { getExcelMapping } from '../constants/exerciseMapping';
import { insertBaslangic, getBaslangicDetails } from '../lib/n8nService';
import type { BaslangicInput, BaslangicDetailsResponse } from '../lib/n8nService';
import { EXERCISE_EXCEL_MAPPING } from '../constants/exerciseMapping';
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
  const [verifyError, setVerifyError] = useState<string[] | null>(null);

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
  const allExerciseIds = EXERCISE_GROUPS[currentGroup];
  const exerciseIds = allExerciseIds.filter(id => !SETUP_SKIP_EXERCISES.has(id));
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

  const buildBaslangicInputs = (): BaslangicInput[] => {
    const baslangicInputs: BaslangicInput[] = [];
    for (const group of groupKeys) {
      for (const exId of EXERCISE_GROUPS[group]) {
        if (SETUP_SKIP_EXERCISES.has(exId)) continue;

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
    return baslangicInputs;
  };

  const sendToN8n = async (): Promise<{ googleFileId: string; sentInputs: BaslangicInput[] } | null> => {
    // Get google_file_id from Supabase
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return null;

    const program = await getUserProgram(userId);
    if (!program?.google_file_id) {
      console.warn('google_file_id bulunamadı, insertBaslangic atlanıyor.');
      return null;
    }

    const baslangicInputs = buildBaslangicInputs();

    await insertBaslangic(
      program.google_file_id,
      Number(bodyWeight),
      baslangicInputs,
    );

    return { googleFileId: program.google_file_id, sentInputs: baslangicInputs };
  };

  const verifyBaslangic = (
    sentInputs: BaslangicInput[],
    enteredBodyWeight: number,
    remote: BaslangicDetailsResponse,
  ): string[] => {
    const mismatches: string[] = [];

    // Verify body weight
    if (remote.Kullanici_Bilgileri.Vucut_Agirligi !== enteredBodyWeight) {
      mismatches.push(
        `Vücut Ağırlığı: Girilen ${enteredBodyWeight}kg → Excel'de ${remote.Kullanici_Bilgileri.Vucut_Agirligi}kg`,
      );
    }

    // Build lookup: "G1|Bench Press" → Baslangic_Agirligi
    const remoteMap = new Map<string, number | string>();
    for (const grup of remote.Program_Detayi) {
      for (const ex of grup.Egzersizler) {
        remoteMap.set(`${grup.Grup_Adi}|${ex.Egzersiz_Adi}`, ex.Baslangic_Agirligi);
      }
    }

    // Compare each sent exercise
    for (const sent of sentInputs) {
      const mapping = EXERCISE_EXCEL_MAPPING.find(m => m.search_key === sent.search_key);
      if (!mapping) continue;

      const lookupKey = `${mapping.grup}|${mapping.egzersiz_adi}`;
      const remoteWeight = remoteMap.get(lookupKey);

      if (remoteWeight === undefined) {
        mismatches.push(`${mapping.egzersiz_adi} (${mapping.grup}): Excel'de bulunamadı`);
        continue;
      }

      // Skip bodyweight exercises ("vücut a.")
      if (typeof remoteWeight === 'string') continue;

      if (remoteWeight !== sent.girilen_agirlik) {
        mismatches.push(
          `${mapping.egzersiz_adi} (${mapping.grup}): Girilen ${sent.girilen_agirlik}kg → Excel'de ${remoteWeight}kg`,
        );
      }
    }

    return mismatches;
  };

  const handleNext = async () => {
    // Save baselines for visible exercises in current group
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
      // All groups done — send to n8n, verify, then complete
      setSubmitting(true);
      setVerifyError(null);
      try {
        setStatusMsg('Veriler Excel\'e gönderiliyor...');
        const result = await sendToN8n();

        if (result) {
          setStatusMsg('Veriler doğrulanıyor...');
          const remoteData = await getBaslangicDetails(result.googleFileId);
          const mismatches = verifyBaslangic(result.sentInputs, Number(bodyWeight), remoteData);

          if (mismatches.length > 0) {
            setVerifyError(mismatches);
            setStatusMsg('');
            setSubmitting(false);
            return;
          }
        }
      } catch (err) {
        console.error('insertBaslangic / doğrulama hatası:', err);
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

        {verifyError && (
          <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
            <h3 className="text-red-400 font-semibold mb-2">
              Veriler Excel'e doğru girilemedi!
            </h3>
            <p className="text-sm text-text-muted mb-3">
              Aşağıdaki hareketlerde uyumsuzluk tespit edildi. Lütfen verileri kontrol edip tekrar gönderin.
            </p>
            <ul className="text-xs text-red-300 space-y-1 mb-3">
              {verifyError.map((msg, i) => (
                <li key={i}>• {msg}</li>
              ))}
            </ul>
            <Button
              variant="secondary"
              onClick={() => {
                setVerifyError(null);
                setCurrentGroupIdx(0);
              }}
              className="w-full"
            >
              Başa Dön ve Tekrar Gönder
            </Button>
          </div>
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
