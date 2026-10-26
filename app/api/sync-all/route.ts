import { NextResponse } from 'next/server';
import { syncTibPackagesToPortal } from '@/lib/portal/syncTibToPortal';
import { isSuperadminEmail } from '@/lib/portal/superadmin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { email } = await req.json().catch(() => ({ email: null }));

    // Seguridad: solo el superadmin puede sincronizar en lote
    if (!isSuperadminEmail(email)) {
      return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
    }

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
