import { getPortalAdmin } from '@/lib/supabase/portal-admin';

export interface RawTibItem {
  seqwr?: string;
  wr?: string;
  description?: string;
  tracking?: string;
  status?: string;
  iclient?: string;
  seqUser?: string;
  fecRegister?: string | null;
  fecModify?: string | null;
  img?: string | null;
  ticket?: string | null;
  nclient?: string;
  container?: string;
  weight?: string | number | null;
  rack?: string;
  postal?: string;
  oversized?: string;
  seqwrnd?: string;
  emailClient?: string;
  _fetchedStatus?: string;
}

export function cleanExactString(str: unknown): string {
  return String(str || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

export function getEstadoVisiblePortal(estadoAmex?: string | null, estadoTib?: string | null): string {
  const normTib = (estadoTib || '').toUpperCase();
  if (normTib === 'ENTREGADO' || estadoAmex === 'entregado') return 'ENTREGADO';
  if (normTib === 'ENVIADO') return 'ENVIADO';
  if (normTib === 'RECIBIDO') return 'RECIBIDO';
  return normTib || 'RECIBIDO';
}

export const ADMIN_MASTER_EMAIL = 'sistemaamexcourier@gmail.com';

/**
 * Motor de Re-vinculación Ultrarrápida en Supabase (< 1 segundo).
 * 
 * Arquitectura desacoplada:
 * - El demonio 24/7 en el VPS de Hostinger descarga continuamente los paquetes desde Miami (API TIB)
 *   hacia `paquetes_portal`.
 * - Esta función realiza el cruce inteligente (matching) de clientes y palabras clave directamente
 *   sobre `paquetes_portal` en PostgreSQL sin necesidad de re-descargar los 60,550 paquetes por red,
 *   eliminando riesgos de Timeout 504 en Vercel y respondiendo de forma instantánea.
 * - Soporta enlace híbrido (`usuario_email` + `usuario_id` UUID).
 */
export async function syncTibPackagesToPortal(options?: { specificEmail?: string }) {
  const portalAdmin = getPortalAdmin();
  const specificTarget = options?.specificEmail?.trim().toLowerCase() || null;
  const isSpecificRegularClient = Boolean(specificTarget && specificTarget !== ADMIN_MASTER_EMAIL);

  // 1. Detectar dinámicamente si la columna híbrida `usuario_id` ya fue creada en paquetes_portal
  const { error: colCheckErr } = await portalAdmin
    .from('paquetes_portal')
    .select('usuario_id')
    .limit(1);
  const hasUsuarioIdColumn = !colCheckErr;

  // 2. Consultar todos los perfiles activos en clientes_portal
  const { data: allClients, error: cErr } = await portalAdmin
    .from('clientes_portal')
    .select('id, email, nombre_completo, alias_palabras_clave')
    .eq('activo', true);

  if (cErr) {
    console.error('[syncTibPackagesToPortal] Error al consultar clientes_portal:', cErr);
    throw new Error('Error al consultar directorio de clientes');
  }

  const clientesList = allClients || [];
  const superadminProfile = clientesList.find(
    (c) => c.email?.trim().toLowerCase() === ADMIN_MASTER_EMAIL
  );
  const superadminId = superadminProfile?.id || null;

  // 3. Determinar qué clientes regulares procesar
  const regularClientsToProcess = clientesList.filter((c) => {
    const email = c.email?.trim().toLowerCase();
    if (!email || email === ADMIN_MASTER_EMAIL) return false;
    if (isSpecificRegularClient) return email === specificTarget;
    return true;
  });

  // 4. Ejecutar cruce diferencial en PostgreSQL por cada cliente regular y sus palabras clave
  //    Solo actualiza filas cuyo propietario o usuario_id realmente haya cambiado (0 escrituras innecesarias).
  for (const client of regularClientsToProcess) {
    const targetEmail = client.email.trim().toLowerCase();
    const searchTerms = new Set<string>();

    const cleanNombre = cleanExactString(client.nombre_completo);
    if (cleanNombre && cleanNombre.length >= 3 && cleanNombre !== 'AMEX') {
      searchTerms.add(cleanNombre);
    }

    if (Array.isArray(client.alias_palabras_clave)) {
      for (const alias of client.alias_palabras_clave) {
        const cleanAlias = cleanExactString(alias);
        if (cleanAlias && cleanAlias.length >= 2 && cleanAlias !== 'AMEX') {
          searchTerms.add(cleanAlias);
        }
      }
    }

    const termsArray = Array.from(searchTerms);

    // Si se editó un cliente específico, liberar únicamente los paquetes que ya no coincidan con sus alias actuales
    if (isSpecificRegularClient) {
      const { data: currentClientPkgs } = await portalAdmin
        .from('paquetes_portal')
        .select('id, nombre_consignatario')
        .eq('usuario_email', targetEmail);

      const idsToRelease = (currentClientPkgs || [])
        .filter((pkg) => {
          const cName = cleanExactString(pkg.nombre_consignatario);
          return !termsArray.some((t) => cName.includes(t));
        })
        .map((pkg) => pkg.id);

      if (idsToRelease.length > 0) {
        const resetPayload: Record<string, any> = {
          usuario_email: ADMIN_MASTER_EMAIL,
          actualizado_en: new Date().toISOString(),
        };
        if (hasUsuarioIdColumn) {
          resetPayload.usuario_id = superadminId;
        }
        await portalAdmin
          .from('paquetes_portal')
          .update(resetPayload)
          .in('id', idsToRelease);
      }
    }

    const updatePayload: Record<string, any> = {
      usuario_email: targetEmail,
      actualizado_en: new Date().toISOString(),
    };
    if (hasUsuarioIdColumn) {
      updatePayload.usuario_id = client.id;
    }

    const diffFilter = hasUsuarioIdColumn
      ? `usuario_email.neq.${targetEmail},usuario_id.is.null`
      : `usuario_email.neq.${targetEmail}`;

    await Promise.all(
      termsArray.map((term) =>
        portalAdmin
          .from('paquetes_portal')
          .update(updatePayload)
          .ilike('nombre_consignatario', `%${term}%`)
          .or(diffFilter)
      )
    );
  }

  // 6. Asegurar que los paquetes del Superadmin tengan su usuario_id vinculado si la columna existe
  if (!isSpecificRegularClient && hasUsuarioIdColumn && superadminId) {
    await portalAdmin
      .from('paquetes_portal')
      .update({ usuario_id: superadminId })
      .eq('usuario_email', ADMIN_MASTER_EMAIL)
      .is('usuario_id', null);
  }

  // 7. Obtener conteos finales exactos
  const { count: totalTibCount } = await portalAdmin
    .from('paquetes_portal')
    .select('*', { count: 'exact', head: true });

  if (isSpecificRegularClient && specificTarget) {
    const { count: linkedCount } = await portalAdmin
      .from('paquetes_portal')
      .select('*', { count: 'exact', head: true })
      .eq('usuario_email', specificTarget);

    return {
      success: true,
      count: linkedCount || 0,
      totalTib: totalTibCount || 0,
    };
  }

  return {
    success: true,
    count: totalTibCount || 0,
    totalTib: totalTibCount || 0,
    message: `Sincronización y cruce de clientes completado exitosamente (${(totalTibCount || 0).toLocaleString()} paquetes activos).`,
  };
}
