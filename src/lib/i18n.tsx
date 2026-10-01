import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Lang = 'zh' | 'en';

const STORAGE_KEY = 'app.lang';

export function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'zh' || saved === 'en') return saved;
  } catch {}
  return (navigator.language || 'en').toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export const dict = {
  zh: {
    'app.title': '美签照片编辑器',
    'app.subtitle': '免费 · 纯浏览器本地处理 · 照片不上传任何服务器 · 符合 DS-160 电子照片规格',
    'app.docTitle': '美签照片编辑器 · 免费纯前端制作 DS-160 证件照',
    'step.guide': '拍摄引导',
    'step.confirm': '预览确认',
    'step.processing': 'AI 处理',
    'step.edit': '微调与检测',
    'step.export': '下载',

    'guide.officialTitle': '美国签证照片官方要求',
    'guide.officialIntro': '依据美国国务院规定，本工具每一步检测都对照下表执行。',
    'guide.link': '查看美国国务院官方照片要求页面 ↗',
    'guide.prepareTitle': '准备一张合格的原照',
    'guide.prepareSub': 'AI 无法凭空造出合规照片，拍摄到位就成功了一大半。',
    'guide.tip1': '面对白墙或纯色墙，光线均匀（面光，不要侧光阴影）',
    'guide.tip2': '正对镜头、平视、中性表情、露出双耳和完整头顶',
    'guide.tip3': '穿深色有领衣服，与白色背景形成对比',
    'guide.tip4': '摘下眼镜（美签明确规定不可佩戴）',
    'guide.tip5': '不戴帽子头饰（宗教头巾需露出完整面部）',
    'guide.tip6': '不用美颜滤镜、不修图（过度磨皮会被拒）',
    'guide.upload': '上传照片',
    'guide.camera': '摄像头拍摄',
    'guide.recommend': '推荐：请他人用后置摄像头在 1~2 米外平拍，比自拍畸变更小。',
    'guide.drop': '或将照片拖到这里',

    'spec.size.label': '尺寸',
    'spec.size': '2×2 英寸（51×51 毫米）正方形；数字版 600×600 ~ 1200×1200 像素',
    'spec.head.label': '头部占比',
    'spec.head': '头顶到下巴占画面高度 50% ~ 69%',
    'spec.eye.label': '眼睛位置',
    'spec.eye': '距照片底边 56% ~ 69%（35 ~ 45 毫米）',
    'spec.bg.label': '背景',
    'spec.bg': '纯白或接近白色的纯色背景，无阴影、无纹理、无人物',
    'spec.recency.label': '拍摄时间',
    'spec.recency': '最近 6 个月内，能代表当前样貌',
    'spec.expr.label': '表情姿态',
    'spec.expr': '面部正对镜头，中性表情或自然的闭嘴微笑',
    'spec.glasses.label': '眼镜',
    'spec.glasses': '不得佩戴（医学原因需附医生证明）',
    'spec.headwear.label': '头饰着装',
    'spec.headwear': '仅限日常佩戴的宗教头饰，且面部不得有阴影；不得穿制服',
    'spec.file.label': '数字文件',
    'spec.file': 'JPEG 彩色，≤ 240KB；不接受扫描件和修图滤镜',

    'confirm.title': '照片上传成功，请确认',
    'confirm.meta': '原始尺寸 {w}×{h}，仅在本机显示，未上传任何服务器。',
    'confirm.reselect': '重新选择',
    'confirm.start': '开始 AI 处理',

    'processing.title': '正在本地处理',
    'processing.s1': '读取照片',
    'processing.s2': 'AI 抠图（人像分割）',
    'processing.s3': '合成纯白背景',
    'processing.s4': '人脸关键点定位',
    'processing.s5': '按官方规格自动构图',
    'processing.privacy': '全部计算在你的浏览器内完成，照片不会离开这台设备。',

    'edit.zoom': '缩放',
    'edit.auto': '重新自动构图',
    'edit.hint': '拖动画面平移，滚轮缩放',
    'edit.bandTitle': '眼睛应落在此绿带内（距底边 56%~69%）',
    'edit.headTopTitle': '头顶（含头发）',
    'edit.chinTitle': '下巴底端',
    'edit.checkTitle': '合规检测 · 实时',
    'edit.checking': '检测中…',
    'edit.allpass': '全部符合规格，可以进入下载。',
    'edit.somefail': '存在不符合项，按建议调整左侧构图后自动重新检测。',
    'edit.next': '下一步：下载',
    'edit.reset': '换一张照片',

    'check.head': '头部占比 50.0%~69.0%',
    'check.head.detail': '当前 {v}%',
    'check.eye': '眼睛位置（距底边）56.0%~69.0%',
    'check.eye.detail': '当前 {v}%',
    'check.res': '有效分辨率 ≥ {min}px',
    'check.res.detail': '源图可用 {v}px',
    'check.bg': '背景纯净均匀',
    'check.bg.detail': '边缘亮度 {mean}，均匀度 σ={std}',
    'check.size': '文件大小 < {max}KB',
    'check.size.detail': '当前 {v}KB',
    'advice.head': '调整缩放：让两条橙色虚线（头顶到下巴）的间距占画面的 50%~69%',
    'advice.eye': '上下拖动画框：让双眼落在绿色带内（距底边 56%~69%）',
    'advice.res': '源图放大后有效像素不足 600，请换一张更高分辨率的照片重新制作',
    'advice.bg': '背景不够白或有阴影/杂物：建议面对白墙重拍；若头发超出画面上边缘，请缩小构图',
    'advice.size': '通常会自动压缩达标；若仍超标，减少画面细节（如缩小构图）',

    'export.title': '下载成品',
    'export.digitalTitle': '网签电子照',
    'export.digitalMeta': 'JPEG · {size}×{size} 像素 · {kb}KB · DS-160 在线申请直接上传',
    'export.digitalBtn': '下载电子照',
    'export.download': '下载',
    'export.retune': '返回微调',
    'export.again': '再做一张',
    'sheet.single.label': '单张 2×2 英寸',
    'sheet.single.desc': '600×600 · 300dpi · 自由裁剪',
    'sheet.4x6.label': '4×6 英寸 六连',
    'sheet.4x6.desc': '2 列 × 3 张 · 照相馆/便利店最常见相纸',
    'sheet.5x7.label': '5×7 英寸 六连',
    'sheet.5x7.desc': '2 列 × 3 张 · 带白边，留足裁剪余量',
    'sheet.6x8.label': '6×8 英寸 十二连',
    'sheet.6x8.desc': '3 列 × 4 张 · 一次多备',
    'sheet.a4.label': 'A4 二十连',
    'sheet.a4.desc': '4 列 × 5 张 · 家用打印机 A4 相纸',

    'camera.guide': '头部对准椭圆引导框，头顶上方留少量空间，身体坐直正对镜头',
    'camera.capture': '拍摄',
    'camera.cancel': '取消',

    'footer.note': '照片规格依据美国国务院（U.S. Department of State）',
    'footer.link': '官方照片要求',
    'footer.tail': '。本工具结果仅供参考，最终以使领馆审核为准。',

    'err.format': '暂仅支持 JPG / PNG / WebP / BMP，苹果 HEIC 请先转换格式',
    'err.read': '无法读取该图片文件',
    'err.noPerson': '未检测到人像，请上传包含完整面部的照片',
    'err.noFace': '未检测到人脸，请使用正面清晰照片',
    'err.export': '导出失败',
    'err.generic': '处理失败，请换一张照片重试',
  },
  en: {
    'app.title': 'US Visa Photo Editor',
    'app.subtitle':
      'Free · 100% in-browser processing · Photos never leave your device · Meets DS-160 digital photo specs',
    'app.docTitle': 'US Visa Photo Editor · Free in-browser DS-160 photo maker',
    'step.guide': 'Guidelines',
    'step.confirm': 'Preview',
    'step.processing': 'AI Processing',
    'step.edit': 'Adjust & Check',
    'step.export': 'Download',

    'guide.officialTitle': 'Official US Visa Photo Requirements',
    'guide.officialIntro':
      'Based on U.S. Department of State rules. Every check in this tool follows the table below.',
    'guide.link': 'View the official State Department photo page ↗',
    'guide.prepareTitle': 'Start with a compliant photo',
    'guide.prepareSub': 'AI cannot invent compliance — a well-taken photo is half the job.',
    'guide.tip1': 'Face a white or plain wall with even, front lighting (no side shadows)',
    'guide.tip2': 'Look straight into the camera, neutral expression, full head and ears visible',
    'guide.tip3': 'Wear dark, collared clothing that contrasts with the white background',
    'guide.tip4': 'Remove glasses (prohibited for US visa photos)',
    'guide.tip5': 'No hats or headwear (religious head coverings must leave the full face visible)',
    'guide.tip6': 'No beauty filters or retouching (heavy smoothing gets rejected)',
    'guide.upload': 'Upload Photo',
    'guide.camera': 'Use Camera',
    'guide.recommend':
      'Best: have someone shoot you with a rear camera from 1–2 m away — less distortion than selfies.',
    'guide.drop': 'or drop your photo here',

    'spec.size.label': 'Size',
    'spec.size': '2×2 in (51×51 mm) square; digital 600×600 to 1200×1200 pixels',
    'spec.head.label': 'Head size',
    'spec.head': 'Hair top to chin: 50% – 69% of photo height',
    'spec.eye.label': 'Eye position',
    'spec.eye': '56% – 69% from the bottom edge (35 – 45 mm)',
    'spec.bg.label': 'Background',
    'spec.bg': 'Plain white or near-white; no shadows, patterns, or people',
    'spec.recency.label': 'Recency',
    'spec.recency': 'Taken within the last 6 months',
    'spec.expr.label': 'Expression',
    'spec.expr': 'Face the camera directly; neutral or natural closed-mouth smile',
    'spec.glasses.label': 'Glasses',
    'spec.glasses': 'Not allowed (medical exception requires a doctor’s note)',
    'spec.headwear.label': 'Attire',
    'spec.headwear':
      'Religious headwear worn daily only, no facial shadows; no uniforms',
    'spec.file.label': 'Digital file',
    'spec.file': 'Color JPEG ≤ 240KB; scans and filter-retouched images not accepted',

    'confirm.title': 'Photo uploaded — please confirm',
    'confirm.meta': 'Original size {w}×{h}. Shown only on this device, never uploaded.',
    'confirm.reselect': 'Choose Another',
    'confirm.start': 'Start AI Processing',

    'processing.title': 'Processing locally',
    'processing.s1': 'Loading photo',
    'processing.s2': 'AI cutout (portrait segmentation)',
    'processing.s3': 'Compositing on pure white',
    'processing.s4': 'Locating facial landmarks',
    'processing.s5': 'Auto-framing to official specs',
    'processing.privacy': 'All computation happens in your browser. Your photo never leaves this device.',

    'edit.zoom': 'Zoom',
    'edit.auto': 'Re-frame automatically',
    'edit.hint': 'Drag to pan, scroll to zoom',
    'edit.bandTitle': 'Eyes should fall inside this green band (56%–69% from bottom)',
    'edit.headTopTitle': 'Top of head (incl. hair)',
    'edit.chinTitle': 'Chin bottom',
    'edit.checkTitle': 'Compliance Check · Live',
    'edit.checking': 'Checking…',
    'edit.allpass': 'All checks passed. Ready to download.',
    'edit.somefail': 'Some checks failed — adjust the framing as advised; it re-checks automatically.',
    'edit.next': 'Next: Download',
    'edit.reset': 'Start Over',

    'check.head': 'Head size 50.0%–69.0%',
    'check.head.detail': 'Now {v}%',
    'check.eye': 'Eye position (from bottom) 56.0%–69.0%',
    'check.eye.detail': 'Now {v}%',
    'check.res': 'Effective resolution ≥ {min}px',
    'check.res.detail': 'Source provides {v}px',
    'check.bg': 'Background clean & uniform',
    'check.bg.detail': 'Edge brightness {mean}, uniformity σ={std}',
    'check.size': 'File size < {max}KB',
    'check.size.detail': 'Now {v}KB',
    'advice.head':
      'Adjust zoom: the gap between the two orange dashed lines (hair top to chin) should be 50%–69% of the frame',
    'advice.eye': 'Drag the frame up/down so both eyes sit inside the green band (56%–69% from bottom)',
    'advice.res': 'Too few native pixels when enlarged — use a higher-resolution photo',
    'advice.bg':
      'Background not pure white or has shadows/objects: reshoot against a white wall; if hair touches the top edge, zoom out',
    'advice.size': 'Usually compressed automatically; if still over, reduce detail (e.g. zoom out)',

    'export.title': 'Download Your Photos',
    'export.digitalTitle': 'Digital Photo (DS-160 upload)',
    'export.digitalMeta': 'JPEG · {size}×{size} px · {kb}KB · ready for online application',
    'export.digitalBtn': 'Download Digital',
    'export.download': 'Download',
    'export.retune': 'Back to Adjust',
    'export.again': 'Make Another',
    'sheet.single.label': 'Single 2×2 inch',
    'sheet.single.desc': '600×600 · 300dpi · crop freely',
    'sheet.4x6.label': '4×6 in · 6-up',
    'sheet.4x6.desc': '2 cols × 3 · the most common photo-paper size',
    'sheet.5x7.label': '5×7 in · 6-up',
    'sheet.5x7.desc': '2 cols × 3 · white border for easy cutting',
    'sheet.6x8.label': '6×8 in · 12-up',
    'sheet.6x8.desc': '3 cols × 4 · keep spares on hand',
    'sheet.a4.label': 'A4 · 20-up',
    'sheet.a4.desc': '4 cols × 5 · home printer on A4 photo paper',

    'camera.guide': 'Align your head with the oval guide, leave a little space above, sit straight facing the camera',
    'camera.capture': 'Capture',
    'camera.cancel': 'Cancel',

    'footer.note': 'Specifications follow the U.S. Department of State',
    'footer.link': 'official photo requirements',
    'footer.tail': '. Results are for reference only; final acceptance is up to the consulate.',

    'err.format': 'Only JPG / PNG / WebP / BMP are supported (convert HEIC first)',
    'err.read': 'Cannot read this image file',
    'err.noPerson': 'No person detected — please use a photo showing a complete face',
    'err.noFace': 'No face detected — please use a clear, front-facing photo',
    'err.export': 'Export failed',
    'err.generic': 'Processing failed, please try another photo',
  },
} as const;

type Dict = (typeof dict)['zh'];
export type Key = keyof Dict;

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: Key, params?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.title = dict[lang]['app.docTitle'];
  }, [lang]);

  const t = useCallback(
    (key: Key, params?: Record<string, string | number>) => {
      let s: string = dict[lang][key] ?? dict.zh[key] ?? String(key);
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          s = s.split(`{${k}}`).join(String(v));
        }
      }
      return s;
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useI18n outside provider');
  return ctx;
}
