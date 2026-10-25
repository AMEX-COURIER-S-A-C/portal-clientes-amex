import { createClient } from '@supabase/supabase-js';

const portalUrl =
  process.env.NEXT_PUBLIC_PORTAL_SUPABASE_URL ||
  'https://zftkbolgcnnkkdfzmtix.supabase.co';

const portalAnonKey =
  process.env.NEXT_PUBLIC_PORTAL_SUPABASE_ANON_KEY ||
  '';

/**
 * Cliente de Supabase EXCLUSIVO para el Portal de Clientes (us-west-2 Oregon).
 * 100% aislado del ERP interno.
 */
export const supabasePortal = createClient(portalUrl, portalAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'amex-portal-cliente-token',
  },
});
