import { SupabaseClient } from '@supabase/supabase-js';
import { isSuperadminEmail } from './superadmin';
import { isInternalStaffEmail } from './roles';
import {
  buildPostgrestMatchingOrFilter,
  normalizeMatchingRules,
} from './matching';

export interface ClientKeywordsInfo {
  isSuperadmin: boolean;
  isInternalStaff: boolean;
  hasGlobalWarehouseAccess: boolean;
  cleanEmail: string;
  exactConsignees: string[];
  groupKeywords: string[];
  /** Unión solo informativa (compatibilidad con lectores existentes) */
  keywords: string[];
}

/**
 * Obtiene las reglas de matching explícitas asignadas a un cliente desde clientes_portal
 * (`alias_palabras_clave` exactos + `palabras_clave_grupo` por palabra completa),
 * sin inyectar `nombre_completo` de forma oculta.
 * Concede acceso global de Warehouse a Superadmin y usuarios internos activos.
 */
export async function getClientKeywords(
  portalAdmin: SupabaseClient,
  rawEmail: string
): Promise<ClientKeywordsInfo> {
  const cleanEmail = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  if (!cleanEmail) {
    return {
      isSuperadmin: false,
      isInternalStaff: false,
      hasGlobalWarehouseAccess: false,
      cleanEmail: '',
      exactConsignees: [],
      groupKeywords: [],
      keywords: [],
    };
  }

  const isSuperadmin = isSuperadminEmail(cleanEmail);
  if (isSuperadmin) {
    return {
      isSuperadmin: true,
      isInternalStaff: false,
      hasGlobalWarehouseAccess: true,
      cleanEmail,
      exactConsignees: [],
      groupKeywords: [],
      keywords: [],
    };
  }

  if (isInternalStaffEmail(cleanEmail)) {
    const { data: staff } = await portalAdmin
      .from('usuarios_internos')
      .select('activo')
      .eq('auth_email', cleanEmail)
      .maybeSingle();

    const isActiveStaff = Boolean(staff && staff.activo !== false);
    return {
      isSuperadmin: false,
      isInternalStaff: isActiveStaff,
      hasGlobalWarehouseAccess: isActiveStaff,
      cleanEmail: isActiveStaff ? cleanEmail : '',
      exactConsignees: [],
      groupKeywords: [],
      keywords: [],
    };
  }

  const { data: profile } = await portalAdmin
    .from('clientes_portal')
    .select('alias_palabras_clave, palabras_clave_grupo')
    .eq('email', cleanEmail)
    .maybeSingle();

  const { exactConsignees, groupKeywords } = normalizeMatchingRules({
    exactConsignees: profile?.alias_palabras_clave,
    groupKeywords: profile?.palabras_clave_grupo,
    isSuperadmin: false,
    applyFallbackWhenEmpty: false,
  });

  return {
    isSuperadmin: false,
    isInternalStaff: false,
    hasGlobalWarehouseAccess: false,
    cleanEmail,
    exactConsignees,
    groupKeywords,
    keywords: [...exactConsignees, ...groupKeywords],
  };
}

/**
 * Aplica el filtro dinámico de cliente a cualquier consulta de paquetes_portal en Supabase:
 * - Superadmin o usuario interno activo: acceso global irrestricto.
 * - Cliente con reglas exactas o de grupo: filtro PostgREST `imatch` unificado
 *   (coincidencia exacta normalizada para `alias_palabras_clave` y palabra completa `\yTERM\y` para `palabras_clave_grupo`).
 * - Sin reglas configuradas: filtra estrictamente por `usuario_email`.
 */
export function applyClientScopeFilter(query: any, info: ClientKeywordsInfo): any {
  if (info.isSuperadmin || info.hasGlobalWarehouseAccess) {
    return query;
  }

  const orFilter = buildPostgrestMatchingOrFilter(
    'nombre_consignatario',
    info.exactConsignees,
    info.groupKeywords
  );

  if (orFilter) {
    return query.or(orFilter);
  }

  if (!info.cleanEmail) {
    return query.eq('usuario_email', '__invalid_empty_email__');
  }

  return query.eq('usuario_email', info.cleanEmail);
}
