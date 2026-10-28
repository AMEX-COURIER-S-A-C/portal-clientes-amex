'use client';
import { trackPortalEvent } from '@/lib/analytics/tracker';

import React, { useState, useRef, useEffect } from 'react';
import {
  FileSpreadsheet,
  ChevronDown,
  Filter,
  Layers,
  PackageCheck,
  Truck,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

export interface ExcelExportDropdownProps {
  userEmail?: string | null;
  filters: {
    wr: string;
    tracking: string;
    consignatario: string;
    tipo: string;
    estado: string;
    fechaTipo?: 'creado_en' | 'actualizado_en';
    fechaDesde?: string;
    fechaHasta?: string;
    pesoMin?: string;
    pesoMax?: string;
  };
  totalFilteredCount: number;
  totalSystemCount: number;
}

export default function ExcelExportDropdown({
  userEmail,
  filters,
  totalFilteredCount,
  totalSystemCount,
}: ExcelExportDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportingLabel, setExportingLabel] = useState<string>('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleExport = async (scope: 'filtered' | 'all' | 'recibido_miami' | 'en_transito' | 'entregado', label: string) => {
    if (isExporting) return;
    setIsOpen(false);
    setIsExporting(true);
    setExportingLabel(`Exportando (${label})...`);

    try {
      const res = await fetch('/api/exportar-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          scope,
          filters,
        }),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error || 'Error al generar el archivo Excel');
      }

      // Obtener el nombre del archivo desde el header Content-Disposition si existe
      let filename = `AMEX_Inventario_${scope}.xlsx`;
      const disposition = res.headers.get('content-disposition');
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) {
          filename = match[1];
        }
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      // Telemetria no bloqueante de descarga Excel
      trackPortalEvent({
        usuario_email: userEmail || undefined,
        tipo_evento: 'EXPORTAR_EXCEL',
        detalles: { scope, filename },
      });
    } catch (err: any) {
      console.error('Error al exportar inventario a Excel:', err);
      alert(err?.message || 'Ocurrió un error inesperado al descargar el archivo Excel.');
    } finally {
      setIsExporting(false);
      setExportingLabel('');
    }
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        disabled={isExporting}
        style={{
          backgroundColor: '#10b981',
          color: '#ffffff',
          border: 'none',
          borderRadius: '6px',
          padding: '9px 16px',
          fontSize: '13px',
          fontWeight: 700,
          letterSpacing: '0.3px',
          cursor: isExporting ? 'wait' : 'pointer',
          boxShadow: '0 2px 4px rgba(16, 185, 129, 0.25)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          transition: 'all 0.15s ease',
          opacity: isExporting ? 0.8 : 1,
        }}
        title="Exportar inventario a formato Excel (.xlsx)"
      >
        {isExporting ? (
          <>
            <Loader2 style={{ width: '15px', height: '15px', animation: 'spin 1s linear infinite' }} />
            <span>{exportingLabel || 'Generando Excel...'}</span>
          </>
        ) : (
          <>
            <FileSpreadsheet style={{ width: '16px', height: '16px' }} />
            <span>EXPORTAR EXCEL</span>
            <ChevronDown
              style={{
                width: '14px',
                height: '14px',
                transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s ease',
              }}
            />
          </>
        )}
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 'calc(100% + 6px)',
            width: '280px',
            maxWidth: 'calc(100vw - 32px)',
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
            padding: '6px',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          <div
            style={{
              padding: '6px 10px',
              fontSize: '10.5px',
              fontWeight: 800,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            Opciones de Exportación
          </div>

          {/* 1. Resultados Filtrados */}
          <button
            type="button"
            onClick={() => handleExport('filtered', 'Filtrados')}
            style={dropdownItemStyle}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Filter style={{ width: '15px', height: '15px', color: '#2563eb' }} />
              <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '12.5px' }}>
                Resultados Filtrados
              </span>
            </div>
            <span style={badgeStyle('#eff6ff', '#1d4ed8')}>
              {totalFilteredCount.toLocaleString()}
            </span>
          </button>

          {/* 2. Todo el Inventario */}
          <button
            type="button"
            onClick={() => handleExport('all', 'Inventario Completo')}
            style={dropdownItemStyle}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers style={{ width: '15px', height: '15px', color: '#4f46e5' }} />
              <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '12.5px' }}>
                Todo el Inventario
              </span>
            </div>
            <span style={badgeStyle('#f1f5f9', '#475569')}>
              {(totalSystemCount || totalFilteredCount).toLocaleString()}
            </span>
          </button>

          <div style={{ height: '1px', backgroundColor: '#f1f5f9', margin: '4px 0' }} />

          <div
            style={{
              padding: '4px 10px',
              fontSize: '10.5px',
              fontWeight: 800,
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Filtros Rápidos por Estado
          </div>

          {/* 3. Solo Recibido */}
          <button
            type="button"
            onClick={() => handleExport('recibido_miami', 'Recibido')}
            style={dropdownItemStyle}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PackageCheck style={{ width: '15px', height: '15px', color: '#059669' }} />
              <span style={{ fontWeight: 600, color: '#334155', fontSize: '12.5px' }}>
                Solo Recibidos
              </span>
            </div>
          </button>

          {/* 4. Solo Enviado */}
          <button
            type="button"
            onClick={() => handleExport('en_transito', 'Enviado')}
            style={dropdownItemStyle}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Truck style={{ width: '15px', height: '15px', color: '#7c3aed' }} />
              <span style={{ fontWeight: 600, color: '#334155', fontSize: '12.5px' }}>
                Solo Enviados
              </span>
            </div>
          </button>

          {/* 5. Solo Entregados */}
          <button
            type="button"
            onClick={() => handleExport('entregado', 'Entregados')}
            style={dropdownItemStyle}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 style={{ width: '15px', height: '15px', color: '#16a34a' }} />
              <span style={{ fontWeight: 600, color: '#334155', fontSize: '12.5px' }}>
                Solo Entregados
              </span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

const dropdownItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '7px 10px',
  borderRadius: '6px',
  border: 'none',
  background: 'transparent',
  width: '100%',
  textAlign: 'left',
  cursor: 'pointer',
  transition: 'background-color 0.1s ease',
};

const badgeStyle = (bg: string, color: string): React.CSSProperties => ({
  background: bg,
  color: color,
  padding: '1px 6px',
  borderRadius: '10px',
  fontSize: '11px',
  fontWeight: 800,
});
