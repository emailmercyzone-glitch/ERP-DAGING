import React, { useState } from 'react';

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleTokenClient {
  requestAccessToken(options?: { prompt?: string }): void;
}

interface GoogleOAuth2Api {
  initTokenClient(options: {
    client_id: string;
    scope: string;
    include_granted_scopes?: boolean;
    callback: (response: GoogleTokenResponse) => void;
    error_callback?: (error: { type?: string; message?: string }) => void;
  }): GoogleTokenClient;
}

interface GoogleOAuthWindow extends Window {
  google?: {
    accounts?: {
      oauth2?: GoogleOAuth2Api;
    };
  };
}

let loader: Promise<GoogleOAuth2Api> | null = null;

function loadGoogleOAuth2(): Promise<GoogleOAuth2Api> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Google Drive hanya tersedia di browser.'));
  const current = (window as GoogleOAuthWindow).google?.accounts?.oauth2;
  if (current) return Promise.resolve(current);
  if (!loader) {
    loader = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-erp-google-identity="true"]');
      const script = existing ?? document.createElement('script');
      const loaded = () => {
        const oauth2 = (window as GoogleOAuthWindow).google?.accounts?.oauth2;
        if (oauth2) resolve(oauth2);
        else reject(new Error('Google OAuth tidak menyediakan akses Drive.'));
      };
      const failed = () => {
        loader = null;
        reject(new Error('Tidak dapat memuat layanan OAuth Google. Periksa koneksi internet.'));
      };
      script.addEventListener('load', loaded, { once: true });
      script.addEventListener('error', failed, { once: true });
      if (!existing) {
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.dataset.erpGoogleIdentity = 'true';
        document.head.appendChild(script);
      }
    });
  }
  return loader;
}

export function GoogleDriveAccessButton(props: {
  clientId: string;
  disabled?: boolean;
  onAccessToken: (accessToken: string) => void | Promise<void>;
  onError: (message: string) => void;
}) {
  const [loading, setLoading] = useState(false);

  const requestAccess = async () => {
    if (loading || props.disabled || !props.clientId) return;
    setLoading(true);
    try {
      const oauth2 = await loadGoogleOAuth2();
      const tokenClient = oauth2.initTokenClient({
        client_id: props.clientId,
        scope: 'openid email https://www.googleapis.com/auth/drive.file',
        include_granted_scopes: true,
        callback: (response) => {
          if (!response.access_token) {
            props.onError(response.error_description || response.error || 'Google tidak memberikan token akses Drive.');
            setLoading(false);
            return;
          }
          void Promise.resolve(props.onAccessToken(response.access_token))
            .catch((error: unknown) => props.onError(error instanceof Error ? error.message : 'Backup ke Google Drive gagal.'))
            .finally(() => setLoading(false));
        },
        error_callback: (error) => {
          props.onError(error.message || 'Persetujuan akses Google Drive dibatalkan atau gagal.');
          setLoading(false);
        },
      });
      tokenClient.requestAccessToken({ prompt: '' });
    } catch (error) {
      props.onError(error instanceof Error ? error.message : 'Layanan Google Drive tidak tersedia.');
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void requestAccess()}
      disabled={loading || props.disabled || !props.clientId}
      className="px-4 py-2 rounded-lg border border-sky-300 bg-sky-50 hover:bg-sky-100 disabled:opacity-50 disabled:cursor-not-allowed text-sky-900 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
    >
      {loading ? 'Mengunggah ke Drive…' : 'Backup ke Google Drive Owner'}
    </button>
  );
}
