import { createHmac, timingSafeEqual } from 'node:crypto';

export const TICKET_WR_REGEX = /^[A-Z0-9-]{3,30}$/;

const ALLOWED_LEGACY_TICKET_HOSTS = new Set(['www.tibcourier.com']);

/**
 * Enlaces firmados para Tickets PDF de paquetes.
 * Usa namespace `ticket.<WR>` distinto al de fotos para evitar reutilización cruzada de tokens.
 */
export function signTicketToken(wr: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(`ticket.${wr.trim().toUpperCase()}`)
    .digest('base64url')
    .slice(0, 32);
}

export function verifyTicketToken(wr: string, token: string, secret: string): boolean {
  if (!secret || !token || !wr) return false;
  const expected = Buffer.from(signTicketToken(wr, secret));
  const received = Buffer.from(token);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function isValidTicketWr(wr: string): boolean {
  return TICKET_WR_REGEX.test(wr.trim().toUpperCase());
}

export function buildSignedTicketPath(wr: string, secret: string): string {
  const cleanWr = wr.trim().toUpperCase();
  const token = signTicketToken(cleanWr, secret);
  return `/api/ticket/${encodeURIComponent(cleanWr)}?t=${token}`;
}

/**
 * Valida URLs históricas de tickets PDF alojadas en tibcourier.com (anti-SSRF).
 */
export function isAuthorizedLegacyTicketUrl(url?: string | null): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && ALLOWED_LEGACY_TICKET_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Extrae el ID numérico desde referencias internas `tibv2://receipt/<id>` o `tibv2://pdf/<id>`.
 */
export function parseTibV2TicketId(rawTicketUrl?: string | null): number | null {
  if (!rawTicketUrl) return null;
  const match = String(rawTicketUrl).trim().match(/^tibv2:\/\/(?:receipt|pdf)\/(\d+)$/i);
  if (!match) return null;
  const id = Number.parseInt(match[1], 10);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * Indica si un paquete tiene Ticket PDF descargable (vía TIB v2 o URL legacy).
 */
export function hasAvailableTicketPdf(rawTicketUrl?: string | null): boolean {
  if (!rawTicketUrl) return false;
  const trimmed = String(rawTicketUrl).trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return false;
  if (parseTibV2TicketId(trimmed) !== null) return true;
  return isAuthorizedLegacyTicketUrl(trimmed);
}
