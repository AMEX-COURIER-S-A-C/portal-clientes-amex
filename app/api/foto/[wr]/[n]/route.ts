import { NextRequest, NextResponse } from 'next/server';
import { getPortalAdmin } from '@/lib/supabase/portal-admin';
import { verifyPhotoToken } from '@/lib/portal/photo-link';

export const dynamic = 'force-dynamic';

const TIB_MEDIA_BASE_URL = 'https://www.tibcourier.com/global-courier/ajax/';

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

  if (!/^[A-Z0-9-]{3,30}$/.test(wr) || !Number.isInteger(index) || index < 0 || index > 20) {
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

  const urls = String(data?.tib_imagen_url || '')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean)
    .map((u) => (u.startsWith('http') ? u : TIB_MEDIA_BASE_URL + u.replace(/^\/+/, '')));
  const target = urls[index];

  // Solo se descarga desde el host de TIB (evita SSRF).
  if (!target || new URL(target).hostname !== 'www.tibcourier.com') {
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
