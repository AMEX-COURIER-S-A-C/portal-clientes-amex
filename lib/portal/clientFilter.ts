import { SupabaseClient } from '@supabase/supabase-js';
import { cleanExactString, sanitizePostgrestFilterTerm } from './keywords';
import { isSuperadminEmail } from './superadmin';
import { isInternalStaffEmail } from './roles';

export interface ClientKeywordsInfo {
  isSuperadmin: boolean;
  isInternalStaff: boolean;
  hasGlobalWarehouseAccess: boolean;
  cleanEmail: string;
  keywords: string[];
}

/**
 * Obtiene las palabras clave y siglas asignadas a un cliente desde clientes_portal,
 * o concede acceso global de Warehouse a cuentas Superadmin y usuarios internos activos.
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
      keywords: [],
    };
  }

  const { data: profile } = await portalAdmin
    .from('clientes_portal')
    .select('alias_palabras_clave, nombre_completo')
    .eq('email', cleanEmail)
    .maybeSingle();

  const validKeywords: string[] = [];

  if (profile) {
    if (Array.isArray(profile.alias_palabras_clave)) {
      for (const k of profile.alias_palabras_clave) {
        const clean = cleanExactString(k);
        // Excluir cadenas vacías o la palabra genérica 'AMEX'
        if (clean && clean.length >= 2 && clean !== 'AMEX' && !validKeywords.includes(clean)) {
          validKeywords.push(clean);
        }
      }
    }
    const cleanNombre = cleanExactString(profile.nombre_completo);
    if (cleanNombre && cleanNombre.length >= 3 && cleanNombre !== 'AMEX' && !validKeywords.includes(cleanNombre)) {
      validKeywords.push(cleanNombre);
    }
  }

  return {
    isSuperadmin: false,
    isInternalStaff: false,
    hasGlobalWarehouseAccess: false,
    cleanEmail,
    keywords: validKeywords,
  };
}

/**
 * Aplica el filtro dinámico de cliente a cualquier consulta de paquetes_portal en Supabase.
 * - Si es Superadmin o usuario interno activo: acceso global irrestricto a todos los paquetes.
 * - Si tiene siglas/palabras clave asignadas: muestra los paquetes donde nombre_consignatario coincida con sus siglas.
 * - Si no tiene palabras clave: filtra por su usuario_email.
 */
export function applyClientScopeFilter(query: any, info: ClientKeywordsInfo): any {
  if (info.isSuperadmin || info.hasGlobalWarehouseAccess) {
    return query;
  }

  if (info.keywords.length > 0) {
    const conditions = info.keywords
      .map((kw) => kw.replace(/["'(),]/g, '').trim())
      .filter((safeKw) => safeKw.length >= 2)
      .map((safeKw) => `nombre_consignatario.ilike.*${safeKw}*`);
    if (conditions.length > 0) {
      return query.or(conditions.join(','));
    }
  }

  if (!info.cleanEmail) {
    return query.eq('usuario_email', '__invalid_empty_email__');
  }

  return query.eq('usuario_email', info.cleanEmail);
}
