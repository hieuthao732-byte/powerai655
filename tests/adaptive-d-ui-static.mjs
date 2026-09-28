import fs from 'node:fs';
import assert from 'node:assert/strict';

const ui=fs.readFileSync('adaptive-d-ui.js','utf8');
const css=fs.readFileSync('adaptive-d.css','utf8');
const html=fs.readFileSync('index.html','utf8');
const build=fs.readFileSync('build.mjs','utf8');

assert.match(ui,/powerai_rc6_d_lock_/);
assert.match(ui,/source:'feed'/);
assert.match(ui,/matchedNullBenchmark/);
assert.match(ui,/4 CÁCH PHÂN TÍCH CỦA D/);
assert.match(ui,/hasAnyKnownResult/);
assert.match(ui,/verifyLockIntegrity/);
assert.match(ui,/D-INTEGRITY-1/);
assert.match(ui,/Kiểm tra dữ liệu/);
assert.match(ui,/generator:\{\.\.\.GENERATOR_CONFIG\}/);
assert.match(ui,/rc97HighPrizeStats/);
assert.match(ui,/A \/ B \/ C \/ L \/ D/);
assert.doesNotMatch(ui,/manual.*saveDLogs|saveDLogs.*manual/i);
assert.match(css,/\.dStatusGrid/);
assert.match(html,/adaptive-d\.css/);
assert.match(html,/adaptive-d\.js/);
assert.match(html,/adaptive-d-ui\.js/);
assert.match(build,/'adaptive-d\.js'/);
assert.match(build,/'adaptive-d-ui\.js'/);
assert.match(build,/'adaptive-d\.css'/);
console.log('Track D UI static integration checks passed.');
