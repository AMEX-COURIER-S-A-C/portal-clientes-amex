import { NextResponse } from 'next/server';
import { requireAuthSession } from '@/lib/supabase/auth-guard';
import { getClientKeywords } from '@/lib/portal/clientFilter';
import { sanitizePostgrestFilterTerm } from '@/lib/portal/keywords';

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
      const [clientInfo, profileRes] = await Promise.all([
        getClientKeywords(supabase, email),
        supabase
          .from('clientes_portal')
          .select('nombre_completo, alias_palabras_clave')
          .eq('email', email)
          .maybeSingle(),
      ]);

      const safeKeywords = clientInfo.keywords
        .map((kw) => sanitizePostgrestFilterTerm(kw))
        .filter((kw) => kw.length >= 2);

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

      if (safeKeywords.length > 0) {
        const orConditions = safeKeywords
          .map((kw) => `nombre.ilike.*${kw}*`)
          .join(',');

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
