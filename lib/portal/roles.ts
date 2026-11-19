import { isSuperadminEmail } from './superadmin';

export type PortalRole = 'superadmin' | 'interno' | 'cliente';

/**
 * Dominio sintético no enrutable usado en Supabase Auth para usuarios internos
 * que inician sesión únicamente con nombre de usuario + contraseña.
 */
export const INTERNAL_EMAIL_DOMAIN = '@interno.amex.local';

export const INTERNAL_USERNAME_REGEX = /^[a-z0-9._-]{3,32}$/;

export function normalizeInternalUsername(raw: unknown): string {
  return String(raw || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/\s+/g, '');
}

export function isValidInternalUsername(username: string): boolean {
  return INTERNAL_USERNAME_REGEX.test(username);
}

export function usernameToInternalAuthEmail(username: string): string {
  return `${normalizeInternalUsername(username)}${INTERNAL_EMAIL_DOMAIN}`;
}

export function isInternalStaffEmail(email?: string | null): boolean {
  if (!email || typeof email !== 'string') return false;
  return email.trim().toLowerCase().endsWith(INTERNAL_EMAIL_DOMAIN);
}

export function extractInternalUsername(email?: string | null): string {
  if (!isInternalStaffEmail(email)) return '';
  const clean = String(email).trim().toLowerCase();
  return clean.slice(0, -INTERNAL_EMAIL_DOMAIN.length);
}

export function getStaticRoleFromEmail(email?: string | null): PortalRole {
  if (isSuperadminEmail(email)) return 'superadmin';
  if (isInternalStaffEmail(email)) return 'interno';
  return 'cliente';
}

export function resolveLoginIdentifier(rawIdentifier: string): {
  authEmail: string;
  isInternal: boolean;
  username: string | null;
} {
  const clean = String(rawIdentifier || '').trim().toLowerCase();
  if (!clean) {
    return { authEmail: '', isInternal: false, username: null };
  }
  if (!clean.includes('@')) {
    const username = normalizeInternalUsername(clean);
    return {
      authEmail: usernameToInternalAuthEmail(username),
      isInternal: true,
      username,
    };
  }
  if (isInternalStaffEmail(clean)) {
    return {
      authEmail: clean,
      isInternal: true,
      username: extractInternalUsername(clean),
    };
  }
  return {
    authEmail: clean,
    isInternal: false,
    username: null,
  };
}
