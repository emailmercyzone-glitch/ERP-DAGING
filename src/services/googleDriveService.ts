/**
 * Google Drive Integration Service for ERP Daging Import Sampora Banten
 * Uses client-side Firebase Auth + Google OAuth 2.0 with in-memory token storage.
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as fbSignOut, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Inisialisasi Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// In-Memory Token Cache (CRITICAL: Never store tokens in localStorage/sessionStorage)
let inMemoryAccessToken: string | null = null;

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  webContentLink?: string;
  size?: string;
  createdTime?: string;
}

export interface DriveUploadResult {
  file: DriveFileItem;
  folderId: string;
  folderName: string;
}

export const ERP_DRIVE_FOLDER_NAME = 'ERP Daging Sampora Banten - Arsip Resmi';

/**
 * Cek status token in-memory
 */
export function getCachedDriveAccessToken(): string | null {
  return inMemoryAccessToken;
}

/**
 * Set atau update token in-memory
 */
export function setCachedDriveAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
}

/**
 * Login Google dengan Scopes Google Drive
 */
export async function loginWithGoogleDrive(): Promise<{ user: User; accessToken: string }> {
  const provider = new GoogleAuthProvider();
  
  // Scopes Google Drive
  provider.addScope('https://www.googleapis.com/auth/drive');
  provider.addScope('https://www.googleapis.com/auth/drive.file');
  provider.setCustomParameters({
    prompt: 'select_account'
  });

  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const token = credential?.accessToken;

  if (!token) {
    throw new Error('Gagal mendapatkan OAuth Access Token dari Google. Silakan coba lagi.');
  }

  inMemoryAccessToken = token;
  return {
    user: result.user,
    accessToken: token
  };
}

/**
 * Logout Google Drive
 */
export async function logoutGoogleDrive(): Promise<void> {
  inMemoryAccessToken = null;
  await fbSignOut(auth);
}

/**
 * Listener Perubahan Status Login
 */
export function subscribeToDriveAuth(callback: (user: User | null, hasToken: boolean) => void) {
  return onAuthStateChanged(auth, (user) => {
    callback(user, inMemoryAccessToken !== null);
  });
}

/**
 * Cari atau buat folder ERP resmi di Google Drive
 */
export async function getOrCreateErpFolder(accessToken: string, folderName = ERP_DRIVE_FOLDER_NAME): Promise<string> {
  const query = encodeURIComponent(`mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and trashed = false`);
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&spaces=drive`;

  const searchRes = await fetch(searchUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json'
    }
  });

  if (!searchRes.ok) {
    const errText = await searchRes.text();
    throw new Error(`Google Drive API Search Error (${searchRes.status}): ${errText}`);
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Jika folder belum ada, buat folder baru
  const createUrl = 'https://www.googleapis.com/drive/v3/files';
  const createRes = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Folder arsip dokumen transaksi, surat jalan, dan laporan keuangan ERP Daging Import Sampora Banten'
    })
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Google Drive API Folder Create Error (${createRes.status}): ${errText}`);
  }

  const newFolder = await createRes.json();
  return newFolder.id;
}

/**
 * Upload Dokumen PDF atau File ke Google Drive (Multipart Upload)
 */
export async function uploadPdfToDrive(options: {
  accessToken: string;
  blob: Blob;
  filename: string;
  description?: string;
  folderName?: string;
}): Promise<DriveUploadResult> {
  const { accessToken, blob, filename, description, folderName = ERP_DRIVE_FOLDER_NAME } = options;

  // 1. Dapatkan folder ID
  const folderId = await getOrCreateErpFolder(accessToken, folderName);

  // 2. Siapkan multipart upload
  const metadata = {
    name: filename,
    parents: [folderId],
    description: description || 'Dokumen resmi diekspor otomatis dari ERP Daging Import Sampora Banten',
    mimeType: 'application/pdf'
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadataPart = delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata);

  const filePartHeader = delimiter +
    'Content-Type: application/pdf\r\n\r\n';

  // Gabungkan parts ke dalam satu ArrayBuffer / Blob
  const blobBuffer = await blob.arrayBuffer();
  const multipartBlob = new Blob([
    metadataPart,
    filePartHeader,
    new Uint8Array(blobBuffer),
    closeDelimiter
  ], { type: `multipart/related; boundary=${boundary}` });

  const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink,size,createdTime';

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartBlob
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Google Drive Upload Error (${uploadRes.status}): ${errText}`);
  }

  const uploadedFile = await uploadRes.json();
  return {
    file: uploadedFile,
    folderId,
    folderName
  };
}

/**
 * Daftar File Dokumen ERP yang ada di folder Google Drive
 */
export async function listErpDriveFiles(accessToken: string, folderName = ERP_DRIVE_FOLDER_NAME): Promise<DriveFileItem[]> {
  try {
    const folderId = await getOrCreateErpFolder(accessToken, folderName);
    const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const listUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,webViewLink,webContentLink,size,createdTime)&orderBy=createdTime desc&pageSize=15`;

    const res = await fetch(listUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      }
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    return data.files || [];
  } catch (error) {
    console.error('Error listing Drive files:', error);
    return [];
  }
}
