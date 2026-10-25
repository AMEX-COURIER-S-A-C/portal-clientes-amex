import { getPortalAdmin } from '@/lib/supabase/portal-admin';
import { normalizeTibWr, getTibApiCredentials } from '@/lib/tib/apiClient';

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

const TIB_MEDIA_BASE_URL = 'https://www.tibcourier.com/global-courier/ajax/';
export const ADMIN_MASTER_EMAIL = 'sistemaamexcourier@gmail.com';

/**
 * Consulta la API oficial de TIB para un estado dado ('RECIBIDO', 'ENVIADO', 'ENTREGADO')
 */
async function fetchTibStatus(url: string, email: string, password: string, status: string): Promise<RawTibItem[]> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, status }),
    });

    if (!res.ok) {
      console.warn(`[TIB API] HTTP ${res.status} al consultar estado ${status}`);
      return [];
    }

    const json = await res.json();
    return (json.data || []).map((item: RawTibItem) => ({ ...item, _fetchedStatus: status }));
  } catch (err) {
    console.error(`[TIB API] Error al consultar estado ${status}:`, err);
    return [];
  }
}

/**
 * Sincroniza paquetes ÚNICA Y EXCLUSIVAMENTE desde la API oficial de TIB hacia paquetes_portal.
 * 
 * Reglas de asignación:
 * 1. Prioridad: Coincidencia EXACTA con los clientes regulares registrados en clientes_portal
 *    (nombre completo, palabras clave o casillero).
 * 2. Regla Admin Master: Cualquier paquete que contenga "AMEX" o "amex" en consignatario o descripción
 *    se asigna automáticamente al usuario Admin Master (sistemaamexcourier@gmail.com).
 */
export async function syncTibPackagesToPortal(options?: { specificEmail?: string }) {
  const portalAdmin = getPortalAdmin();
  const credentials = getTibApiCredentials();
  const isSpecificRegularClient =
    options?.specificEmail && options.specificEmail.trim().toLowerCase() !== ADMIN_MASTER_EMAIL;

  // 1. Obtener los clientes registrados en clientes_portal
  let clientQuery = portalAdmin
    .from('clientes_portal')
    .select('email, nombre_completo, alias_palabras_clave, casillero_codigo')
    .eq('activo', true);

  if (isSpecificRegularClient) {
    clientQuery = clientQuery.eq('email', options!.specificEmail!.trim().toLowerCase());
  }

  const { data: clientes, error: cErr } = await clientQuery;
  if (cErr) {
    console.error('[syncTibPackagesToPortal] Error al consultar clientes_portal:', cErr);
    throw new Error('Error al consultar directorio de clientes');
  }

  const clientesList = clientes || [];

  // 2. Construir mapas de coincidencia exacta y lista para coincidencia por inclusión
  const nclientExactMap = new Map<string, string>();
  const iclientMap = new Map<string, string>();
  const keywordInclusionList: Array<{ keyword: string; email: string }> = [];

  for (const c of clientesList) {
    const targetEmail = c.email.trim().toLowerCase();
    // Excluir al admin master de las coincidencias exactas para dar prioridad a los clientes regulares
    if (targetEmail === ADMIN_MASTER_EMAIL) continue;

    const cleanNombre = cleanExactString(c.nombre_completo);
    if (cleanNombre && cleanNombre.length >= 3 && cleanNombre !== 'AMEX') {
      nclientExactMap.set(cleanNombre, targetEmail);
      keywordInclusionList.push({ keyword: cleanNombre, email: targetEmail });
    }

    if (Array.isArray(c.alias_palabras_clave)) {
      for (const alias of c.alias_palabras_clave) {
        const cleanAlias = cleanExactString(alias);
        if (cleanAlias && cleanAlias.length >= 2 && cleanAlias !== 'AMEX') {
          nclientExactMap.set(cleanAlias, targetEmail);
          keywordInclusionList.push({ keyword: cleanAlias, email: targetEmail });
        }
      }
    }

    if (c.casillero_codigo) {
      const cleanCasillero = cleanExactString(c.casillero_codigo);
      if (cleanCasillero && cleanCasillero !== 'AMEX') {
        iclientMap.set(cleanCasillero, targetEmail);
        keywordInclusionList.push({ keyword: cleanCasillero, email: targetEmail });
      }
    }
  }

  // Ordenar lista de inclusión por longitud descendente para que frases más específicas tengan prioridad
  keywordInclusionList.sort((a, b) => b.keyword.length - a.keyword.length);

  // 3. Descargar en paralelo los estados de la API oficial de TIB
  const [recibidos, enviados, entregados] = await Promise.all([
    fetchTibStatus(credentials.url, credentials.email, credentials.password, 'RECIBIDO'),
    fetchTibStatus(credentials.url, credentials.email, credentials.password, 'ENVIADO'),
    fetchTibStatus(credentials.url, credentials.email, credentials.password, 'ENTREGADO'),
  ]);

  // Procesar todo el inventario histórico de TIB (2021 - presente: RECIBIDO, ENVIADO y ENTREGADO)
  const allTibPackages: RawTibItem[] = [...recibidos, ...enviados, ...entregados];

  // 4. Filtrar y procesar según las reglas de asignación
  const recordsToUpsert = [];

  for (const item of allTibPackages) {
    const cleanConsignee = cleanExactString(item.nclient);
    const cleanIclient = cleanExactString(item.iclient);

    // Regla 1: Coincidencia con cliente regular (exacta primero, luego por inclusión)
    let matchedEmail: string | undefined = undefined;

    if (cleanConsignee && nclientExactMap.has(cleanConsignee)) {
      matchedEmail = nclientExactMap.get(cleanConsignee);
    } else if (cleanIclient && iclientMap.has(cleanIclient)) {
      matchedEmail = iclientMap.get(cleanIclient);
    } else if (cleanConsignee) {
      for (const kwItem of keywordInclusionList) {
        if (cleanConsignee.includes(kwItem.keyword)) {
          matchedEmail = kwItem.email;
          break;
        }
      }
    }

    // Regla 2: Asignación automática al Admin Master para todo lo que contenga "AMEX" o "amex"
    if (!matchedEmail) {
      const consigneeUpper = (item.nclient || '').toUpperCase();
      const descUpper = (item.description || '').toUpperCase();
      if (consigneeUpper.includes('AMEX') || descUpper.includes('AMEX')) {
        matchedEmail = ADMIN_MASTER_EMAIL;
      }
    }

    // Si se solicitó para un email específico, omitir si no coincide
    if (options?.specificEmail) {
      const target = options.specificEmail.trim().toLowerCase();
      if (matchedEmail !== target) {
        continue;
      }
    }

    // Si tiene un destinatario asignado, estructurar para paquetes_portal
    if (matchedEmail) {
      const canonicalWr = normalizeTibWr(item.wr, item.seqwr);
      if (!canonicalWr) continue;

      const fullImgUrl = item.img
        ? `${TIB_MEDIA_BASE_URL}${item.img.replace(/^\/+/, '')}`
        : null;

      const fullTicketUrl = item.ticket
        ? `${TIB_MEDIA_BASE_URL}${item.ticket.replace(/^\/+/, '')}`
        : null;

      const weightNum = item.weight != null ? parseFloat(String(item.weight)) : 0;
      const statusTib = item._fetchedStatus || item.status || 'RECIBIDO';

      let parsedDate = new Date().toISOString();
      if (item.fecRegister) {
        const d = new Date(item.fecRegister);
        if (!isNaN(d.getTime())) parsedDate = d.toISOString();
      }

      recordsToUpsert.push({
        numero_recibo_bodega: canonicalWr,
        tracking: item.tracking?.trim() || null,
        nombre_consignatario: (item.nclient || '').trim(),
        usuario_email: matchedEmail,
        tipo_empaque: (item.container || item.description || 'CAJA').trim().toUpperCase(),
        peso_kg: isNaN(weightNum) ? 0 : weightNum,
        estado_tib: statusTib,
        estado_amex: 'en_almacen',
        estado_visible: getEstadoVisiblePortal('en_almacen', statusTib),
        tib_imagen_url: fullImgUrl,
        tib_ticket_pdf_url: fullTicketUrl,
        ubicacion_almacen: item.rack?.trim() || null,
        erp_paquete_id: null,
        creado_en: parsedDate,
        actualizado_en: new Date().toISOString(),
      });
    }
  }

  if (recordsToUpsert.length === 0) {
    return {
      success: true,
      count: 0,
      totalTib: allTibPackages.length,
      message: 'No se encontraron paquetes en TIB para sincronizar.',
    };
  }

  // 5. Upsert optimizado por lotes (500 por lote) en paquetes_portal
  const CHUNK_SIZE = 500;
  let insertedCount = 0;

  for (let i = 0; i < recordsToUpsert.length; i += CHUNK_SIZE) {
    const chunk = recordsToUpsert.slice(i, i + CHUNK_SIZE);
    const { error: upsertErr } = await portalAdmin
      .from('paquetes_portal')
      .upsert(chunk, { onConflict: 'numero_recibo_bodega' });

    if (upsertErr) {
      console.error('[syncTibPackagesToPortal] Error en lote upsert:', upsertErr);
    } else {
      insertedCount += chunk.length;
    }
  }

  return {
    success: true,
    count: insertedCount,
    totalTib: allTibPackages.length,
  };
}
