import { NextRequest, NextResponse } from 'next/server';
import { getPortalAdmin } from '@/lib/supabase/portal-admin';
import { isSuperadminEmail } from '@/lib/portal/superadmin';

export const dynamic = 'force-dynamic';

// Los correos automáticos los genera el sistema (VPS), no el cliente: no deben
// contar como actividad, dispositivo ni "último acceso" del usuario.
const SERVER_EVENT_TYPES = new Set(['EMAIL_ENVIADO']);

function isClientEvent(tipo?: string | null): boolean {
  return !SERVER_EVENT_TYPES.has(String(tipo || '').toUpperCase());
}

// Perú no aplica horario de verano: UTC-5 durante todo el año.
const LIMA_DAY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Lima',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function limaDayKey(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return LIMA_DAY_FORMATTER.format(date);
}

// Hora local de Perú (0-23) para el mapa de horas pico.
const LIMA_HOUR_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'America/Lima',
  hour: '2-digit',
  hourCycle: 'h23',
});

function limaHour(value: Date | string): number {
  const date = typeof value === 'string' ? new Date(value) : value;
  const parsed = parseInt(LIMA_HOUR_FORMATTER.format(date), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const emailParam = searchParams.get('admin_email')?.trim().toLowerCase() || '';
    const daysParam = parseInt(searchParams.get('days') || '30', 10);
    const safeDays = isNaN(daysParam) || daysParam <= 0 ? 30 : Math.min(daysParam, 365);

    // Solo superadmin puede acceder a estas analíticas
    if (!isSuperadminEmail(emailParam)) {
      return NextResponse.json({ error: 'Acceso no autorizado a analíticas ejecutivas' }, { status: 403 });
    }

    const portalAdmin = getPortalAdmin();

    // Si se solicita el historial específico de un cliente para la auditoría detallada
    const clientEmailParam = searchParams.get('client_email')?.trim().toLowerCase();
    if (clientEmailParam) {
      const eventType = (searchParams.get('event_type') || 'ALL').trim().toUpperCase();
      const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 200);
      const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);
      const fromParam = searchParams.get('from')?.trim();
      const toParam = searchParams.get('to')?.trim();

      let historyQuery = portalAdmin
        .from('portal_eventos_uso')
        .select('*', { count: 'exact' })
        .eq('usuario_email', clientEmailParam);

      if (eventType && eventType !== 'ALL') {
        historyQuery = historyQuery.eq('tipo_evento', eventType);
      }
      if (fromParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam)) {
        historyQuery = historyQuery.gte('creado_en', `${fromParam}T00:00:00-05:00`);
      }
      if (toParam && /^\d{4}-\d{2}-\d{2}$/.test(toParam)) {
        historyQuery = historyQuery.lte('creado_en', `${toParam}T23:59:59.999-05:00`);
      }

      const { data: clientHistory, error: histErr, count } = await historyQuery
        .order('creado_en', { ascending: false })
        .range(offset, offset + limit - 1);

      if (histErr) {
        return NextResponse.json({ error: histErr.message }, { status: 500 });
      }

      return NextResponse.json({
        email: clientEmailParam,
        historial: clientHistory || [],
        total: count ?? 0,
        limit,
        offset,
        event_type: eventType || 'ALL',
      });
    }
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - safeDays);
    const cutoffIso = cutoffDate.toISOString();

    // "Hoy" se evalúa en hora de Perú, no en UTC.
    const limaHoy = limaDayKey(new Date());

    // 1. Obtener todos los clientes registrados
    const { data: clientsData } = await portalAdmin
      .from('clientes_portal')
      .select('id, email, nombre_completo, alias_palabras_clave, activo, creado_en')
      .order('nombre_completo', { ascending: true });

    // Excluir cuentas de administradores para mostrar estrictamente clientes reales
    const clients = (clientsData || []).filter(c => !isSuperadminEmail(c.email));

    // 2. Obtener usuarios de auth para su last_sign_in_at
    const { data: authUsersRes } = await portalAdmin.auth.admin.listUsers({ perPage: 1000 });
    const authMap = new Map<string, any>();
    (authUsersRes?.users || []).forEach((u) => {
      if (u.email) authMap.set(u.email.toLowerCase(), u);
    });

    // 3. Obtener catálogo completo de consignatarios (paginado para superar el límite de 1000 de Supabase)
    const fetchFullCatalog = async () => {
      const all: any[] = [];
      let from = 0;
      const step = 1000;
      while (true) {
        const { data } = await portalAdmin
          .from('amex_portal_clientes')
          .select('nombre, total_paquetes')
          .range(from, from + step - 1);
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < step) break;
        from += step;
      }
      return all;
    };

    const [catalogData, systemCountRes] = await Promise.all([
      fetchFullCatalog(),
      portalAdmin
        .from('paquetes_portal')
        .select('id', { count: 'exact', head: true }),
    ]);

    const totalPaquetesSistema = systemCountRes.count ?? 61261;

    const catalogMap = new Map<string, any>();
    (catalogData || []).forEach((c) => {
      catalogMap.set((c.nombre || '').toUpperCase().trim(), c);
    });

    // 4. Eventos del período actual y del período anterior (paginado para superar el límite de 1000 de Supabase)
    const previousCutoffIso = new Date(
      cutoffDate.getTime() - safeDays * DAY_MS
    ).toISOString();

    const fetchFullEvents = async (
      selectCols: string,
      gteIso: string,
      ltIso?: string
    ) => {
      const all: any[] = [];
      let from = 0;
      const step = 1000;
      while (true) {
        let query = portalAdmin
          .from('portal_eventos_uso')
          .select(selectCols)
          .gte('creado_en', gteIso)
          .order('creado_en', { ascending: false })
          .range(from, from + step - 1);

        if (ltIso) {
          query = query.lt('creado_en', ltIso);
        }

        const { data, error } = await query;
        if (error) {
          console.error('[Analiticas API Error]', error);
          throw error;
        }
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < step) break;
        from += step;
      }
      return all;
    };

    let eventsData: any[] = [];
    let previousEventsData: any[] = [];
    try {
      [eventsData, previousEventsData] = await Promise.all([
        fetchFullEvents(
          'id, usuario_email, nombre_cliente, tipo_evento, detalles, dispositivo, navegador, creado_en',
          cutoffIso
        ),
        fetchFullEvents(
          'usuario_email, tipo_evento, creado_en',
          previousCutoffIso,
          cutoffIso
        ),
      ]);
    } catch (queryError: any) {
      console.error('[Analiticas API Error]', queryError);
      return NextResponse.json({ error: queryError?.message || 'Error al consultar eventos' }, { status: 500 });
    }

    // Excluir eventos de administradores para que no contaminen KPIs, gráficas ni promedios
    const events = (eventsData || []).filter(ev => !isSuperadminEmail(ev.usuario_email));

    // 5. Agregados del período anterior (mismos criterios: sin administradores)
    const previousEvents = (previousEventsData || []).filter(
      ev => !isSuperadminEmail(ev.usuario_email)
    );

    const previousStats = {
      activos: new Set<string>(),
      actividad: 0,
      logins: 0,
      busquedas: 0,
      fotos: 0,
      excels: 0,
      correos: 0,
    };

    for (const ev of previousEvents) {
      const tipo = String(ev.tipo_evento || '').toUpperCase();
      const email = (ev.usuario_email || '').toLowerCase();

      if (tipo === 'EMAIL_ENVIADO') {
        previousStats.correos++;
        continue;
      }

      if (isClientEvent(tipo)) {
        previousStats.actividad++;
        if (email) previousStats.activos.add(email);
        if (tipo === 'LOGIN_EXITOSO') previousStats.logins++;
        else if (tipo === 'BUSQUEDA_INVENTARIO') previousStats.busquedas++;
        else if (tipo === 'VER_FOTO_ALMACEN') previousStats.fotos++;
        else if (tipo === 'EXPORTAR_EXCEL') previousStats.excels++;
      }
    }

    // 5. Procesar KPIs globales
    let totalBusquedas = 0;
    let totalFotos = 0;
    let totalExcels = 0;
    let totalLogins = 0;
    let totalCorreos = 0;
    const activosHoySet = new Set<string>();
    const activosPeriodoSet = new Set<string>();
    const clientStatsMap = new Map<string, {
      totalEventos: number;
      logins: number;
      busquedas: number;
      fotos: number;
      excels: number;
      correos: number;
      ultimoEvento: string | null;
      ultimoLogin: string | null;
      dispositivos: Record<string, number>;
    }>();

    const dailyTrendMap = new Map<string, {
      fecha: string;
      dia: string;
      total: number;
      actividad: number;
      logins: number;
      busquedas: number;
      fotos: number;
      excels: number;
      otros: number;
      correos: number;
    }>();

    // Series que se dibujan por separado en la barra; el resto de eventos del
    // cliente (p. ej. filtros o consultas de detalle) se agrupa como "otros".
    const DAILY_CLIENT_SERIES = new Set([
      'LOGIN_EXITOSO',
      'BUSQUEDA_INVENTARIO',
      'VER_FOTO_ALMACEN',
      'EXPORTAR_EXCEL',
    ]);

    const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];

    // Inicializar días de la gráfica (para que los días sin eventos muestren 0 y la gráfica sea continua)
    for (let i = safeDays - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dayKey = limaDayKey(d);
      const parts = dayKey.split('-');
      const mIdx = parseInt(parts[1], 10) - 1;
      const dayNum = parseInt(parts[2], 10);
      const diaLabel = `${dayNum} ${MESES_CORTO[mIdx] || ''}`;
      dailyTrendMap.set(dayKey, { fecha: dayKey, dia: diaLabel, total: 0, actividad: 0, logins: 0, busquedas: 0, fotos: 0, excels: 0, otros: 0, correos: 0 });
    }

    const topSearchTermsMap = new Map<string, number>();
    const deviceCounts = new Map<string, number>();
    const browserCounts = new Map<string, number>();
    const hourlyCounts: number[] = new Array(24).fill(0);
    const loginTimesByEmail = new Map<string, number[]>();
    const emailTimesByEmail = new Map<string, number[]>();

    for (const ev of events) {
      const email = (ev.usuario_email || '').toLowerCase();
      const tipo = ev.tipo_evento;
      const creadoEn = ev.creado_en;
      const dayKey = limaDayKey(creadoEn);
      const esCliente = isClientEvent(tipo);

      // Solo la actividad real del cliente cuenta como "activo".
      // Los correos automáticos del VPS se contabilizan aparte.
      if (esCliente) {
        activosPeriodoSet.add(email);
        if (dayKey === limaHoy) {
          activosHoySet.add(email);
        }

        const device = (ev.dispositivo || '').trim() || 'Desconocido';
        deviceCounts.set(device, (deviceCounts.get(device) || 0) + 1);

        const browser = (ev.navegador || '').trim() || 'Desconocido';
        browserCounts.set(browser, (browserCounts.get(browser) || 0) + 1);

        const hour = limaHour(creadoEn);
        if (hour >= 0 && hour <= 23) hourlyCounts[hour]++;
      }

      if (tipo === 'BUSQUEDA_INVENTARIO') {
        totalBusquedas++;
        const q = ev.detalles?.query || ev.detalles?.termino;
        if (q && typeof q === 'string') {
          const cleanQ = q.trim().toUpperCase();
          if (cleanQ.length >= 2) {
            topSearchTermsMap.set(cleanQ, (topSearchTermsMap.get(cleanQ) || 0) + 1);
          }
        }
      } else if (tipo === 'VER_FOTO_ALMACEN') {
        totalFotos++;
      } else if (tipo === 'EXPORTAR_EXCEL') {
        totalExcels++;
      } else if (tipo === 'LOGIN_EXITOSO') {
        totalLogins++;
      } else if (tipo === 'EMAIL_ENVIADO') {
        totalCorreos++;
      }

      // Timestamps para la conversión correo -> login (atribución simple)
      const eventTime = new Date(creadoEn).getTime();
      if (!Number.isNaN(eventTime)) {
        if (tipo === 'EMAIL_ENVIADO') {
          const list = emailTimesByEmail.get(email) || [];
          list.push(eventTime);
          emailTimesByEmail.set(email, list);
        } else if (tipo === 'LOGIN_EXITOSO') {
          const list = loginTimesByEmail.get(email) || [];
          list.push(eventTime);
          loginTimesByEmail.set(email, list);
        }
      }

      // Agregado diario para la gráfica:
      // - total: todos los eventos (actividad del cliente + correos automáticos)
      // - actividad: solo lo que hizo el cliente (sin correos)
      if (dailyTrendMap.has(dayKey)) {
        const dStat = dailyTrendMap.get(dayKey)!;
        dStat.total++;
        if (esCliente) {
          dStat.actividad++;
          if (!DAILY_CLIENT_SERIES.has(tipo)) dStat.otros++;
        }
        if (tipo === 'LOGIN_EXITOSO') dStat.logins++;
        else if (tipo === 'BUSQUEDA_INVENTARIO') dStat.busquedas++;
        else if (tipo === 'VER_FOTO_ALMACEN') dStat.fotos++;
        else if (tipo === 'EXPORTAR_EXCEL') dStat.excels++;
        else if (tipo === 'EMAIL_ENVIADO') dStat.correos++;
      }

      // Agregado por cliente
      if (!clientStatsMap.has(email)) {
        clientStatsMap.set(email, {
          totalEventos: 0,
          logins: 0,
          busquedas: 0,
          fotos: 0,
          excels: 0,
          correos: 0,
          ultimoEvento: null,
          ultimoLogin: null,
          dispositivos: {},
        });
      }

      const cStat = clientStatsMap.get(email)!;

      if (esCliente) {
        cStat.totalEventos++;
        if (!cStat.ultimoEvento || creadoEn > cStat.ultimoEvento) {
          cStat.ultimoEvento = creadoEn;
        }
        if (ev.dispositivo) {
          cStat.dispositivos[ev.dispositivo] = (cStat.dispositivos[ev.dispositivo] || 0) + 1;
        }
      }

      if (tipo === 'LOGIN_EXITOSO') {
        cStat.logins++;
        if (!cStat.ultimoLogin || creadoEn > cStat.ultimoLogin) {
          cStat.ultimoLogin = creadoEn;
        }
      } else if (tipo === 'BUSQUEDA_INVENTARIO') cStat.busquedas++;
      else if (tipo === 'VER_FOTO_ALMACEN') cStat.fotos++;
      else if (tipo === 'EXPORTAR_EXCEL') cStat.excels++;
      else if (tipo === 'EMAIL_ENVIADO') cStat.correos++;
    }

    // 6. Conversión correo -> login y distribuciones de comportamiento
    let conversiones24h = 0;
    let conversiones72h = 0;
    const clientesConvertidos24h = new Set<string>();

    for (const [email, emailTimes] of emailTimesByEmail.entries()) {
      const loginTimes = (loginTimesByEmail.get(email) || []).slice().sort((a, b) => a - b);
      if (loginTimes.length === 0) continue;

      for (const emailTime of emailTimes) {
        let converted24 = false;
        let converted72 = false;

        for (const loginTime of loginTimes) {
          if (loginTime <= emailTime) continue;
          const delta = loginTime - emailTime;
          if (delta <= DAY_MS) converted24 = true;
          if (delta <= 3 * DAY_MS) converted72 = true;
          if (converted24 && converted72) break;
        }

        if (converted24) {
          conversiones24h++;
          clientesConvertidos24h.add(email);
        }
        if (converted72) conversiones72h++;
      }
    }

    const tasaConversion = (valor: number) =>
      totalCorreos > 0 ? Math.round((valor / totalCorreos) * 1000) / 10 : 0;

    const buildDistribution = (counts: Map<string, number>) => {
      const total = Array.from(counts.values()).reduce((sum, value) => sum + value, 0);
      return Array.from(counts.entries())
        .map(([nombre, cantidad]) => ({
          nombre,
          cantidad,
          porcentaje: total > 0 ? Math.round((cantidad / total) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 8);
    };

    // 7. Construir tabla de desglose por cliente
    const clientesAnalitica = clients.map((c) => {
      const email = c.email.toLowerCase();
      const authUser = authMap.get(email);
      const stat = clientStatsMap.get(email) || {
        totalEventos: 0,
        logins: 0,
        busquedas: 0,
        fotos: 0,
        excels: 0,
        correos: 0,
        ultimoEvento: null,
        ultimoLogin: null,
        dispositivos: {},
      };

      // Dispositivo más frecuente
      let dispositivoFrecuente = 'Escritorio';
      let maxDispCount = 0;
      for (const [disp, count] of Object.entries(stat.dispositivos)) {
        if (count > maxDispCount) {
          maxDispCount = count;
          dispositivoFrecuente = disp;
        }
      }

      // Calcular paquetes exactos: si es Superadmin ve el 100% del sistema (61,261)
      const esAdmin = isSuperadminEmail(c.email);
      let paquetesEstimados = 0;

      if (esAdmin) {
        paquetesEstimados = totalPaquetesSistema;
      } else {
        const clientKeywords: string[] = [];
        if (Array.isArray(c.alias_palabras_clave)) {
          for (const k of c.alias_palabras_clave) {
            const clean = (k || '').replace(/\s+/g, ' ').trim().toUpperCase();
            if (clean && clean.length >= 2 && clean !== 'AMEX' && !clientKeywords.includes(clean)) {
              clientKeywords.push(clean);
            }
          }
        }

        if (clientKeywords.length > 0) {
          const matchedConsignatarios = new Set<string>();
          for (const kw of clientKeywords) {
            for (const [catName] of catalogMap.entries()) {
              if (catName.includes(kw)) {
                matchedConsignatarios.add(catName);
              }
            }
          }
          for (const name of matchedConsignatarios) {
            paquetesEstimados += (catalogMap.get(name)?.total_paquetes || 0);
          }
        }
      }

      // "Último login" es histórico (auth es la fuente autoritativa); "última
      // actividad" se limita al período y excluye correos automáticos.
      const ultimoLogin = authUser?.last_sign_in_at || stat.ultimoLogin || null;
      const ultimaActividad = stat.ultimoEvento || null;

      // Para el riesgo usamos la referencia más reciente entre login y actividad.
      const referenciaActividad = [ultimoLogin, ultimaActividad]
        .filter((value): value is string => Boolean(value))
        .sort()
        .pop() || null;
      const referenciaMs = referenciaActividad ? new Date(referenciaActividad).getTime() : NaN;
      const diasSinActividad = Number.isNaN(referenciaMs)
        ? null
        : Math.max(0, Math.floor((Date.now() - referenciaMs) / DAY_MS));
      const nuncaIngreso = !ultimoLogin;
      const enRiesgo = !nuncaIngreso && diasSinActividad !== null && diasSinActividad > 30;

      return {
        id: c.id,
        email: c.email,
        nombre_completo: c.nombre_completo,
        activo: c.activo,
        es_admin: esAdmin,
        alias_palabras_clave: c.alias_palabras_clave,
        creado_en: c.creado_en,
        ultimo_login: ultimoLogin,
        ultima_actividad: ultimaActividad,
        dias_sin_actividad: diasSinActividad,
        en_riesgo: enRiesgo,
        nunca_ingreso: nuncaIngreso,
        total_eventos: stat.totalEventos,
        total_interacciones: stat.totalEventos + (stat.correos || 0),
        logins: stat.logins,
        busquedas: stat.busquedas,
        fotos_vistas: stat.fotos,
        descargas_excel: stat.excels,
        correos_enviados: stat.correos || 0,
        dispositivo_frecuente: stat.totalEventos > 0 ? dispositivoFrecuente : 'Sin actividad',
        paquetes_estimados: paquetesEstimados,
      };
    });

    // Ordenar clientes por nivel de actividad descendente
    clientesAnalitica.sort(
      (a, b) =>
        b.total_eventos - a.total_eventos ||
        (b.ultimo_login ? 1 : 0) - (a.ultimo_login ? 1 : 0)
    );

    // Top búsquedas
    const topBusquedas = Array.from(topSearchTermsMap.entries())
      .map(([termino, cantidad]) => ({ termino, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 8);

    const clienteMasActivo = clientesAnalitica.length > 0 && clientesAnalitica[0].total_eventos > 0
      ? clientesAnalitica[0].nombre_completo
      : 'Sin interacciones aún';

    const totalCorreosEnviados = clientesAnalitica.reduce(
      (sum, c) => sum + (c.correos_enviados || 0),
      0
    );

    const clientesActivados = clientesAnalitica.filter(c => !!c.ultimo_login).length;
    const clientesNuncaIngresaron = clientesAnalitica.length - clientesActivados;
    const clientesEnRiesgo = clientesAnalitica.filter(c => c.en_riesgo).length;
    const clientesSoloCorreo = clientesAnalitica.filter(
      c => c.correos_enviados > 0 && c.total_eventos === 0
    ).length;
    const tasaActivacion = clientesAnalitica.length > 0
      ? Math.round((clientesActivados / clientesAnalitica.length) * 1000) / 10
      : 0;

    return NextResponse.json({
      periodo_dias: safeDays,
      resumen_kpis: {
        total_clientes: clients.length,
        activos_hoy: activosHoySet.size,
        activos_periodo: activosPeriodoSet.size,
        total_busquedas: totalBusquedas,
        total_fotos_vistas: totalFotos,
        total_descargas_excel: totalExcels,
        total_logins: totalLogins,
        total_correos_enviados: totalCorreosEnviados,
        cliente_mas_activo: clienteMasActivo,
        clientes_activados: clientesActivados,
        clientes_nunca_ingresaron: clientesNuncaIngresaron,
        clientes_en_riesgo: clientesEnRiesgo,
        clientes_solo_correo: clientesSoloCorreo,
        tasa_activacion: tasaActivacion,
      },
      comparativa: {
        periodo_anterior: {
          activos_periodo: previousStats.activos.size,
          total_actividad: previousStats.actividad,
          total_logins: previousStats.logins,
          total_busquedas: previousStats.busquedas,
          total_fotos_vistas: previousStats.fotos,
          total_descargas_excel: previousStats.excels,
          total_correos_enviados: previousStats.correos,
        },
      },
      conversion_correos: {
        correos_analizados: totalCorreos,
        conversiones_24h: conversiones24h,
        conversiones_72h: conversiones72h,
        tasa_24h: tasaConversion(conversiones24h),
        tasa_72h: tasaConversion(conversiones72h),
        clientes_convertidos_24h: clientesConvertidos24h.size,
      },
      distribucion: {
        dispositivos: buildDistribution(deviceCounts),
        navegadores: buildDistribution(browserCounts),
        horas: hourlyCounts.map((cantidad, hora) => ({ hora, cantidad })),
      },
      tendencia_diaria: Array.from(dailyTrendMap.values()),
      top_busquedas: topBusquedas,
      clientes: clientesAnalitica,
    });
  } catch (err: any) {
    console.error('[API Analíticas Excepción]:', err);
    return NextResponse.json({ error: err.message || 'Error al procesar analíticas' }, { status: 500 });
  }
}
