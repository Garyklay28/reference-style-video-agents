// 채택한 음성의 앞뒤 무음을 다듬고 자막 시각표(timing.js)를 만든다.
// 사용: node build-timing.mjs <project> <takes 폴더>
// script.json의 각 줄은 {id, text, say, pause?, take?}. take가 없으면 <id>.wav를 쓴다.
import fs from 'node:fs/promises';
import path from 'node:path';

const [proj, takes] = process.argv.slice(2);
if (!proj || !takes) { console.error('usage: node build-timing.mjs <project> <takes dir>'); process.exit(1); }
const lines = JSON.parse(await fs.readFile(path.join(proj, 'script.json'), 'utf8'));
await fs.mkdir(path.join(proj, 'assets/voice'), { recursive: true });

const GAP = 0.08;   // 문장 사이 간격(초)
const LEAD = 0.25;  // 첫 문장 앞 여백
const TAIL = 1.8;   // 마지막 문장 뒤 여백
let t = LEAD; const caps = [];

for (const l of lines) {
  const b = await fs.readFile(path.join(takes, (l.take || l.id) + '.wav'));
  const sr = b.readUInt32LE(24), n = (b.length - 44) / 2;
  const pcm = new Int16Array(b.buffer.slice(b.byteOffset + 44, b.byteOffset + 44 + n * 2));
  // 10ms 단위 RMS. 상위 10% 수준의 3% 아래를 무음으로 본다(순간 잡음에 흔들리지 않도록 최고값을 쓰지 않는다).
  const w = Math.round(sr / 100), nw = Math.floor(n / w), rms = new Float32Array(nw);
  for (let k = 0; k < nw; k++) { let s = 0; for (let i = k * w; i < (k + 1) * w; i++) s += pcm[i] * pcm[i]; rms[k] = Math.sqrt(s / w); }
  const th = Float32Array.from(rms).sort()[Math.floor(nw * 0.9)] * 0.03;
  let k0 = 0, k1 = nw - 1; while (k0 < nw && rms[k0] < th) k0++; while (k1 > 0 && rms[k1] < th) k1--;
  const a0 = Math.max(0, k0 * w - Math.round(sr * 0.06)), a1 = Math.min(n - 1, (k1 + 1) * w + Math.round(sr * 0.14)), m = a1 - a0 + 1;
  // 음량 맞춤: 99.9 백분위 기준, 부드러운 제한
  const abs = Array.from(pcm.subarray(a0, a1 + 1), Math.abs).sort((x, y) => x - y), g = 0.8 / abs[Math.floor(m * 0.999)];
  const out = Buffer.alloc(44 + m * 2); b.copy(out, 0, 0, 44); out.writeUInt32LE(36 + m * 2, 4); out.writeUInt32LE(m * 2, 40);
  for (let i = 0; i < m; i++) {
    let v = Math.tanh(pcm[a0 + i] * g) / Math.tanh(1) * 0.9; v = Math.max(-0.98, Math.min(0.98, v));
    const fade = Math.min(1, i / 400) * Math.min(1, (m - 1 - i) / 2000);
    out.writeInt16LE(Math.round(v * fade * 32767), 44 + i * 2);
  }
  await fs.writeFile(path.join(proj, 'assets/voice', l.id + '.wav'), out);
  t += l.pause || 0; const start = +t.toFixed(3), dur = m / sr; t = start + dur + GAP;
  caps.push({ id: l.id, text: l.text, start, dur: +dur.toFixed(3) });
}
caps.forEach((c, i) => { c.end = +(i < caps.length - 1 ? caps[i + 1].start - 0.04 : c.start + c.dur + 1.4).toFixed(3); });
const total = +(t + TAIL).toFixed(2);
await fs.writeFile(path.join(proj, 'timing.js'), 'window.DUR=' + total + ';\nwindow.CAPS=' + JSON.stringify(caps).replace(/\},\{/g, '},\n{') + ';\n');
const syl = lines.reduce((a, l) => a + (l.say.match(/[가-힣]/g) || []).length, 0);
console.log('captions', caps.length, 'duration', total, 'syllables/sec', (syl / caps.reduce((a, c) => a + c.dur, 0)).toFixed(2));
