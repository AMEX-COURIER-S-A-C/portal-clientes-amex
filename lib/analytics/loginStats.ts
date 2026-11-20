/**
 * Utilidades puras para métricas históricas de inicios de sesión de clientes.
 * Módulo autocontenido (sin alias `@/`) para pruebas unitarias directas con `node --test`.
 */

const LIMA_DAY_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Lima',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export interface LoginEventRow {
  usuario_email?: string | null;
  creado_en?: string | null;
}

export interface HistoricalLoginSummary {
  totalLoginsHistoricos: number;
  loginsHoy: number;
  clientesConLoginHistorico: number;
}

export function getLimaDayKeyFromValue(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  return LIMA_DAY_FMT.format(d);
}

/**
 * Resume todos los eventos históricos `LOGIN_EXITOSO` filtrando solo clientes reales
 * y calculando los inicios de sesión acumulados + los del día actual en America/Lima.
 */
export function summarizeHistoricalClientLogins(
  rows: LoginEventRow[],
  options: {
    todayLimaKey?: string;
    isEligibleClientEmail?: (email: string) => boolean;
  } = {}
): HistoricalLoginSummary {
  const todayKey = options.todayLimaKey || getLimaDayKeyFromValue(new Date());
  const isEligible = options.isEligibleClientEmail ?? ((email: string) => Boolean(email));

  let totalLoginsHistoricos = 0;
  let loginsHoy = 0;
  const uniqueClients = new Set<string>();

  for (const row of rows || []) {
    const email = String(row?.usuario_email || '').trim().toLowerCase();
    if (!email || !isEligible(email)) continue;

    totalLoginsHistoricos++;
    uniqueClients.add(email);

    if (row?.creado_en) {
      const evDayKey = getLimaDayKeyFromValue(row.creado_en);
      if (evDayKey && evDayKey === todayKey) {
        loginsHoy++;
      }
    }
  }

  return {
    totalLoginsHistoricos,
    loginsHoy,
    clientesConLoginHistorico: uniqueClients.size,
  };
}
