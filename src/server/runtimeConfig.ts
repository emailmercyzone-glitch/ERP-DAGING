function parsePort(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value.trim())) return null;
  const port = Number(value.trim());
  return Number.isSafeInteger(port) && port >= 1 && port <= 65535 ? port : null;
}

/** CLI flags override environment variables; defaults stay suitable for local use. */
export function resolvePort(args: readonly string[], envPort?: string): number {
  const flagIndex = args.indexOf('--port');
  const cliPort = flagIndex >= 0 ? parsePort(args[flagIndex + 1]) : null;
  return cliPort ?? parsePort(envPort) ?? 3000;
}

export function resolveHost(args: readonly string[], envHost?: string): string {
  const flagIndex = args.indexOf('--host');
  const cliHost = flagIndex >= 0 ? args[flagIndex + 1]?.trim() : '';
  return cliHost || envHost?.trim() || '0.0.0.0';
}
