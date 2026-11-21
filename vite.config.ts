import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const base = mode === 'github-pages' ? '/publish-planner/' : '/';

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        injectRegister: null,
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        manifest: {
          name: 'منظّم النشر',
          short_name: 'منظّم النشر',
          description: 'خطط لمواعيد نشر المحتوى وتلّق تنبيهاتك',
          lang: 'ar',
          dir: 'rtl',
          start_url: base,
          scope: base,
          display: 'standalone',
          theme_color: '#286650',
          background_color: '#f5f4f0',
          icons: [
            { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
            { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
            { src: `${base}icons/icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        injectManifest: {
          globPatterns: ['**/*.{html,js,css,woff2,woff,ttf,png,svg,ico}'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        },
      }),
    ],
  };
});
