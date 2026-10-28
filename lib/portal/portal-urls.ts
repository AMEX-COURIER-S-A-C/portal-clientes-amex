/**
 * Obtiene la URL base oficial para el Portal de Clientes (enlaces de invitación, activación y recuperación).
 * Por defecto SIEMPRE debe ser el dominio oficial de producción: https://clientes.sistemaamexcourier.online
 * para que los clientes que abran el correo desde su celular, tablet o PC accedan siempre a la web real.
 */
export function getPortalBaseUrl(req?: Request): string {
  // 1. Si explícitamente se fuerza localhost para depuración interna específica
  if (process.env.FORCE_LOCAL_PORTAL_URL === 'true') {
    return 'http://localhost:3000';
  }

  // 2. Si se configuró una URL explícita en el entorno
  if (process.env.NEXT_PUBLIC_PORTAL_URL) {
    return process.env.NEXT_PUBLIC_PORTAL_URL.replace(/\/$/, '');
  }

  // 3. Si la petición viene de un host público real
  if (req) {
    const forwardedHost = req.headers.get('x-forwarded-host');
    const host = forwardedHost || req.headers.get('host');
    if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
      const proto = req.headers.get('x-forwarded-proto') || 'https';
      return `${proto}://${host}`;
    }
  }

  // 4. Por defecto absoluto para cualquier correo a clientes: el dominio oficial en vivo
  return 'https://clientes.sistemaamexcourier.online';
}

/**
 * Convierte un enlace de autenticación generado por Supabase (ej. supabase.co/auth/v1/verify?...)
 * al dominio oficial institucional del portal (ej. clientes.sistemaamexcourier.online/auth/v1/verify?...)
 * para garantizar marca blanca total y resolver la advertencia de Resend (URLs match sending domain).
 */
export function toBrandedAuthLink(rawActionLink: string, req?: Request): string {
  if (!rawActionLink) return rawActionLink;
  try {
    const rawUrl = new URL(rawActionLink);
    const baseUrl = getPortalBaseUrl(req);
    const brandedBase = new URL(baseUrl);

    rawUrl.protocol = brandedBase.protocol;
    rawUrl.host = brandedBase.host;
    rawUrl.port = brandedBase.port;

    return rawUrl.toString();
  } catch {
    return rawActionLink;
  }
}
