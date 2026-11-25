#!/bin/sh
# 깃허브 업로드용: 완성 MP4에 썸네일(표지 이미지)을 넣는다. 다시 인코딩하지 않는다.
# 사용: sh tools/attach-thumbnail.sh <video.mp4> <초 | 이미지 파일> [출력.mp4]
#   두 번째 인자가 숫자면 그 시점의 프레임을 썸네일로 쓴다.
# ffmpeg가 필요하다(렌더링이 아닌 업로드 포장 단계에서만 쓴다).
# ※ 12주차 영상 튜토리얼의 썸네일 규격이 따로 있으면 그에 맞춰 이 스크립트를 고친다.
set -e
V="$1"; T="$2"; OUT="${3:-demo/$(basename "${V%.*}")-thumb.mp4}"
[ -f "$V" ] && [ -n "$T" ] || { echo "usage: sh tools/attach-thumbnail.sh <video.mp4> <초|이미지> [out.mp4]"; exit 1; }
command -v ffmpeg >/dev/null 2>&1 || { echo "ffmpeg가 필요합니다 (brew install ffmpeg)"; exit 1; }
mkdir -p "$(dirname "$OUT")"
THUMB="${OUT%.*}.jpg"
case "$T" in
  *[!0-9.]*) ffmpeg -hide_banner -loglevel error -y -i "$T" -q:v 2 "$THUMB" ;;
  *)         ffmpeg -hide_banner -loglevel error -y -ss "$T" -i "$V" -frames:v 1 -q:v 2 "$THUMB" ;;
esac
ffmpeg -hide_banner -loglevel error -y -i "$V" -i "$THUMB" -map 0 -map 1 -c copy -c:v:1 mjpeg \
  -disposition:v:1 attached_pic -movflags +faststart "$OUT"
echo "✓ 썸네일 $THUMB"
echo "✓ 영상 $OUT"
