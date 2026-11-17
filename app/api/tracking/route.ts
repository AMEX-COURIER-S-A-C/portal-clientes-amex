import { NextRequest, NextResponse } from 'next/server';
import { requireAuthSession } from '@/lib/supabase/auth-guard';
import { applyClientScopeFilter, getClientKeywords } from '@/lib/portal/clientFilter';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthSession(req);
    if (!auth.ok) return auth.response;
    const { email, portalAdmin } = auth;

    const rawCode = req.nextUrl.searchParams.get('code')?.trim().toUpperCase() || '';
    const code = rawCode.replace(/["'(),*%]/g, '').trim();

    if (!code || code.length < 3) {
      return NextResponse.json(
        { error: 'Por favor ingresa un código de tracking o recibo de almacén (mínimo 3 caracteres).' },
        { status: 400 }
      );
    }

    const clientInfo = await getClientKeywords(portalAdmin, email);

    let pkgQuery = portalAdmin
      .from('paquetes_portal')
      .select(`
        id,
        numero_recibo_bodega,
        tracking,
        nombre_consignatario,
        tipo_empaque,
        peso_kg,
        estado_tib,
        estado_amex,
        tib_imagen_url,
        tib_ticket_pdf_url,
        ubicacion_almacen,
        creado_en,
        actualizado_en
      `);

    pkgQuery = applyClientScopeFilter(pkgQuery, clientInfo);

    const { data, error } = await pkgQuery
      .or(`numero_recibo_bodega.ilike.%${code}%,tracking.ilike.%${code}%`)
      .order('creado_en', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[API Tracking Error]', error);
      return NextResponse.json(
        { error: 'Error al consultar el servicio de rastreo.' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: `No se encontró ningún paquete con el código "${code}". Verifica el número ingresado.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      paquete: {
        ...data,
        estado: data.estado_tib || 'RECIBIDO',
      },
    });
  } catch (err: any) {
    console.error('[API Tracking Server Error]', err);
    return NextResponse.json(
      { error: 'Error interno en el servidor de rastreo.' },
      { status: 500 }
    );
  }
}
