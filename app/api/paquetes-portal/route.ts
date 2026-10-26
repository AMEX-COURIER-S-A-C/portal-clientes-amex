import { NextResponse } from 'next/server';
import { getPortalAdmin } from '@/lib/supabase/portal-admin';
import { isSuperadminEmail } from '@/lib/portal/superadmin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      email,
      page = 1,
      itemsPerPage = 50,
      filters = {},
      onlySystemCount = false,
    } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const isSuperadmin = isSuperadminEmail(cleanEmail);
    const portalAdmin = getPortalAdmin();

    // Si solo se solicita el conteo total del sistema/cliente (sin filtros)
    if (onlySystemCount) {
      let sysQuery = portalAdmin
        .from('paquetes_portal')
        .select('id', { count: 'exact', head: true });

      if (!isSuperadmin) {
        sysQuery = sysQuery.eq('usuario_email', cleanEmail);
      }

      const { count, error } = await sysQuery;
      if (error) throw error;

      return NextResponse.json({
        success: true,
        systemCount: count ?? 0,
      });
    }

    const {
      wr = '',
      tracking = '',
      consignatario = '',
      tipo = '',
      estado = '',
      fechaTipo = 'creado_en',
      fechaDesde = '',
      fechaHasta = '',
      pesoMin = '',
      pesoMax = '',
    } = filters;

    const applyFilters = (q: any) => {
      if (!isSuperadmin) {
        q = q.eq('usuario_email', cleanEmail);
      }
      if (wr && typeof wr === 'string' && wr.trim()) {
        q = q.ilike('numero_recibo_bodega', `%${wr.trim()}%`);
      }
      if (tracking && typeof tracking === 'string' && tracking.trim()) {
        q = q.ilike('tracking', `%${tracking.trim()}%`);
      }
      if (consignatario && typeof consignatario === 'string' && consignatario.trim()) {
        q = q.eq('nombre_consignatario', consignatario.trim());
      }
      if (tipo && typeof tipo === 'string' && tipo.trim()) {
        q = q.eq('tipo_empaque', tipo.trim());
      }
      if (estado && typeof estado === 'string' && estado.trim()) {
        q = q.eq('estado_visible', estado.trim());
      }
      const colFecha = fechaTipo === 'actualizado_en' ? 'actualizado_en' : 'creado_en';
      if (fechaDesde && typeof fechaDesde === 'string' && fechaDesde.trim()) {
        try {
          const d = new Date(`${fechaDesde.trim()}T00:00:00`);
          if (!isNaN(d.getTime())) {
            q = q.gte(colFecha, d.toISOString());
          }
        } catch (_) {}
      }
      if (fechaHasta && typeof fechaHasta === 'string' && fechaHasta.trim()) {
        try {
          const d = new Date(`${fechaHasta.trim()}T23:59:59.999`);
          if (!isNaN(d.getTime())) {
            q = q.lte(colFecha, d.toISOString());
          }
        } catch (_) {}
      }
      if (pesoMin !== undefined && String(pesoMin).trim() !== '' && !isNaN(Number(pesoMin))) {
        q = q.gte('peso_kg', Number(pesoMin));
      }
      if (pesoMax !== undefined && String(pesoMax).trim() !== '' && !isNaN(Number(pesoMax))) {
        q = q.lte('peso_kg', Number(pesoMax));
      }
      return q;
    };

    const safePage = Math.max(1, Number(page) || 1);
    const safePerPage = Math.min(500, Math.max(1, Number(itemsPerPage) || 50));
    const from = (safePage - 1) * safePerPage;
    const to = from + safePerPage - 1;

    // Ejecutar consulta de filas (Index Scan con LIMIT) y conteo en paralelo sin bloquear el planificador
    const dataQuery = applyFilters(
      portalAdmin.from('paquetes_portal').select(`
        id,
        numero_recibo_bodega,
        tracking,
        nombre_consignatario,
        tipo_empaque,
        peso_kg,
        estado_tib,
        estado_amex,
        estado_visible,
        tib_imagen_url,
        tib_ticket_pdf_url,
        creado_en,
        actualizado_en
      `)
    )
      .order('creado_en', { ascending: false })
      .range(from, to);

    const countQuery = applyFilters(
      portalAdmin.from('paquetes_portal').select('id', { count: 'exact', head: true })
    );

    const [dataRes, countRes] = await Promise.all([dataQuery, countQuery]);

    if (dataRes.error) throw dataRes.error;
    if (countRes.error) throw countRes.error;

    return NextResponse.json({
      success: true,
      paquetes: dataRes.data || [],
      count: countRes.count ?? (dataRes.data?.length || 0),
    });
  } catch (err: any) {
    console.error('[API paquetes-portal] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Error al consultar paquetes del portal' },
      { status: 500 }
    );
  }
}
