import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

// Build-time injection of Firebase web config from environment variables.
// Falls back to `firebase-applet-config.json` if a key is not set in env,
// so existing setups continue to work. The bundled file should be a template
// (no secrets) in version control; real values come from VITE_FIREBASE_*.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const fileConfig = readFirebaseFileConfig();
  const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY || fileConfig.apiKey || '',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || fileConfig.authDomain || '',
    projectId: env.VITE_FIREBASE_PROJECT_ID || fileConfig.projectId || '',
    appId: env.VITE_FIREBASE_APP_ID || fileConfig.appId || '',
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || fileConfig.storageBucket || '',
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || fileConfig.messagingSenderId || '',
    measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || fileConfig.measurementId || '',
    firestoreDatabaseId: env.VITE_FIREBASE_DATABASE_ID || fileConfig.firestoreDatabaseId || '',
  };
  const appCheckSiteKey = env.VITE_FIREBASE_APP_CHECK_SITE_KEY || '';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    define: {
      __FIREBASE_CONFIG__: JSON.stringify(firebaseConfig),
      __FIREBASE_APP_CHECK_SITE_KEY__: JSON.stringify(appCheckSiteKey),
    },
    server: {
      // HMR can be disabled by setting DISABLE_HMR=true (e.g. for CI or for
      // IDE agent edits that benefit from a quiet file watcher).
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

function readFirebaseFileConfig(): Record<string, string> {
  try {
    // Dynamic require so missing or template files do not break the build.
    const fs = require('fs') as typeof import('fs');
    const p = path.resolve(__dirname, 'firebase-applet-config.json');
    if (!fs.existsSync(p)) return {};
    const raw = fs.readFileSync(p, 'utf-8').trim();
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
