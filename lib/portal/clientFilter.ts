import { SupabaseClient } from '@supabase/supabase-js';
import { cleanExactString } from './syncTibToPortal';
import { isSuperadminEmail } from './superadmin';

export interface ClientKeywordsInfo {
  isSuperadmin: boolean;
  cleanEmail: string;
  keywords: string[];
}

/**
 * Obtiene las palabras clave y siglas asignadas a un cliente desde clientes_portal.
 * Permite que múltiples cuentas de correo compartan las mismas siglas sin conflicto.
 */
export async function getClientKeywords(
  portalAdmin: SupabaseClient,
  rawEmail: string
): Promise<ClientKeywordsInfo> {
  const cleanEmail = (rawEmail || '').trim().toLowerCase();
  const isSuperadmin = isSuperadminEmail(cleanEmail);

  if (isSuperadmin || !cleanEmail) {
    return { isSuperadmin: true, cleanEmail, keywords: [] };
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

  return { isSuperadmin: false, cleanEmail, keywords: validKeywords };
}

/**
 * Aplica el filtro dinámico de cliente a cualquier consulta de paquetes_portal en Supabase.
 * - Si es Superadmin: acceso global irrestricto a todos los paquetes.
 * - Si tiene siglas/palabras clave asignadas: muestra los paquetes donde usuario_email sea su correo
 *   O donde nombre_consignatario coincida con cualquiera de sus siglas (acceso multi-cuenta compartido).
 * - Si no tiene palabras clave: filtra por su usuario_email.
 */
export function applyClientScopeFilter(query: any, info: ClientKeywordsInfo): any {
  if (info.isSuperadmin) {
    return query;
  }

  if (info.keywords.length > 0) {
    const conditions = [
      `usuario_email.eq.${info.cleanEmail}`,
      ...info.keywords.map((kw) => {
        // Sanitizar caracteres especiales para la sintaxis de PostgREST
        const safeKw = kw.replace(/["'(),]/g, '').trim();
        return `nombre_consignatario.ilike.*${safeKw}*`;
      }),
    ];
    return query.or(conditions.join(','));
  }

  return query.eq('usuario_email', info.cleanEmail);
}
