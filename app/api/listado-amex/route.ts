import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const portalUrl =
  process.env.NEXT_PUBLIC_PORTAL_SUPABASE_URL || 'https://zftkbolgcnnkkdfzmtix.supabase.co';
const portalKey =
  process.env.PORTAL_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_PORTAL_SUPABASE_ANON_KEY ||
  '';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = (searchParams.get('search') || searchParams.get('q') || '').trim();
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 500);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

    const supabase = createClient(portalUrl, portalKey);

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
