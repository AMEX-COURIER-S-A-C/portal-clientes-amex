import { NextResponse } from 'next/server';
import { requireSuperadminSession } from '@/lib/supabase/auth-guard';
import { sendWelcomeClientEmail } from '@/lib/email/welcomeClient';
import { generateClientAuthLink, getPortalBaseUrl, toBrandedAuthLink } from '@/lib/portal/portal-urls';

export async function POST(req: Request) {
  try {
    const auth = await requireSuperadminSession(req);
    if (!auth.ok) return auth.response;
    const portalAdmin = auth.portalAdmin;

    const body = await req.json();
    const { email } = body;

    if (!email || !email.trim() || !email.includes('@')) {
      return NextResponse.json({ error: 'Ingresa un correo electrónico válido.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const baseUrl = getPortalBaseUrl(req);
    const redirectTo = `${baseUrl}/establecer-password`;

    const { data: profile } = await portalAdmin
      .from('clientes_portal')
      .select('nombre_completo, email, id')
      .eq('email', cleanEmail)
      .maybeSingle();

    const nombreCompleto = profile?.nombre_completo || 'Estimado(a) Cliente';

    const linkRes = await generateClientAuthLink({
      portalAdmin,
      email: cleanEmail,
      nombreCompleto,
      primaryType: 'recovery',
      redirectTo,
    });

    if (!linkRes.actionLink) {
      return NextResponse.json(
        { error: `No se pudo generar el enlace: ${linkRes.error || 'Error desconocido'}` },
        { status: 500 }
      );
    }

    const emailRes = await sendWelcomeClientEmail({
      email: cleanEmail,
      nombreCompleto,
      activationLink: toBrandedAuthLink(linkRes.actionLink, req),
    });

    if (!emailRes.success) {
      return NextResponse.json(
        { error: `Error al enviar correo vía Resend: ${emailRes.error}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      email: cleanEmail,
      message: `Enlace de activación enviado correctamente a ${cleanEmail}.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno al reenviar enlace de activación';
    console.error('[API reenviar-activacion] Error:', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
