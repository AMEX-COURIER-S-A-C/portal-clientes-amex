import { getPortalAdmin } from '@/lib/supabase/portal-admin';
import { ADMIN_MASTER_EMAIL, isSuperadminEmail } from '@/lib/portal/superadmin';
import { matchesConsigneeRule, normalizeMatchingRules } from '@/lib/portal/matching';

export interface PaqueteSyncData {
  id?: string;
  numero_recibo_bodega: string;
  tracking?: string | null;
  nombre_consignatario: string;
  usuario_email?: string | null;
  tipo_empaque?: string | null;
  peso_kg?: number | null;
  estado_tib?: string | null;
  estado_amex?: string | null;
  tib_imagen_url?: string | null;
  tib_ticket_pdf_url?: string | null;
  ubicacion_almacen?: string | null;
  creado_en?: string | null;
}

/**
 * Sincroniza uno o varios paquetes hacia la base de datos exclusiva del Portal de Clientes (us-west-2 Oregon).
 * Asigna automáticamente el usuario_email buscando coincidencias en clientes_portal por nombre o alias.
 */
export async function syncPackagesToClientPortal(packages: PaqueteSyncData[]) {
  if (!packages || packages.length === 0) return { success: true, count: 0 };

  const portalAdmin = getPortalAdmin();

  // 1. Obtener todos los clientes activos registrados en el portal (paginado sin tope de 1,000)
  const clientes: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error: cErr } = await portalAdmin
      .from('clientes_portal')
      .select('email, nombre_completo, alias_palabras_clave, palabras_clave_grupo')
      .eq('activo', true)
      .range(from, from + pageSize - 1);

    if (cErr) {
      console.error('[PortalSync] Error al obtener clientes_portal:', cErr);
      break;
    }
    if (!data || data.length === 0) break;
    clientes.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const clientesList = clientes
    .filter((c) => !isSuperadminEmail(c.email))
    .map((c) => ({
      email: c.email.trim().toLowerCase(),
      rules: normalizeMatchingRules({
        exactConsignees: c.alias_palabras_clave,
        groupKeywords: c.palabras_clave_grupo,
      }),
    }));

  // Motor unificado: coincidencia exacta normalizada + siglas de agencia por palabra completa
  const findClientEmail = (consignatario: string, explicitEmail?: string | null): string | null => {
    if (explicitEmail && explicitEmail.includes('@')) return explicitEmail.trim().toLowerCase();
    if (!consignatario) return null;

    for (const c of clientesList) {
      if (matchesConsigneeRule(consignatario, c.rules.exactConsignees, c.rules.groupKeywords)) {
        return c.email;
      }
    }

    // Si no coincide con ningún cliente registrado, se asigna por defecto al Superadmin Master
    return ADMIN_MASTER_EMAIL;
  };

  const recordsToUpsert = [];

  for (const pkg of packages) {
    const targetEmail = findClientEmail(pkg.nombre_consignatario, pkg.usuario_email);

    // Solo se publican si tienen un cliente asociado o si se especifica para un cliente
    if (targetEmail) {
      recordsToUpsert.push({
        numero_recibo_bodega: pkg.numero_recibo_bodega,
        tracking: pkg.tracking || null,
        nombre_consignatario: pkg.nombre_consignatario,
        usuario_email: targetEmail,
        tipo_empaque: pkg.tipo_empaque || 'CAJA',
        peso_kg: pkg.peso_kg != null ? Number(pkg.peso_kg) : 0,
        estado_tib: pkg.estado_tib || 'RECIBIDO',
        estado_amex: pkg.estado_amex || 'en_almacen',
        tib_imagen_url: pkg.tib_imagen_url || null,
        tib_ticket_pdf_url: pkg.tib_ticket_pdf_url || null,
        ubicacion_almacen: pkg.ubicacion_almacen || null,
        erp_paquete_id: pkg.id || null,
        creado_en: pkg.creado_en || new Date().toISOString(),
        actualizado_en: new Date().toISOString(),
      });
    }
  }

  if (recordsToUpsert.length === 0) {
    return { success: true, count: 0, message: 'Ningún paquete coincidió con clientes registrados' };
  }

  // 2. Insertar o actualizar en paquetes_portal en lotes de alta velocidad usando numero_recibo_bodega
  const CHUNK_SIZE = 100;
  let insertedCount = 0;

  for (let i = 0; i < recordsToUpsert.length; i += CHUNK_SIZE) {
    const chunk = recordsToUpsert.slice(i, i + CHUNK_SIZE);
    const { error: upsertErr } = await portalAdmin
      .from('paquetes_portal')
      .upsert(chunk, { onConflict: 'numero_recibo_bodega' });

    if (upsertErr) {
      console.error('[PortalSync] Error en lote upsert:', upsertErr);
    } else {
      insertedCount += chunk.length;
    }
  }

  return { success: true, count: insertedCount };
}
