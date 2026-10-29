import { NextRequest, NextResponse } from 'next/server';
import { getPortalAdmin } from '@/lib/supabase/portal-admin';
import { isSuperadminEmail } from '@/lib/portal/superadmin';

export const dynamic = 'force-dynamic';

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
      const { data: clientHistory, error: histErr } = await portalAdmin
        .from('portal_eventos_uso')
        .select('*')
        .eq('usuario_email', clientEmailParam)
        .order('creado_en', { ascending: false })
        .limit(100);

      if (histErr) {
        return NextResponse.json({ error: histErr.message }, { status: 500 });
      }

      return NextResponse.json({
        email: clientEmailParam,
        historial: clientHistory || [],
      });
    }
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - safeDays);
    const cutoffIso = cutoffDate.toISOString();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayIso = todayStart.toISOString();

    // 1. Obtener todos los clientes registrados
    const { data: clientsData } = await portalAdmin
      .from('clientes_portal')
      .select('id, email, nombre_completo, alias_palabras_clave, activo, creado_en')
      .order('nombre_completo', { ascending: true });

    const clients = clientsData || [];

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

    // 4. Consultar eventos del período en portal_eventos_uso
    const { data: eventsData, error: eventsErr } = await portalAdmin
      .from('portal_eventos_uso')
      .select('id, usuario_email, nombre_cliente, tipo_evento, detalles, dispositivo, navegador, creado_en')
      .gte('creado_en', cutoffIso)
      .order('creado_en', { ascending: false });

    if (eventsErr) {
      console.error('[Analiticas API Error]', eventsErr);
      return NextResponse.json({ error: eventsErr.message }, { status: 500 });
    }

    const events = eventsData || [];

    // 5. Procesar KPIs globales
    let totalBusquedas = 0;
    let totalFotos = 0;
    let totalExcels = 0;
    let totalLogins = 0;
    const activosHoySet = new Set<string>();
    const activosPeriodoSet = new Set<string>();
    const clientStatsMap = new Map<string, {
      totalEventos: number;
      logins: number;
      busquedas: number;
      fotos: number;
      excels: number;
      ultimoEvento: string | null;
      dispositivos: Record<string, number>;
    }>();

    const dailyTrendMap = new Map<string, {
      fecha: string;
      total: number;
      logins: number;
      busquedas: number;
      fotos: number;
      excels: number;
    }>();

    // Inicializar días de la gráfica (para que los días sin eventos muestren 0 y la gráfica sea continua)
    for (let i = safeDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayKey = d.toISOString().split('T')[0];
      dailyTrendMap.set(dayKey, { fecha: dayKey, total: 0, logins: 0, busquedas: 0, fotos: 0, excels: 0 });
    }

    const topSearchTermsMap = new Map<string, number>();

    for (const ev of events) {
      const email = (ev.usuario_email || '').toLowerCase();
      const tipo = ev.tipo_evento;
      const creadoEn = ev.creado_en;
      const dayKey = creadoEn.split('T')[0];

      activosPeriodoSet.add(email);
      if (creadoEn >= todayIso) {
        activosHoySet.add(email);
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
      }

      // Agregado diario para gráfica
      if (dailyTrendMap.has(dayKey)) {
        const dStat = dailyTrendMap.get(dayKey)!;
        dStat.total++;
        if (tipo === 'LOGIN_EXITOSO') dStat.logins++;
        else if (tipo === 'BUSQUEDA_INVENTARIO') dStat.busquedas++;
        else if (tipo === 'VER_FOTO_ALMACEN') dStat.fotos++;
        else if (tipo === 'EXPORTAR_EXCEL') dStat.excels++;
      }

      // Agregado por cliente
      if (!clientStatsMap.has(email)) {
        clientStatsMap.set(email, {
          totalEventos: 0,
          logins: 0,
          busquedas: 0,
          fotos: 0,
          excels: 0,
          ultimoEvento: null,
          dispositivos: {},
        });
      }

      const cStat = clientStatsMap.get(email)!;
      cStat.totalEventos++;
      if (!cStat.ultimoEvento || creadoEn > cStat.ultimoEvento) {
        cStat.ultimoEvento = creadoEn;
      }
      if (tipo === 'LOGIN_EXITOSO') cStat.logins++;
      else if (tipo === 'BUSQUEDA_INVENTARIO') cStat.busquedas++;
      else if (tipo === 'VER_FOTO_ALMACEN') cStat.fotos++;
      else if (tipo === 'EXPORTAR_EXCEL') cStat.excels++;

      if (ev.dispositivo) {
        cStat.dispositivos[ev.dispositivo] = (cStat.dispositivos[ev.dispositivo] || 0) + 1;
      }
    }

    // 6. Construir tabla de desglose por cliente
    const clientesAnalitica = clients.map((c) => {
      const email = c.email.toLowerCase();
      const authUser = authMap.get(email);
      const stat = clientStatsMap.get(email) || {
        totalEventos: 0,
        logins: 0,
        busquedas: 0,
        fotos: 0,
        excels: 0,
        ultimoEvento: null,
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

      // Calcular paquetes aproximados: si es Superadmin ve el 100% del sistema (61,246)
      const esAdmin = isSuperadminEmail(c.email);
      let paquetesEstimados = 0;

      if (esAdmin) {
        paquetesEstimados = totalPaquetesSistema;
      } else if (Array.isArray(c.alias_palabras_clave)) {
        for (const kw of c.alias_palabras_clave) {
          const cleanKw = (kw || '').toUpperCase().trim();
          for (const [catName, catRow] of catalogMap.entries()) {
            if (catName.includes(cleanKw)) {
              paquetesEstimados += (catRow.total_paquetes || 0);
            }
          }
        }
      }

      const ultimoAcceso = stat.ultimoEvento || authUser?.last_sign_in_at || null;

      return {
        id: c.id,
        email: c.email,
        nombre_completo: c.nombre_completo,
        activo: c.activo,
        es_admin: esAdmin,
        alias_palabras_clave: c.alias_palabras_clave,
        creado_en: c.creado_en,
        ultimo_acceso: ultimoAcceso,
        total_eventos: stat.totalEventos,
        logins: stat.logins,
        busquedas: stat.busquedas,
        fotos_vistas: stat.fotos,
        descargas_excel: stat.excels,
        dispositivo_frecuente: stat.totalEventos > 0 ? dispositivoFrecuente : 'Sin actividad',
        paquetes_estimados: paquetesEstimados,
      };
    });

    // Ordenar clientes por nivel de actividad descendente
    clientesAnalitica.sort((a, b) => b.total_eventos - a.total_eventos || (b.ultimo_acceso ? 1 : -1));

    // Top búsquedas
    const topBusquedas = Array.from(topSearchTermsMap.entries())
      .map(([termino, cantidad]) => ({ termino, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 8);

    const clienteMasActivo = clientesAnalitica.length > 0 && clientesAnalitica[0].total_eventos > 0
      ? clientesAnalitica[0].nombre_completo
      : 'Sin interacciones aún';

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
        cliente_mas_activo: clienteMasActivo,
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
