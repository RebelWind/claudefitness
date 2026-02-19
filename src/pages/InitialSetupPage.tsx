import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useUserStore } from '../stores/userStore';
import { useProgramStore } from '../stores/programStore';
import { EXERCISE_GROUPS, GROUP_LABELS, GROUP_COLORS, EXERCISES, SETUP_SKIP_EXERCISES } from '../constants/exercises';
import { getExcelMapping } from '../constants/exerciseMapping';
import { insertBaslangic, getBaslangicDetails } from '../lib/n8nService';
import type { BaslangicInput, BaslangicDetailsResponse, BaslangicDetailInput } from '../lib/n8nService';
import { EXERCISE_EXCEL_MAPPING } from '../constants/exerciseMapping';
import { getUserProgram } from '../lib/programService';
import { saveBaselines } from '../lib/supabaseSync';
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
  const [summaryData, setSummaryData] = useState<BaslangicDetailsResponse | null>(null);

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
    if (remote.kilo !== enteredBodyWeight) {
      mismatches.push(
        `Vücut Ağırlığı: Girilen ${enteredBodyWeight}kg → Excel'de ${remote.kilo}kg`,
      );
    }

    // Build lookup by search_key
    const remoteMap = new Map<string, BaslangicDetailInput>();
    for (const input of remote.inputs) {
      remoteMap.set(input.search_key, input);
    }

    // Compare each sent exercise
    for (const sent of sentInputs) {
      const remoteInput = remoteMap.get(sent.search_key);
      const mapping = EXERCISE_EXCEL_MAPPING.find(m => m.search_key === sent.search_key);
      const label = mapping ? `${mapping.egzersiz_adi} (${mapping.grup})` : sent.search_key;

      if (!remoteInput) {
        mismatches.push(`${label}: Excel'de bulunamadı`);
        continue;
      }

      if (remoteInput.agirlik !== sent.girilen_agirlik) {
        mismatches.push(
          `${label}: Girilen ${sent.girilen_agirlik}kg → Excel'de ${remoteInput.agirlik}kg`,
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
        currentGroup,
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

          // Verification passed — show summary before proceeding
          setSummaryData(remoteData);
          setStatusMsg('');
          setSubmitting(false);
          return;
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

  const handleCompleteSummary = async () => {
    completeSetup();
    initializeProgram(new Date().toISOString());

    // Save baselines to Supabase for fast restore
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (userId) {
        const baselines = useUserStore.getState().baselines;
        await saveBaselines(userId, baselines);
      }
    } catch {
      // Non-critical — baselines still in localStorage + Google Sheets
    }

    navigate('/dashboard', { replace: true });
  };

  // Summary screen after successful verification
  if (summaryData) {
    return (
      <>
        <Header title="Program Özeti" />
        <PageContainer noBottomNav>
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-3xl text-green-400">✓</span>
            </div>
            <h2 className="text-xl font-bold text-text">Veriler Başarıyla Kaydedildi!</h2>
            <p className="text-sm text-text-muted mt-1">
              Vücut Ağırlığı: <span className="font-semibold text-text">{summaryData.kilo} kg</span>
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {summaryData.inputs.map((item) => {
              const mapping = EXERCISE_EXCEL_MAPPING.find(m => m.search_key === item.search_key);
              const label = mapping ? mapping.egzersiz_adi : item.search_key;
              const group = mapping?.grup || '';
              const groupColor = group ? GROUP_COLORS[group as ExerciseGroup] : null;

              return (
                <div
                  key={item.search_key}
                  className={`bg-surface rounded-xl border p-3 ${groupColor?.border || 'border-surface-light'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`font-semibold text-sm ${groupColor?.text || 'text-text'}`}>{label}</span>
                    {group && <Badge group={group as ExerciseGroup}>{group}</Badge>}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div className="text-text-muted">Başlangıç Ağırlığı</div>
                    <div className="text-text font-medium text-right">{item['baslangic agirliklari']} kg</div>
                    <div className="text-text-muted">Tekrar Sayısı</div>
                    <div className="text-text font-medium text-right">{item['tekrar sayisi']}</div>
                    <div className="text-text-muted">1 Tekrar Max</div>
                    <div className="text-text font-medium text-right">{item['1 tekrar max']} kg</div>
                    <div className="text-text-muted">Set x Tekrar</div>
                    <div className="text-text font-medium text-right">{item['set x tekrar sayilari']}</div>
                    <div className="text-text-muted">Haftalık Artış</div>
                    <div className="text-text font-medium text-right">{item['haftalik artis']} kg</div>
                    {item.RPE !== null && (
                      <>
                        <div className="text-text-muted">RPE</div>
                        <div className="text-text font-medium text-right">{item.RPE}</div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <Button onClick={handleCompleteSummary} className="w-full mt-6 mb-4">
            Dashboard'a Git
          </Button>
        </PageContainer>
      </>
    );
  }

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
