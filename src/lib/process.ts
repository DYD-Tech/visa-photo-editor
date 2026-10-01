import { SPEC } from './spec';
import { segmentAlpha, detectFace } from './vision';

export interface FaceMetrics {
  eyeY: number;
  centerX: number;
  chinY: number;
  hairTopY: number;
  headH: number;
}

export interface EditState {
  composited: HTMLCanvasElement;
  metrics: FaceMetrics;
  // 裁剪框：源图坐标系中的正方形
  crop: { x: number; y: number; size: number };
}

const MAX_SIDE = 1600;

export async function loadImage(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas;
}

/** 把人像合成到纯白背景上（alpha 可复用已计算的分割结果） */
export async function compositeOnWhite(
  source: HTMLCanvasElement,
  alpha?: Float32Array,
): Promise<HTMLCanvasElement> {
  alpha = alpha ?? (await segmentAlpha(source));
  const ctx = source.getContext('2d')!;
  const img = ctx.getImageData(0, 0, source.width, source.height);
  const d = img.data;
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    let a = alpha[p];
    a = a * a * (3 - 2 * a); // smoothstep，收一点边缘噪点
    d[i] = d[i] * a + 255 * (1 - a);
    d[i + 1] = d[i + 1] * a + 255 * (1 - a);
    d[i + 2] = d[i + 2] * a + 255 * (1 - a);
  }
  const out = document.createElement('canvas');
  out.width = source.width;
  out.height = source.height;
  out.getContext('2d')!.putImageData(img, 0, 0);
  return out;
}

/** 人脸关键点 + 分割 alpha 估算包含头发的头顶位置 */
export function computeMetrics(
  composited: HTMLCanvasElement,
  landmarks: Awaited<ReturnType<typeof detectFace>>,
  alpha: Float32Array,
): FaceMetrics {
  const W = composited.width;
  const H = composited.height;
  const chinY = landmarks[152].y * H;
  const meshTopY = landmarks[10].y * H;
  const eyeY = (landmarks[468].y + landmarks[473].y) / 2 * H;
  const centerX = (landmarks[468].x + landmarks[473].x) / 2 * W;

  const meshH = chinY - meshTopY;
  let hairTopY = meshTopY;
  const bandHalf = meshH * 0.6;
  const searchTop = Math.max(0, Math.floor(meshTopY - meshH * 1.6));
  outer: for (let y = searchTop; y <= Math.floor(meshTopY); y++) {
    const x0 = Math.max(0, Math.floor(centerX - bandHalf));
    const x1 = Math.min(W - 1, Math.ceil(centerX + bandHalf));
    for (let x = x0; x <= x1; x++) {
      if (alpha[y * W + x] > 0.55) {
        hairTopY = y;
        break outer;
      }
    }
  }
  return { eyeY, centerX, chinY, hairTopY, headH: chinY - hairTopY };
}

/** 依据头部占比与眼位目标自动求裁剪框 */
export function autoCrop(size: { w: number; h: number }, m: FaceMetrics) {
  const { w: W, h: H } = size;
  let cropSize = m.headH / SPEC.targetHeadRatio;
  cropSize = Math.min(cropSize, Math.min(W, H));
  const eyeFromTop = (1 - SPEC.targetEyeFromBottom) * cropSize;
  let y = m.eyeY - eyeFromTop;
  let x = m.centerX - cropSize / 2;
  x = Math.max(0, Math.min(W - cropSize, x));
  y = Math.max(0, Math.min(H - cropSize, y));
  return { x, y, size: cropSize };
}

export async function buildEditState(source: HTMLCanvasElement): Promise<EditState> {
  const alpha = await segmentAlpha(source);
  const composited = await compositeOnWhite(source, alpha);
  const landmarks = await detectFace(composited);
  const metrics = computeMetrics(composited, landmarks, alpha);
  return {
    composited,
    metrics,
    crop: autoCrop({ w: composited.width, h: composited.height }, metrics),
  };
}
