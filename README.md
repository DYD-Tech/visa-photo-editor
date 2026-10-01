# 美签照片编辑器（US Visa Photo Editor）

免费的纯前端美国签证（DS-160）证件照制作工具。照片全程在浏览器本地处理，**不上传任何服务器**。

## 功能

- 上传自拍照或用摄像头拍摄，MediaPipe 人像分割自动抠图换纯白背景
- 人脸关键点 + 发顶检测，按头部占比 60%、眼位 62.5% 自动构图
- 实时合规检测：头部占比 50%~69%、眼睛距底边 56%~69%、有效分辨率、背景均匀度、JPEG < 240KB
- 导出 1000×1000 电子照（自动压缩到 240KB 内）与 4×6 英寸 300dpi 六连打印排版图

## 开发

```bash
npm install
npm run dev
```

## 部署到 GitHub Pages

仓库设置 → Pages → Build and deployment 选 **GitHub Actions**，推送到 main 即自动发布（见 `.github/workflows/deploy.yml`）。
