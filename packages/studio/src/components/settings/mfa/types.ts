export type MFAMethodType = 'totp' | 'email';

export interface MFAMethod {
  type: MFAMethodType;
  enabled: boolean;
  verified: boolean;
  verifiedAt?: string;
}

export interface TrustedDevice {
  id: string;
  name: string;
  trustedAt: string;
  expiresAt: string;
  lastUsedAt?: string;
}

export interface MFAStatus {
  enabled: boolean;
  methods: MFAMethod[];
  backupCodesRemaining: number;
  backupCodesGeneratedAt?: string;
  trustedDevicesCount: number;
}

export type SetupStep =
  | 'idle'
  | 'totp-qr'
  | 'totp-verify'
  | 'email-verify'
  | 'backup-codes';
