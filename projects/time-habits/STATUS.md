# 진행 상황

| 단계 | 담당 | 상태 | 산출물 | 메모 |
|---|---|---|---|---|
| 1 参考视频分析 | Claude | 完成 | analysis/reference.json, analysis/reference.md, analysis/frames/sheet.png | 无字幕条→改为文字卡检测；无背景音乐 |
| 0 选定音色 | 用户 | 完成 | tmp/voice-samples/M3.wav | M1～M5 试听后选 M3 |
| 1b 事实核查 | researcher（通用代理按 .claude/agents/researcher.md 执行；项目子代理未加载到会话） | 完成 | research/facts.md | 25 条，均有出处 URL；#2/#3 只对照维基未对原文；#10 年份、#15、#23、#25 仅搜索结果确认；番茄钟长休息时长、创立年份有分歧 |
| 2 文案 | scriptwriter（通用代理按 .claude/agents/scriptwriter.md 执行） | 待用户确认 | script.json, research/script-sources.md | 60 句、9 张卡；766 音节，按 5 音节/秒 + pause 4.5 秒 ≈ 157.7 秒（按 5.6 音节/秒 ≈ 141.3 秒）；say 无数字/英文；事实句均对应 facts # |
| 3 旁白 | narrator（通用代理按 .claude/agents/narrator.md 执行） | 完成 | assets/voice/c01–c60.wav, timing.js, analysis/asr-check.json, analysis/asr-takes.json | 音色 M3，语速 0.9（试配 0.95=5.94、0.9=5.56 音节/秒，去首尾静音）；60/60 采用：严格一致 52，tol≤2 放宽 7（c18 c29 c30 c39 c40 c51 c56，均为写法/同音差异），c48_2 转写恒为「블로그는」由用户亲耳确认；c39→c39_3、c51→c51_1 由调度者改选；ASR whisper-small WebGPU；总时长 170.02 秒，4.83 音节/秒 |
| 4b 音效 | sound-designer（通用代理按 .claude/agents/sound-designer.md 执行） | 完成 | assets/sfx/pop.wav, whoosh.wav, ding.wav, pencil.wav, synth.js, list.md | Web Audio 确定性合成（固定种子），48kHz 单声道 16-bit；长度 0.135/0.336/0.545/0.495 秒，峰值均 -6.00dBFS（调度者复测）；无外部音效；未亲耳试听 |
| 4a 画面 | scene-builder（通用代理按 .claude/agents/scene-builder.md 执行；首个代理误停后重启） | 完成 | index.html, qa/sheet-v1.png, qa/sheet-v2.png, qa/sheet-v3.png | 1920x1080 2D canvas，60 个画面、9 张文字卡、5 个编号牌；SFX 147 个（whoosh 46 / pop 78 / pencil 16 / ding 7）；调度者在 4801 服务器+内置浏览器复测：__ready、Gaegu 两字重已加载、4 个时刻重复渲染像素一致、mixAudio/encStart 已接入、音效文件均 200、sheet-v3 经 /__save 保存；已知差异：人物比参考小、图表类画面偏多 |
| 5 编辑 | editor（通用代理按 .claude/agents/editor.md 执行） | 待验证 | out/time-habits-v1.mp4 (31.9MB), CREDITS.txt | mixAudio: voices 60, sfx 147, bgm null, peakBefore 1.022 → gain 0.871；encFrames 5101 帧约 22 秒；元数据 170.09 秒 1920x1080；CREDITS 写明 Supertonic 2 (OpenRAIL-M，需标明机器生成)、Gaegu OFL、自制音效 |
| 6 验证 | qa-reviewer（通用代理按 .claude/agents/qa-reviewer.md 执行；报告正文由调度者保存） | PASS（附条件），待用户确认成片 | qa/report-v1.md, qa/mp4-sheet-v1.png, qa/asr-check-final-v1-aligned.json | 170.09 秒 1920x1080 30fps 有音轨；峰值 -1.04dBFS；旁白 p90 -11.5dBFS；转写 58/60（c06 同音写法、c48 已人工确认）；音频比 timing 晚 44ms（AAC 前置延迟，无 elst）、峰值余量小，建议 editor 修正 |
| 5 编辑（修正） | editor | 待验证 | out/time-habits-v2.mp4, out/time-habits-v3.mp4；export.js 新增 peak/audioShift 选项（默认旧行为）；index.html 仅改 installExport 行 | v2：audioShift 2112 后 c06/c10/c30 对齐偏移 0（v1 为 +2112），peak 0.841 但 AAC 后成片 -1.18dBFS；v3：peak 0.81，成片 -1.81dBFS，对齐偏移 0，170.048 秒 1920x1080 |
| 6 验证（v3） | qa-reviewer（报告正文由调度者保存） | PASS（附条件），待用户确认成片 | qa/report-v3.md, qa/mp4-sheet-v3.png, qa/asr-check-final-v3.json | 170.048 秒 1920x1080 30fps；60/60 句对齐偏移 0；峰值 -1.81dBFS；旁白 p90 -12.3dBFS（比参考小约 1.5～1.9dB）；转写 58/60（c06 同音写法、c48 已人工确认）；画面与 v1 逐像素相同 |
| 7 成片确认 | 用户 | 完成 | out/time-habits-v3.mp4 | 用户试看后确认 v3 定稿（2026-11-25）；v1、v2 为中间版本 |
| 7 成片确认（补记） | 用户（上级会话转达） | 完成 | out/time-habits-v3.mp4 | 用户在上级会话也确认 v3 定稿；上级会话逐帧扫描发现 43 帧短暂空白（多为切换后 1 帧，最长 124.13 秒处 7 帧），用户看过后接受 |
