import { NextRequest, NextResponse } from 'next/server';
import { getPortalAdmin } from '@/lib/supabase/portal-admin';

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code')?.trim().toUpperCase();

    if (!code || code.length < 3) {
      return NextResponse.json(
        { error: 'Por favor ingresa un código de tracking o recibo de almacén (mínimo 3 caracteres).' },
        { status: 400 }
      );
    }

    const portalAdmin = getPortalAdmin();

    const { data, error } = await portalAdmin
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
        estado_visible,
        tib_imagen_url,
        tib_ticket_pdf_url,
        ubicacion_almacen,
        creado_en,
        actualizado_en
      `)
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
      paquete: data,
    });
  } catch (err: any) {
    console.error('[API Tracking Server Error]', err);
    return NextResponse.json(
      { error: 'Error interno en el servidor de rastreo.' },
      { status: 500 }
    );
  }
}
