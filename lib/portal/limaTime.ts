/**
 * Utilidades canónicas de fecha y zona horaria para AMEX Courier Perú (America/Lima, UTC-5 permanente).
 * Módulo autocontenido (sin imports relativos sin extensión) para pruebas directas con `node --test`.
 */

export const LIMA_TIME_ZONE = 'America/Lima';
export const LIMA_UTC_OFFSET = '-05:00';

const YMD_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

function getLimaCalendarParts(date: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: LIMA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatYmd(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/**
 * Convierte una fecha de filtro (`YYYY-MM-DD`) en el límite ISO-8601 UTC exacto
 * correspondiente a `00:00:00.000-05:00` (start) o `23:59:59.999-05:00` (end) en America/Lima.
 */
export function parseLimaDateRangeBound(
  rawDate: string | null | undefined,
  boundary: 'start' | 'end'
): string | null {
  const clean = String(rawDate || '').trim();
  if (!clean) return null;

  const ymd = clean.match(YMD_REGEX);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]);
    const day = Number(ymd[3]);
    // Validar existencia real en calendario gregoriano (evita rollover de fechas como 2026-02-31)
    const check = new Date(Date.UTC(year, month - 1, day));
    if (
      check.getUTCFullYear() !== year ||
      check.getUTCMonth() + 1 !== month ||
      check.getUTCDate() !== day
    ) {
      return null;
    }

    const timePart = boundary === 'end' ? '23:59:59.999' : '00:00:00.000';
    const d = new Date(`${clean}T${timePart}${LIMA_UTC_OFFSET}`);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  // Si ya trae hora explícita con offset o Z, respetarlo; si no trae offset, asumir Lima (-05:00)
  const hasExplicitTz = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(clean);
  const candidate = hasExplicitTz ? clean : `${clean}${LIMA_UTC_OFFSET}`;
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * Formatea un Date como `YYYY-MM-DD` en zona horaria America/Lima (UTC-5).
 */
export function formatLimaDateForInput(d: Date): string {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const { year, month, day } = getLimaCalendarParts(d);
  return formatYmd(year, month, day);
}

/**
 * Calcula los rangos de presets rápidos ("today", "yesterday", "7days", "30days", "thisMonth", "lastMonth")
 * anclados estrictamente al calendario de America/Lima, sin depender de la zona horaria del navegador.
 */
export function getLimaDatePresetRange(
  preset: string,
  referenceDate: Date = new Date()
): { desde: string; hasta: string } {
  if (preset === 'all') {
    return { desde: '', hasta: '' };
  }

  const { year, month, day } = getLimaCalendarParts(referenceDate);
  const todayStr = formatYmd(year, month, day);

  const shiftDays = (deltaDays: number): string => {
    const shifted = new Date(Date.UTC(year, month - 1, day + deltaDays));
    return formatYmd(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
  };

  if (preset === 'today') {
    return { desde: todayStr, hasta: todayStr };
  }
  if (preset === 'yesterday') {
    const yestStr = shiftDays(-1);
    return { desde: yestStr, hasta: yestStr };
  }
  if (preset === '7days') {
    return { desde: shiftDays(-6), hasta: todayStr };
  }
  if (preset === '30days') {
    return { desde: shiftDays(-29), hasta: todayStr };
  }
  if (preset === 'thisMonth') {
    return { desde: formatYmd(year, month, 1), hasta: todayStr };
  }
  if (preset === 'lastMonth') {
    const prevFirst = new Date(Date.UTC(year, month - 2, 1));
    const prevLast = new Date(Date.UTC(year, month - 1, 0));
    return {
      desde: formatYmd(prevFirst.getUTCFullYear(), prevFirst.getUTCMonth() + 1, prevFirst.getUTCDate()),
      hasta: formatYmd(prevLast.getUTCFullYear(), prevLast.getUTCMonth() + 1, prevLast.getUTCDate()),
    };
  }

  return { desde: '', hasta: '' };
}

/**
 * Formatea un timestamp ISO a `{ date: 'DD/MM/YYYY', time: 'HH:MM:SS' }` en hora de Lima (UTC-5).
 */
export function formatLimaDateTimeParts(isoString?: string | null): { date: string; time: string } {
  if (!isoString) return { date: '—', time: '' };
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return { date: '—', time: '' };
    const { year, month, day, hour, minute, second } = getLimaCalendarParts(d);
    return {
      date: `${pad2(day)}/${pad2(month)}/${year}`,
      time: `${pad2(hour)}:${pad2(minute)}:${pad2(second)}`,
    };
  } catch {
    return { date: '—', time: '' };
  }
}

/**
 * Formatea un timestamp ISO a `'DD/MM/YYYY HH:MM:SS'` en hora de Lima (para exportación Excel).
 */
export function formatLimaDateTimeString(isoString?: string | null): string {
  const { date, time } = formatLimaDateTimeParts(isoString);
  if (date === '—') return '—';
  return time ? `${date} ${time}` : date;
}
