/**
 * AMEX COURIER - CLIENTE Y UTILIDADES DE INTEGRACIÓN CON LA API DE TIB
 */

export const DEFAULT_TIB_API_URL = 'https://www.tibcourier.com/api/list-warehouse';
export const TIB_MEDIA_BASE_URL = 'https://www.tibcourier.com/global-courier/ajax/';

export function getTibApiCredentials(): { url: string; email: string; password: string } {
  const url = (process.env.TIB_API_URL || DEFAULT_TIB_API_URL).trim();
  const email = (process.env.TIB_API_EMAIL || '').trim();
  const password = (process.env.TIB_API_PASSWORD || '').trim();

  if (!email || !password) {
    throw new Error('Faltan las credenciales TIB_API_EMAIL o TIB_API_PASSWORD en las variables de entorno.');
  }

  return { url, email, password };
}

/**
 * Convierte cualquier representación de WR de TIB ("000485581", "485581", "WR000485581")
 * al formato canónico estándar: WR + 9 dígitos (ej: "WR000485581").
 */
export function normalizeTibWr(rawWr: unknown, seqwr?: unknown): string {
  const str = String(rawWr || seqwr || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();

  if (!str) return '';

  if (/^WR[A-Z0-9]{9}$/.test(str)) {
    return str;
  }

  const digits = str.replace(/\D/g, '');
  if (digits.length > 0 && digits.length <= 9) {
    return `WR${digits.padStart(9, '0')}`;
  }

  if (str.startsWith('WR') && digits.length > 0) {
    return `WR${digits.padStart(9, '0')}`;
  }

  return str;
}
