import { NextResponse } from 'next/server';
import { syncTibPackagesToPortal } from '@/lib/portal/syncTibToPortal';
import { requireSuperadminSession } from '@/lib/supabase/auth-guard';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const auth = await requireSuperadminSession(req);
    if (!auth.ok) return auth.response;

    // Sincronización oficial DIRECTAMENTE desde la API de TIB
    const syncRes = await syncTibPackagesToPortal();

    return NextResponse.json({
      success: true,
      total_tib: syncRes.totalTib || 0,
      sincronizados: syncRes.count || 0,
      actualizados_tib: syncRes.updatedFromTib || 0,
      message: syncRes.message || undefined,
    });
  } catch (err: any) {
    const msg = err?.message || 'Error al sincronizar paquetes desde TIB';
    console.error('[API sync-all TIB] Error:', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
