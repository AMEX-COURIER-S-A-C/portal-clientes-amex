export const ADMIN_MASTER_EMAIL = 'sistemaamexcourier@gmail.com';

export const SUPERADMIN_EMAILS: readonly string[] = [
  'sistemaamexcourier@gmail.com',
  'gerencia@amexcourierperu.com',
];

/**
 * Verifica si un correo electrónico pertenece a una cuenta Superadmin autorizada.
 */
export function isSuperadminEmail(email?: string | null): boolean {
  if (!email || typeof email !== 'string') return false;
  const clean = email.trim().toLowerCase();
  return SUPERADMIN_EMAILS.includes(clean);
}
