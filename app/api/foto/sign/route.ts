import { NextRequest, NextResponse } from 'next/server';
import { requireAuthSession } from '@/lib/supabase/auth-guard';
import { applyClientScopeFilter, getClientKeywords } from '@/lib/portal/clientFilter';
import { buildSignedPhotoPath } from '@/lib/portal/photo-link';
import {
  isAuthorizedTibPhotoUrl,
  isValidPhotoTarget,
  parseTibImageUrls,
} from '@/lib/portal/photo-urls';

export const dynamic = 'force-dynamic';

/**
 * Emite bajo demanda una URL firmada hacia /api/foto/<WR>/<n>?t=<token>
 * verificando primero la sesión JWT en Supabase y que el usuario tenga acceso al WR.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthSession(req);
    if (!auth.ok) return auth.response;
    const { email, portalAdmin } = auth;

    const body = await req.json().catch(() => ({}));
    const wr = String(body?.wr || '').trim().toUpperCase();
    const index = typeof body?.index === 'number' ? body.index : parseInt(String(body?.index ?? ''), 10);

    if (!isValidPhotoTarget(wr, index)) {
      return NextResponse.json({ error: 'Referencia de foto inválida.' }, { status: 400 });
    }

    const clientInfo = await getClientKeywords(portalAdmin, email);

    let pkgQuery = portalAdmin
      .from('paquetes_portal')
      .select('numero_recibo_bodega, tib_imagen_url')
      .eq('numero_recibo_bodega', wr);

    pkgQuery = applyClientScopeFilter(pkgQuery, clientInfo);

    const { data: pkg, error: pkgError } = await pkgQuery.limit(1).maybeSingle();

    if (pkgError) {
      console.error('[API Foto Sign] Error consultando paquete:', pkgError.message);
      return NextResponse.json({ error: 'No se pudo verificar la foto solicitada.' }, { status: 500 });
    }

    if (!pkg) {
      return NextResponse.json({ error: 'No tienes permiso para acceder a esta foto.' }, { status: 404 });
    }

    const urls = parseTibImageUrls(pkg.tib_imagen_url);
    const target = urls[index];

    if (!isAuthorizedTibPhotoUrl(target)) {
      return NextResponse.json({ error: 'Foto no disponible.' }, { status: 404 });
    }

    const secret = process.env.PHOTO_LINK_SECRET || '';
    if (!secret) {
      // Respaldo equivalente al demonio del VPS cuando PHOTO_LINK_SECRET no está definido.
      return NextResponse.json({ ok: true, url: target, proxied: false });
    }

    return NextResponse.json({
      ok: true,
      url: buildSignedPhotoPath(wr, index, secret),
      proxied: true,
    });
  } catch (err: unknown) {
    console.error('[API Foto Sign] Error inesperado:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Error al generar el enlace de la foto.' }, { status: 500 });
  }
}
