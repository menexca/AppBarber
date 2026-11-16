import React, { useEffect, useState } from 'react';
import {
  Camera,
  Sparkles,
  Compass,
  AlertTriangle,
  CheckCircle2,
  RotateCw,
  Upload,
  Wand2,
  Layers,
  ShieldAlert,
} from 'lucide-react';
import { FaceShape, HaircutStyle, HAIRCUT_CATALOG } from '../data/haircuts';
import {
  analyzeFourAnglesWithAI,
  CranialAIDiagnosis,
} from '../lib/geminiService';

export type AngleKey = 'front' | 'left' | 'right' | 'back';

interface MultiAngleStudioProps {
  photos: Partial<Record<AngleKey, string>>;
  onUpdatePhoto: (angle: AngleKey, dataUrl: string) => void;
  detectedFaceShape: FaceShape;
  selectedStyle: HaircutStyle;
  onSelectStyle: (style: HaircutStyle) => void;
  onDiagnosisComplete: (diag: CranialAIDiagnosis) => void;
  diagnosis: CranialAIDiagnosis | null;
}

const ANGLE_META: Array<{
  key: AngleKey;
  title: string;
  degrees: string;
  focus: string;
  guideHint: string;
}> = [
  {
    key: 'front',
    title: '1. Frente',
    degrees: '0° Frontal',
    focus: 'Simetría de sienes, entradas y proporción facial',
    guideHint: 'Alinea los ojos con la línea horizontal y mantén el mentón neutro.',
  },
  {
    key: 'left',
    title: '2. Perfil Izquierdo',
    degrees: '-90° Lateral Izq',
    focus: 'Caída del fade, arco de patilla y sien izquierda',
    guideHint: 'Encuadra desde el arco de la ceja hasta 2 dedos detrás de la oreja.',
  },
  {
    key: 'right',
    title: '3. Perfil Derecho',
    degrees: '+90° Lateral Der',
    focus: 'Espejo de simetría lateral y cresta parietal derecha',
    guideHint: 'Usa la misma distancia y altura que en el perfil izquierdo.',
  },
  {
    key: 'back',
    title: '4. Nuca y Coronilla',
    degrees: '180° Posterior / 45° Superior',
    focus: 'Hueso occipital y dirección del remolino en coronilla',
    guideHint: 'Inclina el teléfono 15° hacia abajo para ver tanto nuca como coronilla.',
  },
];

export const MultiAngleStudio: React.FC<MultiAngleStudioProps> = ({
  photos,
  onUpdatePhoto,
  detectedFaceShape,
  selectedStyle,
  onSelectStyle,
  onDiagnosisComplete,
  diagnosis,
}) => {
  const [activeAngle, setActiveAngle] = useState<AngleKey>('left');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [tiltBeta, setTiltBeta] = useState<number>(85);
  const [tiltGamma, setTiltGamma] = useState<number>(0);
  const [showDiagramOverlay, setShowDiagramOverlay] = useState(true);
  const [previewBeard, setPreviewBeard] = useState<'none' | 'stubble' | 'boxed'>('stubble');

  // Listen to mobile gyroscope if available
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (typeof e.beta === 'number') setTiltBeta(Math.round(e.beta));
      if (typeof e.gamma === 'number') setTiltGamma(Math.round(e.gamma));
    };
    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, []);

  const isPhoneLevel = Math.abs(tiltGamma) <= 8 && tiltBeta >= 65 && tiltBeta <= 105;

  const handleFileUpload = (angle: AngleKey, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUpdatePhoto(angle, reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLoadDemoSet = () => {
    (['front', 'left', 'right', 'back'] as AngleKey[]).forEach((angle) => {
      const svgDataUrl = generateAngleBlueprintDataUrl(angle, detectedFaceShape, selectedStyle);
      onUpdatePhoto(angle, svgDataUrl);
    });
  };

  const handleRunAIDiagnosis = async () => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeFourAnglesWithAI(photos, detectedFaceShape);
      onDiagnosisComplete(result);
      const found = HAIRCUT_CATALOG.find((h) => h.id === result.recommendedStyleId);
      if (found) onSelectStyle(found);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const capturedCount = Object.values(photos).filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Header Banner + Gyroscope Level + Demo Generator */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <Compass className="w-4 h-4" />
            Modelado Multiángulo (4 Vistas) + Detector de Remolinos y Cráneo
          </div>
          <h2 className="text-lg font-extrabold text-white mt-0.5">
            Estudio Técnico de 4 Tomas y Diagrama Craneal
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Captura o carga las 4 vistas del cliente (Frente, Perfiles y Nuca/Coronilla) para que la IA analice el hueso occipital, remolinos y proyecte el diagrama completo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Gyroscope / Level Indicator */}
          <div
            className={`px-3 py-2 rounded-2xl border text-xs flex items-center gap-2 ${
              isPhoneLevel
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
            }`}
          >
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                isPhoneLevel ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <div>
              <div className="font-bold">
                {isPhoneLevel ? 'Teléfono Nivelado' : 'Ajusta Inclinación'}
              </div>
              <div className="text-[10px] opacity-80">
                Inclinación: {tiltBeta}° • Lateral: {tiltGamma}°
              </div>
            </div>
          </div>

          <button
            onClick={handleLoadDemoSet}
            className="px-3.5 py-2.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
            Generar 4 Tomas de Prueba
          </button>

          <button
            onClick={handleRunAIDiagnosis}
            disabled={isAnalyzing}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 text-xs font-extrabold flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            {isAnalyzing
              ? 'Analizando Cráneo y Remolinos...'
              : `Diagnosticar con IA (${capturedCount}/4 tomas)`}
          </button>
        </div>
      </div>

      {/* 4-Angle Grid Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {ANGLE_META.map((item) => {
          const img = photos[item.key];
          const isSelected = activeAngle === item.key;
          return (
            <div
              key={item.key}
              onClick={() => setActiveAngle(item.key)}
              className={`rounded-3xl border p-3.5 transition flex flex-col justify-between cursor-pointer ${
                isSelected
                  ? 'bg-zinc-900 border-amber-500 shadow-lg shadow-amber-500/10'
                  : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-white">{item.title}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-cyan-300">
                    {item.degrees}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">{item.focus}</p>

                {/* Preview Box with SVG Technical Silhouette & Diagram Overlay */}
                <div className="mt-3 relative rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800 aspect-[4/3] flex items-center justify-center">
                  {img ? (
                    <img
                      src={img}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <TechnicalAngleDiagramSVG
                      angle={item.key}
                      style={selectedStyle}
                      showZones={showDiagramOverlay}
                    />
                  )}
                  {img && showDiagramOverlay && (
                    <div className="absolute inset-0 pointer-events-none">
                      <TechnicalAngleDiagramSVG
                        angle={item.key}
                        style={selectedStyle}
                        showZones={true}
                        overlayOnly={true}
                      />
                    </div>
                  )}
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-zinc-950/80 text-[10px] text-zinc-300 border border-zinc-800">
                    {img ? 'Toma Capturada' : 'Diagrama Guía'}
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                <label className="flex-1 py-1.5 px-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition">
                  <Upload className="w-3.5 h-3.5 text-amber-400" />
                  Subir / Cámara
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => handleFileUpload(item.key, e)}
                    className="hidden"
                  />
                </label>
                {img && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detailed Interactive Blueprint + AI Morphology Report + Client Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left 7 Cols: AI Cranial & Cowlick (Remolino) Diagnosis Report */}
        <div className="lg:col-span-7 bg-zinc-900/90 border border-zinc-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                Diagnóstico Morfológico Craneal y Capilar
              </span>
              <h3 className="text-base font-extrabold text-white">
                Análisis de Hueso Occipital, Remolinos y Receta Personalizada
              </h3>
            </div>
            <button
              onClick={() => setShowDiagramOverlay((v) => !v)}
              className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 flex items-center gap-1.5 cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              {showDiagramOverlay ? 'Ocultar Líneas en Vistas' : 'Mostrar Líneas en Vistas'}
            </button>
          </div>

          {!diagnosis ? (
            <div className="p-6 rounded-2xl bg-zinc-950/80 border border-zinc-800 text-center space-y-3">
              <Wand2 className="w-8 h-8 text-amber-400 mx-auto" />
              <div className="text-sm font-bold text-zinc-200">
                Pulsa en &ldquo;Diagnosticar con IA&rdquo; para generar el estudio morfológico
              </div>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                El sistema evaluará la caída del hueso occipital en la nuca, la dirección del remolino en la coronilla y ajustará los peines guía para que tu hermano no corte de más en zonas críticas.
              </p>
              <button
                onClick={handleRunAIDiagnosis}
                className="px-4 py-2 rounded-xl bg-amber-500 text-zinc-950 font-bold text-xs cursor-pointer"
              >
                Ejecutar Diagnóstico Ahora
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Occipital Bone Box */}
                <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase text-amber-400">
                      Hueso Occipital (Nuca)
                    </span>
                    <span className="text-xs font-extrabold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300">
                      {diagnosis.occipitalBone.type}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    {diagnosis.occipitalBone.dropRecommendation}
                  </p>
                  <div className="text-[11px] text-rose-300 flex items-start gap-1.5 pt-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                    <span>{diagnosis.occipitalBone.dangerZoneNote}</span>
                  </div>
                </div>

                {/* Crown Swirl / Cowlick Detector Box */}
                <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase text-cyan-400">
                      Detector de Remolino (Coronilla)
                    </span>
                    <span className="text-xs font-extrabold px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300">
                      Mínimo {diagnosis.crownSwirl.minSafeGuard}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-zinc-200">
                    Giro detectado: {diagnosis.crownSwirl.direction}
                  </div>
                  <div className="text-[11px] text-amber-200 flex items-start gap-1.5 pt-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>{diagnosis.crownSwirl.warning}</span>
                  </div>
                </div>
              </div>

              {/* Hair Density & Custom Adjustments */}
              <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300">
                    <strong>Rostro:</strong> {diagnosis.faceShapeConfirmed}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300">
                    <strong>Densidad:</strong> {diagnosis.hairCharacteristics.density}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300">
                    <strong>Textura:</strong> {diagnosis.hairCharacteristics.texture}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300">
                    <strong>Cerquillo:</strong> {diagnosis.hairCharacteristics.frontHairline}
                  </span>
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="text-xs font-bold text-emerald-400">
                    Ajustes Técnicos para este Cráneo:
                  </div>
                  {diagnosis.customRecipeAdjustments.map((adj, i) => (
                    <div key={i} className="text-xs text-zinc-300 flex items-start gap-2">
                      <span className="text-amber-400 font-bold">•</span>
                      <span>{adj}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right 5 Cols: Client Visual Simulator (Haircut + Beard Preview) */}
        <div className="lg:col-span-5 bg-zinc-900/90 border border-zinc-800 rounded-3xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Simulador Visual para el Cliente
            </span>
            <h3 className="text-base font-extrabold text-white">
              Vista Previa de Estilo + Diseño de Barba
            </h3>
            <p className="text-xs text-zinc-400">
              Muéstrale al cliente cómo enmarcará su rostro ({detectedFaceShape}) el corte{' '}
              <strong className="text-zinc-200">{selectedStyle.name}</strong> antes de pasar la máquina.
            </p>
          </div>

          {/* Interactive SVG Client Preview Simulator */}
          <div className="rounded-2xl bg-zinc-950 border border-zinc-800 p-4 flex flex-col items-center">
            <ClientStyleSimulatorSVG
              faceShape={detectedFaceShape}
              style={selectedStyle}
              beardMode={previewBeard}
            />

            <div className="w-full mt-3 pt-3 border-t border-zinc-800 flex items-center justify-between gap-2">
              <span className="text-xs text-zinc-400 font-medium">Simular Barba:</span>
              <div className="flex items-center gap-1.5">
                {(
                  [
                    { id: 'none', label: 'Sin Barba' },
                    { id: 'stubble', label: 'Sombreada (3mm)' },
                    { id: 'boxed', label: 'Perfilada Angular' },
                  ] as const
                ).map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setPreviewBeard(b.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                      previewBeard === b.id
                        ? 'bg-amber-500 text-zinc-950'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300">
            <strong className="text-amber-400">Recomendación de Barba:</strong>{' '}
            {selectedStyle.beardRecommendation}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Renders the technical barbering diagram for each of the 4 cranial angles
 * (Front, Left Profile, Right Profile, Back/Crown with occipital bone & cowlick).
 */
const TechnicalAngleDiagramSVG: React.FC<{
  angle: AngleKey;
  style: HaircutStyle;
  showZones: boolean;
  overlayOnly?: boolean;
}> = ({ angle, style, showZones, overlayOnly = false }) => {
  const dropOffset = style.dropAmount * 45;
  return (
    <svg viewBox="0 0 260 195" className="w-full h-full">
      {!overlayOnly && <rect width="260" height="195" fill="#09090b" />}

      {/* Grid lines */}
      {!overlayOnly && (
        <g stroke="#27272a" strokeWidth="0.7">
          <line x1="130" y1="10" x2="130" y2="185" strokeDasharray="3 3" />
          <line x1="20" y1="95" x2="240" y2="95" strokeDasharray="3 3" />
        </g>
      )}

      {/* Angle-specific Cranial Silhouette */}
      {angle === 'front' && (
        <g>
          {!overlayOnly && (
            <path
              d="M82 75 C82 35, 178 35, 178 75 C178 122, 156 158, 130 164 C104 158, 82 122, 82 75 Z"
              fill="#27272a"
              stroke="#52525b"
              strokeWidth="2"
            />
          )}
          {showZones && (
            <>
              {/* Horseshoe parietal lines */}
              <path
                d="M78 68 Q130 56 182 68"
                stroke="#22c55e"
                strokeWidth="2.5"
                strokeDasharray="5 3"
                fill="none"
              />
              <path
                d="M78 84 Q130 74 182 84"
                stroke="#eab308"
                strokeWidth="2.5"
                strokeDasharray="5 3"
                fill="none"
              />
              <path
                d="M80 100 Q130 92 180 100"
                stroke="#ef4444"
                strokeWidth="2.5"
                fill="none"
              />
            </>
          )}
        </g>
      )}

      {(angle === 'left' || angle === 'right') && (
        <g transform={angle === 'right' ? 'translate(260, 0) scale(-1, 1)' : undefined}>
          {!overlayOnly && (
            <>
              {/* Profile head & occipital curve */}
              <path
                d="M78 158 L78 135 L66 115 L76 96 C74 44, 155 32, 182 72 C196 95, 188 124, 172 138 L168 168 Z"
                fill="#27272a"
                stroke="#52525b"
                strokeWidth="2"
              />
              {/* Ear */}
              <ellipse cx="128" cy="112" rx="10" ry="18" fill="#3f3f46" stroke="#71717a" />
              {/* Occipital bone marker */}
              <circle cx="184" cy="108" r="4" fill="#06b6d4" />
              <text x="140" y="152" fill="#06b6d4" fontSize="8" fontWeight="bold">
                Hueso Occipital
              </text>
            </>
          )}
          {showZones && (
            <>
              {/* Zone #2 Horseshoe */}
              <path
                d={`M82 66 Q135 64 184 ${78 + dropOffset * 0.3}`}
                stroke="#22c55e"
                strokeWidth="2.5"
                strokeDasharray="5 3"
                fill="none"
              />
              {/* Zone #1 Mid */}
              <path
                d={`M80 80 Q135 80 186 ${94 + dropOffset * 0.55}`}
                stroke="#eab308"
                strokeWidth="2.5"
                strokeDasharray="5 3"
                fill="none"
              />
              {/* Zone #0.5 Transition */}
              <path
                d={`M78 92 Q135 95 184 ${108 + dropOffset * 0.7}`}
                stroke="#f97316"
                strokeWidth="2.5"
                fill="none"
              />
              {/* Zone #0 Base Drop Guide */}
              <path
                d={`M78 104 Q134 108 178 ${122 + dropOffset * 0.8}`}
                stroke="#ef4444"
                strokeWidth="3"
                fill="none"
              />
            </>
          )}
        </g>
      )}

      {angle === 'back' && (
        <g>
          {!overlayOnly && (
            <>
              <path
                d="M82 82 C82 36, 178 36, 178 82 C178 118, 166 145, 162 168 L98 168 C94 145, 82 118, 82 82 Z"
                fill="#27272a"
                stroke="#52525b"
                strokeWidth="2"
              />
              {/* Crown Swirl (Remolino) spiral indicator */}
              <path
                d="M130 58 C136 58, 138 64, 132 67 C124 70, 120 60, 128 53 C139 46, 148 60, 138 72"
                stroke="#06b6d4"
                strokeWidth="2"
                fill="none"
              />
              <text x="95" y="44" fill="#06b6d4" fontSize="8" fontWeight="bold">
                Remolino (#2 Mín)
              </text>
            </>
          )}
          {showZones && (
            <>
              <path
                d="M82 78 Q130 88 178 78"
                stroke="#22c55e"
                strokeWidth="2.5"
                strokeDasharray="5 3"
                fill="none"
              />
              <path
                d="M84 96 Q130 108 176 96"
                stroke="#eab308"
                strokeWidth="2.5"
                strokeDasharray="5 3"
                fill="none"
              />
              <path
                d="M88 114 Q130 128 172 114"
                stroke="#f97316"
                strokeWidth="2.5"
                fill="none"
              />
              <path
                d="M92 132 Q130 146 168 132"
                stroke="#ef4444"
                strokeWidth="3"
                fill="none"
              />
            </>
          )}
        </g>
      )}
    </svg>
  );
};

/**
 * Interactive Client Visual Simulator showing how the selected haircut + beard frame the face.
 */
const ClientStyleSimulatorSVG: React.FC<{
  faceShape: FaceShape;
  style: HaircutStyle;
  beardMode: 'none' | 'stubble' | 'boxed';
}> = ({ faceShape, style, beardMode }) => {
  const isWide = faceShape === 'Redondo' || faceShape === 'Cuadrado';
  const isLong = faceShape === 'Alargado';
  const rx = isWide ? 48 : isLong ? 39 : 43;
  const ry = isLong ? 60 : isWide ? 50 : 54;

  return (
    <svg viewBox="0 0 220 210" className="w-48 h-48">
      <defs>
        <linearGradient id="fadeGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#18181b" />
          <stop offset="55%" stopColor="#3f3f46" />
          <stop offset="100%" stopColor="#a1a1aa" stopOpacity="0.2" />
        </linearGradient>
      </defs>

      {/* Neck */}
      <rect x="88" y="148" width="44" height="42" rx="10" fill="#71717a" />

      {/* Ears */}
      <ellipse cx={110 - rx - 4} cy="108" rx="7" ry="14" fill="#a1a1aa" />
      <ellipse cx={110 + rx + 4} cy="108" rx="7" ry="14" fill="#a1a1aa" />

      {/* Face contour */}
      <ellipse cx="110" cy="104" rx={rx} ry={ry} fill="#d4d4d8" />

      {/* Simulated Fade on Sides */}
      <path
        d={`M${110 - rx} 98 C${110 - rx - 3} 65, ${110 + rx + 3} 65, ${110 + rx} 98 L${
          110 + rx - 4
        } 70 L${110 - rx + 4} 70 Z`}
        fill="url(#fadeGrad)"
      />

      {/* Top Hair Volume according to selected style */}
      {style.id === 'high-skin-fade-quiff' ? (
        <path
          d={`M${110 - rx + 6} 72 C85 32, 145 26, ${110 + rx - 6} 72 Q110 58 ${110 - rx + 6} 72 Z`}
          fill="#18181b"
        />
      ) : style.id === 'mid-drop-fade-crop' ? (
        <path
          d={`M${110 - rx + 2} 74 C78 42, 142 42, ${110 + rx - 2} 74 L${110 + rx - 6} 78 Q110 72 ${
            110 - rx + 6
          } 78 Z`}
          fill="#18181b"
        />
      ) : (
        <path
          d={`M${110 - rx - 1} 82 C74 38, 146 38, ${110 + rx + 1} 82 Q110 64 ${
            110 - rx - 1
          } 82 Z`}
          fill="#18181b"
        />
      )}

      {/* Eyes & Eyebrows */}
      <path d="M84 92 Q93 88 101 92" stroke="#27272a" strokeWidth="2.5" fill="none" />
      <path d="M119 92 Q127 88 136 92" stroke="#27272a" strokeWidth="2.5" fill="none" />
      <circle cx="93" cy="99" r="3" fill="#27272a" />
      <circle cx="127" cy="99" r="3" fill="#27272a" />

      {/* Beard simulation */}
      {beardMode !== 'none' && (
        <path
          d={`M${110 - rx + 2} 112 Q110 142 ${110 + rx - 2} 112 C${110 + rx - 4} 145, 128 160, 110 160 C92 160, ${
            110 - rx + 4
          } 145, ${110 - rx + 2} 112 Z`}
          fill="#27272a"
          fillOpacity={beardMode === 'stubble' ? 0.45 : 0.85}
        />
      )}

      {/* Mustache / Mouth */}
      <path d="M98 132 Q110 136 122 132" stroke="#3f3f46" strokeWidth="2" fill="none" />

      {/* AR Guide indicator badge */}
      <rect x="45" y="176" width="130" height="22" rx="6" fill="#18181b" stroke="#f59e0b" />
      <text x="110" y="190" textAnchor="middle" fill="#fbbf24" fontSize="9" fontWeight="bold">
        {style.name.split('+')[0].trim()}
      </text>
    </svg>
  );
};

function generateAngleBlueprintDataUrl(
  angle: AngleKey,
  faceShape: FaceShape,
  style: HaircutStyle
): string {
  const titles: Record<AngleKey, string> = {
    front: 'FRENTE 0°',
    left: 'PERFIL IZQ -90°',
    right: 'PERFIL DER +90°',
    back: 'NUCA Y CORONILLA 180°',
  };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
    <rect width="400" height="300" fill="#18181b"/>
    <circle cx="200" cy="145" r="78" fill="#3f3f46" stroke="#f59e0b" stroke-width="3"/>
    <text x="200" y="34" text-anchor="middle" fill="#f59e0b" font-family="sans-serif" font-size="14" font-weight="bold">${titles[angle]} — ${faceShape}</text>
    <text x="200" y="275" text-anchor="middle" fill="#a1a1aa" font-family="sans-serif" font-size="12">${style.name}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

