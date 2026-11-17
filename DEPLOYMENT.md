# ERP DAGING — Deployment Preparation

This repository now includes a production container build and safe health probes. This prepares the server for deployment; it does **not** mean a live environment has been deployed or authenticated.

## Container

Build:

```sh
docker build -t erp-daging:latest .
```

Run with a server-side environment file mounted/provided by the deployment platform:

```sh
docker run -d --name erp-daging \
  --restart unless-stopped \
  --env-file /secure/path/erp-daging.env \
  -p 3000:3000 \
  erp-daging:latest
```

Do not copy `.env` into the image or commit it to Git. Put TLS termination in a trusted reverse proxy and expose the PWA only through HTTPS.

## Required authentication environment

- `GOOGLE_CLIENT_ID`: OAuth 2.0 Web Client ID.
- `ERP_AUTH_SESSION_SECRET`: random server-only value, minimum 32 characters.
- `ERP_AUTH_MEMBERS_JSON`: valid membership JSON with at least one active Owner. Every active device that syncs must appear in that membership's `deviceIds`; every Sales membership must include a valid `salesId`.
- `ERP_OFFLINE_LEASE_PRIVATE_KEY`: server-only RSA private key (minimum 2048-bit) used to sign device-bound offline authorization leases valid for 72 hours.
- `VITE_ERP_OFFLINE_LEASE_PUBLIC_KEY`: matching PEM public key embedded in the PWA at build time. This public key is not secret; it must match the server private key.

Generate a dedicated keypair once and keep the private key outside Git:

```sh
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out offline-lease-private.pem
openssl pkey -in offline-lease-private.pem -pubout -out offline-lease-public.pem
```

Inject the private PEM into the server runtime as `ERP_OFFLINE_LEASE_PRIVATE_KEY` (literal newlines or `\\n`-escaped newlines are accepted). Supply the matching public PEM as `VITE_ERP_OFFLINE_LEASE_PUBLIC_KEY` when building the PWA. Never expose or commit the private key. Rotating this key requires deploying the matching new public key in a rebuilt PWA; existing offline leases signed by the old key will no longer verify after that client update.

Google Cloud OAuth configuration must include the exact production HTTPS origin as an authorized JavaScript origin. Use the same Web Client ID in the server and PWA. The first live login must be verified with an actual Google account that has an active Owner membership.

## Optional GAS gateway environment

Only required when the selected runtime backend is Google Sheets via GAS:

- `GAS_WEB_APP_URL`: HTTPS Apps Script Web App deployment URL.
- `GAS_SYNC_SHARED_SECRET`: minimum 32 characters; same value as GAS Script Property `SYNC_SHARED_SECRET`.
- `GAS_GATEWAY_HMAC_SECRET`: minimum 32 characters; same value as GAS Script Property `GAS_GATEWAY_HMAC_SECRET`.

GAS is optional. Do not set these values if another backend is selected.

## Health probes

- `GET /api/health/live`: process liveness only.
- `GET /api/health/ready`: production authentication readiness. Returns HTTP 503 until Google OAuth/session signing, a valid RSA offline-lease signing key, and at least one active Owner membership are configured. It reports only configuration booleans, never secrets or membership identifiers.

A successful readiness probe does not prove Google OAuth works or prove offline lease issuance. Complete a real login, lease issuance/verification, session revocation, device enrollment, and backend round-trip before go-live.

## Still required before production

1. Choose the hosting target and provision its persistent secret environment.
2. Configure the production domain, HTTPS, Google OAuth origin, and Owner membership.
3. Deploy the container and confirm both health probes.
4. Perform a real Google login and verify the returned role/session against the Owner account.
5. If GAS is selected, deploy the Apps Script, set Script Properties, and test push/pull through the authenticated gateway.
6. Run two-phone acceptance tests for offline resume, cursor continuity, conflicts, media, role isolation, backup, restore, revocation, and device limits.

No production host, domain, OAuth Client ID, membership registry, or server secrets are committed in this repository. Deployment remains unverified until the above is completed in the actual environment.
