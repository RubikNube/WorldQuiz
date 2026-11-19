import { cp, mkdir, rm } from 'node:fs/promises';
import { buildOfflineWorker } from './build-pwa.mjs';

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('src', 'dist', { recursive: true });
await cp('assets/flags', 'dist/assets/flags', { recursive: true });
await cp('assets/mountains', 'dist/assets/mountains', { recursive: true });
// Publish the adapted database and its source/license alongside the app.
await cp('assets/data', 'dist/assets/data', { recursive: true });
await cp('LICENSE', 'dist/LICENSE');
await cp('ATTRIBUTION.md', 'dist/ATTRIBUTION.md');
await buildOfflineWorker('dist');
console.log('WorldQuiz built in dist/');
