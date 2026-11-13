import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Enlaces firmados para fotos de paquetes.
 * El token es HMAC-SHA256(secret, `${WR}.${index}`) en base64url (truncado a 32 chars),
 * por lo que no se puede adivinar un WR vecino para ver fotos de otros clientes.
 * Mismo algoritmo en worker/tib-mirror-daemon.mjs (VPS).
 */
export function signPhotoToken(wr: string, index: number, secret: string): string {
  return createHmac('sha256', secret)
    .update(`${wr.toUpperCase()}.${index}`)
    .digest('base64url')
    .slice(0, 32);
}

export function verifyPhotoToken(wr: string, index: number, token: string, secret: string): boolean {
  if (!secret || !token) return false;
  const expected = Buffer.from(signPhotoToken(wr, index, secret));
  const received = Buffer.from(token);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/**
 * Construye la ruta relativa firmada hacia el proxy /api/foto/<WR>/<n>?t=<token>.
 */
export function buildSignedPhotoPath(wr: string, index: number, secret: string): string {
  const cleanWr = wr.trim().toUpperCase();
  const token = signPhotoToken(cleanWr, index, secret);
  return `/api/foto/${encodeURIComponent(cleanWr)}/${index + 1}?t=${token}`;
}
