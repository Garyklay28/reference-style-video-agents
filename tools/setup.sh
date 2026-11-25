#!/bin/sh
# 준비물 다운로드: Supertonic 2 음성 합성 모델(약 270MB)과 three.js
# 사용: sh tools/setup.sh            모델 + three.js
#       sh tools/setup.sh --no-models three.js만
set -e
cd "$(dirname "$0")/.."

command -v node >/dev/null 2>&1 || { echo "Node.js가 필요합니다 (https://nodejs.org)"; exit 1; }
echo "node $(node -v)"

mkdir -p vendor
THREE=0.160.0
if [ ! -s vendor/three.min.js ]; then
  curl -fsSL -o vendor/three.min.js "https://cdn.jsdelivr.net/npm/three@$THREE/build/three.min.js"
fi
mkdir -p projects/_template/lib && cp vendor/three.min.js projects/_template/lib/three.min.js
echo "✓ vendor/three.min.js (three@$THREE, MIT)"

[ "$1" = "--no-models" ] && exit 0

SK=.claude/skills/reference-style-video/scripts/assets
HF=https://huggingface.co/Supertone/supertonic-2/resolve/main
mkdir -p "$SK/onnx" "$SK/voice_styles"
for f in tts.json unicode_indexer.json duration_predictor.onnx text_encoder.onnx vector_estimator.onnx vocoder.onnx; do
  if [ ! -s "$SK/onnx/$f" ]; then echo "↓ onnx/$f"; curl -fL --progress-bar -o "$SK/onnx/$f" "$HF/onnx/$f"; fi
done
for v in F1 F2 F3 F4 F5 M1 M2 M3 M4 M5; do
  [ -s "$SK/voice_styles/$v.json" ] || curl -fsSL -o "$SK/voice_styles/$v.json" "$HF/voice_styles/$v.json"
done
[ -s "$SK/SUPERTONIC_LICENSE" ] || curl -fsSL -o "$SK/SUPERTONIC_LICENSE" "$HF/LICENSE"
echo "✓ Supertonic 2 → $SK (OpenRAIL 라이선스: 공개 전에 $SK/SUPERTONIC_LICENSE 확인)"
echo "  모델 파일은 .gitignore 대상입니다. 깃허브에 올리지 마세요."
