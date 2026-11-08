import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

function encodeKeyShard(key: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < key.length; i++) {
    out.push(key.charCodeAt(i) ^ 0x5a ^ (i & 0x1f));
  }
  return out;
}

function collectApiKeyPool(env: Record<string, string | undefined>): number[][] {
  const rawKeys: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const k = (env[`GROQ_API_KEY_${i}`] ?? env[`VITE_GROQ_API_KEY_${i}`] ?? '').trim();
    if (k) rawKeys.push(k);
  }
  const csv = (env.GROQ_API_KEYS ?? env.VITE_GROQ_API_KEYS ?? '').trim();
  if (csv) {
    for (const part of csv.split(',')) {
      const trimmed = part.trim();
      if (trimmed) rawKeys.push(trimmed);
    }
  }
  const single = (env.GROQ_API_KEY ?? env.VITE_GROQ_API_KEY ?? '').trim();
  if (single) rawKeys.push(single);

  const unique: string[] = [];
  for (let i = 0; i < rawKeys.length; i++) {
    if (unique.indexOf(rawKeys[i]) === -1) {
      unique.push(rawKeys[i]);
    }
  }
  return unique.map(encodeKeyShard);
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const keyPoolShards = collectApiKeyPool(env);
  const apiUrl = (env.VITE_GROQ_API_URL ?? env.GROQ_API_URL ?? '').trim();
  const modelName = (env.VITE_GROQ_MODEL ?? env.GROQ_MODEL ?? '').trim();

  return {
    base: './',
    plugins: [react()],
    define: {
      __CALCIOS_KEY_POOL__: JSON.stringify(keyPoolShards),
      __CALCIOS_GROQ_URL__: JSON.stringify(apiUrl),
      __CALCIOS_GROQ_MODEL__: JSON.stringify(modelName),
    },
    server: { host: '0.0.0.0', allowedHosts: true },
    preview: { host: '0.0.0.0', allowedHosts: true },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test-setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      restoreMocks: true,
    },
  };
});
