import { NextResponse } from 'next/server';
import { getPortalAdmin } from '@/lib/supabase/portal-admin';
import { syncTibPackagesToPortal, cleanExactString } from '@/lib/portal/syncTibToPortal';
import { sendWelcomeClientEmail } from '@/lib/email/welcomeClient';
import { getPortalBaseUrl } from '@/lib/portal/portal-urls';
import { isSuperadminEmail } from '@/lib/portal/superadmin';
import { getClientKeywords, applyClientScopeFilter } from '@/lib/portal/clientFilter';

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

    if (Array.isArray(alias_palabras_clave)) {
      alias_palabras_clave.forEach((k: unknown) => {
        const cleaned = cleanExactString(k);
        if (cleaned && !keywords.includes(cleaned)) {
          keywords.push(cleaned);
        }
      });
    } else if (typeof alias_palabras_clave === 'string') {
      alias_palabras_clave
        .split(',')
        .map((k) => cleanExactString(k))
        .filter(Boolean)
        .forEach((cleaned) => {
          if (!keywords.includes(cleaned)) {
            keywords.push(cleaned);
          }
        });
    }

    // Solo si no hay ninguna palabra clave definida, respaldar con el nombre
    if (keywords.length === 0 && cleanNombre && !isSuperadmin) {
      keywords.push(cleanNombre);
    }

    const portalAdmin = getPortalAdmin();

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
      const baseUrl = getPortalBaseUrl();
      const redirectUrl = `${baseUrl}/establecer-password`;

      const { data: authLinkData, error: authLinkError } = await portalAdmin.auth.admin.generateLink({
        type: 'invite',
        email: cleanEmail,
        options: {
          redirectTo: redirectUrl,
          data: {
            nombre_completo: cleanNombre,
            es_cliente_portal: true,
          },
        },
      });

      if (authLinkError || !authLinkData?.properties?.action_link) {
        console.warn('[CrearCliente] Falló generateLink invite, intentando recovery:', authLinkError?.message);
        const { error: recoveryError, data: recoveryData } = await portalAdmin.auth.admin.generateLink({
          type: 'recovery',
          email: cleanEmail,
          options: { redirectTo: redirectUrl },
        });

        if (recoveryData?.user) {
          authUserId = recoveryData.user.id;
          actionLink = recoveryData.properties?.action_link || '';
        } else {
          console.error('[CrearCliente] Error alternativo al generar recovery link:', recoveryError);
        }
      } else {
        authUserId = authLinkData.user?.id || null;
        actionLink = authLinkData.properties.action_link;
      }
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
