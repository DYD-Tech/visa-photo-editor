import {
  FilesetResolver,
  ImageSegmenter,
  FaceLandmarker,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';

const WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const SEGMENTER_MODEL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';
const FACELM_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

let segmenterPromise: Promise<ImageSegmenter> | null = null;
let landmarkerPromise: Promise<FaceLandmarker> | null = null;

function createWithFallback<T>(
  build: (fileset: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>, delegate: 'GPU' | 'CPU') => Promise<T>,
): Promise<T> {
  return FilesetResolver.forVisionTasks(WASM_URL).then(async fileset => {
    try {
      return await build(fileset, 'GPU');
    } catch {
      return build(fileset, 'CPU');
    }
  });
}

export function loadModels() {
  if (!segmenterPromise) {
    segmenterPromise = createWithFallback((fileset, delegate) =>
      ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: SEGMENTER_MODEL, delegate },
        runningMode: 'IMAGE',
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      }),
    );
  }
  if (!landmarkerPromise) {
    landmarkerPromise = createWithFallback((fileset, delegate) =>
      FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: FACELM_MODEL, delegate },
        runningMode: 'IMAGE',
        numFaces: 1,
      }),
    );
  }
  return Promise.all([segmenterPromise, landmarkerPromise]);
}

/** 人像分割，返回与画布同尺寸的 alpha 通道（0..1，人像为 1） */
export async function segmentAlpha(
  source: HTMLCanvasElement,
): Promise<Float32Array> {
  const segmenter = await (await loadModels())[0];
  const result = segmenter.segment(source);
  const mask = result.confidenceMasks?.[0];
  if (!mask) throw new Error('no_person');
  const { width, height } = mask;
  const data = mask.getAsFloat32Array();
  mask.close();
  if (width === source.width && height === source.height) {
    return Float32Array.from(data);
  }
  // 模型输出尺寸可能与输入不同，双线性放大回原尺寸
  const out = new Float32Array(source.width * source.height);
  for (let y = 0; y < source.height; y++) {
    const my = Math.min(height - 1, Math.max(0, ((y + 0.5) * height) / source.height - 0.5));
    const y0 = Math.floor(my);
    const fy = my - y0;
    const y1 = Math.min(height - 1, y0 + 1);
    for (let x = 0; x < source.width; x++) {
      const mx = Math.min(width - 1, Math.max(0, ((x + 0.5) * width) / source.width - 0.5));
      const x0 = Math.floor(mx);
      const fx = mx - x0;
      const x1 = Math.min(width - 1, x0 + 1);
      const v00 = data[y0 * width + x0];
      const v01 = data[y0 * width + x1];
      const v10 = data[y1 * width + x0];
      const v11 = data[y1 * width + x1];
      out[y * source.width + x] =
        (v00 * (1 - fx) + v01 * fx) * (1 - fy) + (v10 * (1 - fx) + v11 * fx) * fy;
    }
  }
  return out;
}

export async function detectFace(
  source: HTMLCanvasElement,
): Promise<NormalizedLandmark[]> {
  const landmarker = await (await loadModels())[1];
  const result = landmarker.detect(source);
  if (!result.faceLandmarks.length) throw new Error('no_face');
  return result.faceLandmarks[0];
}
