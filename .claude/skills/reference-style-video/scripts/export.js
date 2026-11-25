// 장면 페이지에 넣는 내보내기 모듈. 오디오 믹스, MP4 인코딩, 저장을 한다.
// 사용: installExport({ W, H, FPS, DUR, CAPS, SFX, renderAt, canvas, music, duck, peak, audioShift })
//   CAPS  [{id, start}]            내레이션: assets/voice/<id>.wav
//   SFX   [{file, t, vol}]         효과음 큐
//   music {file, rms}              배경음악 파일과 목표 RMS(기본 0.03 ≈ -30dBFS). 없으면 생략
//   duck  [{from, to, level}]      음악을 낮출 구간(예: 무거운 장면)
//   peak  number                   mixAudio의 샘플 피크 상한(선형). 기본 0.89(≈ -1dBFS). 예: 0.841 ≈ -1.5dBFS
//   audioShift number              encStart에서 믹스 앞부분을 이만큼(샘플, 48kHz) 건너뛰고 인코딩한다(=음성을 앞당김).
//                                  AAC 인코더 프라이밍 지연(mp4-muxer가 edts/elst를 쓰지 않아 디코더가 보정하지 않음)을 상쇄하는 용도. 기본 0
window.installExport = ({ W, H, FPS, DUR, CAPS, SFX, renderAt, canvas, music, duck = [], peak = 0.89, audioShift = 0 }) => {
  let muxer, enc;

  window.mixAudio = async () => {
    const sr = 48000, ac = new OfflineAudioContext(2, Math.round(sr * DUR), sr), cache = {};
    const load = async (src) => cache[src] || (cache[src] = await ac.decodeAudioData(await (await fetch(src)).arrayBuffer()));
    const put = async (src, t, vol) => { const s = ac.createBufferSource(); s.buffer = await load(src); const g = ac.createGain(); g.gain.value = vol; s.connect(g).connect(ac.destination); s.start(t); };
    for (const c of CAPS) await put('assets/voice/' + c.id + '.wav', c.start, 1.0);
    for (const s of SFX) await put(s.file, s.t, s.vol * 0.6);
    let bgm = null;
    if (music) {
      const mb = await load(music.file), md = mb.getChannelData(0), win = Math.round(mb.sampleRate * 0.25), env = [];
      for (let i = 0; i + win < Math.min(md.length, mb.sampleRate * (DUR + 30)); i += win) { let e = 0; for (let j = i; j < i + win; j++) e += md[j] * md[j]; env.push(Math.sqrt(e / win)); }
      const med = env.slice().sort((a, b) => a - b)[env.length >> 1];
      let k0 = env.findIndex((v) => v > med * 0.3); if (k0 < 0) k0 = 0;           // 조용한 도입부는 건너뛴다
      const off = Math.max(0, k0 * 0.25 - 0.05), seg = env.slice(k0, k0 + Math.round(DUR * 4));
      const g0 = (music.rms || 0.03) / Math.sqrt(seg.reduce((a, v) => a + v * v, 0) / seg.length);
      const ms = ac.createBufferSource(); ms.buffer = mb; const mg = ac.createGain(); ms.connect(mg).connect(ac.destination);
      mg.gain.setValueAtTime(0, 0); mg.gain.linearRampToValueAtTime(g0, 0.6);
      for (const d of duck) { mg.gain.setValueAtTime(g0, d.from - 0.3); mg.gain.linearRampToValueAtTime(g0 * d.level, d.from + 0.5); mg.gain.setValueAtTime(g0 * d.level, d.to); mg.gain.linearRampToValueAtTime(g0, d.to + 1.0); }
      mg.gain.setValueAtTime(g0, DUR - 3.0); mg.gain.linearRampToValueAtTime(0, DUR - 0.1); ms.start(0, off);
      bgm = { offset: +off.toFixed(2), gain: +g0.toFixed(3) };
    }
    const buf = await ac.startRendering(), L = buf.getChannelData(0), R = buf.getChannelData(1);
    let pk = 0; for (let i = 0; i < L.length; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
    const g = pk > peak ? peak / pk : 1; if (g !== 1) for (let i = 0; i < L.length; i++) { L[i] *= g; R[i] *= g; }   // 최고값을 peak 이하로
    window.__mix = buf; return { voices: CAPS.length, sfx: SFX.length, bgm, peakBefore: +pk.toFixed(3), peakTarget: peak, gain: +g.toFixed(3) };
  };

  window.encStart = async () => {
    const Mp4 = await import('https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.3/build/mp4-muxer.mjs');
    muxer = new Mp4.Muxer({ target: new Mp4.ArrayBufferTarget(), fastStart: 'in-memory', video: { codec: 'avc', width: W, height: H, frameRate: FPS }, audio: { codec: 'aac', sampleRate: 48000, numberOfChannels: 2 } });
    enc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: (e) => { window.__err = String(e); } });
    enc.configure({ codec: 'avc1.640028', width: W, height: H, bitrate: 6000000, framerate: FPS });
    const aenc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: (e) => { window.__err = String(e); } });
    aenc.configure({ codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 192000 });
    const buf = window.__mix, L = buf.getChannelData(0), R = buf.getChannelData(1), N = 4800;
    for (let i = audioShift; i < L.length; i += N) {   // 앞 audioShift 샘플을 버리고, 타임스탬프는 0부터 시작
      const n = Math.min(N, L.length - i), d = new Float32Array(n * 2); d.set(L.subarray(i, i + n), 0); d.set(R.subarray(i, i + n), n);
      const ad = new AudioData({ format: 'f32-planar', sampleRate: 48000, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((i - audioShift) / 48000 * 1e6), data: d }); aenc.encode(ad); ad.close();
    }
    await aenc.flush(); window.__n = 0; return 'started';
  };

  // 한 번에 150프레임 안팎으로 나눠 부른다. setTimeout을 쓰지 않아 백그라운드 탭에서도 느려지지 않는다.
  window.encFrames = async (f0, f1) => {
    for (let f = f0; f < f1; f++) {
      renderAt(f / FPS);
      const vf = new VideoFrame(canvas, { timestamp: Math.round(f * 1e6 / FPS), duration: Math.round(1e6 / FPS) });
      enc.encode(vf, { keyFrame: f % 60 === 0 }); vf.close(); window.__n++;
      if (enc.encodeQueueSize > 8) await new Promise((r) => enc.addEventListener('dequeue', r, { once: true }));
    }
    return window.__err || window.__n;
  };

  // 로컬 서버(serve.mjs)의 /__save로 저장한다. 큰 파일은 응답이 끊길 수 있으니 저장된 파일 크기로 확인한다.
  window.encFinish = async (path) => {
    await enc.flush(); muxer.finalize(); const ab = muxer.target.buffer;
    const r = await fetch('/__save?path=' + encodeURIComponent(path), { method: 'POST', body: ab });
    return { bytes: ab.byteLength, saved: await r.text(), err: window.__err || null };
  };
};
