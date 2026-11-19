import { NextResponse } from 'next/server';
import { requireSuperadminSession } from '@/lib/supabase/auth-guard';
import {
  isValidInternalUsername,
  normalizeInternalUsername,
  usernameToInternalAuthEmail,
} from '@/lib/portal/roles';

export const dynamic = 'force-dynamic';

const MIN_PASSWORD_LENGTH = 8;

export async function GET(req: Request) {
  try {
    const auth = await requireSuperadminSession(req);
    if (!auth.ok) return auth.response;
    const { portalAdmin } = auth;

    const fetchAllAuthUsers = async () => {
      const all: any[] = [];
      let page = 1;
      while (true) {
        const { data, error } = await portalAdmin.auth.admin.listUsers({ page, perPage: 1000 });
        if (error || !data?.users || data.users.length === 0) break;
        all.push(...data.users);
        if (data.users.length < 1000) break;
        page++;
      }
      return all;
    };

    const [staffRes, authUsers] = await Promise.all([
      portalAdmin
        .from('usuarios_internos')
        .select('*')
        .order('creado_en', { ascending: false }),
      fetchAllAuthUsers(),
    ]);

    if (staffRes.error) {
      return NextResponse.json({ error: staffRes.error.message }, { status: 500 });
    }

    const authById = new Map<string, any>();
    for (const u of authUsers) {
      if (u.id) authById.set(u.id, u);
    }

    const usuarios = (staffRes.data || []).map((row) => {
      const authUser = authById.get(row.id);
      return {
        ...row,
        ultimo_acceso: authUser?.last_sign_in_at || null,
      };
    });

    return NextResponse.json({
      success: true,
      total: usuarios.length,
      usuarios,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al listar usuarios internos';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireSuperadminSession(req);
    if (!auth.ok) return auth.response;
    const { portalAdmin, email: adminEmail } = auth;

    const body = await req.json().catch(() => ({}));
    const rawNombre = String(body?.nombre_completo || '').trim();
    const cleanUsername = normalizeInternalUsername(body?.username);
    const rawCargo = body?.cargo ? String(body.cargo).trim() : null;
    const password = String(body?.password || '');
    const puedeExportarExcel = Boolean(body?.puede_exportar_excel);

    if (!rawNombre || rawNombre.length < 2) {
      return NextResponse.json(
        { error: 'Ingresa el nombre completo del trabajador.' },
        { status: 400 }
      );
    }

    if (!isValidInternalUsername(cleanUsername)) {
      return NextResponse.json(
        {
          error:
            'El nombre de usuario debe tener entre 3 y 32 caracteres y solo usar letras minúsculas, números, punto (.), guion (-) o guion bajo (_).',
        },
        { status: 400 }
      );
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` },
        { status: 400 }
      );
    }

    const authEmail = usernameToInternalAuthEmail(cleanUsername);
    const cleanNombre = rawNombre.toUpperCase();

    // 1. Verificar duplicado en usuarios_internos
    const { data: existing } = await portalAdmin
      .from('usuarios_internos')
      .select('id, username')
      .or(`username.eq.${cleanUsername},auth_email.eq.${authEmail}`)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: `El usuario "@${cleanUsername}" ya existe en el equipo interno.` },
        { status: 409 }
      );
    }

    // 2. Crear cuenta en Supabase Auth con confirmación inmediata (sin correo)
    const { data: createdAuth, error: authCreateError } = await portalAdmin.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      app_metadata: {
        role: 'interno',
      },
      user_metadata: {
        role: 'interno',
        username: cleanUsername,
        nombre_completo: cleanNombre,
        cargo: rawCargo,
      },
    });

    if (authCreateError || !createdAuth?.user?.id) {
      const errMsg = authCreateError?.message || 'No se pudo crear el acceso en autenticación.';
      const isDuplicate = errMsg.toLowerCase().includes('already') || errMsg.toLowerCase().includes('registered');
      return NextResponse.json(
        {
          error: isDuplicate
            ? `El usuario "@${cleanUsername}" ya está registrado en el sistema de acceso.`
            : errMsg,
        },
        { status: isDuplicate ? 409 : 500 }
      );
    }

    const userId = createdAuth.user.id;
    const nowIso = new Date().toISOString();

    // 3. Insertar perfil en public.usuarios_internos (con rollback de Auth si falla)
    const { data: inserted, error: insertError } = await portalAdmin
      .from('usuarios_internos')
      .insert({
        id: userId,
        username: cleanUsername,
        auth_email: authEmail,
        nombre_completo: cleanNombre,
        cargo: rawCargo,
        puede_exportar_excel: puedeExportarExcel,
        activo: true,
        creado_por: adminEmail,
        creado_en: nowIso,
        actualizado_en: nowIso,
      })
      .select()
      .single();

    if (insertError || !inserted) {
      // Rollback del usuario Auth recién creado
      await portalAdmin.auth.admin.deleteUser(userId).catch(() => {});
      return NextResponse.json(
        { error: `Error al registrar usuario interno: ${insertError?.message || 'Error desconocido'}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      usuario: {
        ...inserted,
        ultimo_acceso: null,
      },
      mensaje: `Usuario interno @${cleanUsername} creado con éxito. Ya puede iniciar sesión en /login.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno al crear usuario interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireSuperadminSession(req);
    if (!auth.ok) return auth.response;
    const { portalAdmin } = auth;

    const body = await req.json().catch(() => ({}));
    const id = String(body?.id || '').trim();
    if (!id) {
      return NextResponse.json({ error: 'ID de usuario interno requerido.' }, { status: 400 });
    }

    const { data: current, error: fetchErr } = await portalAdmin
      .from('usuarios_internos')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !current) {
      return NextResponse.json({ error: 'Usuario interno no encontrado.' }, { status: 404 });
    }

    const dbUpdates: Record<string, any> = {
      actualizado_en: new Date().toISOString(),
    };
    const authUpdates: Record<string, any> = {};
    const nextMeta: Record<string, any> = {
      role: 'interno',
      username: current.username,
      nombre_completo: current.nombre_completo,
      cargo: current.cargo,
    };
    let metaChanged = false;

    if (typeof body?.nombre_completo === 'string') {
      const cleanNombre = body.nombre_completo.trim().toUpperCase();
      if (cleanNombre.length < 2) {
        return NextResponse.json({ error: 'El nombre completo es inválido.' }, { status: 400 });
      }
      dbUpdates.nombre_completo = cleanNombre;
      nextMeta.nombre_completo = cleanNombre;
      metaChanged = true;
    }

    if (body?.cargo !== undefined) {
      const cleanCargo = body.cargo ? String(body.cargo).trim() : null;
      dbUpdates.cargo = cleanCargo;
      nextMeta.cargo = cleanCargo;
      metaChanged = true;
    }

    if (typeof body?.puede_exportar_excel === 'boolean') {
      dbUpdates.puede_exportar_excel = body.puede_exportar_excel;
    }

    if (typeof body?.activo === 'boolean') {
      dbUpdates.activo = body.activo;
      authUpdates.ban_duration = body.activo ? 'none' : '876000h';
    }

    if (typeof body?.new_password === 'string' && body.new_password.length > 0) {
      if (body.new_password.length < MIN_PASSWORD_LENGTH) {
        return NextResponse.json(
          { error: `La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` },
          { status: 400 }
        );
      }
      authUpdates.password = body.new_password;
    }

    if (metaChanged) {
      authUpdates.user_metadata = nextMeta;
    }

    if (Object.keys(authUpdates).length > 0) {
      const { error: authUpdErr } = await portalAdmin.auth.admin.updateUserById(id, authUpdates);
      if (authUpdErr) {
        return NextResponse.json(
          { error: `Error al actualizar acceso en autenticación: ${authUpdErr.message}` },
          { status: 500 }
        );
      }
    }

    const { data: updated, error: dbUpdErr } = await portalAdmin
      .from('usuarios_internos')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (dbUpdErr || !updated) {
      return NextResponse.json(
        { error: `Error al actualizar usuario interno: ${dbUpdErr?.message || 'Error desconocido'}` },
        { status: 500 }
      );
    }

    const actionMessage =
      typeof body?.new_password === 'string' && body.new_password.length > 0
        ? `Contraseña actualizada correctamente para @${updated.username}.`
        : typeof body?.activo === 'boolean' && Object.keys(dbUpdates).length === 2
          ? `Cuenta @${updated.username} ${updated.activo ? 'activada' : 'desactivada'} correctamente.`
          : `Usuario interno @${updated.username} actualizado correctamente.`;

    return NextResponse.json({
      success: true,
      usuario: updated,
      mensaje: actionMessage,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al actualizar usuario interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireSuperadminSession(req);
    if (!auth.ok) return auth.response;
    const { portalAdmin } = auth;

    const { searchParams } = new URL(req.url);
    let id = (searchParams.get('id') || '').trim();
    if (!id) {
      const body = await req.json().catch(() => ({}));
      id = String(body?.id || '').trim();
    }

    if (!id) {
      return NextResponse.json({ error: 'ID de usuario interno requerido.' }, { status: 400 });
    }

    const { data: current } = await portalAdmin
      .from('usuarios_internos')
      .select('id, username')
      .eq('id', id)
      .maybeSingle();

    if (!current) {
      return NextResponse.json({ error: 'Usuario interno no encontrado.' }, { status: 404 });
    }

    // 1. Eliminar primero de Supabase Auth (revoca acceso inmediatamente)
    const { error: authDelErr } = await portalAdmin.auth.admin.deleteUser(id);
    if (authDelErr && !authDelErr.message.toLowerCase().includes('not found')) {
      return NextResponse.json(
        { error: `No se pudo eliminar la cuenta de acceso: ${authDelErr.message}` },
        { status: 500 }
      );
    }

    // 2. Eliminar de usuarios_internos (portal_eventos_uso conserva la auditoría histórica)
    const { error: dbDelErr } = await portalAdmin
      .from('usuarios_internos')
      .delete()
      .eq('id', id);

    if (dbDelErr) {
      return NextResponse.json(
        { error: `No se pudo eliminar el perfil interno: ${dbDelErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      mensaje: `Usuario interno @${current.username} eliminado. Su historial en auditoría se conserva intacto.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al eliminar usuario interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
