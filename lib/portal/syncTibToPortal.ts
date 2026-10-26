import { getPortalAdmin } from '@/lib/supabase/portal-admin';
import { ADMIN_MASTER_EMAIL, isSuperadminEmail } from '@/lib/portal/superadmin';
import { getTibApiCredentials, normalizeTibWr, TIB_MEDIA_BASE_URL } from '@/lib/tib/apiClient';

export { ADMIN_MASTER_EMAIL };

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

/**
 * Motor de Sincronización en Vivo (Delta de RECIBIDO) + Re-vinculación Ultrarrápida en Supabase.
 *
 * - Cuando se invoca de forma global (botón "Sincronizar con API TIB"), descarga en vivo los paquetes
 *   en estado RECIBIDO desde la API de TIB (~1s) y actualiza inmediatamente cualquier paquete nuevo
 *   o cuyos datos (nombre_consignatario, tracking, peso, empaque, foto o ticket) hayan sido corregidos en TIB.
 * - Ejecuta el cruce inteligente (matching) de clientes y palabras clave directamente sobre `paquetes_portal`.
 * - Actualiza las estadísticas del catálogo `amex_portal_clientes` para los consignatarios modificados.
 */
export async function syncTibPackagesToPortal(options?: { specificEmail?: string }) {
  const portalAdmin = getPortalAdmin();
  const specificTarget = options?.specificEmail?.trim().toLowerCase() || null;
  const isSpecificRegularClient = Boolean(specificTarget && !isSuperadminEmail(specificTarget));

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

  // 2.B. Sincronización en vivo de paquetes RECIBIDO desde TIB API (detecta nuevos WRs y correcciones de nombre/peso/foto)
  let updatedFromTibCount = 0;
  if (!isSpecificRegularClient) {
    try {
      const creds = getTibApiCredentials();
      const tibRes = await fetch(creds.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: creds.email,
          password: creds.password,
          status: 'RECIBIDO',
        }),
      });

      if (tibRes.ok) {
        const tibJson = await tibRes.json();
        const rawRecibidos: RawTibItem[] = Array.isArray(tibJson?.data) ? tibJson.data : [];

        if (rawRecibidos.length > 0) {
          const tibMap = new Map<string, RawTibItem>();
          for (const item of rawRecibidos) {
            const canonicalWr = normalizeTibWr(item.wr, item.seqwr);
            if (canonicalWr) {
              tibMap.set(canonicalWr, item);
            }
          }

          const wrList = Array.from(tibMap.keys());
          const existingMap = new Map<string, any>();

          // Consultar en lotes los WRs existentes en paquetes_portal para detectar ediciones de metadatos
          const CHUNK = 500;
          for (let i = 0; i < wrList.length; i += CHUNK) {
            const slice = wrList.slice(i, i + CHUNK);
            const { data: existingRows } = await portalAdmin
              .from('paquetes_portal')
              .select('numero_recibo_bodega, nombre_consignatario, tracking, peso_kg, tipo_empaque, tib_imagen_url, tib_ticket_pdf_url, estado_tib, usuario_email, creado_en')
              .in('numero_recibo_bodega', slice);

            for (const row of existingRows || []) {
              existingMap.set(row.numero_recibo_bodega, row);
            }
          }

          const deltaRecordsToUpsert: Record<string, any>[] = [];
          const affectedConsignees = new Set<string>();

          for (const [canonicalWr, item] of tibMap.entries()) {
            const existing = existingMap.get(canonicalWr);
            const newConsignee = (item.nclient || '').trim();
            const newTracking = item.tracking?.trim() || null;
            const weightNum = item.weight != null ? parseFloat(String(item.weight)) : 0;
            const newWeight = isNaN(weightNum) ? 0 : weightNum;
            const newTipo = (item.container || item.description || 'CAJA').trim().toUpperCase();
            const newImgUrl = item.img
              ? item.img
                  .split(',')
                  .map((p) => p.trim())
                  .filter(Boolean)
                  .map((p) => (p.startsWith('http') ? p : `${TIB_MEDIA_BASE_URL}${p.replace(/^\/+/, '')}`))
                  .join(',')
              : null;
            const newTicketUrl = item.ticket ? `${TIB_MEDIA_BASE_URL}${item.ticket.replace(/^\/+/, '')}` : null;

            const isNew = !existing;
            const isModified =
              existing &&
              (cleanExactString(existing.nombre_consignatario) !== cleanExactString(newConsignee) ||
                cleanExactString(existing.tracking) !== cleanExactString(newTracking) ||
                Number(existing.peso_kg || 0).toFixed(2) !== Number(newWeight).toFixed(2) ||
                cleanExactString(existing.tipo_empaque) !== cleanExactString(newTipo) ||
                (existing.tib_imagen_url || null) !== newImgUrl ||
                (existing.tib_ticket_pdf_url || null) !== newTicketUrl);

            if (isNew || isModified) {
              let parsedDate = new Date().toISOString();
              if (item.fecRegister) {
                const d = new Date(item.fecRegister);
                if (!isNaN(d.getTime())) parsedDate = d.toISOString();
              }

              const targetEmail = existing?.usuario_email || ADMIN_MASTER_EMAIL;
              const recordObj: Record<string, any> = {
                numero_recibo_bodega: canonicalWr,
                tracking: newTracking,
                nombre_consignatario: newConsignee,
                usuario_email: targetEmail,
                tipo_empaque: newTipo,
                peso_kg: newWeight,
                estado_tib: existing?.estado_tib || 'RECIBIDO',
                estado_amex: 'en_almacen',
                estado_visible: getEstadoVisiblePortal('en_almacen', existing?.estado_tib || 'RECIBIDO'),
                tib_imagen_url: newImgUrl,
                tib_ticket_pdf_url: newTicketUrl,
                ubicacion_almacen: item.rack?.trim() || null,
                creado_en: existing?.creado_en || parsedDate,
                actualizado_en: new Date().toISOString(),
              };

              if (hasUsuarioIdColumn && targetEmail === ADMIN_MASTER_EMAIL && superadminId) {
                recordObj.usuario_id = superadminId;
              }

              deltaRecordsToUpsert.push(recordObj);
              if (newConsignee) affectedConsignees.add(cleanExactString(newConsignee));
              if (existing?.nombre_consignatario) {
                affectedConsignees.add(cleanExactString(existing.nombre_consignatario));
              }
            }
          }

          if (deltaRecordsToUpsert.length > 0) {
            await portalAdmin
              .from('paquetes_portal')
              .upsert(deltaRecordsToUpsert, { onConflict: 'numero_recibo_bodega' });
            updatedFromTibCount = deltaRecordsToUpsert.length;

            // Recalcular conteos en amex_portal_clientes para los consignatarios modificados
            for (const cName of affectedConsignees) {
              if (!cName) continue;
              const { data: cPkgs } = await portalAdmin
                .from('paquetes_portal')
                .select('numero_recibo_bodega, tracking, estado_tib, creado_en')
                .eq('nombre_consignatario', cName)
                .order('creado_en', { ascending: false });

              if (cPkgs && cPkgs.length > 0) {
                let recCount = 0;
                let envCount = 0;
                let entCount = 0;
                for (const p of cPkgs) {
                  const st = (p.estado_tib || '').toUpperCase();
                  if (st === 'RECIBIDO') recCount++;
                  else if (st === 'ENVIADO') envCount++;
                  else if (st === 'ENTREGADO') entCount++;
                }
                await portalAdmin.from('amex_portal_clientes').upsert(
                  {
                    nombre: cName,
                    total_paquetes: cPkgs.length,
                    recibidos: recCount,
                    enviados: envCount,
                    entregados: entCount,
                    ultimo_wr: cPkgs[0].numero_recibo_bodega,
                    ultimo_tracking: cPkgs[0].tracking || null,
                    ultima_fecha: cPkgs[0].creado_en,
                    actualizado_en: new Date().toISOString(),
                  },
                  { onConflict: 'nombre' }
                );
              }
            }
          }
        }
      }
    } catch (liveErr) {
      console.warn('[syncTibPackagesToPortal] Aviso en sincronización delta RECIBIDO desde TIB:', liveErr);
    }
  }

  // 3. Determinar qué clientes regulares procesar (excluyendo todas las cuentas Superadmin)
  const regularClientsToProcess = clientesList.filter((c) => {
    const email = c.email?.trim().toLowerCase();
    if (!email || isSuperadminEmail(email)) return false;
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
      updatedFromTib: updatedFromTibCount,
    };
  }

  return {
    success: true,
    count: totalTibCount || 0,
    totalTib: totalTibCount || 0,
    updatedFromTib: updatedFromTibCount,
    message: `Sincronización y cruce de clientes completado exitosamente (${(totalTibCount || 0).toLocaleString()} paquetes activos, ${updatedFromTibCount} actualizados desde TIB).`,
  };
}
