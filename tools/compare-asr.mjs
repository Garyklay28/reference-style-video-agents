// 받아쓰기(ASR) 결과를 대본과 비교해 일치하는 음성 벌(take)을 고른다.
// 사용: node tools/compare-asr.mjs <project> <asr.json> [--apply] [--tol N]
//   asr.json  asr.html의 window.out을 저장한 것: { "<wav 경로>": "<받아쓴 문장>" }
//             파일 이름은 <id>_<번호>.wav (음성 벌) 또는 <id>.wav (완성본 구간)
//   --apply   일치한 벌을 script.json의 take 필드에 기록한다 (build-timing.mjs가 읽는다)
//   --tol N   허용 편집 거리(기본 0 = 공백·문장부호를 뺀 글자가 완전히 같아야 함)
// 결과: <project>/analysis/asr-check.json, 불일치 문장이 있으면 종료 코드 1
import fs from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const [proj, asrFile] = args.filter((a) => !a.startsWith('--') && !/^\d+$/.test(a));
const apply = args.includes('--apply');
const tol = +(args[args.indexOf('--tol') + 1] ?? 0) || 0;
if (!proj || !asrFile) { console.error('usage: node tools/compare-asr.mjs <project> <asr.json> [--apply] [--tol N]'); process.exit(2); }

const scriptPath = path.join(proj, 'script.json');
const lines = JSON.parse(await fs.readFile(scriptPath, 'utf8'));
const asr = JSON.parse(await fs.readFile(asrFile, 'utf8'));

// 표기 차이를 같은 것으로 본다: "300m" = "300미터", "%" = "퍼센트"
const norm = (s) => String(s).normalize('NFC').toLowerCase()
  .replace(/(\d)\s*km\b/g, '$1킬로미터').replace(/(\d)\s*m\b/g, '$1미터').replace(/(\d)\s*kg\b/g, '$1킬로그램')
  .replace(/%/g, '퍼센트')
  .replace(/[\s\p{P}\p{S}]/gu, '');

const dist = (a, b) => {
  a = [...a]; b = [...b];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
};

const byId = {};
for (const [url, text] of Object.entries(asr)) {
  const name = path.basename(url.split('?')[0]).replace(/\.wav$/i, '');
  const id = lines.some((l) => l.id === name) ? name : name.replace(/_[^_]+$/, '');
  (byId[id] ||= []).push({ take: name, heard: text });
}

const report = [];
for (const l of lines) {
  const cands = (byId[l.id] || []).map((c) => {
    const h = norm(c.heard);
    return { ...c, d: Math.min(dist(h, norm(l.say)), dist(h, norm(l.text))) };
  }).sort((a, b) => a.d - b.d);
  const best = cands[0];
  const ok = !!best && best.d <= tol;
  report.push({ id: l.id, text: l.text, say: l.say, ok, take: ok ? best.take : null,
    best: best ? { take: best.take, heard: best.heard, distance: best.d } : null, candidates: cands.length });
  if (apply && ok && best.take !== l.id) l.take = best.take;
}

const bad = report.filter((r) => !r.ok);
for (const r of report) {
  const mark = r.ok ? '✓' : (r.candidates ? '✗' : '–');
  console.log(`${mark} ${r.id}  ${r.ok ? r.take : (r.best ? `거리 ${r.best.distance}: "${r.best.heard}"` : '받아쓴 음성 없음')}  | ${r.text}`);
}
console.log(`\n일치 ${report.length - bad.length}/${report.length}` + (bad.length ? ` · 불일치: ${bad.map((r) => r.id).join(', ')}` : ''));
await fs.mkdir(path.join(proj, 'analysis'), { recursive: true });
await fs.writeFile(path.join(proj, 'analysis', 'asr-check.json'), JSON.stringify({ tol, matched: report.length - bad.length, total: report.length, lines: report }, null, 1));
if (apply) { await fs.writeFile(scriptPath, JSON.stringify(lines, null, 1) + '\n'); console.log('script.json의 take를 갱신했습니다.'); }
process.exit(bad.length ? 1 : 0);
