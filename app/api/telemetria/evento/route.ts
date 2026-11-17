import { isSuperadminEmail } from '@/lib/portal/superadmin';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthSession } from '@/lib/supabase/auth-guard';

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
    const auth = await requireAuthSession(req);
    if (!auth.ok) return auth.response;
    const { email: cleanEmail, portalAdmin } = auth;

    if (isSuperadminEmail(cleanEmail)) {
      // Ignorar silenciosamente las acciones de administradores
      return NextResponse.json({ ok: true, ignored: true });
    }

    let body: any = {};
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      body = await req.json().catch(() => ({}));
    } else {
      const text = await req.text().catch(() => '');
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        body = {};
      }
    }

    const { nombre_cliente, tipo_evento, detalles } = body;

    if (!tipo_evento || typeof tipo_evento !== 'string' || !tipo_evento.trim()) {
      return NextResponse.json({ error: 'Faltan campos requeridos (tipo_evento)' }, { status: 400 });
    }

    const cleanTipo = tipo_evento.trim().toUpperCase();
    const userAgent = req.headers.get('user-agent');
    const { dispositivo, navegador } = parseUserAgent(userAgent);

    const forwardedFor = req.headers.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 'Anonimizada';

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
    return NextResponse.json({ ok: false, error: 'Error al registrar evento de telemetría.' }, { status: 500 });
  }
}
