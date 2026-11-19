import { NextResponse } from 'next/server';
import { requireAuthSession } from '@/lib/supabase/auth-guard';

export const dynamic = 'force-dynamic';

/**
 * Devuelve el rol real verificado en servidor y permisos activos del usuario autenticado.
 */
export async function GET(req: Request) {
  try {
    const auth = await requireAuthSession(req);
    if (!auth.ok) return auth.response;

    const { user, email, role, canExportExcel, internalProfile } = auth;

    return NextResponse.json({
      ok: true,
      role,
      canExportExcel,
      email,
      username: internalProfile?.username || null,
      nombre_completo:
        internalProfile?.nombre_completo ||
        (typeof user.user_metadata?.nombre_completo === 'string'
          ? user.user_metadata.nombre_completo
          : null),
      cargo: internalProfile?.cargo || null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al verificar perfil de sesión';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
