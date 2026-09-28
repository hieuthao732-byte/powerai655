import { rmSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const files = [
  'index.html',
  'app.js',
  'adaptive-d.js',
  'adaptive-d-ui.js',
  'adaptive-d-cycle.js',
  'adaptive-d.css',
  'auth.js',
  'style.css',
  'favicon.svg',
  'google933e1c79e6843890.html',
  'robots.txt',
  'site.webmanifest',
  'sitemap.xml'
];

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
for (const file of files) {
  if (!existsSync(file)) throw new Error(`Missing required static file: ${file}`);
  copyFileSync(file, join('dist', file));
}
console.log('Stable build complete — source copied to dist without post-build mutation.');
