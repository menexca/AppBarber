import { FaceShape, HAIRCUT_CATALOG, HaircutStyle, FACE_SHAPE_INFO } from '../data/haircuts';

export interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
}

export interface VisagismMetrics {
  faceShape: FaceShape;
  confidence: number;
  lengthToWidthRatio: number;
  foreheadToCheekRatio: number;
  jawToCheekRatio: number;
  chinAngleDeg: number;
  yawDeg: number; // -90 = left profile, 0 = front, +90 = right profile
  pitchDeg: number;
  rollDeg: number;
  symmetryScore: number; // 0 - 100
  detectedView: 'front' | 'left' | 'right';
  recommendedStyles: HaircutStyle[];
  shapeDetails: (typeof FACE_SHAPE_INFO)[FaceShape];
}

function dist2D(a: NormalizedLandmark, b: NormalizedLandmark, aspect = 1): number {
  const dx = (a.x - b.x) * aspect;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function angleBetween(a: NormalizedLandmark, vertex: NormalizedLandmark, b: NormalizedLandmark, aspect = 1): number {
  const v1x = (a.x - vertex.x) * aspect;
  const v1y = a.y - vertex.y;
  const v2x = (b.x - vertex.x) * aspect;
  const v2y = b.y - vertex.y;
  const dot = v1x * v2x + v1y * v2y;
  const mag = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
  if (mag === 0) return 120;
  const cos = Math.max(-1, Math.min(1, dot / mag));
  return (Math.acos(cos) * 180) / Math.PI;
}

/**
 * Analyzes 478 MediaPipe Face Mesh landmarks and computes facial geometry,
 * head pose (yaw/pitch/roll), symmetry, and visagism classification.
 */
export function analyzeFaceLandmarks(
  landmarks: NormalizedLandmark[],
  aspectRatio = 0.75
): VisagismMetrics {
  // Key MediaPipe Face Mesh indices:
  // 10: Top of forehead (trichion approximation)
  // 152: Chin bottom (gnathion/menton)
  // 234: Left cheekbone / zygomatic arch outer
  // 454: Right cheekbone / zygomatic arch outer
  // 103: Left forehead temple (frontotemporale)
  // 332: Right forehead temple (frontotemporale)
  // 172: Left jaw angle (gonion)
  // 397: Right jaw angle (gonion)
  // 1: Nose tip
  // 33: Left eye outer corner, 263: Right eye outer corner

  const foreheadTop = landmarks[10] || { x: 0.5, y: 0.22, z: 0 };
  const chinBottom = landmarks[152] || { x: 0.5, y: 0.78, z: 0 };
  const cheekLeft = landmarks[234] || { x: 0.28, y: 0.5, z: 0 };
  const cheekRight = landmarks[454] || { x: 0.72, y: 0.5, z: 0 };
  const templeLeft = landmarks[103] || { x: 0.31, y: 0.32, z: 0 };
  const templeRight = landmarks[332] || { x: 0.69, y: 0.32, z: 0 };
  const jawLeft = landmarks[172] || { x: 0.33, y: 0.67, z: 0 };
  const jawRight = landmarks[397] || { x: 0.67, y: 0.67, z: 0 };
  const noseTip = landmarks[1] || { x: 0.5, y: 0.52, z: -0.05 };
  const eyeLeft = landmarks[33] || { x: 0.36, y: 0.42, z: 0 };
  const eyeRight = landmarks[263] || { x: 0.64, y: 0.42, z: 0 };

  // Estimate head yaw (-90 left profile to +90 right profile)
  const midCheekX = (cheekLeft.x + cheekRight.x) / 2;
  const cheekSpanX = Math.max(0.08, Math.abs(cheekRight.x - cheekLeft.x));
  const rawYaw = ((noseTip.x - midCheekX) / (cheekSpanX * 0.5)) * 75;
  const yawDeg = Math.max(-85, Math.min(85, Math.round(rawYaw)));

  // Estimate head roll (tilt) from eye line
  const rollDeg = Math.round(
    (Math.atan2(eyeRight.y - eyeLeft.y, (eyeRight.x - eyeLeft.x) * aspectRatio) * 180) / Math.PI
  );

  // Estimate head pitch from nose relative to eye-chin midpoint
  const eyeMidY = (eyeLeft.y + eyeRight.y) / 2;
  const faceVertSpan = Math.max(0.1, chinBottom.y - foreheadTop.y);
  const noseRelY = (noseTip.y - eyeMidY) / faceVertSpan;
  const pitchDeg = Math.round((noseRelY - 0.28) * 140);

  // Compute core geometric distances (include hair crown margin above point #10)
  const rawLength = dist2D(foreheadTop, chinBottom, aspectRatio) * 1.12;
  const cheekWidth = Math.max(0.05, dist2D(cheekLeft, cheekRight, aspectRatio));
  const foreheadWidth = dist2D(templeLeft, templeRight, aspectRatio) * 1.08;
  const jawWidth = dist2D(jawLeft, jawRight, aspectRatio) * 1.04;

  const lengthToWidthRatio = Number((rawLength / cheekWidth).toFixed(2));
  const foreheadToCheekRatio = Number((foreheadWidth / cheekWidth).toFixed(2));
  const jawToCheekRatio = Number((jawWidth / cheekWidth).toFixed(2));
  const chinAngleDeg = Math.round(angleBetween(jawLeft, chinBottom, jawRight, aspectRatio));

  // Symmetry score (when looking relatively frontal)
  const leftDist = dist2D(noseTip, cheekLeft, aspectRatio);
  const rightDist = dist2D(noseTip, cheekRight, aspectRatio);
  const symDiff = Math.abs(leftDist - rightDist) / Math.max(0.05, (leftDist + rightDist) / 2);
  const symmetryScore = Math.max(78, Math.min(99, Math.round(100 - symDiff * 35)));

  // Classify face shape
  let faceShape: FaceShape = 'Ovalado';
  let confidence = 89;

  if (lengthToWidthRatio >= 1.52) {
    faceShape = 'Alargado';
    confidence = 91;
  } else if (lengthToWidthRatio <= 1.31 && chinAngleDeg >= 122 && jawToCheekRatio < 0.88) {
    faceShape = 'Redondo';
    confidence = 90;
  } else if (jawToCheekRatio >= 0.89 && foreheadToCheekRatio >= 0.87 && chinAngleDeg >= 118) {
    faceShape = 'Cuadrado';
    confidence = 92;
  } else if (foreheadToCheekRatio < 0.83 && jawToCheekRatio < 0.82) {
    faceShape = 'Diamante';
    confidence = 88;
  } else if (Math.abs(foreheadToCheekRatio - jawToCheekRatio) >= 0.14) {
    faceShape = 'Triangular';
    confidence = 86;
  } else {
    faceShape = 'Ovalado';
    confidence = 93;
  }

  const detectedView: 'front' | 'left' | 'right' =
    yawDeg < -22 ? 'left' : yawDeg > 22 ? 'right' : 'front';

  const recommendedStyles = HAIRCUT_CATALOG.filter((h) => h.idealFaces.includes(faceShape));
  if (recommendedStyles.length === 0) {
    recommendedStyles.push(HAIRCUT_CATALOG[0]);
  }

  return {
    faceShape,
    confidence,
    lengthToWidthRatio,
    foreheadToCheekRatio,
    jawToCheekRatio,
    chinAngleDeg,
    yawDeg,
    pitchDeg,
    rollDeg,
    symmetryScore,
    detectedView,
    recommendedStyles,
    shapeDetails: FACE_SHAPE_INFO[faceShape],
  };
}

/**
 * Generates synthetic 478-point landmarks for a chosen face shape and yaw angle,
 * enabling interactive testing and training even without a live camera feed.
 */
export function createSyntheticLandmarks(
  shape: FaceShape,
  yawDeg = 0
): NormalizedLandmark[] {
  const pts: NormalizedLandmark[] = Array.from({ length: 478 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
  }));

  const presets: Record<
    FaceShape,
    { halfCheek: number; halfTemple: number; halfJaw: number; topY: number; chinY: number; jawY: number }
  > = {
    Ovalado: { halfCheek: 0.19, halfTemple: 0.165, halfJaw: 0.155, topY: 0.23, chinY: 0.76, jawY: 0.66 },
    Cuadrado: { halfCheek: 0.20, halfTemple: 0.185, halfJaw: 0.188, topY: 0.25, chinY: 0.74, jawY: 0.68 },
    Redondo: { halfCheek: 0.215, halfTemple: 0.175, halfJaw: 0.175, topY: 0.26, chinY: 0.73, jawY: 0.65 },
    Diamante: { halfCheek: 0.21, halfTemple: 0.145, halfJaw: 0.14, topY: 0.23, chinY: 0.76, jawY: 0.65 },
    Alargado: { halfCheek: 0.17, halfTemple: 0.155, halfJaw: 0.15, topY: 0.19, chinY: 0.80, jawY: 0.69 },
    Triangular: { halfCheek: 0.195, halfTemple: 0.145, halfJaw: 0.185, topY: 0.24, chinY: 0.75, jawY: 0.67 },
  };

  const p = presets[shape];
  const yawOffset = (yawDeg / 75) * p.halfCheek * 0.45;

  pts[10] = { x: 0.5 + yawOffset * 0.4, y: p.topY, z: 0 };
  pts[152] = { x: 0.5 + yawOffset * 0.4, y: p.chinY, z: 0 };
  pts[234] = { x: 0.5 - p.halfCheek + yawOffset * 0.2, y: 0.49, z: 0 };
  pts[454] = { x: 0.5 + p.halfCheek + yawOffset * 0.2, y: 0.49, z: 0 };
  pts[103] = { x: 0.5 - p.halfTemple + yawOffset * 0.25, y: p.topY + 0.08, z: 0 };
  pts[332] = { x: 0.5 + p.halfTemple + yawOffset * 0.25, y: p.topY + 0.08, z: 0 };
  pts[172] = { x: 0.5 - p.halfJaw + yawOffset * 0.25, y: p.jawY, z: 0 };
  pts[397] = { x: 0.5 + p.halfJaw + yawOffset * 0.25, y: p.jawY, z: 0 };
  pts[1] = { x: 0.5 + yawOffset, y: 0.52, z: -0.05 };
  pts[33] = { x: 0.5 - p.halfCheek * 0.55 + yawOffset * 0.6, y: 0.42, z: 0 };
  pts[263] = { x: 0.5 + p.halfCheek * 0.55 + yawOffset * 0.6, y: 0.42, z: 0 };
  // Eyebrow arches (70 left, 300 right)
  pts[70] = { x: 0.5 - p.halfTemple * 0.78 + yawOffset * 0.5, y: 0.37, z: 0 };
  pts[300] = { x: 0.5 + p.halfTemple * 0.78 + yawOffset * 0.5, y: 0.37, z: 0 };

  return pts;
}

