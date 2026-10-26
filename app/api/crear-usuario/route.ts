import { NextResponse } from 'next/server';
import { getPortalAdmin } from '@/lib/supabase/portal-admin';
import { syncTibPackagesToPortal, cleanExactString } from '@/lib/portal/syncTibToPortal';
import { sendWelcomeClientEmail } from '@/lib/email/welcomeClient';
import { getPortalBaseUrl } from '@/lib/portal/portal-urls';
import { isSuperadminEmail } from '@/lib/portal/superadmin';

export async function POST(req: Request) {
  try {
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

    // Palabras clave para matching: guardar ÚNICAMENTE lo seleccionado/ingresado
    let keywords: string[] = [];
    if (Array.isArray(alias_palabras_clave) && alias_palabras_clave.length > 0) {
      alias_palabras_clave.forEach((k: string) => {
        const trimmed = String(k).trim().toUpperCase();
        if (trimmed && !keywords.includes(trimmed)) {
          keywords.push(trimmed);
        }
      });
    }

    // Solo si no se especificó ninguna palabra clave y es cliente regular, usar el nombre del formulario como respaldo
    if (keywords.length === 0 && cleanNombre && !isSuperadmin) {
      keywords.push(cleanNombre);
    }

    const portalAdmin = getPortalAdmin();
    const baseUrl = getPortalBaseUrl(req);
    const redirectTo = `${baseUrl}/establecer-password`;

    // 1. Generar enlace de invitación y crear usuario en Supabase Auth (Oregon us-west-2)
    // El Superadmin ya NO define contraseña; el usuario la establece desde el enlace recibido por correo.
    let authUser: any = null;
    let actionLink: string | null = null;

    const { data: inviteData, error: inviteErr } = await portalAdmin.auth.admin.generateLink({
      type: 'invite',
      email: cleanEmail,
      options: {
        redirectTo,
        data: {
          nombre_completo: cleanNombre,
          rol: isSuperadmin ? 'superadmin' : 'cliente',
          is_superadmin: isSuperadmin,
          password_establecido: false,
        },
      },
    });

    if (inviteErr) {
      if (inviteErr.message.includes('already been registered') || inviteErr.message.includes('already registered')) {
        // Si el usuario ya existía previamente en auth, generamos enlace de recuperación para establecer su contraseña
        const { data: recoveryData, error: recoveryErr } = await portalAdmin.auth.admin.generateLink({
          type: 'recovery',
          email: cleanEmail,
          options: {
            redirectTo,
          },
        });

        if (recoveryErr) {
          return NextResponse.json(
            { error: `Este correo ya está registrado y no se pudo generar el enlace: ${recoveryErr.message}` },
            { status: 400 }
          );
        }

        authUser = recoveryData?.user;
        actionLink = recoveryData?.properties?.action_link || null;
      } else {
        return NextResponse.json({ error: `Error de autenticación: ${inviteErr.message}` }, { status: 500 });
      }
    } else {
      authUser = inviteData?.user;
      actionLink = inviteData?.properties?.action_link || null;
    }

    const newUserId = authUser?.id;
    if (!newUserId) {
      return NextResponse.json({ error: 'No se pudo obtener el identificador de usuario creado.' }, { status: 500 });
    }

    // 2. Registrar o actualizar en la tabla public.clientes_portal
    const { error: profileErr } = await portalAdmin.from('clientes_portal').upsert({
      id: newUserId,
      nombre_completo: cleanNombre,
      email: cleanEmail,
      alias_palabras_clave: keywords,
      activo: true,
      actualizado_en: new Date().toISOString(),
    });

    if (profileErr) {
      console.error('[CrearCliente] Error al crear perfil clientes_portal:', profileErr);
    }

    // 3. Enviar correo de activación mediante Resend
    let emailSent = false;
    let emailError: string | null = null;

    if (actionLink) {
      const emailRes = await sendWelcomeClientEmail({
        email: cleanEmail,
        nombreCompleto: cleanNombre,
        activationLink: actionLink,
      });

      emailSent = emailRes.success;
      if (!emailRes.success) {
        emailError = emailRes.error || 'No se pudo enviar el correo';
        console.warn('[CrearCliente] Aviso de envío de correo:', emailError);
      }
    }

    // 4. Auto-cruce de paquetes directamente en el inventario y consulta TIB (solo para clientes regulares)
    let totalLinked = 0;
    try {
      if (!isSuperadmin) {
        const validKeywords: string[] = [];
        const candidateList = [cleanNombre, ...keywords];
        for (const item of candidateList) {
          const clean = cleanExactString(item);
          if (clean && clean.length >= 2 && clean !== 'AMEX' && !validKeywords.includes(clean)) {
            validKeywords.push(clean);
            const compact = clean.replace(/\s+/g, '');
            if (compact.length >= 5 && compact !== clean && !validKeywords.includes(compact)) {
              validKeywords.push(compact);
            }
          }
        }

        if (validKeywords.length > 0) {
          for (const kw of validKeywords) {
            await portalAdmin
              .from('paquetes_portal')
              .update({
                usuario_email: cleanEmail,
                actualizado_en: new Date().toISOString(),
              })
              .ilike('nombre_consignatario', `%${kw}%`);
          }
        }

        try {
          await syncTibPackagesToPortal({ specificEmail: cleanEmail });
        } catch (tibErr) {
          console.warn('[CrearCliente] Aviso al sincronizar paquetes desde TIB API:', tibErr);
        }

        const { count: finalCount } = await portalAdmin
          .from('paquetes_portal')
          .select('id', { count: 'exact', head: true })
          .eq('usuario_email', cleanEmail);
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
        id: newUserId,
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
