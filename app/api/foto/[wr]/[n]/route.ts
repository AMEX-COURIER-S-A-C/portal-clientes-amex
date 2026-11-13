import { NextRequest, NextResponse } from 'next/server';
import { getPortalAdmin } from '@/lib/supabase/portal-admin';
import { verifyPhotoToken } from '@/lib/portal/photo-link';
import {
  isAuthorizedTibPhotoUrl,
  isValidPhotoTarget,
  parseTibImageUrls,
} from '@/lib/portal/photo-urls';

export const dynamic = 'force-dynamic';

/**
 * Proxy de fotos de almacén: oculta el dominio de TIB al cliente.
 * GET /api/foto/<WR>/<n>?t=<token firmado>   (n empieza en 1)
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ wr: string; n: string }> }) {
  const { wr: rawWr, n: rawN } = await ctx.params;
  const wr = decodeURIComponent(rawWr).trim().toUpperCase();
  const index = parseInt(rawN, 10) - 1;
  const token = req.nextUrl.searchParams.get('t') || '';
  const secret = process.env.PHOTO_LINK_SECRET || '';

  if (!isValidPhotoTarget(wr, index)) {
    return new NextResponse('Not found', { status: 404 });
  }
  if (!verifyPhotoToken(wr, index, token, secret)) {
    return new NextResponse('Enlace no válido', { status: 403 });
  }

  const { data } = await getPortalAdmin()
    .from('paquetes_portal')
    .select('tib_imagen_url')
    .eq('numero_recibo_bodega', wr)
    .limit(1)
    .maybeSingle();

  const urls = parseTibImageUrls(data?.tib_imagen_url);
  const target = urls[index];

  // Solo se descarga desde el host de TIB (evita SSRF).
  if (!isAuthorizedTibPhotoUrl(target)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const upstream = await fetch(target, { cache: 'no-store' });
  const type = upstream.headers.get('content-type') || '';
  if (!upstream.ok || !type.startsWith('image/')) {
    return new NextResponse('Foto no disponible', { status: 502 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': type,
      'Cache-Control': 'private, max-age=86400',
      'Content-Disposition': 'inline',
      'X-Robots-Tag': 'noindex',
    },
  });
}
