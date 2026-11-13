import { TIB_MEDIA_BASE_URL } from '@/lib/tib/apiClient';

export const PHOTO_WR_REGEX = /^[A-Z0-9-]{3,30}$/;
export const MAX_PHOTO_INDEX = 20;

/**
 * Parsea la columna tib_imagen_url (posiblemente separada por comas y con rutas relativas)
 * filtrando marcadores vacíos o de ausencia de foto.
 */
export function parseTibImageUrls(rawUrl?: string | null): string[] {
  if (!rawUrl) return [];
  return String(rawUrl)
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !part.includes('sin_imagen') && part !== 'null' && part !== 'undefined')
    .map((part) => {
      if (part.startsWith('http://') || part.startsWith('https://')) {
        return part;
      }
      return `${TIB_MEDIA_BASE_URL}${part.replace(/^\/+/, '')}`;
    });
}

/**
 * Valida que el WR y el índice (0-based) tengan formato y rango permitidos para el proxy de fotos.
 */
export function isValidPhotoTarget(wr: string, index: number): boolean {
  return PHOTO_WR_REGEX.test(wr) && Number.isInteger(index) && index >= 0 && index <= MAX_PHOTO_INDEX;
}

/**
 * Comprueba que la URL resuelta pertenezca al host autorizado de TIB (evita SSRF).
 */
export function isAuthorizedTibPhotoUrl(url?: string | null): url is string {
  if (!url) return false;
  try {
    return new URL(url).hostname === 'www.tibcourier.com';
  } catch {
    return false;
  }
}
