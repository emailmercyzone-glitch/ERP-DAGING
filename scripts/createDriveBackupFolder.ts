import dotenv from 'dotenv';

dotenv.config();

const clientId = (process.env.GOOGLE_DRIVE_CLIENT_ID || '').trim();
const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET || '';
const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN || '';
const ownerEmail = (process.env.GOOGLE_DRIVE_OWNER_EMAIL || '').trim().toLowerCase();
const configuredFolderId = (process.env.GOOGLE_DRIVE_FOLDER_ID || '').trim();

function assertOk(response: Response, body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Google API mengirim respons tidak valid.');
  const record = body as Record<string, unknown>;
  if (!response.ok) {
    const error = record.error;
    const message = error && typeof error === 'object' && 'message' in error ? String((error as { message: unknown }).message) : 'Google API request gagal.';
    throw new Error(message);
  }
  return record;
}

async function main() {
  if (!clientId || !clientSecret || !refreshToken || !ownerEmail) {
    throw new Error('Isi GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_DRIVE_REFRESH_TOKEN, dan GOOGLE_DRIVE_OWNER_EMAIL di environment lokal.');
  }
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      client_id: clientId, client_secret: clientSecret,
      refresh_token: refreshToken, grant_type: 'refresh_token',
    }),
  });
  const tokenBody = assertOk(tokenResponse, await tokenResponse.json());
  const accessToken = String(tokenBody.access_token || '');
  if (!accessToken) throw new Error('Google tidak menerbitkan access token.');
  const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  const profile = assertOk(profileResponse, await profileResponse.json());
  if (profile.email_verified !== true || String(profile.email || '').toLowerCase() !== ownerEmail) {
    throw new Error('Refresh token bukan milik GOOGLE_DRIVE_OWNER_EMAIL.');
  }

  const headers = { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' };
  let folderId = configuredFolderId;
  if (folderId) {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,name,mimeType,owners(emailAddress),trashed`, { headers });
    const folder = assertOk(response, await response.json());
    const owners = Array.isArray(folder.owners) ? folder.owners as Array<Record<string, unknown>> : [];
    if (folder.name !== 'ERP DAGING BACKUP' || folder.mimeType !== 'application/vnd.google-apps.folder' ||
        folder.trashed === true || !owners.some((owner) => String(owner.emailAddress || '').toLowerCase() === ownerEmail)) {
      throw new Error('Folder ID yang dikonfigurasi bukan folder ERP DAGING BACKUP milik Owner.');
    }
  } else {
    const query = new URLSearchParams({
      q: `name = 'ERP DAGING BACKUP' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      pageSize: '100', fields: 'files(id,name,mimeType,owners(emailAddress),appProperties)',
    });
    const listResponse = await fetch(`https://www.googleapis.com/drive/v3/files?${query.toString()}`, { headers });
    const list = assertOk(listResponse, await listResponse.json());
    const folders = Array.isArray(list.files) ? list.files as Array<Record<string, unknown>> : [];
    const ownedFolders = folders.filter((folder) => {
      const owners = Array.isArray(folder.owners) ? folder.owners as Array<Record<string, unknown>> : [];
      return owners.some((owner) => String(owner.emailAddress || '').toLowerCase() === ownerEmail) &&
        folder.mimeType === 'application/vnd.google-apps.folder';
    });
    if (ownedFolders.length > 1) throw new Error('Lebih dari satu folder bernama ERP DAGING BACKUP ditemukan; rapikan manual agar hanya ada satu folder.');
    if (ownedFolders.length === 1) {
      folderId = String(ownedFolders[0].id || '');
    } else {
      const createResponse = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,owners(emailAddress)', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'ERP DAGING BACKUP',
          mimeType: 'application/vnd.google-apps.folder',
          appProperties: { app: 'ERP_DAGING', backupType: 'folder' },
        }),
      });
      const created = assertOk(createResponse, await createResponse.json());
      folderId = String(created.id || '');
    }
  }
  if (!folderId) throw new Error('Google Drive tidak mengembalikan Folder ID.');
  process.stdout.write(`Google Drive Owner terverifikasi: ${ownerEmail}\n`);
  process.stdout.write(`Folder ERP DAGING BACKUP siap. Tambahkan ke server environment:\nGOOGLE_DRIVE_FOLDER_ID=${folderId}\n`);
}

main().catch((error) => {
  process.stderr.write(`Drive folder setup gagal: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
