import { createClient } from '@supabase/supabase-js';

const portalUrl =
  process.env.NEXT_PUBLIC_PORTAL_SUPABASE_URL ||
  process.env.PORTAL_SUPABASE_URL ||
  'https://zftkbolgcnnkkdfzmtix.supabase.co';

const portalServiceRoleKey =
  process.env.PORTAL_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  '';

/**
 * Cliente de administración de Supabase para el Portal de Clientes.
 * Capaz de crear usuarios de autenticación, sincronizar paquetes y administrar perfiles.
 * NUNCA debe contener claves maestras en texto plano.
 */
export function getPortalAdmin() {
  if (!portalServiceRoleKey) {
    throw new Error('PORTAL_SUPABASE_SERVICE_ROLE_KEY no está configurada en las variables de entorno.');
  }
  return createClient(portalUrl, portalServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
