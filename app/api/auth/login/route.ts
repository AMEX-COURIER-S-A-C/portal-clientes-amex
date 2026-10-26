import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getPortalAdmin } from '@/lib/supabase/portal-admin';

const PORTAL_URL =
  process.env.NEXT_PUBLIC_PORTAL_SUPABASE_URL ||
  process.env.PORTAL_SUPABASE_URL ||
  'https://zftkbolgcnnkkdfzmtix.supabase.co';

const PORTAL_ANON_KEY =
  process.env.NEXT_PUBLIC_PORTAL_SUPABASE_ANON_KEY ||
  '';

const MASTER_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://tliubfyepimzlimxrquz.supabase.co';

const MASTER_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  '';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Por favor ingresa tu correo y contraseña.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Cliente aislado del portal de clientes (us-west-2 Oregon)
    const portalClient = createClient(PORTAL_URL, PORTAL_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Intentar inicio de sesión en el portal
    let { data: portalAuth, error: portalError } = await portalClient.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    // 2. Si falla y es la cuenta superadmin de AMEX, sincronizar con la base maestra de ERP
    if (portalError && cleanEmail === 'sistemaamexcourier@gmail.com') {
      try {
        const masterClient = createClient(MASTER_URL, MASTER_ANON_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: masterAuth, error: masterError } = await masterClient.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        // Si la contraseña maestra es correcta en el ERP principal:
        if (masterAuth?.session && !masterError) {
          const portalAdmin = getPortalAdmin();

          // Buscar el ID del superadmin en el portal
          const { data: usersData } = await portalAdmin.auth.admin.listUsers();
          const existingUser = usersData?.users?.find(
            (u) => u.email?.toLowerCase() === cleanEmail
          );

          if (existingUser) {
            // Actualizar contraseña en el portal para que coincida con el ERP
            await portalAdmin.auth.admin.updateUserById(existingUser.id, {
              password,
              email_confirm: true,
            });
          } else {
            // Si no existiera en el portal, crearlo
            await portalAdmin.auth.admin.createUser({
              email: cleanEmail,
              password,
              email_confirm: true,
              user_metadata: {
                role: 'superadmin',
                nombre_completo: 'Administrador AMEX Courier',
              },
            });
          }

          // Iniciar sesión ahora con la contraseña sincronizada
          const retry = await portalClient.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });

          portalAuth = retry.data;
          portalError = retry.error;
        }
      } catch (bridgeErr) {
        console.error('[Auth Bridge Error]', bridgeErr);
      }
    }

    if (portalError || !portalAuth?.session) {
      return NextResponse.json(
        {
          error:
            portalError?.message === 'Invalid login credentials'
              ? 'Correo o contraseña incorrectos. Revisa tus datos.'
              : portalError?.message || 'Error al iniciar sesión.',
        },
        { status: 401 }
      );
    }

    // Verificar si la cuenta ha sido desactivada por administración
    if (cleanEmail !== 'sistemaamexcourier@gmail.com') {
      const portalAdmin = getPortalAdmin();
      const { data: clientProfile } = await portalAdmin
        .from('clientes_portal')
        .select('activo')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (clientProfile && clientProfile.activo === false) {
        return NextResponse.json(
          { error: 'Tu cuenta ha sido desactivada por administración. Contacta con soporte AMEX Courier.' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      session: portalAuth.session,
      user: portalAuth.user,
    });
  } catch (err: any) {
    console.error('[Cliente Auth Route Error]', err);
    return NextResponse.json(
      { error: err.message || 'Error en el servidor de autenticación.' },
      { status: 500 }
    );
  }
}
