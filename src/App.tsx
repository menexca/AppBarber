import React, { useState, useCallback } from 'react';
import {
  Camera,
  Compass,
  ClipboardCheck,
  Mic,
  MicOff,
  KeyRound,
  Scissors,
  Sparkles,
  X,
  Check,
} from 'lucide-react';
import { HAIRCUT_CATALOG, HaircutStyle } from './data/haircuts';
import {
  analyzeFaceLandmarks,
  createSyntheticLandmarks,
  VisagismMetrics,
} from './lib/visagism';
import {
  CranialAIDiagnosis,
  getSavedGeminiKey,
  saveGeminiKey,
} from './lib/geminiService';
import { useVoiceControl } from './hooks/useVoiceControl';
import { ARScannerView } from './components/ARScannerView';
import { AngleKey, MultiAngleStudio } from './components/MultiAngleStudio';
import { EvaluationAndClients } from './components/EvaluationAndClients';

type ActiveTab = 'ar-scanner' | 'multi-angle' | 'evaluation';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('ar-scanner');
  const [selectedStyle, setSelectedStyle] = useState<HaircutStyle>(HAIRCUT_CATALOG[0]);
  const [activeStepIdx, setActiveStepIdx] = useState<number>(0);
  const [showARZones, setShowARZones] = useState<boolean>(true);
  const [showMesh, setShowMesh] = useState<boolean>(true);

  const [metrics, setMetrics] = useState<VisagismMetrics>(() =>
    analyzeFaceLandmarks(createSyntheticLandmarks('Ovalado', 0))
  );
  const [photos, setPhotos] = useState<Partial<Record<AngleKey, string>>>({});
  const [diagnosis, setDiagnosis] = useState<CranialAIDiagnosis | null>(null);

  const [showKeyModal, setShowKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(() => getSavedGeminiKey());
  const [keySavedToast, setKeySavedToast] = useState(false);

  const currentStep =
    selectedStyle.steps[Math.min(activeStepIdx, selectedStyle.steps.length - 1)] ||
    selectedStyle.steps[0];

  const handleNextStep = useCallback(() => {
    setActiveStepIdx((prev) => {
      const next = Math.min(selectedStyle.steps.length - 1, prev + 1);
      return next;
    });
  }, [selectedStyle.steps.length]);

  const handlePrevStep = useCallback(() => {
    setActiveStepIdx((prev) => Math.max(0, prev - 1));
  }, []);

  const handleToggleARZones = useCallback(() => {
    setShowARZones((v) => !v);
  }, []);

  const handleToggleMesh = useCallback(() => {
    setShowMesh((v) => !v);
  }, []);

  const { isListening, lastCommand, supported, toggleListening, speak } = useVoiceControl({
    onNextStep: () => {
      handleNextStep();
      const nextIdx = Math.min(selectedStyle.steps.length - 1, activeStepIdx + 1);
      const step = selectedStyle.steps[nextIdx];
      if (step) {
        speak(`Paso ${step.stepNumber}: ${step.title}. Usa ${step.guard}, palanca ${step.lever}.`);
      }
    },
    onPrevStep: () => {
      handlePrevStep();
      const prevIdx = Math.max(0, activeStepIdx - 1);
      const step = selectedStyle.steps[prevIdx];
      if (step) {
        speak(`Paso ${step.stepNumber}: ${step.title}. Usa ${step.guard}, palanca ${step.lever}.`);
      }
    },
    onToggleARZones: handleToggleARZones,
    onToggleMesh: handleToggleMesh,
    onExplainCurrentStep: () => {
      speak(
        `Paso ${currentStep.stepNumber}: ${currentStep.title}. Coloca ${currentStep.guard} con la palanca ${currentStep.lever}. ${currentStep.instruction}`
      );
    },
  });

  const handleCaptureAnglePhoto = useCallback((angle: AngleKey, dataUrl: string) => {
    setPhotos((prev) => ({ ...prev, [angle]: dataUrl }));
  }, []);

  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    saveGeminiKey(apiKeyInput);
    setKeySavedToast(true);
    setTimeout(() => {
      setKeySavedToast(false);
      setShowKeyModal(false);
    }, 900);
  };

  const capturedAnglesCount = Object.values(photos).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-24 md:pb-10">
      {/* Top App Header */}
      <header className="sticky top-0 z-30 bg-zinc-950/85 backdrop-blur-xl border-b border-zinc-800/80">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-zinc-950 shadow-lg shadow-amber-500/20">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-white">
                  AppBarber <span className="text-amber-400">AI</span>
                </h1>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  AR + Visagismo 3D
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 hidden sm:block">
                Copiloto de Barbería con Malla Facial en Tiempo Real, Mapa de Peines y Diagnóstico Craneal
              </p>
            </div>
          </div>

          {/* Right Action Controls: Hands-Free Voice & Gemini API Key */}
          <div className="flex items-center gap-2">
            {supported && (
              <button
                onClick={toggleListening}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer ${
                  isListening
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 animate-pulse'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                }`}
                title='Comandos: "siguiente paso", "anterior", "explicar", "ocultar líneas"'
              >
                {isListening ? (
                  <Mic className="w-4 h-4 text-emerald-400" />
                ) : (
                  <MicOff className="w-4 h-4 text-zinc-400" />
                )}
                <span className="hidden sm:inline">
                  {isListening ? 'Voz Manos Libres ON' : 'Activar Voz'}
                </span>
              </button>
            )}

            <button
              onClick={() => setShowKeyModal(true)}
              className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-200 flex items-center gap-1.5 transition cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">
                {getSavedGeminiKey() ? 'Gemini API Activa' : 'Conectar Gemini IA'}
              </span>
            </button>
          </div>
        </div>

        {/* Voice Command Live Feedback Banner */}
        {isListening && (
          <div className="bg-emerald-950/60 border-t border-emerald-500/30 px-4 py-1.5 text-center text-xs text-emerald-200 flex items-center justify-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              <strong>Manos libres activo:</strong> Di{' '}
              <code className="text-emerald-300">&quot;siguiente paso&quot;</code>,{' '}
              <code className="text-emerald-300">&quot;anterior&quot;</code>,{' '}
              <code className="text-emerald-300">&quot;explicar&quot;</code> o{' '}
              <code className="text-emerald-300">&quot;ocultar líneas&quot;</code>
              {lastCommand && ` • Último comando: "${lastCommand}"`}
            </span>
          </div>
        )}
      </header>

      {/* Desktop / Tablet Top Navigation Pills */}
      <div className="max-w-7xl mx-auto px-4 pt-4">
        <div className="hidden md:grid grid-cols-3 gap-2.5 bg-zinc-900/80 p-1.5 rounded-2xl border border-zinc-800 mb-5">
          <button
            onClick={() => setActiveTab('ar-scanner')}
            className={`py-2.5 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'ar-scanner'
                ? 'bg-amber-500 text-zinc-950 shadow-md'
                : 'text-zinc-300 hover:bg-zinc-800/70'
            }`}
          >
            <Camera className="w-4 h-4" />
            1. Cámara AR en Vivo + Visagismo 3D
          </button>

          <button
            onClick={() => setActiveTab('multi-angle')}
            className={`py-2.5 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'multi-angle'
                ? 'bg-amber-500 text-zinc-950 shadow-md'
                : 'text-zinc-300 hover:bg-zinc-800/70'
            }`}
          >
            <Compass className="w-4 h-4" />
            2. Modelado 4 Ángulos + Remolinos IA ({capturedAnglesCount}/4)
          </button>

          <button
            onClick={() => setActiveTab('evaluation')}
            className={`py-2.5 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'evaluation'
                ? 'bg-amber-500 text-zinc-950 shadow-md'
                : 'text-zinc-300 hover:bg-zinc-800/70'
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            3. Autoevaluación de Corte y Fichas
          </button>
        </div>

        {/* Active Module View */}
        {activeTab === 'ar-scanner' && (
          <ARScannerView
            selectedStyle={selectedStyle}
            onSelectStyle={setSelectedStyle}
            activeStepIdx={activeStepIdx}
            setActiveStepIdx={setActiveStepIdx}
            showARZones={showARZones}
            setShowARZones={setShowARZones}
            showMesh={showMesh}
            setShowMesh={setShowMesh}
            onMetricsUpdate={setMetrics}
            onCaptureAnglePhoto={handleCaptureAnglePhoto}
            onSpeakText={speak}
          />
        )}

        {activeTab === 'multi-angle' && (
          <MultiAngleStudio
            photos={photos}
            onUpdatePhoto={handleCaptureAnglePhoto}
            detectedFaceShape={metrics.faceShape}
            selectedStyle={selectedStyle}
            onSelectStyle={setSelectedStyle}
            onDiagnosisComplete={setDiagnosis}
            diagnosis={diagnosis}
          />
        )}

        {activeTab === 'evaluation' && (
          <EvaluationAndClients
            detectedFaceShape={metrics.faceShape}
            selectedStyle={selectedStyle}
            diagnosis={diagnosis}
          />
        )}
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800 px-3 py-2 grid grid-cols-3 gap-2">
        <button
          onClick={() => setActiveTab('ar-scanner')}
          className={`py-2 rounded-xl flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition ${
            activeTab === 'ar-scanner'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              : 'text-zinc-400'
          }`}
        >
          <Camera className="w-4 h-4" />
          <span>Escáner AR</span>
        </button>

        <button
          onClick={() => setActiveTab('multi-angle')}
          className={`py-2 rounded-xl flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition ${
            activeTab === 'multi-angle'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              : 'text-zinc-400'
          }`}
        >
          <Compass className="w-4 h-4" />
          <span>4 Vistas ({capturedAnglesCount}/4)</span>
        </button>

        <button
          onClick={() => setActiveTab('evaluation')}
          className={`py-2 rounded-xl flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition ${
            activeTab === 'evaluation'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              : 'text-zinc-400'
          }`}
        >
          <ClipboardCheck className="w-4 h-4" />
          <span>Evaluar y Fichas</span>
        </button>
      </nav>

      {/* Gemini API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-extrabold text-white">
                  Configurar Gemini API (Opcional)
                </h3>
              </div>
              <button
                onClick={() => setShowKeyModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              El escáner facial 3D (MediaPipe), el cálculo de visagismo, los diagramas en Realidad Aumentada y los comandos de voz funcionan <strong>100% gratis en tu dispositivo</strong> sin necesidad de clave.
              <br />
              <br />
              Si agregas tu clave de <strong>Google AI Studio (Gemini 2.5 Flash)</strong>, las 4 fotos del cráneo y la foto del corte terminado serán analizadas directamente por Gemini Multimodal.
            </p>

            <form onSubmit={handleSaveApiKey} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">
                  Gemini API Key
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowKeyModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-xs font-semibold text-zinc-300 cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                >
                  {keySavedToast ? <Check className="w-4 h-4" /> : null}
                  {keySavedToast ? '¡Guardada!' : 'Guardar Clave'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

