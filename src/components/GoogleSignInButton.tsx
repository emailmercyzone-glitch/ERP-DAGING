import React, { useEffect, useRef } from 'react';

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleIdentityApi {
  initialize(options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }): void;
  renderButton(
    element: HTMLElement,
    options: {
      type?: 'standard' | 'icon';
      theme?: 'outline' | 'filled_blue' | 'filled_black';
      size?: 'large' | 'medium' | 'small';
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
      shape?: 'rectangular' | 'pill' | 'circle' | 'square';
      logo_alignment?: 'left' | 'center';
      width?: number;
    }
  ): void;
}

interface GoogleIdentityServices {
  accounts: { id: GoogleIdentityApi };
}

declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

let googleIdentityLoader: Promise<GoogleIdentityServices> | null = null;

function loadGoogleIdentityServices(): Promise<GoogleIdentityServices> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Sign-In hanya tersedia di browser.'));
  }
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (!googleIdentityLoader) {
    googleIdentityLoader = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-erp-google-identity="true"]');
      const script = existing ?? document.createElement('script');
      const handleLoad = () => {
        if (window.google?.accounts?.id) resolve(window.google);
        else reject(new Error('Google Identity Services gagal dimuat.'));
      };
      const handleError = () => {
        googleIdentityLoader = null;
        reject(new Error('Tidak dapat memuat layanan login Google. Periksa koneksi internet.'));
      };
      script.addEventListener('load', handleLoad, { once: true });
      script.addEventListener('error', handleError, { once: true });
      if (!existing) {
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.dataset.erpGoogleIdentity = 'true';
        document.head.appendChild(script);
      }
    });
  }
  return googleIdentityLoader;
}

interface GoogleSignInButtonProps {
  clientId: string;
  disabled?: boolean;
  onCredential: (credential: string) => void;
  onError: (message: string) => void;
}

export function GoogleSignInButton({
  clientId,
  disabled = false,
  onCredential,
  onError,
}: GoogleSignInButtonProps) {
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const callbacksRef = useRef({ onCredential, onError });
  callbacksRef.current = { onCredential, onError };

  useEffect(() => {
    let cancelled = false;
    if (!clientId || disabled || !buttonRef.current) return;

    void loadGoogleIdentityServices()
      .then((google) => {
        if (cancelled || !buttonRef.current) return;
        buttonRef.current.innerHTML = '';
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (typeof response.credential !== 'string' || !response.credential) {
              callbacksRef.current.onError('Google tidak mengembalikan credential login.');
              return;
            }
            callbacksRef.current.onCredential(response.credential);
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        google.accounts.id.renderButton(buttonRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: 260,
        });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          callbacksRef.current.onError(
            error instanceof Error ? error.message : 'Layanan Google Sign-In tidak tersedia.'
          );
        }
      });

    return () => {
      cancelled = true;
      if (buttonRef.current) buttonRef.current.innerHTML = '';
    };
  }, [clientId, disabled]);

  if (disabled) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
        Hubungkan perangkat ke internet untuk login Google.
      </div>
    );
  }

  return <div ref={buttonRef} className="min-h-[44px] flex items-center justify-center" />;
}
