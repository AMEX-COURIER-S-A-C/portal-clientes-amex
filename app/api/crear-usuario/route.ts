import { NextResponse } from 'next/server';
import { requireSuperadminSession } from '@/lib/supabase/auth-guard';
import { syncTibPackagesToPortal } from '@/lib/portal/syncTibToPortal';
import { normalizeClientKeywordsInput } from '@/lib/portal/keywords';
import { sendWelcomeClientEmail } from '@/lib/email/welcomeClient';
import { generateClientAuthLink, getPortalBaseUrl, toBrandedAuthLink } from '@/lib/portal/portal-urls';
import { isSuperadminEmail } from '@/lib/portal/superadmin';
import { getClientKeywords, applyClientScopeFilter } from '@/lib/portal/clientFilter';

export async function POST(req: Request) {
  try {
    const auth = await requireSuperadminSession(req);
    if (!auth.ok) return auth.response;
    const portalAdmin = auth.portalAdmin;

    const body = await req.json();
    const {
      nombre_completo,
      email,
      alias_palabras_clave,
    } = body;

    if (!nombre_completo || !nombre_completo.trim()) {
      return NextResponse.json({ error: 'El nombre completo o empresa es requerido.' }, { status: 400 });
    }

    if (!email || !email.trim() || !email.includes('@')) {
      return NextResponse.json({ error: 'Ingresa un correo electrónico válido.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanNombre = nombre_completo.trim().toUpperCase();
    const isSuperadmin = isSuperadminEmail(cleanEmail);
    const keywords = normalizeClientKeywordsInput(alias_palabras_clave, cleanNombre, isSuperadmin);

    // 1. Verificar si ya existe en clientes_portal
    const { data: existingClient } = await portalAdmin
      .from('clientes_portal')
      .select('id, email')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (existingClient) {
      return NextResponse.json(
        { error: `El correo ${cleanEmail} ya se encuentra registrado en el portal de clientes.` },
        { status: 409 }
      );
    }

    // 2. Crear usuario en Supabase Auth y generar enlace seguro
    let authUserId: string | null = null;
    let actionLink = '';
    let emailSent = false;
    let emailError: string | null = null;

    if (!isSuperadmin) {
      const baseUrl = getPortalBaseUrl(req);
      const redirectTo = `${baseUrl}/establecer-password`;
      const linkRes = await generateClientAuthLink({
        portalAdmin,
        email: cleanEmail,
        nombreCompleto: cleanNombre,
        primaryType: 'invite',
        redirectTo,
        inviteData: {
          nombre_completo: cleanNombre,
          es_cliente_portal: true,
        },
      });
      authUserId = linkRes.userId;
      actionLink = linkRes.actionLink || '';
    }

    // 3. Crear usuario en public.clientes_portal asegurando ID no nulo
    const finalUserId = authUserId || crypto.randomUUID();

    const { data: newClient, error: clientDbError } = await portalAdmin
      .from('clientes_portal')
      .insert({
        id: finalUserId,
        nombre_completo: cleanNombre,
        email: cleanEmail,
        alias_palabras_clave: keywords,
        activo: true,
      })
      .select()
      .single();

    if (clientDbError || !newClient) {
      console.error('[CrearCliente] Error al registrar en clientes_portal:', clientDbError);
      return NextResponse.json(
        { error: `Error al crear el perfil del cliente: ${clientDbError?.message || 'Error desconocido'}` },
        { status: 500 }
      );
    }

    // 4. Enviar correo de activación mediante Resend
    if (actionLink) {
      const emailRes = await sendWelcomeClientEmail({
        email: cleanEmail,
        nombreCompleto: cleanNombre,
        activationLink: toBrandedAuthLink(actionLink, req),
      });

      emailSent = emailRes.success;
      if (!emailRes.success) {
        emailError = emailRes.error || 'No se pudo enviar el correo';
        console.warn('[CrearCliente] Aviso de envío de correo:', emailError);
      }
    }

    // 5. Auto-cruce unificado de paquetes en paquetes_portal (sin doble pasada redundante)
    let totalLinked = 0;
    try {
      if (!isSuperadmin) {
        try {
          await syncTibPackagesToPortal({ specificEmail: cleanEmail });
        } catch (tibErr) {
          console.warn('[CrearCliente] Aviso al sincronizar paquetes desde TIB API:', tibErr);
        }

        const createdClientInfo = await getClientKeywords(portalAdmin, cleanEmail);
        let finalCountQuery = portalAdmin
          .from('paquetes_portal')
          .select('id', { count: 'exact', head: true });

        finalCountQuery = applyClientScopeFilter(finalCountQuery, createdClientInfo);
        const { count: finalCount } = await finalCountQuery;
        totalLinked = finalCount || 0;
      } else {
        const { count: allCount } = await portalAdmin
          .from('paquetes_portal')
          .select('id', { count: 'exact', head: true });
        totalLinked = allCount || 0;
      }
    } catch (linkErr) {
      console.warn('[CrearCliente] Aviso al vincular paquetes en base de datos:', linkErr);
    }

    return NextResponse.json({
      success: true,
      user: {
        id: finalUserId,
        email: cleanEmail,
        nombre_completo: cleanNombre,
      },
      email_enviado: emailSent,
      email_error: emailError,
      paquetes_vinculados: totalLinked,
      mensaje: emailSent
        ? `Usuario registrado exitosamente. Se ha enviado el enlace de activación a ${cleanEmail}.`
        : `Usuario registrado. (Nota de correo: ${emailError || 'Verificar servicio Resend'}).`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno al crear usuario cliente';
    console.error('[API crear-usuario cliente] Error:', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
