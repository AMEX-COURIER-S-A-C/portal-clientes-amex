import { NextRequest, NextResponse } from 'next/server';
import { getPortalAdmin } from '@/lib/supabase/portal-admin';

export const dynamic = 'force-dynamic';

function parseUserAgent(userAgent?: string | null): { dispositivo: string; navegador: string } {
  if (!userAgent) return { dispositivo: 'Desconocido', navegador: 'Desconocido' };

  let dispositivo = 'Escritorio';
  if (/mobile|android|iphone|ipod/i.test(userAgent)) {
    dispositivo = 'Móvil';
  } else if (/tablet|ipad/i.test(userAgent)) {
    dispositivo = 'Tablet';
  }

  let navegador = 'Otro';
  if (/chrome|crios/i.test(userAgent) && !/edg|opr/i.test(userAgent)) {
    navegador = 'Chrome';
  } else if (/safari/i.test(userAgent) && !/chrome|crios/i.test(userAgent)) {
    navegador = 'Safari';
  } else if (/edg/i.test(userAgent)) {
    navegador = 'Edge';
  } else if (/firefox|fxios/i.test(userAgent)) {
    navegador = 'Firefox';
  } else if (/opr|opera/i.test(userAgent)) {
    navegador = 'Opera';
  }

  return { dispositivo, navegador };
}

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      body = await req.json().catch(() => ({}));
    } else {
      // Soporte para navigator.sendBeacon con text/plain o blob
      const text = await req.text().catch(() => '');
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        body = {};
      }
    }

    const { usuario_email, nombre_cliente, tipo_evento, detalles } = body;

    if (!usuario_email || !tipo_evento) {
      return NextResponse.json({ error: 'Faltan campos requeridos (usuario_email, tipo_evento)' }, { status: 400 });
    }

    const cleanEmail = String(usuario_email).trim().toLowerCase();
    const cleanTipo = String(tipo_evento).trim().toUpperCase();
    const userAgent = req.headers.get('user-agent');
    const { dispositivo, navegador } = parseUserAgent(userAgent);

    const forwardedFor = req.headers.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 'Anonimizada';

    const portalAdmin = getPortalAdmin();

    const { error } = await portalAdmin.from('portal_eventos_uso').insert({
      usuario_email: cleanEmail,
      nombre_cliente: nombre_cliente ? String(nombre_cliente).trim() : null,
      tipo_evento: cleanTipo,
      detalles: typeof detalles === 'object' && detalles !== null ? detalles : {},
      dispositivo,
      navegador,
      ip_anonimizada: ip.replace(/\.\d+$/, '.xxx'), // Máscara de privacidad GDPR/ISO
      creado_en: new Date().toISOString(),
    });

    if (error) {
      console.warn('[Telemetría Error]', error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.warn('[Telemetría Excepción]', err?.message);
    return NextResponse.json({ ok: false }, { status: 200 }); // Siempre 200 para no romper beacon
  }
}
