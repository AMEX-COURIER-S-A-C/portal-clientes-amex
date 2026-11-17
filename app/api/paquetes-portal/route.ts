import { NextResponse } from 'next/server';
import { requireAuthSession } from '@/lib/supabase/auth-guard';
import { getClientKeywords, applyClientScopeFilter } from '@/lib/portal/clientFilter';
import { applyPackageQueryFilters } from '@/lib/portal/packageFilters';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const auth = await requireAuthSession(req);
    if (!auth.ok) return auth.response;
    const { email: cleanEmail, portalAdmin } = auth;

    const body = await req.json().catch(() => ({}));
    const {
      page = 1,
      itemsPerPage = 50,
      filters = {},
      onlySystemCount = false,
    } = body;

    const clientInfo = await getClientKeywords(portalAdmin, cleanEmail);

    // Si solo se solicita el conteo total del sistema/cliente (sin filtros)
    if (onlySystemCount) {
      let sysQuery = portalAdmin
        .from('paquetes_portal')
        .select('id', { count: 'exact', head: true });

      sysQuery = applyClientScopeFilter(sysQuery, clientInfo);

      const { count, error } = await sysQuery;
      if (error) throw error;

      return NextResponse.json({
        success: true,
        systemCount: count ?? 0,
      });
    }

    const safePage = Math.max(1, Number(page) || 1);
    const safePerPage = Math.min(500, Math.max(1, Number(itemsPerPage) || 50));
    const from = (safePage - 1) * safePerPage;
    const to = from + safePerPage - 1;

    // Ejecutar consulta de filas (Index Scan con LIMIT) y conteo en paralelo sin bloquear el planificador
    const dataQuery = applyPackageQueryFilters(
      portalAdmin.from('paquetes_portal').select(`
        id,
        numero_recibo_bodega,
        tracking,
        nombre_consignatario,
        tipo_empaque,
        peso_kg,
        estado_tib,
        estado_amex,
        tib_imagen_url,
        tib_ticket_pdf_url,
        creado_en,
        actualizado_en
      `),
      clientInfo,
      filters
    )
      .order('creado_en', { ascending: false })
      .range(from, to);

    const countQuery = applyPackageQueryFilters(
      portalAdmin.from('paquetes_portal').select('id', { count: 'exact', head: true }),
      clientInfo,
      filters
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
