import { useCallback, useEffect, useRef, useState } from 'react';
import { SPEC } from './lib/spec';
import {
  loadImage,
  compositeOnWhite,
  computeMetrics,
  autoCrop,
  type EditState,
} from './lib/process';
import { segmentAlpha, detectFace, loadModels } from './lib/vision';
import {
  renderCrop,
  geometricChecks,
  backgroundCheck,
  compressJpegWithinLimit,
  makeSheet,
  SHEETS,
  downloadBlob,
  type CheckItem,
} from './lib/exporting';
import { I18nProvider, useI18n, type Key } from './lib/i18n';

type Step = 'guide' | 'confirm' | 'processing' | 'edit' | 'export';

const STEP_KEYS: { key: Step; titleKey: Key }[] = [
  { key: 'guide', titleKey: 'step.guide' },
  { key: 'confirm', titleKey: 'step.confirm' },
  { key: 'processing', titleKey: 'step.processing' },
  { key: 'edit', titleKey: 'step.edit' },
  { key: 'export', titleKey: 'step.export' },
];

const STAGE_KEYS: Key[] = [
  'processing.s1',
  'processing.s2',
  'processing.s3',
  'processing.s4',
  'processing.s5',
];

const SPEC_ROWS = ['size', 'head', 'eye', 'bg', 'recency', 'expr', 'glasses', 'headwear', 'file'];

const ERR_MAP: Record<string, Key> = {
  no_person: 'err.noPerson',
  no_face: 'err.noFace',
  export_fail: 'err.export',
};

interface LiveResult {
  checks: CheckItem[];
  blob: Blob;
  allPass: boolean;
}

export default function App() {
  return (
    <I18nProvider>
      <Wizard />
    </I18nProvider>
  );
}

function Wizard() {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>('guide');
  const [error, setError] = useState<Key | null>(null);
  const [original, setOriginal] = useState<HTMLCanvasElement | null>(null);
  const [state, setState] = useState<EditState | null>(null);
  const [live, setLive] = useState<LiveResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [cameraOpen, setCameraOpen] = useState(false);

  useEffect(() => {
    loadModels().catch(() => {});
  }, []);

  const receiveSource = useCallback(async (source: HTMLCanvasElement) => {
    setError(null);
    setOriginal(source);
    setStep('confirm');
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      if (!/^image\/(jpe?g|png|webp|bmp)$/i.test(file.type)) {
        setError('err.format');
        return;
      }
      try {
        const img = await loadImage(file);
        await receiveSource(img);
      } catch {
        setError('err.read');
      }
    },
    [receiveSource],
  );

  const busyRef = useRef(false);
  const startProcessing = async () => {
    if (!original || busyRef.current) return;
    busyRef.current = true;
    setError(null);
    setProgress(0);
    setStep('processing');
    // 在阻塞的 WASM 推理之间让出事件循环，使 React 能把进度渲染出来。
    // 不能用 rAF（后台标签页挂起）或 setTimeout（被节流到分钟级）；MessageChannel 不受节流影响
    const paint = () =>
      new Promise<void>(r => {
        const ch = new MessageChannel();
        ch.port1.onmessage = () => r();
        ch.port2.postMessage(0);
      });
    try {
      setProgress(1);
      await paint();
      const alpha = await segmentAlpha(original);
      setProgress(2);
      await paint();
      const composited = await compositeOnWhite(original, alpha);
      setProgress(3);
      await paint();
      const landmarks = await detectFace(composited);
      setProgress(4);
      await paint();
      const metrics = computeMetrics(composited, landmarks, alpha);
      setState({
        composited,
        metrics,
        crop: autoCrop({ w: composited.width, h: composited.height }, metrics),
      });
      setProgress(5);
      busyRef.current = false;
      setStep('edit');
    } catch (e) {
      busyRef.current = false;
      setError(ERR_MAP[e instanceof Error ? e.message : ''] ?? 'err.generic');
      setStep('confirm');
    }
  };

  const reset = () => {
    setState(null);
    setLive(null);
    setOriginal(null);
    setError(null);
    setStep('guide');
  };

  return (
    <div className="page">
      <header className="header">
        <div className="title-row">
          <h1>{t('app.title')}</h1>
          <LangSelect />
        </div>
        <p className="sub">{t('app.subtitle')}</p>
      </header>

      <Stepper current={step} />

      {error && <div className="error">{t(error)}</div>}

      {step === 'guide' && (
        <GuidePanel onFile={handleFile} onCamera={() => setCameraOpen(true)} />
      )}

      {step === 'confirm' && original && (
        <ConfirmPanel original={original} onBack={reset} onStart={startProcessing} />
      )}

      {step === 'processing' && <ProgressPanel done={progress} />}

      {step === 'edit' && state && (
        <EditPanel
          state={state}
          setState={setState}
          live={live}
          setLive={setLive}
          onNext={() => setStep('export')}
          onReset={reset}
        />
      )}

      {step === 'export' && state && live && (
        <ExportPanel state={state} live={live} onRetune={() => setStep('edit')} onReset={reset} />
      )}

      {cameraOpen && (
        <CameraModal
          onCapture={canvas => {
            setCameraOpen(false);
            receiveSource(canvas);
          }}
          onClose={() => setCameraOpen(false)}
        />
      )}

      <Footer />
    </div>
  );
}

function LangSelect() {
  const { lang, setLang } = useI18n();
  return (
    <select
      className="lang-select"
      value={lang}
      onChange={e => setLang(e.target.value as 'zh' | 'en')}
      aria-label={lang === 'zh' ? '语言' : 'Language'}
    >
      <option value="zh">中文</option>
      <option value="en">English</option>
    </select>
  );
}

function Stepper({ current }: { current: Step }) {
  const { t } = useI18n();
  const curIdx = STEP_KEYS.findIndex(s => s.key === current);
  return (
    <ol className="stepper">
      {STEP_KEYS.map((s, i) => (
        <li
          key={s.key}
          className={`step${i === curIdx ? ' active' : ''}${i < curIdx ? ' done' : ''}`}
        >
          <span className="dot">{i < curIdx ? '✓' : i + 1}</span>
          <span className="title">{t(s.titleKey)}</span>
        </li>
      ))}
    </ol>
  );
}

const OFFICIAL_URL =
  'https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/photos.html';

function GuidePanel({
  onFile,
  onCamera,
}: {
  onFile: (f: File) => void;
  onCamera: () => void;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const tips: { key: Key; ok: boolean }[] = [
    { key: 'guide.tip1', ok: true },
    { key: 'guide.tip2', ok: true },
    { key: 'guide.tip3', ok: true },
    { key: 'guide.tip4', ok: false },
    { key: 'guide.tip5', ok: false },
    { key: 'guide.tip6', ok: false },
  ];
  return (
    <div className="guide">
      <div className="guide-cols">
        <div className="guide-card">
          <h2>{t('guide.officialTitle')}</h2>
          <p className="muted">{t('guide.officialIntro')}</p>
          <table className="spec-table">
            <tbody>
              {SPEC_ROWS.map(name => (
                <tr key={name}>
                  <th>{t(`spec.${name}.label` as Key)}</th>
                  <td>{t(`spec.${name}` as Key)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <a className="official-link" href={OFFICIAL_URL} target="_blank" rel="noopener noreferrer">
            {t('guide.link')}
          </a>
        </div>
        <div className="guide-card">
          <h2>{t('guide.prepareTitle')}</h2>
          <p className="muted">{t('guide.prepareSub')}</p>
          <ul className="checklist">
            {tips.map(({ key, ok }) => (
              <li key={key} className={ok ? 'yes' : 'no'}>
                {t(key)}
              </li>
            ))}
          </ul>
          <div className="btn-row">
            <button className="primary" onClick={() => inputRef.current?.click()}>
              {t('guide.upload')}
            </button>
            <button onClick={onCamera}>{t('guide.camera')}</button>
          </div>
          <p className="muted small">{t('guide.recommend')}</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/bmp"
            hidden
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = '';
            }}
          />
        </div>
      </div>
      <div
        className={`dropzone${dragging ? ' dragging' : ''}`}
        onDragOver={e => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) onFile(f);
        }}
      >
        {t('guide.drop')}
      </div>
    </div>
  );
}

function ConfirmPanel({
  original,
  onBack,
  onStart,
}: {
  original: HTMLCanvasElement;
  onBack: () => void;
  onStart: () => void;
}) {
  const { t } = useI18n();
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    imgRef.current!.src = original.toDataURL('image/jpeg', 0.92);
  }, [original]);
  return (
    <div className="panel-center wide confirm">
      <h2>{t('confirm.title')}</h2>
      <img ref={imgRef} className="confirm-img" alt="preview" />
      <p className="muted small">{t('confirm.meta', { w: original.width, h: original.height })}</p>
      <div className="btn-row">
        <button onClick={onBack}>{t('confirm.reselect')}</button>
        <button className="primary" onClick={onStart}>
          {t('confirm.start')}
        </button>
      </div>
    </div>
  );
}

function ProgressPanel({ done }: { done: number }) {
  const { t } = useI18n();
  const pct = Math.round((done / STAGE_KEYS.length) * 100);
  return (
    <div className="panel-center">
      <h2>{t('processing.title')}</h2>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <ul className="progress-list">
        {STAGE_KEYS.map((key, i) => {
          const isDone = done > i;
          const isCurrent = !isDone && done === i;
          return (
            <li key={key} className={isDone ? 'done' : isCurrent ? 'current' : 'todo'}>
              <span className="icon">
                {isDone ? '✓' : isCurrent ? <i className="spinner sm" /> : '·'}
              </span>
              {t(key)}
            </li>
          );
        })}
      </ul>
      <p className="muted small">{t('processing.privacy')}</p>
    </div>
  );
}

function EditPanel({
  state,
  setState,
  live,
  setLive,
  onNext,
  onReset,
}: {
  state: EditState;
  setState: (s: EditState) => void;
  live: LiveResult | null;
  setLive: (r: LiveResult | null) => void;
  onNext: () => void;
  onReset: () => void;
}) {
  const { t } = useI18n();
  const previewRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const DISPLAY = 380;
  const { crop, metrics } = state;

  useEffect(() => {
    const canvas = renderCrop(state, DISPLAY);
    const ctx = previewRef.current!.getContext('2d')!;
    ctx.clearRect(0, 0, DISPLAY, DISPLAY);
    ctx.drawImage(canvas, 0, 0);
  }, [state]);

  // 实时合规检测：防抖，随拖动/缩放持续更新
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      const photo = renderCrop(state, SPEC.exportSize);
      const chinFrac = Math.min(0.95, Math.max(0.2, (metrics.chinY - crop.y) / crop.size));
      const checks = geometricChecks(state);
      checks.push(backgroundCheck(photo, chinFrac));
      const { blob } = await compressJpegWithinLimit(photo);
      checks.push({
        key: 'size',
        pass: blob.size <= SPEC.maxBytes,
        args: { max: SPEC.maxBytes / 1024, v: (blob.size / 1024).toFixed(0) },
      });
      if (!cancelled) {
        setLive({ checks, blob, allPass: checks.every(c => c.pass) });
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [state, setLive]);

  const setCrop = (x: number, y: number, size: number) =>
    setState({ ...state, crop: { x, y, size } });

  const zoomTo = (newSize: number) => {
    const f = newSize / crop.size;
    setCrop(
      metrics.centerX - (metrics.centerX - crop.x) * f,
      metrics.eyeY - (metrics.eyeY - crop.y) * f,
      newSize,
    );
  };

  const doAuto = () => {
    const c = autoCrop({ w: state.composited.width, h: state.composited.height }, metrics);
    setCrop(c.x, c.y, c.size);
  };

  const yPct = (srcY: number) => ((srcY - crop.y) / crop.size) * 100;
  const eyeBandTop = (1 - SPEC.eyeFromBottom[1]) * 100;
  const eyeBandBottom = (1 - SPEC.eyeFromBottom[0]) * 100;

  return (
    <div className="editor">
      <div className="preview-card">
        <div
          className="preview"
          style={{ width: DISPLAY, height: DISPLAY }}
          onPointerDown={e => {
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            dragRef.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerMove={e => {
            if (!dragRef.current) return;
            const k = crop.size / DISPLAY;
            const dx = (e.clientX - dragRef.current.x) * k;
            const dy = (e.clientY - dragRef.current.y) * k;
            dragRef.current = { x: e.clientX, y: e.clientY };
            setCrop(crop.x - dx, crop.y - dy, crop.size);
          }}
          onPointerUp={() => (dragRef.current = null)}
          onWheel={e => zoomTo(crop.size * (e.deltaY > 0 ? 1.06 : 0.94))}
        >
          <canvas ref={previewRef} width={DISPLAY} height={DISPLAY} />
          <div
            className="band eye-band"
            style={{ top: `${eyeBandTop}%`, height: `${eyeBandBottom - eyeBandTop}%` }}
            title={t('edit.bandTitle')}
          />
          <div className="line head-top" style={{ top: `${yPct(metrics.hairTopY)}%` }} title={t('edit.headTopTitle')} />
          <div className="line chin" style={{ top: `${yPct(metrics.chinY)}%` }} title={t('edit.chinTitle')} />
        </div>
        <div className="controls">
          <label>
            {t('edit.zoom')}
            <input
              type="range"
              min={0.4}
              max={2.2}
              step={0.01}
              value={crop.size / (metrics.headH / SPEC.targetHeadRatio)}
              onChange={e => zoomTo((metrics.headH / SPEC.targetHeadRatio) * Number(e.target.value))}
            />
          </label>
          <button onClick={doAuto}>{t('edit.auto')}</button>
          <span className="muted">{t('edit.hint')}</span>
        </div>
      </div>

      <div className="panel">
        <h3>{t('edit.checkTitle')}</h3>
        {!live && (
          <p className="muted">
            <i className="spinner sm" /> {t('edit.checking')}
          </p>
        )}
        <ul className="checks">
          {(live?.checks ?? []).map(c => (
            <li key={c.key} className={c.pass ? 'pass' : 'fail'}>
              <span className="icon">{c.pass ? '✓' : '✕'}</span>
              <div>
                <strong>{t(`check.${c.key}` as Key, c.args)}</strong>
                <p>{t(`check.${c.key}.detail` as Key, c.args)}</p>
                {!c.pass && <p className="advice">{t(`advice.${c.key}` as Key)}</p>}
              </div>
            </li>
          ))}
        </ul>
        {live &&
          (live.allPass ? (
            <p className="allpass">{t('edit.allpass')}</p>
          ) : (
            <p className="somefail">{t('edit.somefail')}</p>
          ))}
        <div className="btn-col">
          <button className="primary" disabled={!live?.allPass} onClick={onNext}>
            {t('edit.next')}
          </button>
          <button onClick={onReset}>{t('edit.reset')}</button>
        </div>
      </div>
    </div>
  );
}

function ExportPanel({
  state,
  live,
  onRetune,
  onReset,
}: {
  state: EditState;
  live: LiveResult;
  onRetune: () => void;
  onReset: () => void;
}) {
  const { t } = useI18n();
  const downloadSheet = (specId: string) => {
    const spec = SHEETS.find(s => s.id === specId)!;
    const photo = renderCrop(state, spec.id === 'single' ? SPEC.exportSize : 600);
    const sheet = makeSheet(photo, spec);
    sheet.toBlob(
      b => b && downloadBlob(b, `us-visa-${spec.id}.jpg`),
      'image/jpeg',
      0.95,
    );
  };

  return (
    <div className="panel-center wide">
      <h2>{t('export.title')}</h2>
      <div className="export-cards">
        <div className="export-card highlight">
          <h3>{t('export.digitalTitle')}</h3>
          <p className="muted">
            {t('export.digitalMeta', {
              size: SPEC.exportSize,
              kb: (live.blob.size / 1024).toFixed(0),
            })}
          </p>
          <button
            className="primary"
            onClick={() => downloadBlob(live.blob, 'us-visa-photo-1000x1000.jpg')}
          >
            {t('export.digitalBtn')}
          </button>
        </div>
        {SHEETS.map(s => (
          <div className="export-card" key={s.id}>
            <h3>{t(`sheet.${s.id}.label` as Key)}</h3>
            <p className="muted">{t(`sheet.${s.id}.desc` as Key)}</p>
            <button onClick={() => downloadSheet(s.id)}>{t('export.download')}</button>
          </div>
        ))}
      </div>
      <div className="btn-row">
        <button onClick={onRetune}>{t('export.retune')}</button>
        <button onClick={onReset}>{t('export.again')}</button>
      </div>
    </div>
  );
}

function CameraModal({
  onCapture,
  onClose,
}: {
  onCapture: (canvas: HTMLCanvasElement) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 } } })
      .then(stream => {
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        videoRef.current!.srcObject = stream;
      })
      .catch(() => onClose());
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [onClose]);

  const capture = () => {
    const video = videoRef.current!;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    onCapture(canvas);
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="camera-wrap">
          <video ref={videoRef} autoPlay muted playsInline />
          <div className="camera-guide" />
        </div>
        <p className="muted small center">{t('camera.guide')}</p>
        <div className="btn-row">
          <button className="primary" onClick={capture}>
            {t('camera.capture')}
          </button>
          <button onClick={onClose}>{t('camera.cancel')}</button>
        </div>
      </div>
    </div>
  );
}

function Footer() {
  const { t } = useI18n();
  return (
    <footer className="footer">
      <p>
        {t('footer.note')}
        {' '}
        <a href={OFFICIAL_URL} target="_blank" rel="noopener noreferrer">
          {t('footer.link')}
        </a>
        {t('footer.tail')}
      </p>
    </footer>
  );
}
