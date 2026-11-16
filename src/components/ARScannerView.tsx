import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera,
  RefreshCw,
  Sparkles,
  Volume2,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Sliders,
  CheckCircle2,
  Cpu,
  Compass,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import {
  FaceShape,
  HaircutStyle,
  HAIRCUT_CATALOG,
} from '../data/haircuts';
import {
  analyzeFaceLandmarks,
  createSyntheticLandmarks,
  NormalizedLandmark,
  VisagismMetrics,
} from '../lib/visagism';

interface ARScannerViewProps {
  selectedStyle: HaircutStyle;
  onSelectStyle: (style: HaircutStyle) => void;
  activeStepIdx: number;
  setActiveStepIdx: React.Dispatch<React.SetStateAction<number>>;
  showARZones: boolean;
  setShowARZones: React.Dispatch<React.SetStateAction<boolean>>;
  showMesh: boolean;
  setShowMesh: React.Dispatch<React.SetStateAction<boolean>>;
  onMetricsUpdate: (metrics: VisagismMetrics) => void;
  onCaptureAnglePhoto: (angle: 'front' | 'left' | 'right' | 'back', dataUrl: string) => void;
  onSpeakText: (text: string) => void;
}

const ALL_SHAPES: FaceShape[] = [
  'Ovalado',
  'Cuadrado',
  'Redondo',
  'Diamante',
  'Alargado',
  'Triangular',
];

export const ARScannerView: React.FC<ARScannerViewProps> = ({
  selectedStyle,
  onSelectStyle,
  activeStepIdx,
  setActiveStepIdx,
  showARZones,
  setShowARZones,
  showMesh,
  setShowMesh,
  onMetricsUpdate,
  onCaptureAnglePhoto,
  onSpeakText,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const landmarkerRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('user');
  const [mpStatus, setMpStatus] = useState<'loading' | 'ready' | 'sim'>('loading');
  const [simShape, setSimShape] = useState<FaceShape>('Ovalado');
  const [simYaw, setSimYaw] = useState<number>(0);
  const [metrics, setMetrics] = useState<VisagismMetrics>(() =>
    analyzeFaceLandmarks(createSyntheticLandmarks('Ovalado', 0))
  );
  const [captureFlash, setCaptureFlash] = useState<string | null>(null);

  const currentStep =
    selectedStyle.steps[Math.min(activeStepIdx, selectedStyle.steps.length - 1)] ||
    selectedStyle.steps[0];

  // Initialize MediaPipe FaceLandmarker
  useEffect(() => {
    let cancelled = false;
    async function initMediaPipe() {
      try {
        const vision = await import('@mediapipe/tasks-vision');
        const filesetResolver = await vision.FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
        );
        const faceLandmarker = await vision.FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
        });
        if (!cancelled) {
          landmarkerRef.current = faceLandmarker;
          setMpStatus('ready');
        }
      } catch (err) {
        console.warn('MediaPipe fallback to simulation mode:', err);
        if (!cancelled) {
          setMpStatus('sim');
        }
      }
    }
    initMediaPipe();
    return () => {
      cancelled = true;
    };
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(
    async (mode: 'environment' | 'user' = facingMode) => {
      try {
        setCameraError(null);
        stopCamera();
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraError(
            'El navegador bloqueó la cámara en vivo porque la dirección no usa HTTPS. Abre https://' +
              window.location.host +
              ' y acepta el aviso de seguridad local.'
          );
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraActive(true);
        }
      } catch (err: any) {
        console.warn('Camera permission or device unavailable, running interactive mannequin mode:', err);
        setCameraActive(false);
        setCameraError(
          'No se pudo acceder a la cámara (' +
            (err?.name || 'Permiso denegado') +
            '). Asegúrate de abrir con https:// y permitir el acceso a la cámara en tu navegador.'
        );
      }
    },
    [facingMode, stopCamera]
  );

  const toggleFacingMode = () => {
    const next = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(next);
    if (cameraActive) {
      startCamera(next);
    }
  };

  const toggleFullscreen = async () => {
    const next = !isFullscreen;
    setIsFullscreen(next);
    try {
      if (next && viewportRef.current?.requestFullscreen) {
        await viewportRef.current.requestFullscreen();
      } else if (!next && document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // Fallback CSS fixed full-screen works on iOS Safari and all mobile browsers
    }
  };

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement && isFullscreen) {
        // Keep sync if exited via hardware back button
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, [isFullscreen]);

  // Draw AR Guide & Visagism Overlay on Canvas
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (
      cameraActive &&
      videoRef.current &&
      videoRef.current.readyState >= 2 &&
      videoRef.current.videoWidth > 0 &&
      videoRef.current.videoHeight > 0
    ) {
      if (
        canvas.width !== videoRef.current.videoWidth ||
        canvas.height !== videoRef.current.videoHeight
      ) {
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
      }
    } else if (!cameraActive && (canvas.width !== 720 || canvas.height !== 680)) {
      canvas.width = 720;
      canvas.height = 680;
    }

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    let landmarks: NormalizedLandmark[] | null = null;

    if (cameraActive && videoRef.current && videoRef.current.readyState >= 2) {
      const video = videoRef.current;
      // Mirror front camera for natural barber selfie/mirror view
      ctx.save();
      if (facingMode === 'user') {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, width, height);
      ctx.restore();

      if (landmarkerRef.current) {
        try {
          const result = landmarkerRef.current.detectForVideo(video, performance.now());
          if (result?.faceLandmarks?.length > 0) {
            const raw = result.faceLandmarks[0] as NormalizedLandmark[];
            landmarks =
              facingMode === 'user'
                ? raw.map((pt) => ({ x: 1 - pt.x, y: pt.y, z: pt.z }))
                : raw;
          }
        } catch {
          // ignore frame detection glitch
        }
      }
    }

    // If camera is off or no face detected in frame, render stylized 3D cyber-head silhouette + synthetic landmarks
    if (!landmarks) {
      landmarks = createSyntheticLandmarks(simShape, simYaw);
      if (!cameraActive) {
        drawSyntheticHeadBackground(ctx, width, height, landmarks, simYaw);
      }
    }

    const computed = analyzeFaceLandmarks(landmarks, width / height);
    setMetrics(computed);
    onMetricsUpdate(computed);

    // 1. Draw Visagism Geometric Mesh if enabled
    if (showMesh) {
      drawVisagismMesh(ctx, width, height, landmarks, computed);
    }

    // 2. Draw AR Haircut Diagram & Comb/Guard Color Zones if enabled
    if (showARZones) {
      drawARHaircutOverlay(
        ctx,
        width,
        height,
        landmarks,
        selectedStyle,
        currentStep.zoneId,
        computed.yawDeg
      );
    }

    animFrameRef.current = requestAnimationFrame(renderFrame);
  }, [
    cameraActive,
    facingMode,
    simShape,
    simYaw,
    showMesh,
    showARZones,
    selectedStyle,
    currentStep.zoneId,
    onMetricsUpdate,
  ]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(renderFrame);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [renderFrame]);

  const handleQuickCapture = (angle: 'front' | 'left' | 'right' | 'back') => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.85);
    onCaptureAnglePhoto(angle, dataUrl);
    setCaptureFlash(angle);
    setTimeout(() => setCaptureFlash(null), 900);
  };

  return (
    <div className="space-y-4">
      {/* Top Status & Camera Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              cameraActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`}
          />
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              {cameraActive
                ? 'Cámara AR en Vivo (MediaPipe 478 pts)'
                : 'Modo Simulador 3D Interactivo'}
            </div>
            <div className="text-sm font-bold text-zinc-100">
              Rostro detectado:{' '}
              <span className="text-amber-400">{metrics.faceShape}</span>{' '}
              <span className="text-xs font-normal text-zinc-400">
                ({metrics.confidence}% conf. • Giro {metrics.yawDeg > 0 ? `+${metrics.yawDeg}°` : `${metrics.yawDeg}°`})
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!cameraActive ? (
            <button
              onClick={() => startCamera(facingMode)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              Abrir Cámara
            </button>
          ) : (
            <>
              <button
                onClick={toggleFacingMode}
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition cursor-pointer"
                title="Cambiar cámara frontal/trasera"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Girar Cámara
              </button>
              <button
                onClick={stopCamera}
                className="px-3 py-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-medium hover:bg-rose-500/30 transition cursor-pointer"
              >
                Modo Maniquí
              </button>
            </>
          )}

          <button
            onClick={() => setShowARZones((v) => !v)}
            className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
              showARZones
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400'
            }`}
          >
            {showARZones ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            Guías AR
          </button>

          <button
            onClick={() => setShowMesh((v) => !v)}
            className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
              showMesh
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Malla 3D
          </button>

          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 text-xs font-bold transition cursor-pointer"
            title="Abrir cámara AR en pantalla completa"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Pantalla Completa
          </button>
        </div>
      </div>

      {/* Interactive Simulation Controls when Camera is Off */}
      {cameraError && (
        <div className="bg-rose-500/15 border border-rose-500/40 rounded-2xl p-3 text-xs text-rose-200 flex items-center justify-between gap-3">
          <span>{cameraError}</span>
          {window.location.protocol === 'http:' && window.location.hostname !== 'localhost' && (
            <a
              href={`https://${window.location.host}`}
              className="px-3 py-1.5 rounded-xl bg-amber-500 text-zinc-950 font-bold shrink-0"
            >
              Ir a HTTPS
            </a>
          )}
        </div>
      )}
      {!cameraActive && (
        <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-zinc-400 mr-1">Probar forma de cráneo/rostro:</span>
            {ALL_SHAPES.map((shape) => (
              <button
                key={shape}
                onClick={() => setSimShape(shape)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  simShape === shape
                    ? 'bg-amber-500 text-zinc-950'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                {shape}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Compass className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-xs text-zinc-400 shrink-0">Rotar cabeza ({simYaw}°):</span>
            <input
              type="range"
              min={-60}
              max={60}
              value={simYaw}
              onChange={(e) => setSimYaw(Number(e.target.value))}
              className="w-full sm:w-32 accent-cyan-400 cursor-pointer"
            />
            <button
              onClick={() => setSimYaw(0)}
              className="text-[11px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            >
              0°
            </button>
          </div>
        </div>
      )}

      {/* Main Split View: AR Viewport + Live Step & Visagism Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left/Center: Live AR Canvas Viewport (Supports Fullscreen Mode) */}
        <div
          ref={viewportRef}
          className={
            isFullscreen
              ? 'fixed inset-0 z-50 w-screen h-dvh bg-black flex items-center justify-center overflow-hidden'
              : 'lg:col-span-7 relative rounded-3xl overflow-hidden bg-zinc-950 border border-zinc-800 shadow-2xl'
          }
        >
          <video ref={videoRef} className="hidden" playsInline muted />
          <canvas
            ref={canvasRef}
            width={720}
            height={680}
            className={
              isFullscreen
                ? 'w-full h-full object-contain bg-black'
                : 'w-full h-auto block aspect-[18/17] object-cover'
            }
          />

          {/* HUD Overlay Top-Left: Geometric Visagism Ratios */}
          <div className="absolute top-3 left-3 bg-zinc-950/80 backdrop-blur-md border border-zinc-800/90 rounded-2xl p-2.5 text-[11px] space-y-1 pointer-events-none">
            <div className="font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Rostro: {metrics.faceShape}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-zinc-300">
              <span>Largo/Ancho:</span>
              <span className="font-mono font-semibold text-white">{metrics.lengthToWidthRatio}</span>
              <span>Mandíbula:</span>
              <span className="font-mono font-semibold text-white">{metrics.chinAngleDeg}°</span>
              <span>Simetría:</span>
              <span className="font-mono font-semibold text-emerald-400">{metrics.symmetryScore}%</span>
            </div>
          </div>

          {/* HUD Overlay Top-Right: Fullscreen Toggle + Camera Controls + Active Guard */}
          <div className="absolute top-3 right-3 flex flex-col items-end gap-2">
            <div className="flex items-center gap-1.5">
              {cameraActive && (
                <button
                  onClick={toggleFacingMode}
                  className="p-2 rounded-xl bg-zinc-950/85 backdrop-blur-md border border-zinc-700 text-zinc-100 hover:bg-zinc-800 transition cursor-pointer"
                  title="Girar cámara"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setShowARZones((v) => !v)}
                className={`p-2 rounded-xl backdrop-blur-md border transition cursor-pointer ${
                  showARZones
                    ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200'
                    : 'bg-zinc-950/85 border-zinc-700 text-zinc-400'
                }`}
                title="Mostrar/Ocultar Guías AR"
              >
                {showARZones ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
              <button
                onClick={toggleFullscreen}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 text-zinc-950 font-extrabold text-xs shadow-lg shadow-amber-500/30 hover:bg-amber-400 transition cursor-pointer"
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 className="w-4 h-4" />
                    Salir
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-4 h-4" />
                    Pantalla Completa
                  </>
                )}
              </button>
            </div>

            <div className="bg-zinc-950/85 backdrop-blur-md border border-amber-500/40 rounded-2xl p-2.5 text-right max-w-[220px]">
              <div className="text-[10px] uppercase tracking-wider text-zinc-400">
                Paso {currentStep.stepNumber} de {selectedStyle.steps.length}
              </div>
              <div className="text-xs font-extrabold text-amber-400 truncate">
                {currentStep.guard}
              </div>
              <div className="text-[11px] text-cyan-300 font-semibold">
                Palanca: {currentStep.lever.toUpperCase()} ({currentStep.leverPercent}%)
              </div>
            </div>
          </div>

          {/* Bottom HUD inside AR Viewport (Includes Fullscreen Step Navigator + 4-Angle Capture) */}
          <div className="absolute bottom-3 inset-x-3 space-y-2">
            {isFullscreen && (
              <div className="bg-zinc-950/90 backdrop-blur-md border border-zinc-800 rounded-2xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-white truncate">
                      Paso {currentStep.stepNumber}: {currentStep.title}
                    </div>
                    <div className="text-[11px] text-zinc-300 line-clamp-2">
                      {currentStep.instruction}
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      onSpeakText(
                        `Paso ${currentStep.stepNumber}: ${currentStep.title}. Usa ${currentStep.guard} con la palanca ${currentStep.lever}. ${currentStep.instruction}`
                      )
                    }
                    className="p-2.5 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 shrink-0 cursor-pointer"
                    title="Escuchar paso por voz"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => setActiveStepIdx((i) => Math.max(0, i - 1))}
                    disabled={activeStepIdx === 0}
                    className="flex-1 py-2 px-3 rounded-xl bg-zinc-800 disabled:opacity-40 text-xs font-bold text-white flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" /> Anterior
                  </button>
                  <button
                    onClick={() =>
                      setActiveStepIdx((i) => Math.min(selectedStyle.steps.length - 1, i + 1))
                    }
                    disabled={activeStepIdx >= selectedStyle.steps.length - 1}
                    className="flex-1 py-2 px-3 rounded-xl bg-amber-500 disabled:opacity-40 text-zinc-950 text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    Siguiente <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-1.5 bg-zinc-950/85 backdrop-blur-md border border-zinc-800 rounded-2xl p-2">
              <span className="text-[11px] text-zinc-400 font-medium pl-1.5 hidden sm:inline">
                Guardar toma para IA:
              </span>
              {(['front', 'left', 'right', 'back'] as const).map((angle) => {
                const labels = {
                  front: 'Frente (0°)',
                  left: 'Perfil Izq',
                  right: 'Perfil Der',
                  back: 'Nuca/Corona',
                };
                const isFlashed = captureFlash === angle;
                return (
                  <button
                    key={angle}
                    onClick={() => handleQuickCapture(angle)}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer ${
                      isFlashed
                        ? 'bg-emerald-500 text-zinc-950'
                        : 'bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200'
                    }`}
                  >
                    {isFlashed && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {labels[angle]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Style Selector, Map of Guards/Levers, & Step-by-Step Coach */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Visagism Diagnosis & Recommended Haircuts */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400">
                1. Recomendación por Visagismo ({metrics.faceShape})
              </h3>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                {metrics.shapeDetails.geometryRule}
              </span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              {metrics.shapeDetails.goal}
            </p>

            {/* Haircut Style Selector Cards */}
            <div className="space-y-2 pt-1">
              {HAIRCUT_CATALOG.map((style) => {
                const isRecommended = style.idealFaces.includes(metrics.faceShape);
                const isSelected = style.id === selectedStyle.id;
                return (
                  <button
                    key={style.id}
                    onClick={() => {
                      onSelectStyle(style);
                      setActiveStepIdx(0);
                    }}
                    className={`w-full text-left p-3 rounded-2xl border transition cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500 shadow-lg shadow-amber-500/10'
                        : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm text-zinc-100">{style.name}</span>
                      {isRecommended && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                          Ideal para {metrics.faceShape}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5">{style.subtitle}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Step-by-Step Coach + Clipper Lever Visual Indicator */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-4 space-y-3 flex-1 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                  2. Guía Activa en Realidad Aumentada
                </span>
                <button
                  onClick={() =>
                    onSpeakText(
                      `Paso ${currentStep.stepNumber}: ${currentStep.title}. Usa ${currentStep.guard} con la palanca ${currentStep.lever}. ${currentStep.instruction}`
                    )
                  }
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-semibold hover:bg-cyan-500/30 transition cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  Escuchar Paso
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs text-zinc-400">
                      Paso {currentStep.stepNumber} de {selectedStyle.steps.length}
                    </div>
                    <h4 className="text-base font-extrabold text-white">
                      {currentStep.title}
                    </h4>
                  </div>
                </div>

                {/* Clipper Guard + Lever Visual Meter */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-2.5">
                    <div className="text-[10px] uppercase text-zinc-400">Peine Guía</div>
                    <div className="text-sm font-bold text-amber-400 mt-0.5">
                      {currentStep.guard}
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-0.5">
                      Técnica: {currentStep.motion}
                    </div>
                  </div>

                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-2.5">
                    <div className="flex items-center justify-between text-[10px] uppercase text-zinc-400">
                      <span>Posición Palanca</span>
                      <span className="text-cyan-400 font-bold">{currentStep.leverPercent}%</span>
                    </div>
                    <div className="text-sm font-bold text-zinc-100 capitalize mt-0.5">
                      Palanca {currentStep.lever}
                    </div>
                    <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden mt-1.5">
                      <div
                        className="h-full bg-gradient-to-r from-amber-400 to-cyan-400 transition-all duration-300"
                        style={{ width: `${Math.max(12, currentStep.leverPercent)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <p className="text-xs text-zinc-200 leading-relaxed">
                  {currentStep.instruction}
                </p>

                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200">
                  <strong className="text-amber-400">Tip de Maestro:</strong> {currentStep.proTip}
                </div>
              </div>

              {/* Color Map Legend of Guard Zones */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Mapa de Colores en Pantalla (Peines y Zonas)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {selectedStyle.zones.map((z) => {
                    const isCurrentZone = z.id === currentStep.zoneId;
                    return (
                      <div
                        key={z.id}
                        className={`p-2 rounded-xl border text-xs flex items-start gap-2 transition ${
                          isCurrentZone
                            ? 'bg-zinc-800/90 border-white/40 ring-1 ring-amber-400/50'
                            : 'bg-zinc-950/60 border-zinc-800/80 opacity-80'
                        }`}
                      >
                        <span
                          className="w-3 h-3 rounded-full shrink-0 mt-0.5"
                          style={{ backgroundColor: z.color }}
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-zinc-100 truncate">{z.guard}</div>
                          <div className="text-[11px] text-zinc-400 truncate">{z.leverSummary}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Step Navigation Buttons */}
            <div className="flex items-center justify-between gap-2 pt-2">
              <button
                onClick={() => setActiveStepIdx((i) => Math.max(0, i - 1))}
                disabled={activeStepIdx === 0}
                className="flex-1 py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                Paso Anterior
              </button>
              <button
                onClick={() =>
                  setActiveStepIdx((i) => Math.min(selectedStyle.steps.length - 1, i + 1))
                }
                disabled={activeStepIdx >= selectedStyle.steps.length - 1}
                className="flex-1 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-zinc-950 text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer"
              >
                Siguiente Paso
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Draws the interactive 3D mannequin head when camera is off so the user can test
 * every face shape, rotation angle, and AR fade line immediately.
 */
function drawSyntheticHeadBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  landmarks: NormalizedLandmark[],
  yawDeg: number
) {
  // Subtle cyber grid background
  const grad = ctx.createRadialGradient(w * 0.5, h * 0.45, 30, w * 0.5, h * 0.5, w * 0.7);
  grad.addColorStop(0, '#18181b');
  grad.addColorStop(1, '#09090b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(63, 63, 70, 0.25)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 36) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 36) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  const top = landmarks[10];
  const chin = landmarks[152];
  const leftCheek = landmarks[234];
  const rightCheek = landmarks[454];
  const leftJaw = landmarks[172];
  const rightJaw = landmarks[397];
  const leftTemple = landmarks[103];
  const rightTemple = landmarks[332];

  const cx = ((leftCheek.x + rightCheek.x) / 2) * w;
  const crownY = (top.y - 0.085) * h;
  const chinY = chin.y * h;

  // Neck & shoulders silhouette
  ctx.fillStyle = '#27272a';
  ctx.beginPath();
  ctx.moveTo(leftJaw.x * w + 18, leftJaw.y * h);
  ctx.lineTo(leftJaw.x * w - 25, h * 0.96);
  ctx.lineTo(rightJaw.x * w + 25, h * 0.96);
  ctx.lineTo(rightJaw.x * w - 18, rightJaw.y * h);
  ctx.closePath();
  ctx.fill();

  // Ears
  const earHeight = (leftJaw.y - leftTemple.y) * h * 0.55;
  ctx.fillStyle = '#3f3f46';
  ctx.beginPath();
  ctx.ellipse(leftCheek.x * w - 8, leftCheek.y * h + 6, 12, earHeight, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(rightCheek.x * w + 8, rightCheek.y * h + 6, 12, earHeight, 0.1, 0, Math.PI * 2);
  ctx.fill();

  // Cranium & Jaw shape contoured to the selected FaceShape landmarks
  const headGrad = ctx.createLinearGradient(0, crownY, 0, chinY);
  headGrad.addColorStop(0, '#3f3f46');
  headGrad.addColorStop(0.5, '#52525b');
  headGrad.addColorStop(1, '#27272a');

  ctx.fillStyle = headGrad;
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)';
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(cx, crownY);
  ctx.bezierCurveTo(
    rightTemple.x * w + 16,
    crownY,
    rightTemple.x * w + 18,
    rightTemple.y * h,
    rightCheek.x * w,
    rightCheek.y * h
  );
  ctx.bezierCurveTo(
    rightCheek.x * w - 2,
    rightJaw.y * h - 15,
    rightJaw.x * w,
    rightJaw.y * h,
    chin.x * w,
    chinY
  );
  ctx.bezierCurveTo(
    leftJaw.x * w,
    leftJaw.y * h,
    leftCheek.x * w + 2,
    leftJaw.y * h - 15,
    leftCheek.x * w,
    leftCheek.y * h
  );
  ctx.bezierCurveTo(
    leftTemple.x * w - 18,
    leftTemple.y * h,
    leftTemple.x * w - 16,
    crownY,
    cx,
    crownY
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Subtle eyebrows, eyes, and nose guide for orientation
  const eyeL = landmarks[33];
  const eyeR = landmarks[263];
  const nose = landmarks[1];
  ctx.strokeStyle = 'rgba(228, 228, 231, 0.45)';
  ctx.lineWidth = 2.5;
  // Eyebrows
  ctx.beginPath();
  ctx.arc(eyeL.x * w, eyeL.y * h - 10, 18, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(eyeR.x * w, eyeR.y * h - 10, 18, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();

  // Nose bridge
  ctx.beginPath();
  ctx.moveTo(((eyeL.x + eyeR.x) / 2) * w, eyeL.y * h);
  ctx.lineTo(nose.x * w, nose.y * h);
  ctx.lineTo(nose.x * w - (yawDeg >= 0 ? 8 : -8), nose.y * h + 6);
  ctx.stroke();
}

/**
 * Draws the 3D Visagism proportion axes (forehead width, cheekbone width, jawline angle, central symmetry axis).
 */
function drawVisagismMesh(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  landmarks: NormalizedLandmark[],
  metrics: VisagismMetrics
) {
  const top = landmarks[10];
  const chin = landmarks[152];
  const cheekL = landmarks[234];
  const cheekR = landmarks[454];
  const templeL = landmarks[103];
  const templeR = landmarks[332];
  const jawL = landmarks[172];
  const jawR = landmarks[397];

  ctx.save();
  ctx.setLineDash([5, 5]);
  ctx.lineWidth = 1.5;

  // Vertical central axis
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.75)';
  ctx.beginPath();
  ctx.moveTo(top.x * w, (top.y - 0.06) * h);
  ctx.lineTo(chin.x * w, chin.y * h);
  ctx.stroke();

  // Forehead width line
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)';
  ctx.beginPath();
  ctx.moveTo(templeL.x * w, templeL.y * h);
  ctx.lineTo(templeR.x * w, templeR.y * h);
  ctx.stroke();

  // Cheekbone (bizygomatic) width line
  ctx.strokeStyle = 'rgba(34, 197, 94, 0.85)';
  ctx.beginPath();
  ctx.moveTo(cheekL.x * w, cheekL.y * h);
  ctx.lineTo(cheekR.x * w, cheekR.y * h);
  ctx.stroke();

  // Jawline contour
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(244, 63, 94, 0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(jawL.x * w, jawL.y * h);
  ctx.lineTo(chin.x * w, chin.y * h);
  ctx.lineTo(jawR.x * w, jawR.y * h);
  ctx.stroke();

  // Draw key landmark nodes
  const keyNodes = [top, chin, cheekL, cheekR, templeL, templeR, jawL, jawR];
  for (const pt of keyNodes) {
    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    ctx.arc(pt.x * w, pt.y * h, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Label jaw angle
  ctx.fillStyle = '#fda4af';
  ctx.font = 'bold 11px system-ui';
  ctx.fillText(`Ángulo Mandibular: ${metrics.chinAngleDeg}°`, chin.x * w - 58, chin.y * h + 18);

  ctx.restore();
}

/**
 * Projects the Augmented Reality Haircut Guide (Zones #0, #0.5, #1, #2 Horseshoe)
 * anchored dynamically to the detected cranial & temple landmarks.
 */
function drawARHaircutOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  landmarks: NormalizedLandmark[],
  style: HaircutStyle,
  activeZoneId: string,
  yawDeg: number
) {
  const top = landmarks[10];
  const cheekL = landmarks[234];
  const cheekR = landmarks[454];
  const templeL = landmarks[103];
  const templeR = landmarks[332];

  // Cranial zone vertical boundaries:
  // Bottom of fade area = ear tragus / cheekbone line
  // Top of fade area (Horseshoe / parietal ridge) = slightly above forehead trichion (#10)
  const baseBottomY = ((cheekL.y + cheekR.y) / 2) * h + 8;
  const crownTopY = (top.y - 0.065) * h;
  const totalFadeSpan = Math.max(60, baseBottomY - crownTopY);

  // Horizontal span across cranium
  const leftEdgeX = Math.min(cheekL.x, templeL.x) * w - 18;
  const rightEdgeX = Math.max(cheekR.x, templeR.x) * w + 18;
  const centerX = ((leftEdgeX + rightEdgeX) / 2) + (yawDeg * 0.8);

  // Drop curve offset when head is turned or in drop-fade styles
  const dropPixels = style.dropAmount * totalFadeSpan;

  ctx.save();

  // Draw each comb/guard zone from bottom (#0) to top (#2 Horseshoe)
  style.zones.forEach((zone) => {
    const isActive = zone.id === activeZoneId;

    const yBottom = baseBottomY - zone.yStartRatio * totalFadeSpan;
    const yTop = baseBottomY - zone.yEndRatio * totalFadeSpan;

    // Create curved band path anchored to head width
    ctx.beginPath();
    ctx.moveTo(leftEdgeX, yTop + dropPixels * 0.5);
    ctx.quadraticCurveTo(centerX, yTop - dropPixels * 0.45, rightEdgeX, yTop + dropPixels * 0.5);
    ctx.lineTo(rightEdgeX, yBottom + dropPixels * 0.65);
    ctx.quadraticCurveTo(
      centerX,
      yBottom - dropPixels * 0.35,
      leftEdgeX,
      yBottom + dropPixels * 0.65
    );
    ctx.closePath();

    // Fill band
    ctx.fillStyle = isActive
      ? zone.fillRgba.replace('0.24', '0.42').replace('0.22', '0.40')
      : zone.fillRgba;
    ctx.fill();

    // Draw upper guide boundary line
    ctx.beginPath();
    ctx.moveTo(leftEdgeX - 6, yTop + dropPixels * 0.5);
    ctx.quadraticCurveTo(centerX, yTop - dropPixels * 0.45, rightEdgeX + 6, yTop + dropPixels * 0.5);
    ctx.strokeStyle = zone.color;
    ctx.lineWidth = isActive ? 3.5 : 2;
    ctx.setLineDash(isActive ? [] : [8, 5]);
    ctx.stroke();

    // Draw floating AR Callout Tag on the side
    const labelY = (yTop + yBottom) / 2;
    const tagX = yawDeg <= 0 ? rightEdgeX + 10 : Math.max(8, leftEdgeX - 165);

    ctx.setLineDash([]);
    ctx.fillStyle = isActive ? 'rgba(9, 9, 11, 0.92)' : 'rgba(9, 9, 11, 0.75)';
    ctx.strokeStyle = zone.color;
    ctx.lineWidth = isActive ? 2 : 1;

    const boxW = 156;
    const boxH = 34;
    const clampedX = Math.max(8, Math.min(w - boxW - 8, tagX));
    const clampedY = Math.max(48, Math.min(h - boxH - 52, labelY - boxH / 2));

    ctx.beginPath();
    ctx.roundRect(clampedX, clampedY, boxW, boxH, 8);
    ctx.fill();
    ctx.stroke();

    // Connector line from AR band to floating label
    ctx.beginPath();
    ctx.moveTo(yawDeg <= 0 ? rightEdgeX : leftEdgeX, labelY);
    ctx.lineTo(yawDeg <= 0 ? clampedX : clampedX + boxW, clampedY + boxH / 2);
    ctx.strokeStyle = zone.color;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = zone.color;
    ctx.font = 'bold 11px system-ui';
    ctx.fillText(
      `${isActive ? '▶ ' : ''}${zone.guard.split('+')[0].trim()}`,
      clampedX + 8,
      clampedY + 14
    );

    ctx.fillStyle = '#e4e4e7';
    ctx.font = '10px system-ui';
    ctx.fillText(zone.leverSummary.slice(0, 24), clampedX + 8, clampedY + 27);
  });

  // Draw C-Cup / Frontline ("Cerquillo") AR markers on temples
  ctx.setLineDash([]);
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 2.5;
  // Left C-Cup arc
  ctx.beginPath();
  ctx.arc(templeL.x * w - 4, templeL.y * h + 14, 14, -Math.PI * 0.4, Math.PI * 0.45);
  ctx.stroke();
  // Right C-Cup arc
  ctx.beginPath();
  ctx.arc(templeR.x * w + 4, templeR.y * h + 14, 14, Math.PI * 0.55, Math.PI * 1.4);
  ctx.stroke();

  ctx.restore();
}

