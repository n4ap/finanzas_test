import type { MetadataRoute } from 'next';

/** PWA: la aplicación se puede «instalar» en el móvil/PC y se abre a pantalla completa. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Life Dashboard', short_name: 'Life', description: 'Tu centro de control personal',
    start_url: '/dashboard', scope: '/', display: 'standalone', orientation: 'portrait-primary', lang: 'es',
    background_color: '#f6f7fb', theme_color: '#4f46e5',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [{ name: 'Tareas', url: '/tasks' }, { name: 'Asistente', url: '/assistant' }, { name: 'Finanzas', url: '/finance' }],
  };
}
