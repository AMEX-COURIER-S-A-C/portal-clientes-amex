import { NextRequest, NextResponse } from 'next/server';
import { requireSuperadminSession } from '@/lib/supabase/auth-guard';
import {
  buildSignedTicketPath,
  hasAvailableTicketPdf,
  isValidTicketWr,
} from '@/lib/portal/ticket-link';
import { extractNumericWrId, isTibV2Configured } from '@/lib/tib/apiClient';

export const dynamic = 'force-dynamic';

/**
 * Emite bajo demanda una URL firmada hacia /api/ticket/<WR>?t=<token>
 * restringida estrictamente a Superadministradores AMEX.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireSuperadminSession(req);
    if (!auth.ok) return auth.response;
    const { portalAdmin } = auth;

    const body = await req.json().catch(() => ({}));
    const wr = String(body?.wr || '').trim().toUpperCase();

    if (!isValidTicketWr(wr)) {
      return NextResponse.json({ error: 'Número de Warehouse inválido.' }, { status: 400 });
    }

    const { data: pkg, error: pkgError } = await portalAdmin
      .from('paquetes_portal')
      .select('numero_recibo_bodega, tib_ticket_pdf_url')
      .eq('numero_recibo_bodega', wr)
      .limit(1)
      .maybeSingle();

    if (pkgError) {
      console.error('[API Ticket Sign] Error consultando paquete:', pkgError.message);
      return NextResponse.json({ error: 'No se pudo verificar el ticket solicitado.' }, { status: 500 });
    }

    if (!pkg) {
      return NextResponse.json({ error: 'Paquete no encontrado.' }, { status: 404 });
    }

    const canServeFromDb = hasAvailableTicketPdf(pkg.tib_ticket_pdf_url);
    const canServeFromV2Id = isTibV2Configured() && extractNumericWrId(wr) !== null;

    if (!canServeFromDb && !canServeFromV2Id) {
      return NextResponse.json({ error: 'Este paquete no cuenta con Ticket PDF disponible.' }, { status: 404 });
    }

    const secret = process.env.PHOTO_LINK_SECRET || '';
    if (!secret) {
      return NextResponse.json(
        { error: 'Falta configurar PHOTO_LINK_SECRET para emitir enlaces seguros de Ticket PDF.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      url: buildSignedTicketPath(wr, secret),
      filename: `Ticket-${wr}.pdf`,
      proxied: true,
    });
  } catch (err: unknown) {
    console.error('[API Ticket Sign] Error inesperado:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Error al generar el enlace del Ticket PDF.' }, { status: 500 });
  }
}
