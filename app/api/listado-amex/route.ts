import { NextResponse } from 'next/server';
import { requireAuthSession } from '@/lib/supabase/auth-guard';
import { getClientKeywords } from '@/lib/portal/clientFilter';
import { buildPostgrestMatchingOrFilter } from '@/lib/portal/matching';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const auth = await requireAuthSession(req);
    if (!auth.ok) return auth.response;
    const { email, portalAdmin: supabase } = auth;

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get('search') || searchParams.get('q') || '').trim();
    const parsedLimit = parseInt(searchParams.get('limit') || '50', 10);
    const parsedOffset = parseInt(searchParams.get('offset') || '0', 10);
    const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 50, 1), 500);
    const offset = Math.max(Number.isFinite(parsedOffset) ? parsedOffset : 0, 0);

    const isRegularClient = auth.role === 'cliente';

    // Si es un cliente regular, consultar directamente la tabla pre-calculada amex_portal_clientes
    // filtrando por las palabras clave del cliente (evita el truncamiento a 1,000 filas de paquetes_portal)
    if (isRegularClient) {
      const clientInfo = await getClientKeywords(supabase, email);
      const orConditions = buildPostgrestMatchingOrFilter(
        'nombre',
        clientInfo.exactConsignees,
        clientInfo.groupKeywords
      );

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

      if (orConditions) {
        const pageSize = 1000;
        let from = 0;
        while (true) {
          const { data: catalogRows, error: catErr } = await supabase
            .from('amex_portal_clientes')
            .select('id, nombre, total_paquetes, recibidos, enviados, entregados')
            .or(orConditions)
            .range(from, from + pageSize - 1);

          if (catErr) {
            return NextResponse.json({ error: catErr.message }, { status: 500 });
          }

          if (!catalogRows || catalogRows.length === 0) break;

          for (const row of catalogRows) {
            const name = String(row.nombre || '').trim();
            if (!name) continue;
            statsMap.set(name, {
              id: row.id || name,
              nombre: name,
              total_paquetes: Number(row.total_paquetes || 0),
              recibidos: Number(row.recibidos || 0),
              enviados: Number(row.enviados || 0),
              entregados: Number(row.entregados || 0),
            });
          }

          if (catalogRows.length < pageSize) break;
          from += pageSize;
        }
      }

      // Incluir también consignatarios exactos configurados aunque aún tengan 0 paquetes
      for (const exactAlias of clientInfo.exactConsignees) {
        const cleanAlias = String(exactAlias || '').trim().toUpperCase();
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

    // Superadmin: consultar el catálogo global de consignatarios (amex_portal_clientes)
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
