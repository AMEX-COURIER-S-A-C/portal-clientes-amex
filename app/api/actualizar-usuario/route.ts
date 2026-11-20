import { NextResponse } from 'next/server';
import { requireSuperadminSession } from '@/lib/supabase/auth-guard';
import { syncTibPackagesToPortal } from '@/lib/portal/syncTibToPortal';
import { normalizeMatchingRules } from '@/lib/portal/matching';
import { isSuperadminEmail } from '@/lib/portal/superadmin';
import { getClientKeywords, applyClientScopeFilter } from '@/lib/portal/clientFilter';

export async function GET(req: Request) {
  try {
    const auth = await requireSuperadminSession(req);
    if (!auth.ok) return auth.response;
    const portalAdmin = auth.portalAdmin;

    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

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

    const clientInfo = await getClientKeywords(portalAdmin, client.email);
    let countQuery = portalAdmin
      .from('paquetes_portal')
      .select('*', { count: 'exact', head: true });

    countQuery = applyClientScopeFilter(countQuery, clientInfo);

    const { count: paquetesCount } = await countQuery;

    return NextResponse.json({ client, paquetes_vinculados: paquetesCount || 0 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await requireSuperadminSession(req);
    if (!auth.ok) return auth.response;
    const portalAdmin = auth.portalAdmin;

    const body = await req.json();
    const {
      id,
      nombre_completo,
      alias_palabras_clave,
      palabras_clave_grupo,
      activo,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'El ID del cliente es requerido.' }, { status: 400 });
    }

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

    const isSuperadminTarget = isSuperadminEmail(existingClient.email);
    const cleanNombre = nombre_completo ? String(nombre_completo).trim().toUpperCase() : existingClient.nombre_completo;
    const { exactConsignees, groupKeywords } = normalizeMatchingRules({
      exactConsignees:
        alias_palabras_clave !== undefined ? alias_palabras_clave : existingClient.alias_palabras_clave,
      groupKeywords:
        palabras_clave_grupo !== undefined ? palabras_clave_grupo : existingClient.palabras_clave_grupo,
      isSuperadmin: isSuperadminTarget,
      applyFallbackWhenEmpty: false,
    });

    // 2. Actualizar registro en public.clientes_portal (protegiendo estado activo de Superadmin)
    const updatePayload: Record<string, any> = {
      nombre_completo: cleanNombre,
      alias_palabras_clave: exactConsignees,
      palabras_clave_grupo: groupKeywords,
      actualizado_en: new Date().toISOString(),
    };

    if (isSuperadminTarget) {
      updatePayload.activo = true;
    } else if (activo !== undefined) {
      updatePayload.activo = Boolean(activo);
    }

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

    // 3. Re-vincular paquetes de forma unificada en paquetes_portal (sin doble pasada redundante)
    let totalLinked = 0;
    try {
      const clientEmail = existingClient.email.toLowerCase();

      if (!isSuperadminTarget) {
        try {
          await syncTibPackagesToPortal({ specificEmail: clientEmail });
        } catch (tibErr) {
          console.warn('[ActualizarCliente] Aviso al sincronizar TIB API:', tibErr);
        }

        const updatedClientInfo = await getClientKeywords(portalAdmin, clientEmail);
        let finalCountQuery = portalAdmin
          .from('paquetes_portal')
          .select('id', { count: 'exact', head: true });

        finalCountQuery = applyClientScopeFilter(finalCountQuery, updatedClientInfo);
        const { count: finalCount } = await finalCountQuery;

        totalLinked = finalCount || 0;
      } else {
        const { count: allCount } = await portalAdmin
          .from('paquetes_portal')
          .select('id', { count: 'exact', head: true });
        totalLinked = allCount || 0;
      }
    } catch (relinkErr) {
      console.error('[ActualizarCliente] Error al revincular paquetes:', relinkErr);
    }

    return NextResponse.json({
      success: true,
      client: updatedClient,
      paquetes_vinculados: totalLinked,
      message: `Cliente actualizado. Se vincularon ${totalLinked} paquetes desde el inventario.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno al actualizar usuario cliente';
    console.error('[API actualizar-usuario] Error:', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
