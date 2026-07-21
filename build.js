/**
 * 轻量完整性检查（无打包）
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const required = [
  'worker/index.js',
  'worker/auth.js',
  'worker/routes/ai.js',
  'public/index.html',
  'public/login.html',
  'public/js/app.js',
  'public/js/config.js',
  'public/js/components/emojiPanel.js',
  'public/js/core/eventBus.js',
  'public/css/variables.css',
  'database/schema.sql',
  'wrangler.toml'
];

let ok = true;
for (const f of required) {
  const p = resolve(f);
  if (!existsSync(p)) {
    console.error('❌ missing:', f);
    ok = false;
  } else {
    console.log('✅', f);
  }
}
if (!ok) process.exit(1);
console.log('\nBuild check passed. Deploy with: npm run deploy');
