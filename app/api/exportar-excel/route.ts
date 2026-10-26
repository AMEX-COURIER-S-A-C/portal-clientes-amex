import { NextResponse } from 'next/server';
import { getPortalAdmin } from '@/lib/supabase/portal-admin';
import { isSuperadminEmail } from '@/lib/portal/superadmin';
import writeXlsxFile from 'write-excel-file/node';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Hasta 60 segundos para descargas grandes

function formatFecha(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';
    const pad = (n: number) => String(n).padStart(2, '0');
    const dia = pad(d.getDate());
    const mes = pad(d.getMonth() + 1);
    const anio = d.getFullYear();
    const hora = pad(d.getHours());
    const min = pad(d.getMinutes());
    const seg = pad(d.getSeconds());
    return `${dia}/${mes}/${anio} ${hora}:${min}:${seg}`;
  } catch {
    return '—';
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, scope = 'filtered', filters = {} } = body;

    if (!email) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    const isSuperadmin = isSuperadminEmail(email);
    const portalAdmin = getPortalAdmin();

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
          estado_visible,
          estado_tib,
          estado_amex,
          creado_en,
          actualizado_en
        `);

      // Control de roles estricto: los clientes solo pueden ver y exportar sus propios paquetes
      if (!isSuperadmin) {
        q = q.eq('usuario_email', email);
      }

      // Aplicar lógica según el alcance (scope)
      if (scope === 'filtered') {
        const { wr, tracking, consignatario, tipo, estado, fechaTipo, fechaDesde, fechaHasta, pesoMin, pesoMax } = filters;
        if (wr && typeof wr === 'string' && wr.trim()) {
          q = q.ilike('numero_recibo_bodega', `%${wr.trim()}%`);
        }
        if (tracking && typeof tracking === 'string' && tracking.trim()) {
          q = q.ilike('tracking', `%${tracking.trim()}%`);
        }
        if (consignatario && typeof consignatario === 'string' && consignatario.trim()) {
          q = q.eq('nombre_consignatario', consignatario.trim());
        }
        if (tipo && typeof tipo === 'string' && tipo.trim()) {
          q = q.eq('tipo_empaque', tipo.trim());
        }
        if (estado && typeof estado === 'string' && estado.trim()) {
          q = q.eq('estado_visible', estado.trim());
        }
        const colFecha = fechaTipo === 'actualizado_en' ? 'actualizado_en' : 'creado_en';
        if (fechaDesde && typeof fechaDesde === 'string' && fechaDesde.trim()) {
          try {
            const d = new Date(`${fechaDesde.trim()}T00:00:00`);
            if (!isNaN(d.getTime())) {
              q = q.gte(colFecha, d.toISOString());
            }
          } catch (_) {}
        }
        if (fechaHasta && typeof fechaHasta === 'string' && fechaHasta.trim()) {
          try {
            const d = new Date(`${fechaHasta.trim()}T23:59:59.999`);
            if (!isNaN(d.getTime())) {
              q = q.lte(colFecha, d.toISOString());
            }
          } catch (_) {}
        }
        if (pesoMin !== undefined && pesoMin !== '' && !isNaN(Number(pesoMin))) {
          q = q.gte('peso_kg', Number(pesoMin));
        }
        if (pesoMax !== undefined && pesoMax !== '' && !isNaN(Number(pesoMax))) {
          q = q.lte('peso_kg', Number(pesoMax));
        }
      } else if (scope === 'recibido_miami') {
        q = q.eq('estado_visible', 'RECIBIDO');
      } else if (scope === 'en_transito') {
        q = q.eq('estado_visible', 'ENVIADO');
      } else if (scope === 'entregado') {
        q = q.eq('estado_visible', 'ENTREGADO');
      }
      // scope === 'all' no aplica filtros adicionales

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

    // Definición de columnas con formato profesional para write-excel-file
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
        cell: (p: any) => ({ value: p.estado_tib || p.estado_visible || 'RECIBIDO' }),
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
