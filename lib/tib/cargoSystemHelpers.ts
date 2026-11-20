/**
 * Funciones puras de normalización y mapeo para la API TIB v2 (Cargo System - api.tibgrupo.com).
 * Módulo autocontenido (sin imports relativos sin extensión) para ser probado directamente con `node --test`.
 */

export const CARGO_SYSTEM_STATUSES = [
  'PRERECEIVED',
  'RECEIVED',
  'IN_TRANSIT',
  'TEMP_ASSIGNED',
  'ASSIGNED',
  'DELIVERED',
] as const;

export const CARGO_SYNC_STATUSES = [
  'RECEIVED',
  'IN_TRANSIT',
  'TEMP_ASSIGNED',
  'ASSIGNED',
  'DELIVERED',
] as const;

export type CargoSystemStatus = (typeof CARGO_SYSTEM_STATUSES)[number];
export type PortalTibStatus = 'RECIBIDO' | 'ENVIADO' | 'ENTREGADO';

export const PORTAL_STATUS_PRIORITY: Record<PortalTibStatus, number> = {
  RECIBIDO: 1,
  ENVIADO: 2,
  ENTREGADO: 3,
};

export interface RawCargoWarehouseItem {
  id?: number | string | null;
  tracking?: string | null;
  secondTracking?: string | null;
  idClient?: number | string | null;
  nameClient?: string | null;
  emailClient?: string | null;
  nameConsignee?: string | null;
  description?: string | null;
  postalService?: string | null;
  container?: string | null;
  rack?: string | null;
  weight?: string | number | null;
  status?: string | null;
  photoUrl?: string | null;
  pdfUrl?: string | null;
  dateRegister?: string | null;
  dateModify?: string | null;
  _fetchedStatus?: string | null;
}

export interface NormalizedCargoPackage {
  numericId: number;
  canonicalWr: string;
  tracking: string | null;
  nombreConsignatario: string;
  tipoEmpaque: string;
  pesoKg: number;
  estadoTib: PortalTibStatus;
  rawStatus: string;
  tibImagenUrl: string | null;
  tibTicketPdfUrl: string;
  ubicacionAlmacen: string | null;
  creadoEn: string;
  modificadoEn: string | null;
  clientEmail: string | null;
}

/**
 * Limpia textos devueltos por Cargo System, convirtiendo literales "null" / "undefined" en null real.
 */
export function cleanNullableText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (lower === 'null' || lower === 'undefined') return null;
  return trimmed;
}

/**
 * Convierte un ID numérico de Cargo System (ej. 506539) al WR canónico del portal ("WR000506539").
 */
export function formatCargoCanonicalWr(rawId: unknown): { numericId: number; canonicalWr: string } | null {
  const digits = String(rawId ?? '').replace(/\D/g, '');
  if (!digits) return null;
  const numericId = Number.parseInt(digits, 10);
  if (!Number.isSafeInteger(numericId) || numericId <= 0) return null;
  const padded = digits.length <= 9 ? digits.padStart(9, '0') : digits;
  return { numericId, canonicalWr: `WR${padded}` };
}

/**
 * Traduce los estados de Cargo System al vocabulario oficial del Portal AMEX.
 */
export function mapCargoStatusToPortalStatus(rawStatus: unknown): PortalTibStatus {
  const norm = String(rawStatus || '').trim().toUpperCase();
  if (norm === 'DELIVERED' || norm === 'ENTREGADO') {
    return 'ENTREGADO';
  }
  if (
    norm === 'IN_TRANSIT' ||
    norm === 'TEMP_ASSIGNED' ||
    norm === 'ASSIGNED' ||
    norm === 'ENVIADO' ||
    norm === 'SHIPPED'
  ) {
    return 'ENVIADO';
  }
  return 'RECIBIDO';
}

const ALLOWED_PHOTO_HOSTS = new Set(['www.tibgrupo.com', 'www.tibcourier.com']);

/**
 * Normaliza `photoUrl` de Cargo System (soporta URL única o separadas por coma),
 * descartando "null", "sin_imagen" o hosts no autorizados.
 */
export function normalizeCargoPhotoUrls(rawPhotoUrl: unknown): string | null {
  const clean = cleanNullableText(rawPhotoUrl);
  if (!clean) return null;

  const validUrls: string[] = [];
  for (const part of clean.split(',')) {
    const candidate = cleanNullableText(part);
    if (!candidate || candidate.toLowerCase().includes('sin_imagen')) continue;
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === 'https:' && ALLOWED_PHOTO_HOSTS.has(parsed.hostname.toLowerCase())) {
        if (!validUrls.includes(candidate)) {
          validUrls.push(candidate);
        }
      }
    } catch {
      // Ignorar URL malformada
    }
  }

  return validUrls.length > 0 ? validUrls.join(',') : null;
}

export function buildCargoTicketReference(numericId: number): string {
  return `tibv2://receipt/${numericId}`;
}

/**
 * Formatea una fecha como YYYY-MM-DD (usada en query params startDate / endDate de Cargo System).
 */
export function formatDateYmdUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Convierte un registro crudo de Cargo System en un objeto normalizado listo para Supabase y Matching.
 */
export function mapCargoWarehouseToPortalItem(
  raw: RawCargoWarehouseItem,
  fallbackNowIso?: string
): NormalizedCargoPackage | null {
  const idInfo = formatCargoCanonicalWr(raw?.id);
  if (!idInfo) return null;

  const primaryClient = cleanNullableText(raw.nameClient);
  const fallbackConsignee = cleanNullableText(raw.nameConsignee);
  const nombreConsignatario = primaryClient || fallbackConsignee || '';

  const tracking = cleanNullableText(raw.tracking) || cleanNullableText(raw.secondTracking);

  const rawWeight = cleanNullableText(raw.weight);
  const parsedWeight = rawWeight !== null ? Number.parseFloat(rawWeight.replace(',', '.')) : 0;
  const pesoKg = Number.isFinite(parsedWeight) && parsedWeight >= 0 ? parsedWeight : 0;

  const tipoEmpaque = (
    cleanNullableText(raw.container) ||
    cleanNullableText(raw.description) ||
    'CAJA'
  ).toUpperCase();

  const rawStatus = String(raw.status || raw._fetchedStatus || 'RECEIVED').trim().toUpperCase();
  const estadoTib = mapCargoStatusToPortalStatus(rawStatus);

  const nowIso = fallbackNowIso || new Date().toISOString();
  let creadoEn = nowIso;
  const rawDateRegister = cleanNullableText(raw.dateRegister);
  if (rawDateRegister) {
    const parsedDate = new Date(rawDateRegister);
    if (!Number.isNaN(parsedDate.getTime())) {
      creadoEn = parsedDate.toISOString();
    }
  }

  let modificadoEn: string | null = null;
  const rawDateModify = cleanNullableText(raw.dateModify);
  if (rawDateModify) {
    const parsedMod = new Date(rawDateModify);
    if (!Number.isNaN(parsedMod.getTime())) {
      modificadoEn = parsedMod.toISOString();
    }
  }

  return {
    numericId: idInfo.numericId,
    canonicalWr: idInfo.canonicalWr,
    tracking,
    nombreConsignatario,
    tipoEmpaque,
    pesoKg,
    estadoTib,
    rawStatus,
    tibImagenUrl: normalizeCargoPhotoUrls(raw.photoUrl),
    tibTicketPdfUrl: buildCargoTicketReference(idInfo.numericId),
    ubicacionAlmacen: cleanNullableText(raw.rack),
    creadoEn,
    modificadoEn,
    clientEmail: cleanNullableText(raw.emailClient),
  };
}
