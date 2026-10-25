import { NextResponse } from 'next/server';
import { getPortalAdmin } from '@/lib/supabase/portal-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const portalAdmin = getPortalAdmin();

    // Consultar clientes_portal y la lista de usuarios en Auth Oregon en paralelo
    const [profilesRes, authRes] = await Promise.all([
      portalAdmin
        .from('clientes_portal')
        .select('*')
        .order('creado_en', { ascending: false }),
      portalAdmin.auth.admin.listUsers({ perPage: 1000 }),
    ]);

    if (profilesRes.error) {
      throw profilesRes.error;
    }

    const authMap = new Map((authRes.data?.users || []).map((u) => [u.id, u]));

    const merged = (profilesRes.data || []).map((p) => {
      const auth = authMap.get(p.id) || (authRes.data?.users || []).find((u) => u.email?.toLowerCase() === p.email?.toLowerCase());

      const passwordEstablecido = Boolean(
        auth?.last_sign_in_at ||
        auth?.user_metadata?.password_establecido === true
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
