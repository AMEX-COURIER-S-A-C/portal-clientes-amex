import { NextResponse } from 'next/server';
import { requireSuperadminSession } from '@/lib/supabase/auth-guard';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const auth = await requireSuperadminSession(req);
    if (!auth.ok) return auth.response;
    const portalAdmin = auth.portalAdmin;

    // 1 y 2. Consultar perfiles en clientes_portal y usuarios de Supabase Auth en paralelo
    const fetchAllProfiles = async () => {
      const all: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await portalAdmin
          .from('clientes_portal')
          .select('*')
          .order('creado_en', { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) {
          throw error;
        }
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return all;
    };

    const fetchAllAuthUsers = async () => {
      const all: any[] = [];
      let authPage = 1;
      while (true) {
        const { data, error } = await portalAdmin.auth.admin.listUsers({
          page: authPage,
          perPage: 1000,
        });
        if (error || !data?.users || data.users.length === 0) break;
        all.push(...data.users);
        if (data.users.length < 1000) break;
        authPage++;
      }
      return all;
    };

    const [allProfiles, allAuthUsers] = await Promise.all([
      fetchAllProfiles(),
      fetchAllAuthUsers(),
    ]);

    const authMap = new Map<string, any>();
    const authEmailMap = new Map<string, any>();
    for (const u of allAuthUsers) {
      if (u.id) authMap.set(u.id, u);
      if (u.email) authEmailMap.set(u.email.toLowerCase(), u);
    }

    const merged = allProfiles.map((p) => {
      const auth =
        authMap.get(p.id) ||
        (p.email ? authEmailMap.get(p.email.toLowerCase()) : undefined);

      const passwordEstablecido = Boolean(
        auth?.last_sign_in_at || auth?.user_metadata?.password_establecido === true
      );

      return {
        ...p,
        password_establecido: passwordEstablecido,
        ultimo_acceso: auth?.last_sign_in_at || null,
        invitado_en: auth?.invited_at || null,
      };
    });

    return NextResponse.json({
      success: true,
      clientes: merged,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al listar clientes del portal';
    console.error('[API listar-portal] Error:', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
