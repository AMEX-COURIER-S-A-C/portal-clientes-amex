import { ClientKeywordsInfo, applyClientScopeFilter } from './clientFilter';
import { parseLimaDateRangeBound } from './limaTime';

export interface PackageQueryFilters {
  wr?: string;
  tracking?: string;
  consignatario?: string;
  tipo?: string;
  estado?: string;
  fechaTipo?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  pesoMin?: string | number;
  pesoMax?: string | number;
}

/**
 * Aplica de forma unificada el alcance del cliente y los filtros de búsqueda
 * tanto para /api/paquetes-portal como para /api/exportar-excel.
 */
export function applyPackageQueryFilters(
  query: any,
  clientInfo: ClientKeywordsInfo,
  filters: PackageQueryFilters = {}
): any {
  let q = applyClientScopeFilter(query, clientInfo);

  const {
    wr = '',
    tracking = '',
    consignatario = '',
    tipo = '',
    estado = '',
    fechaTipo = 'creado_en',
    fechaDesde = '',
    fechaHasta = '',
    pesoMin = '',
    pesoMax = '',
  } = filters;

  if (wr && typeof wr === 'string' && wr.trim()) {
    q = q.ilike('numero_recibo_bodega', `%${wr.trim()}%`);
  }
  if (tracking && typeof tracking === 'string' && tracking.trim()) {
    q = q.ilike('tracking', `%${tracking.trim()}%`);
  }
  if (consignatario && typeof consignatario === 'string' && consignatario.trim()) {
    q = q.eq('nombre_consignatario', consignatario.trim());
  }
  if (tipo && typeof tipo === 'string' && tipo.trim()) {
    q = q.eq('tipo_empaque', tipo.trim());
  }
  if (estado && typeof estado === 'string' && estado.trim()) {
    q = q.eq('estado_tib', estado.trim().toUpperCase());
  }

  const colFecha = fechaTipo === 'actualizado_en' ? 'actualizado_en' : 'creado_en';
  if (fechaDesde && typeof fechaDesde === 'string' && fechaDesde.trim()) {
    const startIso = parseLimaDateRangeBound(fechaDesde, 'start');
    if (startIso) {
      q = q.gte(colFecha, startIso);
    }
  }
  if (fechaHasta && typeof fechaHasta === 'string' && fechaHasta.trim()) {
    const endIso = parseLimaDateRangeBound(fechaHasta, 'end');
    if (endIso) {
      q = q.lte(colFecha, endIso);
    }
  }

  if (pesoMin !== undefined && String(pesoMin).trim() !== '' && !isNaN(Number(pesoMin))) {
    q = q.gte('peso_kg', Number(pesoMin));
  }
  if (pesoMax !== undefined && String(pesoMax).trim() !== '' && !isNaN(Number(pesoMax))) {
    q = q.lte('peso_kg', Number(pesoMax));
  }

  return q;
}
