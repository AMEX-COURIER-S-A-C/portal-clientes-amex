import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_PROJECT_URL =
  process.env.NEXT_PUBLIC_PORTAL_SUPABASE_URL ||
  process.env.PORTAL_SUPABASE_URL ||
  'https://zftkbolgcnnkkdfzmtix.supabase.co';

/**
 * Puente institucional de verificación de enlaces (Branded Auth Link).
 * Recibe el clic del cliente desde su correo bajo el dominio oficial (clientes.sistemaamexcourier.online),
 * resolviendo la advertencia de Resend de "Link URLs match sending domain",
 * y redirige de forma transparente al motor de autenticación de Supabase.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const targetUrl = new URL('/auth/v1/verify', SUPABASE_PROJECT_URL);

    // Copiar todos los parámetros de seguridad generados por Supabase (token, type, redirect_to)
    url.searchParams.forEach((val, key) => {
      targetUrl.searchParams.set(key, val);
    });

    // 307 Temporary Redirect preservando el método y parámetros hacia Supabase
    return NextResponse.redirect(targetUrl.toString(), 307);
  } catch (err: unknown) {
    console.error('[Branded Auth Link Error]:', err);
    // En caso de excepción, redirigir a la pantalla de login del portal
    return NextResponse.redirect(new URL('/login', req.url), 302);
  }
}
