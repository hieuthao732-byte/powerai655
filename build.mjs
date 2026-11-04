import { rmSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const files = [
  'index.html',
  'app.js',
  'adaptive-d.js',
  'adaptive-d-ui.js',
  'adaptive-d-cycle.js',
  'adaptive-d-validation.js',
  'adaptive-d.css',
  'auth.js',
  'style.css',\n  'one-ui.css',
  'favicon.svg',
  'google933e1c79e6843890.html',
  'robots.txt',
  'site.webmanifest',
  'POWERAI_ONE/domain.js',
  'POWERAI_ONE/unified-selector.js',
  'POWERAI_ONE/unified-portfolio-pipeline.js',
  'POWERAI_ONE/adaptive-governor.js',
  'POWERAI_ONE/after-draw-evaluation.js',
  'POWERAI_ONE/adaptive-shadow-runner.js',
  'POWERAI_ONE/challenger-evidence-gate.js',
  'POWERAI_ONE/track-a-adapter.js',
  'POWERAI_ONE/track-b-adapter.js',
  'POWERAI_ONE/track-a-provider.js',
  'POWERAI_ONE/track-b-provider.js',
  'POWERAI_ONE/one-runtime.js',
  'POWERAI_ONE/one-web-bridge.js',
  'sitemap.xml'
];

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
for (const file of files) {
  if (!existsSync(file)) throw new Error(`Missing required static file: ${file}`);
  const destination = join('dist', file);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(file, destination);
}
console.log('Stable build complete — source copied to dist without post-build mutation.');
