import { NextResponse } from 'next/server';
import { getPortalAdmin } from '@/lib/supabase/portal-admin';
import { syncTibPackagesToPortal, cleanExactString } from '@/lib/portal/syncTibToPortal';
import { ADMIN_MASTER_EMAIL, isSuperadminEmail } from '@/lib/portal/superadmin';

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
    let countQuery = portalAdmin
      .from('paquetes_portal')
      .select('*', { count: 'exact', head: true });

    if (!isSuperadminEmail(client.email)) {
      countQuery = countQuery.eq('usuario_email', client.email.toLowerCase());
    }

    const { count: paquetesCount } = await countQuery;

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

    const isSuperadminTarget = isSuperadminEmail(existingClient.email);
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
    if (keywords.length === 0 && cleanNombre && !isSuperadminTarget) {
      keywords.push(cleanNombre);
    }

    // 2. Actualizar registro en public.clientes_portal (protegiendo estado activo de Superadmin)
    const updatePayload: Record<string, any> = {
      nombre_completo: cleanNombre,
      alias_palabras_clave: keywords,
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

    // 3. Re-vincular paquetes inteligente en paquetes_portal (solo para clientes regulares)
    let totalLinked = 0;
    try {
      const clientEmail = existingClient.email.toLowerCase();

      if (!isSuperadminTarget) {
        // Recopilar palabras clave válidas (mínimo 2 caracteres, ignorar genéricos como 'AMEX')
        const validKeywords: string[] = [];
        const candidateList = [cleanNombre, ...keywords];
        
        for (const item of candidateList) {
          const clean = cleanExactString(item);
          if (clean && clean.length >= 2 && clean !== 'AMEX' && !validKeywords.includes(clean)) {
            validKeywords.push(clean);
            const compact = clean.replace(/\s+/g, '');
            if (compact.length >= 5 && compact !== clean && !validKeywords.includes(compact)) {
              validKeywords.push(compact);
            }
          }
        }

        // Revertir primero los paquetes asignados previamente a este cliente al email del superadmin
        await portalAdmin
          .from('paquetes_portal')
          .update({ usuario_email: ADMIN_MASTER_EMAIL })
          .eq('usuario_email', clientEmail);

        // Vincular todos los paquetes que contengan o coincidan con cualquiera de las palabras clave
        if (validKeywords.length > 0) {
          for (const kw of validKeywords) {
            await portalAdmin
              .from('paquetes_portal')
              .update({
                usuario_email: clientEmail,
                actualizado_en: new Date().toISOString(),
              })
              .ilike('nombre_consignatario', `%${kw}%`);
          }

          // Consultar también la API de TIB en vivo para garantizar que cualquier paquete histórico o reciente sea importado
          try {
            await syncTibPackagesToPortal({ specificEmail: clientEmail });
          } catch (tibErr) {
            console.warn('[ActualizarCliente] Aviso al sincronizar TIB API:', tibErr);
          }
        }

        // Contar el total de paquetes ahora vinculados a este cliente
        const { count: finalCount } = await portalAdmin
          .from('paquetes_portal')
          .select('id', { count: 'exact', head: true })
          .eq('usuario_email', clientEmail);

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
