import { NextResponse } from 'next/server';
import { getPortalAdmin } from '@/lib/supabase/portal-admin';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, activo } = body;

    if (!id) {
      return NextResponse.json({ error: 'El ID del cliente es requerido.' }, { status: 400 });
    }

    if (typeof activo !== 'boolean') {
      return NextResponse.json({ error: 'El parámetro activo debe ser un booleano (true/false).' }, { status: 400 });
    }

    const portalAdmin = getPortalAdmin();

    // 1. Obtener cliente actual para verificar existencia
    const { data: client, error: fetchErr } = await portalAdmin
      .from('clientes_portal')
      .select('id, email, nombre_completo, activo')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !client) {
      return NextResponse.json({ error: 'Cliente no encontrado en el portal.' }, { status: 404 });
    }

    // 2. Actualizar estado activo en clientes_portal
    const { error: updateErr } = await portalAdmin
      .from('clientes_portal')
      .update({
        activo: activo,
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateErr) {
      console.error('[API toggle-estado-cliente] Error al actualizar clientes_portal:', updateErr);
      return NextResponse.json({ error: `Error en base de datos: ${updateErr.message}` }, { status: 500 });
    }

    // 3. Sincronizar metadatos en Auth para coherencia
    try {
      await portalAdmin.auth.admin.updateUserById(id, {
        user_metadata: {
          activo: activo,
        },
      });
    } catch (authErr) {
      console.warn('[API toggle-estado-cliente] Aviso sincronizando auth metadata:', authErr);
    }

    return NextResponse.json({
      success: true,
      id,
      activo,
      message: activo
        ? `Cuenta de ${client.nombre_completo} activada exitosamente.`
        : `Cuenta de ${client.nombre_completo} desactivada. El acceso al portal ha sido bloqueado.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno al cambiar estado del cliente';
    console.error('[API toggle-estado-cliente] Error:', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
