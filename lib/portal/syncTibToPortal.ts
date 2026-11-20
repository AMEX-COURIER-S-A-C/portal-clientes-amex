import { getPortalAdmin } from '@/lib/supabase/portal-admin';
import { ADMIN_MASTER_EMAIL, isSuperadminEmail } from '@/lib/portal/superadmin';
import {
  getTibApiCredentials,
  isTibV2Configured,
  normalizeTibWr,
  TIB_MEDIA_BASE_URL,
} from '@/lib/tib/apiClient';
import { createCargoSystemClient } from '@/lib/tib/cargoSystemClient';
import {
  CARGO_SYNC_STATUSES,
  PORTAL_STATUS_PRIORITY,
  type PortalTibStatus,
} from '@/lib/tib/cargoSystemHelpers';
import { cleanExactString } from '@/lib/portal/keywords';
import {
  buildPostgrestMatchingOrFilter,
  matchesConsigneeRule,
  normalizeMatchingRules,
} from '@/lib/portal/matching';

export { ADMIN_MASTER_EMAIL, cleanExactString };

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

export function getEstadoVisiblePortal(estadoAmex?: string | null, estadoTib?: string | null): string {
  const normTib = (estadoTib || '').toUpperCase();
  if (normTib === 'ENTREGADO' || estadoAmex === 'entregado') return 'ENTREGADO';
  if (normTib === 'ENVIADO') return 'ENVIADO';
  if (normTib === 'RECIBIDO') return 'RECIBIDO';
  return normTib || 'RECIBIDO';
}

/**
 * Motor de Sincronización en Vivo (Delta de RECIBIDO) + Re-vinculación Ultrarrápida en Supabase.
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

  // 2. Consultar todos los perfiles activos en clientes_portal (paginado sin tope de 1,000)
  const clientesList: any[] = [];
  let clientOffset = 0;
  const PAGE_SIZE = 1000;
  while (true) {
    const { data: pageClients, error: cErr } = await portalAdmin
      .from('clientes_portal')
      .select('id, email, nombre_completo, alias_palabras_clave, palabras_clave_grupo')
      .eq('activo', true)
      .range(clientOffset, clientOffset + PAGE_SIZE - 1);

    if (cErr) {
      console.error('[syncTibPackagesToPortal] Error al consultar clientes_portal:', cErr);
      throw new Error('Error al consultar directorio de clientes');
    }
    if (!pageClients || pageClients.length === 0) break;
    clientesList.push(...pageClients);
    if (pageClients.length < PAGE_SIZE) break;
    clientOffset += PAGE_SIZE;
  }

  const superadminProfile = clientesList.find(
    (c) => c.email?.trim().toLowerCase() === ADMIN_MASTER_EMAIL
  );
  const superadminId = superadminProfile?.id || null;

  // 2.B. Sincronización en vivo desde TIB API (prioriza TIB v2 Cargo System; fallback a v1 legacy)
  let updatedFromTibCount = 0;
  let syncSourceLabel = 'TIB';
  if (!isSpecificRegularClient) {
    try {
      const CHUNK = 500;
      const deltaRecordsToUpsert: Record<string, any>[] = [];
      const affectedConsignees = new Set<string>();

      if (isTibV2Configured()) {
        syncSourceLabel = 'TIB Cargo System v2';
        const cargoClient = createCargoSystemClient();
        const { packages: v2Map } = await cargoClient.fetchNormalizedPackages({
          statuses: CARGO_SYNC_STATUSES,
        });

        if (v2Map.size > 0) {
          const wrList = Array.from(v2Map.keys());
          const existingMap = new Map<string, any>();

          for (let i = 0; i < wrList.length; i += CHUNK) {
            const slice = wrList.slice(i, i + CHUNK);
            const { data: existingRows } = await portalAdmin
              .from('paquetes_portal')
              .select('numero_recibo_bodega, nombre_consignatario, tracking, peso_kg, tipo_empaque, tib_imagen_url, tib_ticket_pdf_url, estado_tib, usuario_email, creado_en, ubicacion_almacen')
              .in('numero_recibo_bodega', slice);

            for (const row of existingRows || []) {
              existingMap.set(row.numero_recibo_bodega, row);
            }
          }

          for (const [canonicalWr, item] of v2Map.entries()) {
            const existing = existingMap.get(canonicalWr);
            const newConsignee = item.nombreConsignatario;
            const newTracking = item.tracking;
            const newWeight = item.pesoKg;
            const newTipo = item.tipoEmpaque;
            const newImgUrl = item.tibImagenUrl || existing?.tib_imagen_url || null;
            const newTicketUrl = item.tibTicketPdfUrl || existing?.tib_ticket_pdf_url || null;
            const newUbicacion = item.ubicacionAlmacen || existing?.ubicacion_almacen || null;

            const existingStatusRaw = String(existing?.estado_tib || '').trim().toUpperCase() as PortalTibStatus;
            const existingPrio = PORTAL_STATUS_PRIORITY[existingStatusRaw] || 0;
            const incomingPrio = PORTAL_STATUS_PRIORITY[item.estadoTib] || 1;
            const resolvedStatus: PortalTibStatus =
              existing && existingPrio > incomingPrio ? existingStatusRaw : item.estadoTib;

            const isNew = !existing;
            const isModified =
              existing &&
              (cleanExactString(existing.nombre_consignatario) !== cleanExactString(newConsignee) ||
                cleanExactString(existing.tracking) !== cleanExactString(newTracking) ||
                Number(existing.peso_kg || 0).toFixed(2) !== Number(newWeight).toFixed(2) ||
                cleanExactString(existing.tipo_empaque) !== cleanExactString(newTipo) ||
                cleanExactString(existing.estado_tib) !== cleanExactString(resolvedStatus) ||
                (existing.tib_imagen_url || null) !== newImgUrl ||
                (existing.tib_ticket_pdf_url || null) !== newTicketUrl ||
                cleanExactString(existing.ubicacion_almacen) !== cleanExactString(newUbicacion));

            if (isNew || isModified) {
              const targetEmail = existing?.usuario_email || ADMIN_MASTER_EMAIL;
              const recordObj: Record<string, any> = {
                numero_recibo_bodega: canonicalWr,
                tracking: newTracking,
                nombre_consignatario: newConsignee,
                usuario_email: targetEmail,
                tipo_empaque: newTipo,
                peso_kg: newWeight,
                estado_tib: resolvedStatus,
                estado_amex: 'en_almacen',
                tib_imagen_url: newImgUrl,
                tib_ticket_pdf_url: newTicketUrl,
                ubicacion_almacen: newUbicacion,
                creado_en: existing?.creado_en || item.creadoEn,
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
        }
      } else {
        syncSourceLabel = 'TIB Legacy v1';
        const creds = getTibApiCredentials();
        const tibRes = await fetch(creds.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: creds.email,
            password: creds.password,
            status: 'RECIBIDO',
          }),
          signal: AbortSignal.timeout(30000),
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
          }
        }
      }

      if (deltaRecordsToUpsert.length > 0) {
        for (let i = 0; i < deltaRecordsToUpsert.length; i += CHUNK) {
          const slice = deltaRecordsToUpsert.slice(i, i + CHUNK);
          await portalAdmin
            .from('paquetes_portal')
            .upsert(slice, { onConflict: 'numero_recibo_bodega' });
        }
        updatedFromTibCount = deltaRecordsToUpsert.length;

        // El trigger de base de datos (002 / 006) mantiene amex_portal_clientes sincronizado;
        // si existe la función RPC, se invoca de forma ligera como respaldo sin descargar filas a Node.js.
        if (typeof (portalAdmin as any).rpc === 'function') {
          await Promise.all(
            Array.from(affectedConsignees)
              .filter(Boolean)
              .map((cName) =>
                Promise.resolve(
                  portalAdmin.rpc('recalcular_consignatario_catalogo', { target_nombre: cName })
                ).catch(() => null)
              )
          );
        }
      }
    } catch (liveErr) {
      console.warn(`[syncTibPackagesToPortal] Aviso en sincronización delta (${syncSourceLabel}):`, liveErr);
    }
  }

  // 3. Pre-normalizar reglas de TODOS los clientes regulares activos para evitar guerras de escritura en cuentas compartidas
  const activeRegularClients = clientesList
    .filter((c) => {
      const email = c.email?.trim().toLowerCase();
      return Boolean(email && !isSuperadminEmail(email));
    })
    .map((c) => ({
      id: c.id as string | null,
      email: c.email.trim().toLowerCase() as string,
      rules: normalizeMatchingRules({
        exactConsignees: c.alias_palabras_clave,
        groupKeywords: c.palabras_clave_grupo,
      }),
    }));

  const activeClientByEmail = new Map(activeRegularClients.map((c) => [c.email, c]));

  const findOtherActiveOwner = (consigneeName: string | null | undefined, excludeEmail: string) => {
    for (const candidate of activeRegularClients) {
      if (candidate.email === excludeEmail) continue;
      if (
        matchesConsigneeRule(
          consigneeName,
          candidate.rules.exactConsignees,
          candidate.rules.groupKeywords
        )
      ) {
        return candidate;
      }
    }
    return null;
  };

  const regularClientsToProcess = isSpecificRegularClient
    ? activeRegularClients.filter((c) => c.email === specificTarget)
    : activeRegularClients;

  // 4. Ejecutar cruce diferencial en PostgreSQL por cada cliente regular usando el motor unificado
  for (const client of regularClientsToProcess) {
    const targetEmail = client.email;
    const { exactConsignees, groupKeywords } = client.rules;

    // Si se editó un cliente específico, liberar únicamente los paquetes que ya no coincidan con sus reglas actuales,
    // respetando a cualquier otro cliente activo que comparta el mismo consignatario (ej. cuentas compartidas).
    if (isSpecificRegularClient) {
      const currentClientPkgs: any[] = [];
      let pkgFrom = 0;
      while (true) {
        const { data: pagePkgs } = await portalAdmin
          .from('paquetes_portal')
          .select('id, nombre_consignatario')
          .eq('usuario_email', targetEmail)
          .range(pkgFrom, pkgFrom + PAGE_SIZE - 1);

        if (!pagePkgs || pagePkgs.length === 0) break;
        currentClientPkgs.push(...pagePkgs);
        if (pagePkgs.length < PAGE_SIZE) break;
        pkgFrom += PAGE_SIZE;
      }

      const idsToSuperadmin: string[] = [];
      const reassignByOwner = new Map<string, { id: string | null; ids: string[] }>();

      for (const pkg of currentClientPkgs) {
        if (matchesConsigneeRule(pkg.nombre_consignatario, exactConsignees, groupKeywords)) {
          continue;
        }
        const coOwner = findOtherActiveOwner(pkg.nombre_consignatario, targetEmail);
        if (coOwner) {
          let entry = reassignByOwner.get(coOwner.email);
          if (!entry) {
            entry = { id: coOwner.id, ids: [] };
            reassignByOwner.set(coOwner.email, entry);
          }
          entry.ids.push(pkg.id);
        } else {
          idsToSuperadmin.push(pkg.id);
        }
      }

      if (idsToSuperadmin.length > 0) {
        const resetPayload: Record<string, any> = {
          usuario_email: ADMIN_MASTER_EMAIL,
          actualizado_en: new Date().toISOString(),
        };
        if (hasUsuarioIdColumn) {
          resetPayload.usuario_id = superadminId;
        }
        for (let i = 0; i < idsToSuperadmin.length; i += 500) {
          const idChunk = idsToSuperadmin.slice(i, i + 500);
          await portalAdmin
            .from('paquetes_portal')
            .update(resetPayload)
            .in('id', idChunk);
        }
      }

      for (const [coEmail, coData] of reassignByOwner.entries()) {
        const coPayload: Record<string, any> = {
          usuario_email: coEmail,
          actualizado_en: new Date().toISOString(),
        };
        if (hasUsuarioIdColumn && coData.id) {
          coPayload.usuario_id = coData.id;
        }
        for (let i = 0; i < coData.ids.length; i += 500) {
          await portalAdmin
            .from('paquetes_portal')
            .update(coPayload)
            .in('id', coData.ids.slice(i, i + 500));
        }
      }
    }

    const orFilter = buildPostgrestMatchingOrFilter(
      'nombre_consignatario',
      exactConsignees,
      groupKeywords
    );
    if (!orFilter) continue;

    // Consultar paquetes que coinciden pero aún no apuntan a targetEmail y filtrar aquellos
    // que ya pertenecen a otro cliente activo co-propietario (evita guerra de escritura en multi-cuenta).
    const idsToClaim: string[] = [];
    let matchFrom = 0;
    while (true) {
      const { data: matchedRows } = await portalAdmin
        .from('paquetes_portal')
        .select('id, usuario_email, nombre_consignatario')
        .or(orFilter)
        .neq('usuario_email', targetEmail)
        .range(matchFrom, matchFrom + PAGE_SIZE - 1);

      if (!matchedRows || matchedRows.length === 0) break;

      for (const row of matchedRows) {
        const currentOwnerEmail = String(row.usuario_email || '').trim().toLowerCase();
        const currentOwner = activeClientByEmail.get(currentOwnerEmail);
        const ownedByValidCoOwner =
          Boolean(currentOwner) &&
          matchesConsigneeRule(
            row.nombre_consignatario,
            currentOwner!.rules.exactConsignees,
            currentOwner!.rules.groupKeywords
          );

        if (!ownedByValidCoOwner) {
          idsToClaim.push(row.id);
        }
      }

      if (matchedRows.length < PAGE_SIZE) break;
      matchFrom += PAGE_SIZE;
    }

    if (idsToClaim.length > 0) {
      const updatePayload: Record<string, any> = {
        usuario_email: targetEmail,
        actualizado_en: new Date().toISOString(),
      };
      if (hasUsuarioIdColumn && client.id) {
        updatePayload.usuario_id = client.id;
      }

      for (let i = 0; i < idsToClaim.length; i += 500) {
        await portalAdmin
          .from('paquetes_portal')
          .update(updatePayload)
          .in('id', idsToClaim.slice(i, i + 500));
      }
    }

    if (hasUsuarioIdColumn && client.id) {
      await portalAdmin
        .from('paquetes_portal')
        .update({ usuario_id: client.id })
        .eq('usuario_email', targetEmail)
        .is('usuario_id', null);
    }
  }

  // 5. Asegurar que los paquetes del Superadmin tengan su usuario_id vinculado si la columna existe
  if (!isSpecificRegularClient && hasUsuarioIdColumn && superadminId) {
    await portalAdmin
      .from('paquetes_portal')
      .update({ usuario_id: superadminId })
      .eq('usuario_email', ADMIN_MASTER_EMAIL)
      .is('usuario_id', null);
  }

  // 6. Obtener conteos finales exactos
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
