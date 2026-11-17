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

## Owner Google Drive backup gateway

The PWA never receives a Google Drive access/refresh token and never calls the Drive API directly. Every enrolled Owner/Admin/Sales device sends its role-scoped backup through its in-memory ERP session and the server gateway. The server verifies the active membership and authorized Device ID; the gateway uses the one Owner-owned Google Drive refresh token and shared folder. Listing/downloading snapshots for full restore remains Owner-only and requires the ERP Owner email to match the configured Drive account.

Configure these server-only environment variables:

- `GOOGLE_DRIVE_CLIENT_ID`: OAuth Web Client ID (may reuse `GOOGLE_CLIENT_ID`).
- `GOOGLE_DRIVE_CLIENT_SECRET`: matching OAuth client secret.
- `GOOGLE_DRIVE_REFRESH_TOKEN`: offline refresh token issued to the Owner Google account.
- `GOOGLE_DRIVE_OWNER_EMAIL`: exact Owner Google email; must match both the ERP Owner membership and Drive refresh-token profile.
- `GOOGLE_DRIVE_FOLDER_ID`: ID of the one shared folder named exactly `ERP DAGING BACKUP`.

Enable the Google Drive API for the OAuth project. Obtain an offline refresh token for the Owner account with the least-privilege Drive file scope `https://www.googleapis.com/auth/drive.file` plus `openid email`, using `access_type=offline`. Do not create the folder manually. Run `bun run setup:drive-folder` locally with the four OAuth/Owner variables set; the script verifies the Owner account, creates or reuses the app-owned folder, and prints `GOOGLE_DRIVE_FOLDER_ID`. Copy that ID into the server environment. Never commit the client secret, refresh token, or production environment file.

The gateway writes immutable/versioned JSON snapshots and stores JPEG attachments as separate Drive files. It verifies the backup envelope checksum, attachment SHA-256 and size, manifest integrity, folder ownership, and backup ID idempotency. A repeated upload with the same backup ID/content reuses the existing snapshot rather than overwriting it. Every enrolled device may upload its own snapshot/attachments without per-run Owner approval. Only Owner can list/download snapshots for full-store restore; Sales projection snapshots are not eligible for full restore. A daily recovery snapshot is attempted while the PWA is active and online; newly changed pending Outbox data is batched at a minimum 10-minute interval. Browsers do not guarantee background execution while closed.

No per-device Drive OAuth, per-device folder, or browser-held Drive token is used. All devices use the same Owner Drive account and the same shared folder.

For this internal deployment, run one backend server instance. The server keeps a short-lived (10-second) in-memory Sales ownership index and invalidates it after every successful event push. Do not horizontally scale long-lived API instances until this cache is moved to shared storage; this avoids stale customer/invoice ownership across replicas.

## Health probes

- `GET /api/health/live`: process liveness only.
- `GET /api/health/ready`: production authentication readiness.
- `GET /api/backup/drive/status`: authenticated, device-bound status check; reports whether optional Drive backup is configured without exposing credentials. Returns HTTP 503 until Google OAuth/session signing, a valid RSA offline-lease signing key, and at least one active Owner membership are configured. Google Drive is optional and does not block API readiness; its configuration status is reported separately. The probe reports only configuration booleans, never secrets or membership identifiers.

A successful readiness probe does not prove Google OAuth works or prove offline lease issuance. Complete a real login, lease issuance/verification, session revocation, device enrollment, and backend round-trip before go-live.

## Still required before production

1. Choose the hosting target and provision its persistent secret environment.
2. Configure the production domain, HTTPS, Google OAuth origin, and Owner membership.
3. Deploy the container and confirm both health probes.
4. Perform a real Google login and verify the returned role/session against the Owner account.
5. If GAS is selected, deploy the Apps Script, set Script Properties, and test push/pull through the authenticated gateway.
6. Run two-phone acceptance tests for offline resume, cursor continuity, conflicts, media, role isolation, backup, restore, revocation, and device limits.

No production host, domain, OAuth Client ID, membership registry, or server secrets are committed in this repository. Deployment remains unverified until the above is completed in the actual environment.
