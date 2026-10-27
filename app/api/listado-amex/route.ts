import { NextResponse } from 'next/server';
import { getPortalAdmin } from '@/lib/supabase/portal-admin';
import { isSuperadminEmail } from '@/lib/portal/superadmin';
import { getClientKeywords, applyClientScopeFilter } from '@/lib/portal/clientFilter';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = (searchParams.get('search') || searchParams.get('q') || '').trim();
    const email = (searchParams.get('email') || '').trim().toLowerCase();
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 500);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

    const supabase = getPortalAdmin();
    const isRegularClient = Boolean(email && !isSuperadminEmail(email));

    // Si es un cliente regular, devolver únicamente sus propios consignatarios asignados y sus conteos reales
    if (isRegularClient) {
      const clientInfo = await getClientKeywords(supabase, email);

      let pkgsQuery = supabase
        .from('paquetes_portal')
        .select('nombre_consignatario, estado_tib');

      pkgsQuery = applyClientScopeFilter(pkgsQuery, clientInfo);

      const [pkgsRes, profileRes] = await Promise.all([
        pkgsQuery,
        supabase
          .from('clientes_portal')
          .select('nombre_completo, alias_palabras_clave')
          .eq('email', email)
          .maybeSingle(),
      ]);

      if (pkgsRes.error) {
        return NextResponse.json({ error: pkgsRes.error.message }, { status: 500 });
      }

      const statsMap = new Map<
        string,
        {
          id: string;
          nombre: string;
          total_paquetes: number;
          recibidos: number;
          enviados: number;
          entregados: number;
        }
      >();

      for (const row of pkgsRes.data || []) {
        const name = (row.nombre_consignatario || '').trim();
        if (!name) continue;
        if (!statsMap.has(name)) {
          statsMap.set(name, {
            id: name,
            nombre: name,
            total_paquetes: 0,
            recibidos: 0,
            enviados: 0,
            entregados: 0,
          });
        }
        const entry = statsMap.get(name)!;
        entry.total_paquetes++;
        const tib = (row.estado_tib || 'RECIBIDO').toUpperCase();
        if (tib === 'RECIBIDO') {
          entry.recibidos++;
        } else if (tib === 'ENVIADO') {
          entry.enviados++;
        } else if (tib === 'ENTREGADO') {
          entry.entregados++;
        }
      }

      // Incluir también alias configurados en su perfil aunque aún tengan 0 paquetes
      const aliases = Array.isArray(profileRes.data?.alias_palabras_clave)
        ? profileRes.data.alias_palabras_clave
        : [];
      for (const alias of aliases) {
        const cleanAlias = String(alias || '').trim().toUpperCase();
        if (cleanAlias && cleanAlias !== 'AMEX' && !statsMap.has(cleanAlias)) {
          statsMap.set(cleanAlias, {
            id: cleanAlias,
            nombre: cleanAlias,
            total_paquetes: 0,
            recibidos: 0,
            enviados: 0,
            entregados: 0,
          });
        }
      }

      let clientConsignees = Array.from(statsMap.values()).sort(
        (a, b) => b.total_paquetes - a.total_paquetes || a.nombre.localeCompare(b.nombre)
      );

      if (search) {
        const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
        clientConsignees = clientConsignees.filter((item) =>
          terms.every((t) => item.nombre.toLowerCase().includes(t))
        );
      }

      const paged = clientConsignees.slice(offset, offset + limit);

      return NextResponse.json({
        total: clientConsignees.length,
        limit,
        offset,
        clientes: paged,
      });
    }

    // Superadmin: consultar el catálogo global de 3,360 consignatarios (amex_portal_clientes)
    let query = supabase
      .from('amex_portal_clientes')
      .select('*', { count: 'exact' });

    if (search) {
      const terms = search.split(/\s+/).filter(Boolean);
      for (const term of terms) {
        query = query.ilike('nombre', `%${term}%`);
      }
    }

    query = query
      .order('total_paquetes', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      total: count || 0,
      limit,
      offset,
      clientes: data || [],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al obtener clientes TIB';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
