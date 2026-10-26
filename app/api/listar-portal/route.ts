import { NextResponse } from 'next/server';
import { getPortalAdmin } from '@/lib/supabase/portal-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const portalAdmin = getPortalAdmin();

    // 1. Consultar todos los perfiles en clientes_portal con paginación automática (sin tope de 1,000)
    const allProfiles: any[] = [];
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
      allProfiles.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    // 2. Consultar todos los usuarios en Supabase Auth con paginación automática
    const allAuthUsers: any[] = [];
    let authPage = 1;
    while (true) {
      const { data, error } = await portalAdmin.auth.admin.listUsers({
        page: authPage,
        perPage: 1000,
      });
      if (error || !data?.users || data.users.length === 0) break;
      allAuthUsers.push(...data.users);
      if (data.users.length < 1000) break;
      authPage++;
    }

    const authMap = new Map(allAuthUsers.map((u) => [u.id, u]));

    const merged = allProfiles.map((p) => {
      const auth =
        authMap.get(p.id) ||
        allAuthUsers.find((u) => u.email?.toLowerCase() === p.email?.toLowerCase());

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
