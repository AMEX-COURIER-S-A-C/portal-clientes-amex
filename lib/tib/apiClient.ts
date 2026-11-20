/**
 * AMEX COURIER - CLIENTE Y UTILIDADES DE INTEGRACIÓN CON LA API DE TIB
 */

export const DEFAULT_TIB_API_URL = 'https://www.tibcourier.com/api/list-warehouse';
export const TIB_MEDIA_BASE_URL = 'https://www.tibcourier.com/global-courier/ajax/';
export const DEFAULT_TIB_V2_API_URL = 'https://api.tibgrupo.com';
export const AUTHORIZED_TIB_MEDIA_HOSTS = new Set(['www.tibcourier.com', 'www.tibgrupo.com']);

export function getTibApiCredentials(): { url: string; email: string; password: string } {
  const url = (process.env.TIB_API_URL || DEFAULT_TIB_API_URL).trim();
  const email = (process.env.TIB_API_EMAIL || '').trim();
  const password = (process.env.TIB_API_PASSWORD || '').trim();

  if (!email || !password) {
    throw new Error('Faltan las credenciales TIB_API_EMAIL o TIB_API_PASSWORD en las variables de entorno.');
  }

  return { url, email, password };
}

export function isTibV2Configured(): boolean {
  const email = (process.env.TIB_V2_EMAIL || '').trim();
  const password = (process.env.TIB_V2_PASSWORD || '').trim();
  return Boolean(email && password);
}

export function getTibV2Credentials(): { baseUrl: string; email: string; password: string } {
  const baseUrl = (process.env.TIB_V2_API_URL || DEFAULT_TIB_V2_API_URL).trim().replace(/\/+$/, '');
  const email = (process.env.TIB_V2_EMAIL || '').trim();
  const password = (process.env.TIB_V2_PASSWORD || '').trim();

  if (!email || !password) {
    throw new Error('Faltan las credenciales TIB_V2_EMAIL o TIB_V2_PASSWORD en las variables de entorno.');
  }

  return { baseUrl, email, password };
}

/**
 * Extrae el ID numérico de warehouse para Cargo System (ej: "WR000506539" -> 506539).
 * Evita enviar cadenas "WR..." que provocan HTTP 500 (NaN) en la API de TIB v2.
 */
export function extractNumericWrId(rawWr: unknown): number | null {
  const digits = String(rawWr || '').replace(/\D/g, '');
  if (!digits) return null;
  const parsed = Number.parseInt(digits, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return null;
  return parsed;
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
