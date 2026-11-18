import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

type CapacitorWindow = Window & {
  Capacitor?: {
    isNativePlatform?: () => boolean;
  };
};

const isNativeCapacitorApp = Boolean(
  (window as CapacitorWindow).Capacitor?.isNativePlatform?.()
);

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
