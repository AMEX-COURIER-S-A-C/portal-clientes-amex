import { NextResponse } from 'next/server';
import { getPortalAdmin } from '@/lib/supabase/portal-admin';
import { sendWelcomeClientEmail } from '@/lib/email/welcomeClient';
import { getPortalBaseUrl, toBrandedAuthLink } from '@/lib/portal/portal-urls';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, userId } = body;

    if (!email || !email.trim() || !email.includes('@')) {
      return NextResponse.json({ error: 'Ingresa un correo electrónico válido.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const portalAdmin = getPortalAdmin();
    const baseUrl = getPortalBaseUrl(req);
    const redirectTo = `${baseUrl}/establecer-password`;

    // 1. Obtener datos del cliente en clientes_portal
    const { data: profile } = await portalAdmin
      .from('clientes_portal')
      .select('nombre_completo, email, id')
      .eq('email', cleanEmail)
      .maybeSingle();

    const nombreCompleto = profile?.nombre_completo || 'Estimado(a) Cliente';

    // 2. Generar nuevo enlace de activación/recuperación
    let actionLink: string | null = null;

    // Primero intentamos enlace de recuperación (para usuarios existentes)
    const { data: recoveryData, error: recoveryErr } = await portalAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: cleanEmail,
      options: {
        redirectTo,
      },
    });

    if (!recoveryErr && recoveryData?.properties?.action_link) {
      actionLink = recoveryData.properties.action_link;
    } else {
      // Si no existe en auth, intentamos invitarlo
      const { data: inviteData, error: inviteErr } = await portalAdmin.auth.admin.generateLink({
        type: 'invite',
        email: cleanEmail,
        options: {
          redirectTo,
          data: {
            nombre_completo: nombreCompleto,
            rol: 'cliente',
            password_establecido: false,
          },
        },
      });

      if (inviteErr) {
        return NextResponse.json(
          { error: `No se pudo generar el enlace: ${inviteErr.message}` },
          { status: 500 }
        );
      }
      actionLink = inviteData?.properties?.action_link || null;
    }

    if (!actionLink) {
      return NextResponse.json({ error: 'No se pudo generar el enlace de activación.' }, { status: 500 });
    }

    // 3. Enviar correo vía Resend
    const emailRes = await sendWelcomeClientEmail({
      email: cleanEmail,
      nombreCompleto,
      activationLink: toBrandedAuthLink(actionLink),
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
