import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const mockContext = fileURLToPath(new URL('./notification-messages-mock-context.tsx', import.meta.url));
const mockService = fileURLToPath(new URL('./notification-messages-mock-school-content.ts', import.meta.url));
const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

// Test-only aliases replace the real network/context boundaries; production Vite config is untouched.
export default defineConfig({
  root: projectRoot,
  plugins: [react()],
  define: {
    __KRISTOU_SUPABASE_URL__: JSON.stringify('https://example.supabase.co'),
    __KRISTOU_SUPABASE_PUBLISHABLE_KEY__: JSON.stringify('test-publishable-key'),
  },
  resolve: {
    alias: [
      { find: /^\.\.\/\.\.\/context\/AppContext$/, replacement: mockContext },
      { find: /^\.\.\/\.\.\/lib\/schoolContent$/, replacement: mockService },
    ],
  },
});
