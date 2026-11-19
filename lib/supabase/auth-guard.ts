import { NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { getPortalAdmin } from '@/lib/supabase/portal-admin';
import { isSuperadminEmail } from '@/lib/portal/superadmin';
import { isInternalStaffEmail, type PortalRole } from '@/lib/portal/roles';

export interface InternalStaffProfile {
  id: string;
  username: string;
  auth_email: string;
  nombre_completo: string;
  cargo: string | null;
  puede_exportar_excel: boolean;
  activo: boolean;
}

export interface AuthSessionOk {
  ok: true;
  user: User;
  email: string;
  role: PortalRole;
  canExportExcel: boolean;
  internalProfile: InternalStaffProfile | null;
  accessToken: string;
  portalAdmin: SupabaseClient;
}

export interface AuthSessionErr {
  ok: false;
  response: NextResponse;
}

export type AuthSessionResult = AuthSessionOk | AuthSessionErr;

export interface AuthGuardOptions {
  portalAdmin?: SupabaseClient;
}

function extractBearerToken(req: Request): string | null {
  const authHeader = (req.headers.get('authorization') || '').trim();
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim() || '';
  if (!token || /\s/.test(token)) {
    return null;
  }
  return token;
}

export async function requireAuthSession(
  req: Request,
  options?: AuthGuardOptions
): Promise<AuthSessionResult> {
  const accessToken = extractBearerToken(req);
  if (!accessToken) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Sesión no autenticada.' }, { status: 401 }),
    };
  }

  const portalAdmin = options?.portalAdmin ?? getPortalAdmin();
  const { data: authData, error: authError } = await portalAdmin.auth.getUser(accessToken);

  const email =
    typeof authData?.user?.email === 'string'
      ? authData.user.email.trim().toLowerCase()
      : '';

  if (authError || !authData?.user || !email) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Tu sesión expiró o es inválida. Vuelve a iniciar sesión.' },
        { status: 401 }
      ),
    };
  }

  let role: PortalRole = 'cliente';
  let canExportExcel = true;
  let internalProfile: InternalStaffProfile | null = null;

  if (isSuperadminEmail(email)) {
    role = 'superadmin';
    canExportExcel = true;
  } else if (isInternalStaffEmail(email)) {
    const { data: staffRow, error: staffErr } = await portalAdmin
      .from('usuarios_internos')
      .select('id, username, auth_email, nombre_completo, cargo, puede_exportar_excel, activo')
      .eq('auth_email', email)
      .maybeSingle();

    if (staffErr || !staffRow || staffRow.activo === false) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Tu cuenta interna ha sido desactivada por administración. Contacta con gerencia AMEX Courier.' },
          { status: 403 }
        ),
      };
    }

    role = 'interno';
    canExportExcel = Boolean(staffRow.puede_exportar_excel);
    internalProfile = staffRow;
  }

  return {
    ok: true,
    user: authData.user,
    email,
    role,
    canExportExcel,
    internalProfile,
    accessToken,
    portalAdmin,
  };
}

export async function requireSuperadminSession(
  req: Request,
  options?: AuthGuardOptions
): Promise<AuthSessionResult> {
  const session = await requireAuthSession(req, options);
  if (!session.ok) {
    return session;
  }

  if (!isSuperadminEmail(session.email)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Acceso denegado. Se requieren permisos de superadministrador.' },
        { status: 403 }
      ),
    };
  }

  return session;
}
