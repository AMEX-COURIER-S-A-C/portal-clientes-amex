import { NextRequest, NextResponse } from 'next/server';
import { getPortalAdmin } from '@/lib/supabase/portal-admin';
import {
  isAuthorizedLegacyTicketUrl,
  isValidTicketWr,
  parseTibV2TicketId,
  verifyTicketToken,
} from '@/lib/portal/ticket-link';
import { extractNumericWrId, isTibV2Configured } from '@/lib/tib/apiClient';
import { createCargoSystemClient } from '@/lib/tib/cargoSystemClient';

export const dynamic = 'force-dynamic';

function buildPdfResponse(body: ArrayBuffer | ReadableStream<Uint8Array>, wr: string): NextResponse {
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Cache-Control': 'private, max-age=3600',
      'Content-Disposition': `inline; filename="Ticket-${wr}.pdf"`,
      'X-Robots-Tag': 'noindex',
    },
  });
}

/**
 * Proxy seguro de Tickets PDF de almacén:
 * - Oculta totalmente el dominio y el token JWT de TIB v2 al navegador.
 * - Soporta tanto Tickets de Cargo System (api.tibgrupo.com) como históricos de tibcourier.com.
 *
 * GET /api/ticket/<WR>?t=<token firmado>
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ wr: string }> }) {
  const { wr: rawWr } = await ctx.params;
  const wr = decodeURIComponent(rawWr).trim().toUpperCase();
  const token = req.nextUrl.searchParams.get('t') || '';
  const secret = process.env.PHOTO_LINK_SECRET || '';

  if (!isValidTicketWr(wr)) {
    return new NextResponse('Not found', { status: 404 });
  }
  if (!verifyTicketToken(wr, token, secret)) {
    return new NextResponse('Enlace no válido', { status: 403 });
  }

  const { data } = await getPortalAdmin()
    .from('paquetes_portal')
    .select('tib_ticket_pdf_url')
    .eq('numero_recibo_bodega', wr)
    .limit(1)
    .maybeSingle();

  const rawTicketUrl = data?.tib_ticket_pdf_url || null;
  const v2IdFromRef = parseTibV2TicketId(rawTicketUrl);

  // 1. Ruta prioritaria TIB v2 (Cargo System con Bearer JWT del servidor)
  if (v2IdFromRef !== null && isTibV2Configured()) {
    try {
      const client = createCargoSystemClient();
      const pdf = await client.fetchWarehousePdf(v2IdFromRef);
      if (pdf) {
        return buildPdfResponse(pdf.buffer, wr);
      }
    } catch (err) {
      console.error('[API Ticket Proxy v2] Error descargando PDF:', err instanceof Error ? err.message : err);
    }
    return new NextResponse('Ticket PDF no disponible temporalmente', { status: 502 });
  }

  // 2. Ruta histórica TIB v1 (tibcourier.com, estrictamente validada anti-SSRF)
  if (isAuthorizedLegacyTicketUrl(rawTicketUrl)) {
    try {
      const upstream = await fetch(rawTicketUrl, {
        cache: 'no-store',
        signal: AbortSignal.timeout(20000),
      });
      const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
      if (upstream.ok && upstream.body && (contentType.includes('application/pdf') || contentType.includes('octet-stream'))) {
        return buildPdfResponse(upstream.body, wr);
      }
    } catch (err) {
      console.warn('[API Ticket Proxy v1] Error en PDF histórico:', err instanceof Error ? err.message : err);
    }
  }

  // 3. Fallback a TIB v2 por ID numérico si el WR fue migrado a Cargo System
  if (isTibV2Configured()) {
    const fallbackNumericId = extractNumericWrId(wr);
    if (fallbackNumericId !== null) {
      try {
        const client = createCargoSystemClient();
        const pdf = await client.fetchWarehousePdf(fallbackNumericId);
        if (pdf) {
          return buildPdfResponse(pdf.buffer, wr);
        }
      } catch (err) {
        console.warn('[API Ticket Proxy Fallback] Error en PDF v2:', err instanceof Error ? err.message : err);
      }
    }
  }

  return new NextResponse('Ticket PDF no disponible', { status: 404 });
}
