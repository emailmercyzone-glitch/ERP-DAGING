export interface CorsOriginConfig {
  appUrl?: string;
  corsOrigins?: string;
  includeDevOrigins?: boolean;
}

function normalizeOrigin(value: string): string | null {
  const candidate = value.trim();
  if (!candidate) return null;
  try {
    return new URL(candidate).origin;
  } catch {
    return null;
  }
}

/**
 * Provider-neutral CORS allowlist for the native Capacitor WebView and the
 * eventual hosted PWA origin. Production origins are supplied through
 * APP_URL and/or CORS_ORIGINS; development origins are never enabled in prod.
 */
export function parseAllowedOrigins(config: CorsOriginConfig = {}): Set<string> {
  const origins = new Set<string>(['https://localhost', 'capacitor://localhost']);
  if (config.includeDevOrigins) {
    origins.add('http://localhost:5173');
    origins.add('http://127.0.0.1:5173');
  }

  const configured = [
    ...(config.corsOrigins || '').split(','),
    config.appUrl || '',
  ];
  for (const value of configured) {
    const normalized = normalizeOrigin(value);
    if (normalized) origins.add(normalized);
  }
  return origins;
}

export function isAllowedCorsOrigin(origin: string, allowedOrigins: ReadonlySet<string>): boolean {
  return allowedOrigins.has(origin);
}
