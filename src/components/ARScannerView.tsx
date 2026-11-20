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
  Scissors,
  Wand2,
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

type BeardSimStyle = 'none' | 'stubble' | 'boxed' | 'goatee';

const HAIR_COLOR_OPTIONS: Array<{ id: string; label: string; hex: string }> = [
  { id: 'black', label: 'Negro Natural', hex: '#141416' },
  { id: 'dark-brown', label: 'Castaño Oscuro', hex: '#2c1e16' },
  { id: 'med-brown', label: 'Castaño Medio', hex: '#4a3222' },
  { id: 'ash-blonde', label: 'Rubio Cenizo', hex: '#7c6246' },
  { id: 'silver', label: 'Plata / Canoso', hex: '#9ca3af' },
];

const BEARD_STYLE_OPTIONS: Array<{ id: BeardSimStyle; label: string }> = [
  { id: 'none', label: 'Sin Barba' },
  { id: 'stubble', label: 'Sombreada 3mm' },
  { id: 'boxed', label: 'Perfilada Angular' },
  { id: 'goatee', label: 'Candado + Bigote' },
];

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
  const [showLiveSimulator, setShowLiveSimulator] = useState<boolean>(true);
  const [simHairColor, setSimHairColor] = useState<string>(HAIR_COLOR_OPTIONS[0].hex);
  const [simBeardStyle, setSimBeardStyle] = useState<BeardSimStyle>('none');
  const [simOpacity, setSimOpacity] = useState<number>(0.88);
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

    // 1. Draw Real-Time AR Haircut & Beard Try-On Simulation if enabled
    if (showLiveSimulator) {
      drawLiveHaircutSimulation(
        ctx,
        width,
        height,
        landmarks,
        selectedStyle,
        simHairColor,
        simBeardStyle,
        simOpacity,
        computed.yawDeg,
        computed.rollDeg
      );
    }

    // 2. Draw Visagism Geometric Mesh if enabled
    if (showMesh) {
      drawVisagismMesh(ctx, width, height, landmarks, computed);
    }

    // 3. Draw AR Haircut Diagram & Comb/Guard Color Zones if enabled
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
    showLiveSimulator,
    simHairColor,
    simBeardStyle,
    simOpacity,
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

  const enableSimulatorOnlyMode = () => {
    setShowLiveSimulator(true);
    setShowARZones(false);
    setShowMesh(false);
  };

  const enableARCoachMode = () => {
    setShowARZones(true);
    setShowMesh(true);
  };

  const isSimulatorOnlyMode = showLiveSimulator && !showARZones && !showMesh;

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

        <div className="flex flex-wrap items-center gap-2">
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
            onClick={() => setShowLiveSimulator((v) => !v)}
            className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
              showLiveSimulator
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400'
            }`}
            title="Activar/desactivar simulación de corte en vivo"
          >
            <Scissors className="w-3.5 h-3.5" />
            Simulador Corte
          </button>

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

      {/* Main Split View: AR Viewport + Real-Time Simulator & Visagism Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left/Center Column: AR Camera Viewport + Quick Real-Time Haircut Try-On Bar */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <div
            ref={viewportRef}
            className={
              isFullscreen
                ? 'fixed inset-0 z-50 w-screen h-dvh bg-black flex items-center justify-center overflow-hidden'
                : 'relative rounded-3xl overflow-hidden bg-zinc-950 border border-zinc-800 shadow-2xl'
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

            {/* HUD Overlay Top-Right: Fullscreen Toggle + Camera Controls + Active Style/Guard */}
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
                  onClick={() => setShowLiveSimulator((v) => !v)}
                  className={`p-2 rounded-xl backdrop-blur-md border transition cursor-pointer ${
                    showLiveSimulator
                      ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200'
                      : 'bg-zinc-950/85 border-zinc-700 text-zinc-400'
                  }`}
                  title="Mostrar/Ocultar Simulador de Corte"
                >
                  <Scissors className="w-4 h-4" />
                </button>
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

              {showARZones ? (
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
              ) : (
                <div className="bg-zinc-950/85 backdrop-blur-md border border-emerald-500/40 rounded-2xl p-2.5 text-right max-w-[220px]">
                  <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold">
                    Vista Previa Cliente
                  </div>
                  <div className="text-xs font-extrabold text-white truncate">
                    {selectedStyle.name.split('+')[0].trim()}
                  </div>
                  <div className="text-[11px] text-zinc-300">
                    {BEARD_STYLE_OPTIONS.find((b) => b.id === simBeardStyle)?.label}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom HUD inside AR Viewport (Includes Fullscreen Haircut Try-On Selector + Step Navigator + 4-Angle Capture) */}
            <div className="absolute bottom-3 inset-x-3 space-y-2">
              {isFullscreen && (
                <div className="bg-zinc-950/90 backdrop-blur-md border border-zinc-800 rounded-2xl p-2.5 space-y-2">
                  {/* Fullscreen Quick Mode & Color/Beard Strip */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={enableSimulatorOnlyMode}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                          isSimulatorOnlyMode
                            ? 'bg-emerald-500 text-zinc-950'
                            : 'bg-zinc-800 text-zinc-300'
                        }`}
                      >
                        Modo Simulador Solo
                      </button>
                      <button
                        onClick={enableARCoachMode}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                          showARZones
                            ? 'bg-cyan-500 text-zinc-950'
                            : 'bg-zinc-800 text-zinc-300'
                        }`}
                      >
                        Entrenador AR
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {HAIR_COLOR_OPTIONS.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setSimHairColor(c.hex)}
                          className={`w-5 h-5 rounded-full border-2 transition cursor-pointer ${
                            simHairColor === c.hex
                              ? 'border-amber-400 scale-110'
                              : 'border-zinc-600'
                          }`}
                          style={{ backgroundColor: c.hex }}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Fullscreen Horizontal Haircut Try-On Carousel */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {HAIRCUT_CATALOG.map((style) => {
                      const active = style.id === selectedStyle.id;
                      return (
                        <button
                          key={style.id}
                          onClick={() => {
                            onSelectStyle(style);
                            setActiveStepIdx(0);
                            setShowLiveSimulator(true);
                          }}
                          className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap border transition cursor-pointer shrink-0 ${
                            active
                              ? 'bg-amber-500 border-amber-400 text-zinc-950'
                              : 'bg-zinc-900 border-zinc-700 text-zinc-200'
                          }`}
                        >
                          {style.name.split('+')[0].trim()}
                        </button>
                      );
                    })}
                  </div>

                  {/* Fullscreen Quick Beard Selector */}
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    <span className="text-[10px] uppercase text-zinc-400 font-bold shrink-0">
                      Barba:
                    </span>
                    {BEARD_STYLE_OPTIONS.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => {
                          setSimBeardStyle(b.id);
                          setShowLiveSimulator(true);
                        }}
                        className={`px-2 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap transition cursor-pointer shrink-0 ${
                          simBeardStyle === b.id
                            ? 'bg-cyan-500 text-zinc-950 font-bold'
                            : 'bg-zinc-800 text-zinc-300'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>

                  {/* Step Navigator when AR Coach is visible */}
                  {showARZones && (
                    <div className="pt-1 border-t border-zinc-800/80 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold text-white truncate">
                            Paso {currentStep.stepNumber}: {currentStep.title}
                          </div>
                          <div className="text-[11px] text-zinc-300 line-clamp-1">
                            {currentStep.instruction}
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            onSpeakText(
                              `Paso ${currentStep.stepNumber}: ${currentStep.title}. Usa ${currentStep.guard} con la palanca ${currentStep.lever}. ${currentStep.instruction}`
                            )
                          }
                          className="p-2 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 shrink-0 cursor-pointer"
                          title="Escuchar paso por voz"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <button
                          onClick={() => setActiveStepIdx((i) => Math.max(0, i - 1))}
                          disabled={activeStepIdx === 0}
                          className="flex-1 py-1.5 px-3 rounded-xl bg-zinc-800 disabled:opacity-40 text-xs font-bold text-white flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <ChevronLeft className="w-4 h-4" /> Anterior
                        </button>
                        <button
                          onClick={() =>
                            setActiveStepIdx((i) => Math.min(selectedStyle.steps.length - 1, i + 1))
                          }
                          disabled={activeStepIdx >= selectedStyle.steps.length - 1}
                          className="flex-1 py-1.5 px-3 rounded-xl bg-amber-500 disabled:opacity-40 text-zinc-950 text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer"
                        >
                          Siguiente <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
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

          {/* Real-Time AR Try-On Simulator Controls Directly Below Camera */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Wand2 className="w-3.5 h-3.5" />
                  Simulador de Corte y Barba en Tiempo Real
                </div>
                <p className="text-[11px] text-zinc-400">
                  Selecciona un estilo para probarlo al instante sobre el rostro en vivo
                </p>
              </div>

              {/* One-tap Mode Switcher: Simulator Only vs AR Coach */}
              <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                <button
                  onClick={enableSimulatorOnlyMode}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    isSimulatorOnlyMode
                      ? 'bg-emerald-500 text-zinc-950'
                      : 'text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  Modo Simulador Solo
                </button>
                <button
                  onClick={enableARCoachMode}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    showARZones
                      ? 'bg-cyan-500 text-zinc-950'
                      : 'text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  Modo Entrenador AR
                </button>
              </div>
            </div>

            {/* Horizontal Haircut Style Selector Carousel */}
            <div className="flex items-stretch gap-2 overflow-x-auto pb-1.5">
              {HAIRCUT_CATALOG.map((style) => {
                const isSelected = style.id === selectedStyle.id;
                const isIdeal = style.idealFaces.includes(metrics.faceShape);
                return (
                  <button
                    key={style.id}
                    onClick={() => {
                      onSelectStyle(style);
                      setActiveStepIdx(0);
                      setShowLiveSimulator(true);
                    }}
                    className={`min-w-[165px] text-left p-2.5 rounded-2xl border transition shrink-0 cursor-pointer flex flex-col justify-between gap-1 ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-500 ring-1 ring-amber-400/50'
                        : 'bg-zinc-950/80 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-cyan-300">
                        {style.simulatorProfile.textureType}
                      </span>
                      {isIdeal && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                          Ideal
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-extrabold text-white leading-snug">
                      {style.name}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Beard Selector + Hair Color Swatches + Opacity Slider */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1 border-t border-zinc-800/80">
              {/* Beard Style Chips */}
              <div className="md:col-span-6 space-y-1.5">
                <span className="text-[11px] font-semibold text-zinc-400 block">
                  Simular Barba en Vivo:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {BEARD_STYLE_OPTIONS.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => {
                        setSimBeardStyle(b.id);
                        setShowLiveSimulator(true);
                      }}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition cursor-pointer ${
                        simBeardStyle === b.id
                          ? 'bg-amber-500 text-zinc-950 font-bold'
                          : 'bg-zinc-950 border border-zinc-800 text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hair Color & Opacity Controls */}
              <div className="md:col-span-6 flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-zinc-400">Tono de Cabello:</span>
                  <div className="flex items-center gap-2">
                    {HAIR_COLOR_OPTIONS.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSimHairColor(c.hex);
                          setShowLiveSimulator(true);
                        }}
                        className={`w-6 h-6 rounded-full border-2 transition cursor-pointer ${
                          simHairColor === c.hex
                            ? 'border-amber-400 scale-110 ring-2 ring-amber-400/30'
                            : 'border-zinc-700 hover:border-zinc-500'
                        }`}
                        style={{ backgroundColor: c.hex }}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-zinc-400 shrink-0">
                    Intensidad ({Math.round(simOpacity * 100)}%):
                  </span>
                  <input
                    type="range"
                    min={0.4}
                    max={1}
                    step={0.05}
                    value={simOpacity}
                    onChange={(e) => setSimOpacity(Number(e.target.value))}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                </div>
              </div>
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

function parseHexRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const num = parseInt(clean.length === 3 ? clean.replace(/(.)/g, '$1$1') : clean, 16);
  if (Number.isNaN(num)) return { r: 24, g: 24, b: 27 };
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgbStr(rgb: { r: number; g: number; b: number }, alpha: number): string {
  return `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, ${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}

function shiftRgb(rgb: { r: number; g: number; b: number }, delta: number) {
  return {
    r: Math.max(0, Math.min(255, rgb.r + delta)),
    g: Math.max(0, Math.min(255, rgb.g + delta)),
    b: Math.max(0, Math.min(255, rgb.b + delta)),
  };
}

/**
 * Projects a realistic real-time AR Haircut & Beard simulation anchored to MediaPipe
 * cranial and jawline landmarks, updating at 60 FPS with head yaw and roll.
 */
function drawLiveHaircutSimulation(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  landmarks: NormalizedLandmark[],
  style: HaircutStyle,
  hairColorHex: string,
  beardStyle: BeardSimStyle,
  opacity: number,
  yawDeg: number,
  rollDeg: number
) {
  const top = landmarks[10];
  const chin = landmarks[152];
  const cheekL = landmarks[234];
  const cheekR = landmarks[454];
  const templeL = landmarks[103];
  const templeR = landmarks[332];
  const jawL = landmarks[172];
  const jawR = landmarks[397];
  const noseTip = landmarks[1];

  const baseRgb = parseHexRgb(hairColorHex);
  const highlightRgb = shiftRgb(baseRgb, 36);
  const shadowRgb = shiftRgb(baseRgb, -20);

  const rollRad = (rollDeg * Math.PI) / 180;
  const ux = Math.cos(rollRad);
  const uy = Math.sin(rollRad);
  const vx = -Math.sin(rollRad);
  const vy = Math.cos(rollRad);

  const headW = Math.max(
    60,
    Math.hypot((cheekR.x - cheekL.x) * w, (cheekR.y - cheekL.y) * h)
  );
  const headH = Math.max(
    80,
    Math.hypot((chin.x - top.x) * w, (chin.y - top.y) * h)
  );
  const yawRatio = Math.max(-1, Math.min(1, yawDeg / 70));

  const pt = (lm: NormalizedLandmark, rx = 0, ry = 0) => ({
    x: lm.x * w + rx * ux + ry * vx,
    y: lm.y * h + rx * uy + ry * vy,
  });
  const shiftPx = (p: { x: number; y: number }, rx = 0, ry = 0) => ({
    x: p.x + rx * ux + ry * vx,
    y: p.y + rx * uy + ry * vy,
  });

  const profile = style.simulatorProfile;
  const crownLift = headH * profile.topVolumeHeight * 0.62;
  const fringeDropPx = profile.fringeDrop * headH * 0.45;

  ctx.save();

  // ---------------------------------------------------------------------------
  // CAPA 1: Degradado Lateral (Side Fade & Sienes + Mullet Tails si aplica)
  // ---------------------------------------------------------------------------
  const leftSideExpand = headW * (0.075 + Math.max(0, yawRatio) * 0.08);
  const rightSideExpand = headW * (0.075 + Math.max(0, -yawRatio) * 0.08);
  const fadeStartRatio = Math.max(0.14, Math.min(0.75, style.startHeightRatio));

  const drawSideFade = (isLeft: boolean) => {
    const temple = isLeft ? templeL : templeR;
    const cheek = isLeft ? cheekL : cheekR;
    const jaw = isLeft ? jawL : jawR;
    const dir = isLeft ? -1 : 1;
    const expand = isLeft ? leftSideExpand : rightSideExpand;

    const pTempleIn = pt(temple, dir * headW * 0.01, -headH * 0.02);
    const pTempleOut = pt(temple, dir * expand, -headH * 0.07);
    const pCrownSide = pt(temple, dir * (expand * 0.85), -crownLift * 0.68);
    const pCheekOut = pt(cheek, dir * (expand * 0.95), headH * 0.02);
    const pCheekIn = pt(cheek, -dir * headW * 0.01, headH * 0.02);
    const pMidCcup = pt(temple, dir * headW * 0.025, headH * 0.09);

    const grad = ctx.createLinearGradient(
      pCrownSide.x,
      pCrownSide.y,
      pCheekOut.x,
      pCheekOut.y
    );
    const topAlpha = opacity * Math.min(0.95, 0.5 + profile.sideFadeDarkness * 0.5);
    const midAlpha = opacity * profile.sideFadeDarkness * 0.45;

    grad.addColorStop(0, rgbStr(baseRgb, topAlpha));
    grad.addColorStop(Math.min(0.88, 1 - fadeStartRatio * 0.65), rgbStr(shadowRgb, midAlpha));
    grad.addColorStop(1, rgbStr(shadowRgb, 0.02));

    ctx.beginPath();
    ctx.moveTo(pTempleIn.x, pTempleIn.y);
    ctx.lineTo(pCrownSide.x, pCrownSide.y);
    ctx.quadraticCurveTo(pTempleOut.x, pTempleOut.y, pCheekOut.x, pCheekOut.y);
    ctx.lineTo(pCheekIn.x, pCheekIn.y);
    ctx.quadraticCurveTo(pMidCcup.x, pMidCcup.y, pTempleIn.x, pTempleIn.y);
    ctx.closePath();

    ctx.fillStyle = grad;
    ctx.fill();

    // Crisp C-Cup temple edge (cerquillo lateral)
    ctx.beginPath();
    ctx.moveTo(pTempleIn.x, pTempleIn.y);
    ctx.quadraticCurveTo(pMidCcup.x, pMidCcup.y, pCheekIn.x, pCheekIn.y);
    ctx.strokeStyle = rgbStr(shadowRgb, opacity * 0.55);
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Mullet / Burst Fade rear nape extension peeking behind ear/jaw
    if (profile.mulletTails) {
      const mTop = pt(cheek, dir * (expand * 0.9), headH * 0.01);
      const mOuter = pt(jaw, dir * (expand * 1.45), headH * 0.11);
      const mBottom = pt(jaw, dir * (expand * 0.9), headH * 0.24);
      const mInner = pt(jaw, dir * headW * 0.02, headH * 0.08);

      const mulletGrad = ctx.createLinearGradient(mTop.x, mTop.y, mBottom.x, mBottom.y);
      mulletGrad.addColorStop(0, rgbStr(baseRgb, opacity * 0.85));
      mulletGrad.addColorStop(1, rgbStr(shadowRgb, opacity * 0.55));

      ctx.beginPath();
      ctx.moveTo(mTop.x, mTop.y);
      ctx.quadraticCurveTo(mOuter.x, mOuter.y, mBottom.x, mBottom.y);
      ctx.lineTo(mInner.x, mInner.y);
      ctx.closePath();
      ctx.fillStyle = mulletGrad;
      ctx.fill();
    }
  };

  drawSideFade(true);
  drawSideFade(false);

  // ---------------------------------------------------------------------------
  // CAPA 2: Volumen Superior, Textura y Flequillo / Cerquillo Frontal
  // ---------------------------------------------------------------------------
  const tl = pt(templeL, -leftSideExpand * 0.72, -headH * 0.02);
  const tr = pt(templeR, rightSideExpand * 0.72, -headH * 0.02);
  const topAnchor = pt(top, yawRatio * headW * 0.04, 0);

  const crownMid = shiftPx(topAnchor, yawRatio * headW * 0.08, -crownLift);
  const crownL = shiftPx(tl, -headW * 0.04, -crownLift * 0.78);
  const crownR = shiftPx(tr, headW * 0.04, -crownLift * 0.78);

  const buildTopHairPath = () => {
    ctx.beginPath();
    ctx.moveTo(tl.x, tl.y);

    if (profile.textureType === 'quiff') {
      const quiffPeak = shiftPx(topAnchor, headW * 0.09 + yawRatio * headW * 0.07, -crownLift * 1.24);
      ctx.bezierCurveTo(crownL.x, crownL.y, quiffPeak.x - headW * 0.14, quiffPeak.y, quiffPeak.x, quiffPeak.y);
      ctx.bezierCurveTo(quiffPeak.x + headW * 0.16, quiffPeak.y, crownR.x, crownR.y, tr.x, tr.y);
      const fMid = shiftPx(topAnchor, 0, fringeDropPx);
      ctx.quadraticCurveTo(fMid.x, fMid.y, tl.x, tl.y);
    } else if (profile.textureType === 'pompadour') {
      const pompPeak = shiftPx(topAnchor, headW * 0.12 + yawRatio * headW * 0.08, -crownLift * 1.22);
      ctx.bezierCurveTo(crownL.x, crownL.y - crownLift * 0.15, pompPeak.x - headW * 0.16, pompPeak.y, pompPeak.x, pompPeak.y);
      ctx.bezierCurveTo(pompPeak.x + headW * 0.18, pompPeak.y + crownLift * 0.1, crownR.x + headW * 0.04, crownR.y, tr.x, tr.y);
      const fMid = shiftPx(topAnchor, 0, fringeDropPx - headH * 0.02);
      ctx.quadraticCurveTo(fMid.x, fMid.y, tl.x, tl.y);
    } else if (profile.textureType === 'buzz') {
      ctx.bezierCurveTo(crownL.x, crownL.y, crownMid.x - headW * 0.18, crownMid.y, crownMid.x, crownMid.y);
      ctx.bezierCurveTo(crownMid.x + headW * 0.18, crownMid.y, crownR.x, crownR.y, tr.x, tr.y);
      // Razor-sharp rectangular line-up edge
      const cornerR = pt(templeR, headW * 0.02, -headH * 0.01);
      const cornerL = pt(templeL, -headW * 0.02, -headH * 0.01);
      ctx.lineTo(cornerR.x, cornerR.y);
      ctx.lineTo(cornerL.x, cornerL.y);
    } else if (profile.textureType === 'crop') {
      ctx.bezierCurveTo(crownL.x, crownL.y, crownMid.x - headW * 0.18, crownMid.y, crownMid.x, crownMid.y);
      ctx.bezierCurveTo(crownMid.x + headW * 0.18, crownMid.y, crownR.x, crownR.y, tr.x, tr.y);
      // Choppy textured fringe on upper forehead
      const segments = 8;
      for (let i = segments; i >= 0; i--) {
        const t = i / segments;
        const fx = tl.x + (tr.x - tl.x) * t;
        const fy = tl.y + (tr.y - tl.y) * t;
        const arch = Math.sin(t * Math.PI) * fringeDropPx;
        const jag = (i % 2 === 0 ? 1 : -0.35) * headH * 0.022;
        ctx.lineTo(fx + vx * (arch + jag), fy + vy * (arch + jag));
      }
    } else if (profile.textureType === 'mullet') {
      // Messy textured top peaks
      const peaks = 6;
      for (let i = 0; i <= peaks; i++) {
        const t = i / peaks;
        const bx = crownL.x + (crownR.x - crownL.x) * t;
        const by = crownL.y + (crownR.y - crownL.y) * t;
        const lift = Math.sin(t * Math.PI) * crownLift * 0.42 + (i % 2 === 0 ? headH * 0.045 : 0);
        ctx.lineTo(bx - vx * lift, by - vy * lift);
      }
      ctx.lineTo(tr.x, tr.y);
      const fMid = shiftPx(topAnchor, 0, fringeDropPx);
      ctx.quadraticCurveTo(fMid.x, fMid.y, tl.x, tl.y);
    } else {
      // 'taper-natural'
      ctx.bezierCurveTo(crownL.x, crownL.y, crownMid.x - headW * 0.2, crownMid.y, crownMid.x, crownMid.y);
      ctx.bezierCurveTo(crownMid.x + headW * 0.2, crownMid.y, crownR.x, crownR.y, tr.x, tr.y);
      const fMid = shiftPx(topAnchor, 0, fringeDropPx);
      ctx.quadraticCurveTo(fMid.x, fMid.y, tl.x, tl.y);
    }
    ctx.closePath();
  };

  buildTopHairPath();
  const topGrad = ctx.createLinearGradient(crownMid.x, crownMid.y, topAnchor.x, topAnchor.y + fringeDropPx);
  topGrad.addColorStop(0, rgbStr(highlightRgb, opacity));
  topGrad.addColorStop(0.55, rgbStr(baseRgb, opacity));
  topGrad.addColorStop(1, rgbStr(shadowRgb, opacity * 0.96));
  ctx.fillStyle = topGrad;
  ctx.fill();

  // Internal 3D hair strand strokes & specular highlights clipped inside top hair cap
  ctx.save();
  buildTopHairPath();
  ctx.clip();

  if (profile.textureType === 'buzz') {
    // Micro stubble dots for Buzz Cut texture
    ctx.fillStyle = rgbStr(highlightRgb, opacity * 0.25);
    const step = Math.max(5, Math.round(headW * 0.04));
    for (let x = crownL.x; x <= crownR.x; x += step) {
      for (let y = crownMid.y - 10; y <= topAnchor.y + 18; y += step) {
        ctx.fillRect(x + ((y * 7) % 3), y, 1.5, 1.5);
      }
    }
  } else {
    // Directional hair flow strokes
    ctx.lineCap = 'round';
    const strandCount = 18;
    for (let i = 0; i < strandCount; i++) {
      const t = (i + 0.5) / strandCount;
      const sx = tl.x + (tr.x - tl.x) * t;
      const sy = tl.y + (tr.y - tl.y) * t + fringeDropPx * 0.6;
      const ex = crownL.x + (crownR.x - crownL.x) * t + (profile.textureType === 'quiff' || profile.textureType === 'pompadour' ? headW * 0.08 : 0);
      const ey = crownMid.y + Math.abs(t - 0.5) * crownLift * 0.5;
      ctx.strokeStyle = i % 2 === 0 ? rgbStr(highlightRgb, opacity * 0.34) : rgbStr(shadowRgb, opacity * 0.45);
      ctx.lineWidth = i % 3 === 0 ? 2.2 : 1.3;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo((sx + ex) / 2 + headW * 0.03, (sy + ey) / 2, ex, ey);
      ctx.stroke();
    }
  }

  // Soft glossy specular band on crown
  ctx.fillStyle = `rgba(255, 255, 255, ${(0.09 * opacity).toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(
    crownMid.x,
    crownMid.y + crownLift * 0.38,
    headW * 0.26,
    Math.max(8, crownLift * 0.22),
    rollRad,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.restore();

  // Razor Side Part line for Pompadour / Side Part
  if (profile.sidePart) {
    const partStart = pt(templeL, headW * 0.02, -headH * 0.02);
    const partEnd = shiftPx(crownL, headW * 0.14, crownLift * 0.25);
    ctx.beginPath();
    ctx.moveTo(partStart.x, partStart.y);
    ctx.lineTo(partEnd.x, partEnd.y);
    ctx.strokeStyle = `rgba(244, 224, 204, ${(0.72 * opacity).toFixed(3)})`;
    ctx.lineWidth = 2.4;
    ctx.stroke();
  }

  // ---------------------------------------------------------------------------
  // CAPA 3: Simulador de Barba en Vivo anclado a la mandíbula
  // ---------------------------------------------------------------------------
  if (beardStyle !== 'none') {
    const hasMouthLandmarks =
      landmarks[61] &&
      landmarks[291] &&
      landmarks[13] &&
      Math.abs(landmarks[61].x - landmarks[291].x) > 0.02;

    const mouthCenterLm = hasMouthLandmarks
      ? landmarks[13]
      : {
          x: noseTip.x * 0.5 + ((jawL.x + jawR.x) / 2) * 0.5,
          y: noseTip.y + (chin.y - noseTip.y) * 0.35,
          z: 0,
        };
    const mouthLeftLm = hasMouthLandmarks
      ? landmarks[61]
      : {
          x: mouthCenterLm.x - (jawR.x - jawL.x) * 0.24,
          y: mouthCenterLm.y + 0.01,
          z: 0,
        };
    const mouthRightLm = hasMouthLandmarks
      ? landmarks[291]
      : {
          x: mouthCenterLm.x + (jawR.x - jawL.x) * 0.24,
          y: mouthCenterLm.y + 0.01,
          z: 0,
        };

    const mCenter = pt(mouthCenterLm, 0, 0);
    const mLeft = pt(mouthLeftLm, -headW * 0.015, 0);
    const mRight = pt(mouthRightLm, headW * 0.015, 0);
    const noseBottom = pt(noseTip, 0, headH * 0.03);

    const sideL = pt(cheekL, -headW * 0.01, headH * 0.03);
    const sideR = pt(cheekR, headW * 0.01, headH * 0.03);
    const jL = pt(jawL, -headW * 0.01, headH * 0.01);
    const jR = pt(jawR, headW * 0.01, headH * 0.01);
    const chinBot = pt(chin, 0, headH * 0.02);
    const lowerLip = pt(mouthCenterLm, 0, headH * 0.065);

    const beardAlpha =
      beardStyle === 'stubble' ? opacity * 0.36 : opacity * 0.78;

    // Mustache (all beard styles include sculpted mustache)
    ctx.beginPath();
    ctx.moveTo(mLeft.x - headW * 0.02, mLeft.y + headH * 0.01);
    ctx.quadraticCurveTo(noseBottom.x, noseBottom.y - headH * 0.01, mRight.x + headW * 0.02, mRight.y + headH * 0.01);
    ctx.quadraticCurveTo(mCenter.x, mCenter.y - headH * 0.015, mLeft.x - headW * 0.02, mLeft.y + headH * 0.01);
    ctx.closePath();
    ctx.fillStyle = rgbStr(baseRgb, beardAlpha);
    ctx.fill();

    if (beardStyle === 'goatee') {
      // Goatee + Soul patch around mouth & chin
      const gL = pt(mouthLeftLm, -headW * 0.02, headH * 0.01);
      const gR = pt(mouthRightLm, headW * 0.02, headH * 0.01);
      const cL = pt(chin, -headW * 0.14, -headH * 0.02);
      const cR = pt(chin, headW * 0.14, -headH * 0.02);

      ctx.beginPath();
      ctx.moveTo(gL.x, gL.y);
      ctx.lineTo(cL.x, cL.y);
      ctx.quadraticCurveTo(chinBot.x, chinBot.y + headH * 0.02, cR.x, cR.y);
      ctx.lineTo(gR.x, gR.y);
      ctx.quadraticCurveTo(mRight.x, lowerLip.y, lowerLip.x, lowerLip.y);
      ctx.quadraticCurveTo(mLeft.x, lowerLip.y, gL.x, gL.y);
      ctx.closePath();

      const gGrad = ctx.createLinearGradient(lowerLip.x, lowerLip.y, chinBot.x, chinBot.y);
      gGrad.addColorStop(0, rgbStr(baseRgb, beardAlpha * 0.85));
      gGrad.addColorStop(1, rgbStr(shadowRgb, beardAlpha));
      ctx.fillStyle = gGrad;
      ctx.fill();
    } else {
      // Full Cheek & Jawline Beard ('stubble' or 'boxed')
      const cheekCurveDrop = beardStyle === 'boxed' ? headH * 0.02 : 0;
      ctx.beginPath();
      ctx.moveTo(sideL.x, sideL.y);
      ctx.lineTo(jL.x, jL.y);
      ctx.quadraticCurveTo(chinBot.x - headW * 0.14, chinBot.y, chinBot.x, chinBot.y + headH * 0.015);
      ctx.quadraticCurveTo(chinBot.x + headW * 0.14, chinBot.y, jR.x, jR.y);
      ctx.lineTo(sideR.x, sideR.y);
      // Inner cheek line to mouth corners
      ctx.lineTo(mRight.x + headW * 0.025, mRight.y + cheekCurveDrop);
      ctx.quadraticCurveTo(mCenter.x, lowerLip.y + headH * 0.01, mLeft.x - headW * 0.025, mLeft.y + cheekCurveDrop);
      ctx.closePath();

      const bGrad = ctx.createLinearGradient(sideL.x, sideL.y, chinBot.x, chinBot.y);
      bGrad.addColorStop(0, rgbStr(baseRgb, beardAlpha * 0.72));
      bGrad.addColorStop(0.6, rgbStr(baseRgb, beardAlpha));
      bGrad.addColorStop(1, rgbStr(shadowRgb, beardAlpha));
      ctx.fillStyle = bGrad;
      ctx.fill();

      if (beardStyle === 'boxed') {
        // Sharp angular razor edge along upper cheek line
        ctx.beginPath();
        ctx.moveTo(sideL.x, sideL.y);
        ctx.lineTo(mLeft.x - headW * 0.025, mLeft.y + cheekCurveDrop);
        ctx.moveTo(sideR.x, sideR.y);
        ctx.lineTo(mRight.x + headW * 0.025, mRight.y + cheekCurveDrop);
        ctx.strokeStyle = rgbStr(shadowRgb, opacity * 0.7);
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
    }
  }

  ctx.restore();
}

