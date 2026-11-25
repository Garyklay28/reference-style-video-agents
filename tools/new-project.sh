#!/bin/sh
# 새 영상 프로젝트 폴더를 만든다: projects/<slug>/
# 사용: sh tools/new-project.sh <slug> "<주제>" "<레퍼런스 영상 주소 또는 파일>"
set -e
cd "$(dirname "$0")/.."
SLUG="$1"; TOPIC="$2"; REF="$3"
if [ -z "$SLUG" ] || [ -z "$TOPIC" ]; then
  echo 'usage: sh tools/new-project.sh <slug> "<주제>" "<레퍼런스>"'; exit 1
fi
case "$SLUG" in *[!a-z0-9-]*) echo "slug는 영문 소문자·숫자·- 만 씁니다"; exit 1;; esac
P="projects/$SLUG"
[ -e "$P" ] && { echo "$P 가 이미 있습니다"; exit 1; }
[ -s vendor/three.min.js ] || sh tools/setup.sh --no-models
cp -R projects/_template "$P"
rm -f "$P/timing.js"   # timing.js는 build-timing.mjs가 만든다
mkdir -p "$P/lib" "$P/assets/voice" "$P/assets/sfx" "$P/assets/music" "$P/assets/fonts" \
         "$P/analysis/frames" "$P/research" "$P/tmp/takes" "$P/out" "$P/qa"
cp vendor/three.min.js "$P/lib/three.min.js"
cat > "$P/brief.md" <<EOF
# 브리프

- 주제: $TOPIC
- 레퍼런스: ${REF:-（미정）}
- 만든 날: $(date +%Y-%m-%d)

## 사용자 요구 사항
- （사용자의 요청을 옮겨 적는다）
EOF
printf '# 진행 상황\n\n| 단계 | 담당 | 상태 | 산출물 | 메모 |\n|---|---|---|---|---|\n' > "$P/STATUS.md"
echo "✓ $P"
