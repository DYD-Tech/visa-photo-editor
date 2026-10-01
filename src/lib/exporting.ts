import { SPEC } from './spec';
import type { EditState } from './process';

export function renderCrop(state: EditState, outSize: number): HTMLCanvasElement {
  const { composited, crop } = state;
  const out = document.createElement('canvas');
  out.width = outSize;
  out.height = outSize;
  const ctx = out.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, outSize, outSize);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(composited, crop.x, crop.y, crop.size, crop.size, 0, 0, outSize, outSize);
  return out;
}

export interface CheckItem {
  key: string;
  pass: boolean;
  args: Record<string, string | number>;
}

/** 头部占比 / 眼睛位置 / 原生分辨率，均由裁剪框直接推算。label/detail 文案由 UI 按 key+t() 渲染 */
export function geometricChecks(state: EditState): CheckItem[] {
  const { crop, metrics } = state;
  const headRatio = metrics.headH / crop.size;
  const eyeFromBottom = 1 - (metrics.eyeY - crop.y) / crop.size;
  const pct = (v: number) => (v * 100).toFixed(1);
  return [
    { key: 'head', pass: headRatio >= SPEC.headRatio[0] && headRatio <= SPEC.headRatio[1], args: { v: pct(headRatio) } },
    { key: 'eye', pass: eyeFromBottom >= SPEC.eyeFromBottom[0] && eyeFromBottom <= SPEC.eyeFromBottom[1], args: { v: pct(eyeFromBottom) } },
    { key: 'res', pass: crop.size >= SPEC.minNativeSize, args: { min: SPEC.minNativeSize, v: Math.round(crop.size) } },
  ];
}

/** 检查画面上部/两侧背景是否接近纯白且均匀（底部被肩颈占据，不采样） */
export function backgroundCheck(
  canvas: HTMLCanvasElement,
  sideLimitFrac: number,
): CheckItem {
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width;
  const H = canvas.height;
  const strip = Math.max(2, Math.floor(W * 0.02));
  const sideH = Math.max(strip, Math.floor(H * sideLimitFrac) - strip);
  const regions = [
    ctx.getImageData(0, 0, W, strip).data,
    ctx.getImageData(0, strip, strip, sideH).data,
    ctx.getImageData(W - strip, strip, strip, sideH).data,
  ];
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (const d of regions) {
    for (let i = 0; i < d.length; i += 16) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      sum += lum;
      sumSq += lum * lum;
      n++;
    }
  }
  const mean = sum / n;
  const std = Math.sqrt(Math.max(0, sumSq / n - mean * mean));
  return {
    key: 'bg',
    pass: mean >= SPEC.bgMinBrightness && std <= SPEC.bgMaxStdDev,
    args: { mean: mean.toFixed(0), std: std.toFixed(1) },
  };
}

/** 二分质量压缩到 240KB 以内 */
export async function compressJpegWithinLimit(
  canvas: HTMLCanvasElement,
): Promise<{ blob: Blob; quality: number }> {
  let lo = 0.3;
  let hi = 0.95;
  let best = await toBlob(canvas, hi);
  if (best.size <= SPEC.maxBytes) return { blob: best, quality: hi };
  let last = best;
  while (hi - lo > 0.02) {
    const mid = (lo + hi) / 2;
    const blob = await toBlob(canvas, mid);
    if (blob.size <= SPEC.maxBytes) {
      lo = mid;
      last = blob;
    } else {
      hi = mid;
    }
  }
  return { blob: last, quality: lo };
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      b => (b ? resolve(b) : reject(new Error('export_fail'))),
      'image/jpeg',
      quality,
    ),
  );
}

/** 打印排版规格：300dpi，每张 2×2 英寸（600px）。文案见 i18n 键 sheet.<id>.label/desc */
export interface SheetSpec {
  id: string;
  wIn: number;
  hIn: number;
  cols: number;
  rows: number;
}

export const SHEETS: SheetSpec[] = [
  { id: 'single', wIn: 2, hIn: 2, cols: 1, rows: 1 },
  { id: '4x6', wIn: 4, hIn: 6, cols: 2, rows: 3 },
  { id: '5x7', wIn: 5, hIn: 7, cols: 2, rows: 3 },
  { id: '6x8', wIn: 6, hIn: 8, cols: 3, rows: 4 },
  { id: 'a4', wIn: 8.27, hIn: 11.69, cols: 4, rows: 5 },
];

const DPI = 300;
const CELL = 600; // 2 英寸 @300dpi

/** 生成排版图：网格整体居中，四周留白 */
export function makeSheet(photo: HTMLCanvasElement, spec: SheetSpec): HTMLCanvasElement {
  const sheet = document.createElement('canvas');
  sheet.width = Math.round(spec.wIn * DPI);
  sheet.height = Math.round(spec.hIn * DPI);
  const ctx = sheet.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, sheet.width, sheet.height);
  const gridW = spec.cols * CELL;
  const gridH = spec.rows * CELL;
  const ox = Math.round((sheet.width - gridW) / 2);
  const oy = Math.round((sheet.height - gridH) / 2);
  for (let r = 0; r < spec.rows; r++) {
    for (let c = 0; c < spec.cols; c++) {
      ctx.drawImage(photo, ox + c * CELL, oy + r * CELL, CELL, CELL);
    }
  }
  return sheet;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
