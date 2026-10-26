import { NextResponse } from 'next/server';
import { getPortalAdmin } from '@/lib/supabase/portal-admin';
import { sendPasswordResetClientEmail } from '@/lib/email/passwordResetClient';
import { getPortalBaseUrl } from '@/lib/portal/portal-urls';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = body;

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
      .select('nombre_completo, email, id, password_establecido')
      .eq('email', cleanEmail)
      .maybeSingle();

    const nombreCompleto = profile?.nombre_completo || 'Estimado(a) Cliente';

    // 2. Generar enlace de recuperación / restablecimiento de contraseña
    let actionLink: string | null = null;

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
      // Si el usuario no fue creado aún en auth.users, intentamos generarlo con invite
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
          { error: `No se pudo generar el enlace de restablecimiento: ${inviteErr.message}` },
          { status: 500 }
        );
      }
      actionLink = inviteData?.properties?.action_link || null;
    }

    if (!actionLink) {
      return NextResponse.json({ error: 'No se pudo generar el enlace para restablecer contraseña.' }, { status: 500 });
    }

    // 3. Enviar correo vía Resend con plantilla de restablecimiento de contraseña
    const emailRes = await sendPasswordResetClientEmail({
      email: cleanEmail,
      nombreCompleto,
      resetLink: actionLink,
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
      message: `Enlace de restablecimiento de contraseña enviado correctamente a ${cleanEmail}.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno al restablecer contraseña';
    console.error('[API restablecer-password] Error:', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
