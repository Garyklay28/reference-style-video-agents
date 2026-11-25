// time-habits 音效合成脚本（Web Audio / OfflineAudioContext，确定性，不用 Math.random）
// 用法：在 http://localhost:4801/ 下的任意同源页面里加载本文件，然后运行
//   await SFXSynth.run({ save: true })   // 合成 4 个音效并通过 /__save 写入 assets/sfx/
//   await SFXSynth.run({ save: false })  // 只合成并返回测量值
// 输出：48kHz 单声道 16-bit PCM wav，峰值归一化到 -6dBFS，裁掉前后静音。
(() => {
  const SR = 48000;
  const PEAK = Math.pow(10, -6 / 20);          // -6dBFS ≈ 0.501
  const DIR = 'projects/time-habits/assets/sfx/';

  // 固定种子的伪随机数（mulberry32）
  const rng = (seed) => () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const noiseBuffer = (ac, dur, seed) => {
    const b = ac.createBuffer(1, Math.ceil(SR * dur), SR), d = b.getChannelData(0), r = rng(seed);
    for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
    return b;
  };
  const noiseSrc = (ac, dur, seed) => { const s = ac.createBufferSource(); s.buffer = noiseBuffer(ac, dur, seed); return s; };

  // ── 各音效的合成图 ──
  const RECIPES = {
    // 元素弹出：下滑正弦“噗” + 很短的带通噪声起音
    pop: { dur: 0.16, build(ac) {
      const o = ac.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(620, 0); o.frequency.exponentialRampToValueAtTime(230, 0.09);
      const g = ac.createGain(); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(1, 0.004);
      g.gain.exponentialRampToValueAtTime(0.0005, 0.15); g.gain.linearRampToValueAtTime(0, 0.16);
      o.connect(g).connect(ac.destination); o.start(0); o.stop(0.16);
      const n = noiseSrc(ac, 0.03, 101), bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 1.5;
      const ng = ac.createGain(); ng.gain.setValueAtTime(0, 0); ng.gain.linearRampToValueAtTime(0.35, 0.002); ng.gain.exponentialRampToValueAtTime(0.001, 0.025);
      n.connect(bp).connect(ng).connect(ac.destination); n.start(0);
    } },
    // 画面切换：带通噪声，中心频率上扫再回落，包络先升后降
    whoosh: { dur: 0.34, build(ac) {
      const n = noiseSrc(ac, 0.34, 202);
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.1;
      bp.frequency.setValueAtTime(350, 0); bp.frequency.exponentialRampToValueAtTime(2200, 0.15); bp.frequency.exponentialRampToValueAtTime(700, 0.34);
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5000;
      const g = ac.createGain(); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(1, 0.13);
      g.gain.exponentialRampToValueAtTime(0.02, 0.32); g.gain.linearRampToValueAtTime(0, 0.34);
      n.connect(bp).connect(lp).connect(g).connect(ac.destination); n.start(0);
    } },
    // 编号牌出现：小钟声，基频 1320Hz + 非整数倍泛音，快起音、指数衰减
    ding: { dur: 0.55, build(ac) {
      const parts = [[1320, 1.0, 0.55], [1320 * 2.0, 0.28, 0.30], [1320 * 2.76, 0.16, 0.18], [1320 * 5.4, 0.05, 0.08]];
      for (const [f, a, dec] of parts) {
        const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        const g = ac.createGain(); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(a, 0.003);
        g.gain.setTargetAtTime(0, 0.003, dec / 4.5);
        const end = ac.createGain(); end.gain.setValueAtTime(1, 0.50); end.gain.linearRampToValueAtTime(0, 0.55);
        o.connect(g).connect(end).connect(ac.destination); o.start(0); o.stop(0.55);
      }
    } },
    // 写字沙沙声：高频带通噪声，被 5 段不规则笔划包络调制
    pencil: { dur: 0.5, build(ac) {
      const n = noiseSrc(ac, 0.5, 303);
      const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 4200; bp.Q.value = 0.8;
      const g = ac.createGain(); g.gain.setValueAtTime(0, 0);
      const strokes = [[0.000, 0.085, 0.9], [0.100, 0.075, 0.7], [0.190, 0.110, 1.0], [0.315, 0.070, 0.6], [0.400, 0.095, 0.8]];
      for (const [t0, len, a] of strokes) {
        g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(a, t0 + 0.012);
        g.gain.linearRampToValueAtTime(a * 0.75, t0 + len * 0.7); g.gain.linearRampToValueAtTime(0, t0 + len);
      }
      // 纸面颗粒感：低速固定种子抖动
      const r = rng(304), grain = ac.createGain(), gc = new Float32Array(100);
      for (let i = 0; i < gc.length; i++) gc[i] = 0.7 + 0.3 * r();
      grain.gain.setValueCurveAtTime(gc, 0, 0.5);
      n.connect(hp).connect(bp).connect(g).connect(grain).connect(ac.destination); n.start(0);
    } },
  };

  // 裁掉前后低于峰值 -60dB 的部分，末尾 3ms 淡出，归一化到 -6dBFS
  const finish = (x) => {
    let pk = 0; for (let i = 0; i < x.length; i++) pk = Math.max(pk, Math.abs(x[i]));
    const th = pk * 0.001;
    let a = 0; while (a < x.length && Math.abs(x[a]) < th) a++;
    let b = x.length - 1; while (b > a && Math.abs(x[b]) < th) b--;
    const y = x.slice(a, b + 1), fo = Math.min(y.length, Math.round(SR * 0.003));
    for (let i = 0; i < fo; i++) y[y.length - 1 - i] *= i / fo;
    let p2 = 0; for (let i = 0; i < y.length; i++) p2 = Math.max(p2, Math.abs(y[i]));
    const g = PEAK / p2; for (let i = 0; i < y.length; i++) y[i] *= g;
    return y;
  };

  const encodeWav = (x) => {
    const buf = new ArrayBuffer(44 + x.length * 2), v = new DataView(buf);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + x.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, SR, true);
    v.setUint32(28, SR * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, x.length * 2, true);
    for (let i = 0; i < x.length; i++) v.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, Math.round(x[i] * 32767))), true);
    return buf;
  };

  const render = async (name) => {
    const r = RECIPES[name], ac = new OfflineAudioContext(1, Math.ceil(SR * r.dur), SR);
    r.build(ac);
    const out = await ac.startRendering();
    return finish(out.getChannelData(0).slice());
  };

  const hash = (ab) => { let h = 2166136261 >>> 0; const u = new Uint8Array(ab); for (let i = 0; i < u.length; i++) { h ^= u[i]; h = Math.imul(h, 16777619) >>> 0; } return h.toString(16).padStart(8, '0'); };

  const run = async ({ save = true } = {}) => {
    const res = {};
    for (const name of Object.keys(RECIPES)) {
      const wav = encodeWav(await render(name));
      res[name] = { bytes: wav.byteLength, fnv1a: hash(wav) };
      if (save) res[name].saved = await (await fetch('/__save?path=' + encodeURIComponent(DIR + name + '.wav'), { method: 'POST', body: wav })).text();
    }
    return res;
  };

  // 保存后重新 fetch + decodeAudioData 实测
  const measure = async (base = '/' + DIR) => {
    const ac = new OfflineAudioContext(1, 1, SR), res = {};
    for (const name of Object.keys(RECIPES)) {
      const ab = await (await fetch(base + name + '.wav', { cache: 'no-store' })).arrayBuffer();
      const b = await ac.decodeAudioData(ab.slice(0)), d = b.getChannelData(0);
      let pk = 0, ss = 0; for (let i = 0; i < d.length; i++) { pk = Math.max(pk, Math.abs(d[i])); ss += d[i] * d[i]; }
      res[name] = { sr: b.sampleRate, ch: b.numberOfChannels, len_s: +b.duration.toFixed(3), samples: d.length,
        peak: +pk.toFixed(4), peak_dBFS: +(20 * Math.log10(pk)).toFixed(2), rms_dBFS: +(10 * Math.log10(ss / d.length)).toFixed(2),
        first: +Math.abs(d[0]).toFixed(4), last: +Math.abs(d[d.length - 1]).toFixed(4), fnv1a: hash(ab) };
    }
    return res;
  };

  window.SFXSynth = { RECIPES, render, encodeWav, run, measure };
})();
