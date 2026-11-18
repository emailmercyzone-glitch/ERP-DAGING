import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

const isNativeCapacitorApp = import.meta.env.VITE_CAPACITOR_APP === 'true';

const storageManager = typeof navigator !== 'undefined' ? navigator.storage : undefined;
if (!isNativeCapacitorApp && storageManager && typeof storageManager.persist === 'function') {
  // Persistent storage is a best-effort browser request; never block app startup.
  void (typeof storageManager.persisted === 'function'
    ? storageManager.persisted().then((persisted) => persisted || storageManager.persist())
    : storageManager.persist()).catch(() => false);
}

if (!isNativeCapacitorApp) {
  let requestServiceWorkerUpdate: ((reloadPage?: boolean) => Promise<void>) | undefined;

  requestServiceWorkerUpdate = registerSW({
    immediate: true,
    onNeedRefresh() {
      const accepted = window.confirm(
        'ERP DAGING memiliki pembaruan. Data transaksi lokal tetap disimpan. Muat ulang aplikasi sekarang untuk menggunakan versi terbaru?'
      );
      if (accepted) void requestServiceWorkerUpdate?.(true);
    },
  });
}

createRoot(document.getElementById('root')!).render(<App />);
