import { NextResponse } from 'next/server';
import { requireAuthSession } from '@/lib/supabase/auth-guard';
import { getClientKeywords, applyClientScopeFilter } from '@/lib/portal/clientFilter';
import { applyPackageQueryFilters } from '@/lib/portal/packageFilters';
import { formatLimaDateTimeString } from '@/lib/portal/limaTime';
import writeXlsxFile from 'write-excel-file/node';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Hasta 60 segundos para descargas grandes

function formatFecha(isoString?: string | null): string {
  return formatLimaDateTimeString(isoString);
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuthSession(req);
    if (!auth.ok) return auth.response;
    const { email: cleanEmail, portalAdmin, role, canExportExcel } = auth;

    if (role === 'interno' && !canExportExcel) {
      return NextResponse.json(
        { error: 'Tu cuenta interna no tiene permiso habilitado para exportar listados a Excel.' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { scope = 'filtered', filters = {} } = body;

    const clientInfo = await getClientKeywords(portalAdmin, cleanEmail);

    // Función constructora de consulta base para paginar de a 1,000 registros
    const createScopedQuery = () => {
      let q = portalAdmin
        .from('paquetes_portal')
        .select(`
          numero_recibo_bodega,
          tracking,
          nombre_consignatario,
          tipo_empaque,
          peso_kg,
          estado_tib,
          estado_amex,
          creado_en,
          actualizado_en
        `);

      if (scope === 'filtered') {
        q = applyPackageQueryFilters(q, clientInfo, filters);
      } else {
        q = applyClientScopeFilter(q, clientInfo);
        if (scope === 'recibido_miami') {
          q = q.eq('estado_tib', 'RECIBIDO');
        } else if (scope === 'en_transito') {
          q = q.eq('estado_tib', 'ENVIADO');
        } else if (scope === 'entregado') {
          q = q.eq('estado_tib', 'ENTREGADO');
        }
      }

      return q.order('creado_en', { ascending: false });
    };

    // Paginación por lotes para extraer hasta 25,000 registros
    const allPaquetes: any[] = [];
    const chunkSize = 1000;
    const maxLimit = 25000;
    let from = 0;

    while (from < maxLimit) {
      const to = from + chunkSize - 1;
      const { data, error } = await createScopedQuery().range(from, to);

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) break;
      allPaquetes.push(...data);
      if (data.length < chunkSize) break;
      from += chunkSize;
    }

    if (allPaquetes.length === 0) {
      return NextResponse.json(
        { error: 'No se encontraron paquetes con los criterios seleccionados para exportar.' },
        { status: 404 }
      );
    }

    const columns = [
      {
        header: { value: 'N°', fontWeight: 'bold' as const, align: 'center' as const },
        cell: (_p: any, idx: number) => ({ value: idx + 1, type: Number, align: 'center' as const }),
        width: 8,
      },
      {
        header: { value: 'WR', fontWeight: 'bold' as const },
        cell: (p: any) => ({ value: p.numero_recibo_bodega || '', fontWeight: 'bold' as const }),
        width: 16,
      },
      {
        header: { value: 'Tracking', fontWeight: 'bold' as const },
        cell: (p: any) => ({ value: p.tracking || '' }),
        width: 26,
      },
      {
        header: { value: 'Cliente / Consignatario', fontWeight: 'bold' as const },
        cell: (p: any) => ({ value: p.nombre_consignatario || '' }),
        width: 38,
      },
      {
        header: { value: 'Tipo de Empaque', fontWeight: 'bold' as const, align: 'center' as const },
        cell: (p: any) => ({ value: p.tipo_empaque || 'CAJA', align: 'center' as const }),
        width: 16,
      },
      {
        header: { value: 'Peso (Kg)', fontWeight: 'bold' as const, align: 'right' as const },
        cell: (p: any) => ({
          value: p.peso_kg ? Number(p.peso_kg) : 0,
          type: Number,
          format: '#,##0.00',
          align: 'right' as const,
        }),
        width: 14,
      },
      {
        header: { value: 'Estado', fontWeight: 'bold' as const },
        cell: (p: any) => ({
          value: p.estado_tib || 'RECIBIDO',
        }),
        width: 20,
      },
      {
        header: { value: 'Fecha Registro', fontWeight: 'bold' as const, align: 'center' as const },
        cell: (p: any) => ({ value: formatFecha(p.creado_en), align: 'center' as const }),
        width: 22,
      },
      {
        header: { value: 'Fecha Modificado', fontWeight: 'bold' as const, align: 'center' as const },
        cell: (p: any) => ({ value: formatFecha(p.actualizado_en || p.creado_en), align: 'center' as const }),
        width: 22,
      },
    ];

    const buffer = await writeXlsxFile(allPaquetes, {
      columns,
      sheet: 'Inventario AMEX',
    }).toBuffer();

    const timestamp = new Date().toISOString().slice(0, 10);
    const scopeLabel =
      scope === 'all'
        ? 'Completo'
        : scope === 'recibido_miami'
        ? 'Miami'
        : scope === 'en_transito'
        ? 'Transito'
        : scope === 'entregado'
        ? 'Entregados'
        : 'Filtrado';

    const filename = `AMEX_Inventario_${scopeLabel}_${timestamp}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error('[API exportar-excel] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Error al generar archivo Excel' },
      { status: 500 }
    );
  }
}
