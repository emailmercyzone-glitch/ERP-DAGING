export type DriveBackupAction = 'UPLOAD' | 'RESTORE';

export interface DriveBackupAccessInput {
  action: DriveBackupAction;
  role: string;
  sessionEmail?: string;
  ownerEmail: string;
  deviceAuthorized: boolean;
}

export type DriveBackupAccessDecision =
  | { allowed: true }
  | { allowed: false; code: 'DEVICE_NOT_AUTHORIZED' | 'OWNER_ONLY' | 'DRIVE_OWNER_MISMATCH'; message: string };

/**
 * Every enrolled device may send its own backup through the Owner-owned server
 * gateway. Listing/downloading snapshots for restore remains Owner-only.
 */
export function authorizeDriveBackupAccess(input: DriveBackupAccessInput): DriveBackupAccessDecision {
  if (!input.deviceAuthorized) {
    return {
      allowed: false,
      code: 'DEVICE_NOT_AUTHORIZED',
      message: 'Perangkat belum terdaftar pada membership ERP aktif.',
    };
  }
  if (input.action === 'UPLOAD') {
    if (input.role === 'OWNER' || input.role === 'ADMIN' || input.role === 'SALES') return { allowed: true };
    return { allowed: false, code: 'OWNER_ONLY', message: 'Role tidak diizinkan mengirim backup.' };
  }
  if (input.role !== 'OWNER') {
    return { allowed: false, code: 'OWNER_ONLY', message: 'Restore Google Drive hanya dapat dijalankan oleh Owner.' };
  }
  const ownerEmail = input.ownerEmail.trim().toLowerCase();
  const sessionEmail = (input.sessionEmail || '').trim().toLowerCase();
  if (!ownerEmail || !sessionEmail || sessionEmail !== ownerEmail) {
    return {
      allowed: false,
      code: 'DRIVE_OWNER_MISMATCH',
      message: 'Akun login ERP harus sama dengan akun Google Drive Owner yang dikonfigurasi.',
    };
  }
  return { allowed: true };
}
