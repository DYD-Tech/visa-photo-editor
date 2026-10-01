export const SPEC = {
  name: '美国签证 / DS-160',
  ratio: 1,
  // 官方允许输出 600x600 ~ 1200x1200，取中间值保证清晰度且不浪费体积
  exportSize: 1000,
  minNativeSize: 600,
  maxBytes: 240 * 1024,
  headRatio: [0.5, 0.69],
  // 眼睛位置：距画面底边 56% ~ 69%
  eyeFromBottom: [0.56, 0.69],
  targetHeadRatio: 0.6,
  targetEyeFromBottom: 0.625,
  bgMinBrightness: 225,
  bgMaxStdDev: 10,
};
