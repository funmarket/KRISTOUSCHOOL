import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  // Vite only exposes VITE_-prefixed values to browser code. Selectively map the
  // public Supabase settings so existing SUPABASE_* deployment names work too.
  // Do not add SUPABASE_ as a global envPrefix: it could expose service-role keys.
  const fileEnv = loadEnv(mode, process.cwd(), '');
  const env = {...fileEnv, ...process.env};
  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || '';
  const supabasePublishableKey =
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    env.SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_ANON_KEY ||
    '';

  return {
    define: {
      __KRISTOU_SUPABASE_URL__: JSON.stringify(supabaseUrl),
      __KRISTOU_SUPABASE_PUBLISHABLE_KEY__: JSON.stringify(supabasePublishableKey),
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
