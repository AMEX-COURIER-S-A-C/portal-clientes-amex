import { NextResponse } from 'next/server';
import { getPortalAdmin } from '@/lib/supabase/portal-admin';
import { syncTibPackagesToPortal, cleanExactString } from '@/lib/portal/syncTibToPortal';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    const portalAdmin = getPortalAdmin();
    const { data: client, error } = await portalAdmin
      .from('clientes_portal')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[ActualizarUsuario GET] Error en consulta clientes_portal:', error);
      return NextResponse.json({ error: `Error en base de datos: ${error.message}` }, { status: 500 });
    }

    if (!client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    // Contar cuántos paquetes tiene actualmente en paquetes_portal
    const { count: paquetesCount } = await portalAdmin
      .from('paquetes_portal')
      .select('*', { count: 'exact', head: true })
      .eq('usuario_email', client.email.toLowerCase());

    return NextResponse.json({ client, paquetes_vinculados: paquetesCount || 0 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const {
      id,
      nombre_completo,
      telefono,
      documento_identidad,
      casillero_codigo,
      alias_palabras_clave,
      activo,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'El ID del cliente es requerido.' }, { status: 400 });
    }

    const portalAdmin = getPortalAdmin();

    // 1. Obtener cliente actual
    const { data: existingClient, error: fetchErr } = await portalAdmin
      .from('clientes_portal')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) {
      console.error('[ActualizarUsuario PUT] Error en consulta clientes_portal:', fetchErr);
      return NextResponse.json({ error: `Error en base de datos: ${fetchErr.message}` }, { status: 500 });
    }

    if (!existingClient) {
      return NextResponse.json({ error: 'Cliente no encontrado en el portal.' }, { status: 404 });
    }

    const cleanNombre = nombre_completo ? String(nombre_completo).trim().toUpperCase() : existingClient.nombre_completo;

    // Normalizar lista de palabras clave (alias): usar ÚNICAMENTE lo que el usuario guardó
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
    if (keywords.length === 0 && cleanNombre) {
      keywords.push(cleanNombre);
    }

    // 2. Actualizar registro en public.clientes_portal
    const updatePayload: Record<string, any> = {
      nombre_completo: cleanNombre,
      alias_palabras_clave: keywords,
      actualizado_en: new Date().toISOString(),
    };

    if (telefono !== undefined) updatePayload.telefono = telefono ? String(telefono).trim() : null;
    if (documento_identidad !== undefined) updatePayload.documento_identidad = documento_identidad ? String(documento_identidad).trim() : null;
    if (casillero_codigo !== undefined) updatePayload.casillero_codigo = casillero_codigo ? String(casillero_codigo).trim() : null;
    if (activo !== undefined) updatePayload.activo = Boolean(activo);

    const { data: updatedClient, error: updateErr } = await portalAdmin
      .from('clientes_portal')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      console.error('[ActualizarCliente] Error al actualizar clientes_portal:', updateErr);
      return NextResponse.json({ error: 'Error al actualizar datos en base de datos.' }, { status: 500 });
    }

    // 3. Re-sincronizar paquetes de la API oficial de TIB para este cliente con sus palabras clave exactas
    let totalLinked = 0;
    try {
      // Limpiar paquetes asignados previamente para este correo antes de recalcular
      await portalAdmin
        .from('paquetes_portal')
        .delete()
        .eq('usuario_email', existingClient.email.toLowerCase());

      const syncRes = await syncTibPackagesToPortal({ specificEmail: existingClient.email });
      totalLinked = syncRes.count || 0;
    } catch (syncErr) {
      console.warn('[ActualizarCliente] Aviso al sincronizar TIB tras edición:', syncErr);
    }

    return NextResponse.json({
      success: true,
      client: updatedClient,
      paquetes_vinculados: totalLinked,
      message: `Cliente actualizado. Se vincularon ${totalLinked} paquetes exactos desde TIB.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno al actualizar usuario cliente';
    console.error('[API actualizar-usuario] Error:', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
