'use client';

import React, { useMemo, useState } from 'react';
import {
  ShieldCheck,
  Search,
  Image as ImageIcon,
  FileSpreadsheet,
  Activity,
  Users,
  X,
  CheckCircle2,
  Ban,
  LogIn,
  Filter,
} from 'lucide-react';
import { normalizeSearchText } from '@/lib/portal/keywords';

export interface InternalAuditWorker {
  id: string;
  username: string;
  auth_email: string;
  nombre_completo: string;
  cargo: string | null;
  puede_exportar_excel: boolean;
  activo: boolean;
  eliminado: boolean;
  creado_en: string | null;
  ultimo_login: string | null;
  ultima_actividad: string | null;
  total_eventos: number;
  logins: number;
  busquedas: number;
  fotos: number;
  excels: number;
  filtros: number;
}

export interface InternalAuditEvent {
  id: string;
  username: string;
  auth_email: string;
  nombre: string;
  cargo: string | null;
  tipo_evento: string;
  detalles: Record<string, any>;
  dispositivo: string;
  navegador: string;
  creado_en: string;
}

export interface InternalAuditData {
  resumen: {
    total_trabajadores: number;
    cuentas_activas: number;
    activos_hoy: number;
    activos_periodo: number;
    total_eventos: number;
    total_logins: number;
    total_busquedas: number;
    total_fotos: number;
    total_excels: number;
  };
  trabajadores: InternalAuditWorker[];
  bitacora_reciente: InternalAuditEvent[];
}

interface InternalAuditSectionProps {
  data?: InternalAuditData;
  days: number;
}

const EVENT_BADGE_MAP: Record<string, { label: string; bg: string; color: string; border: string }> = {
  LOGIN_EXITOSO: { label: 'Inicio de sesión', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  BUSQUEDA_INVENTARIO: { label: 'Búsqueda WR', bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
  CONSULTA_DETALLE: { label: 'Consulta detalle', bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
  FILTRO_ESTADO: { label: 'Filtro estado', bg: '#f5f3ff', color: '#6d28d9', border: '#ddd6fe' },
  VER_FOTO_ALMACEN: { label: 'Foto almacén', bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  EXPORTAR_EXCEL: { label: 'Exportar Excel', bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' },
};

function formatLimaDateTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-PE', {
      timeZone: 'America/Lima',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '—';
  }
}

function summarizeEventDetails(tipo: string, detalles: Record<string, any>): string {
  if (!detalles || typeof detalles !== 'object') return '—';
  const parts: string[] = [];
  if (detalles.wr) parts.push(`WR: ${detalles.wr}`);
  if (detalles.tracking) parts.push(`Tracking: ${detalles.tracking}`);
  if (detalles.consignatario) parts.push(`Consignatario: ${detalles.consignatario}`);
  if (detalles.termino) parts.push(`Término: "${detalles.termino}"`);
  if (detalles.estado) parts.push(`Estado: ${detalles.estado}`);
  if (detalles.scope) parts.push(`Alcance: ${detalles.scope}`);
  if (typeof detalles.total_registros === 'number') parts.push(`${detalles.total_registros} filas`);
  if (parts.length > 0) return parts.join(' • ');
  if (tipo === 'LOGIN_EXITOSO') return 'Acceso autenticado con usuario interno';
  return 'Consulta en portal Warehouse';
}

export default function InternalAuditSection({ data, days }: InternalAuditSectionProps) {
  const [selectedUsername, setSelectedUsername] = useState<string>('ALL');
  const [selectedEventType, setSelectedEventType] = useState<string>('ALL');
  const [logSearch, setLogSearch] = useState<string>('');

  const resumen = data?.resumen || {
    total_trabajadores: 0,
    cuentas_activas: 0,
    activos_hoy: 0,
    activos_periodo: 0,
    total_eventos: 0,
    total_logins: 0,
    total_busquedas: 0,
    total_fotos: 0,
    total_excels: 0,
  };

  const trabajadores = data?.trabajadores || [];
  const bitacora = data?.bitacora_reciente || [];

  const filteredLogs = useMemo(() => {
    const q = normalizeSearchText(logSearch);
    const terms = q ? q.split(' ').filter(Boolean) : [];

    return bitacora.filter((ev) => {
      if (selectedUsername !== 'ALL' && ev.username !== selectedUsername) return false;
      if (selectedEventType !== 'ALL' && ev.tipo_evento !== selectedEventType) return false;
      if (terms.length > 0) {
        const hay = normalizeSearchText(
          [
            ev.nombre,
            ev.username,
            ev.tipo_evento,
            summarizeEventDetails(ev.tipo_evento, ev.detalles),
            ev.dispositivo,
            ev.navegador,
          ].join(' ')
        );
        if (!terms.every((t) => hay.includes(t))) return false;
      }
      return true;
    });
  }, [bitacora, selectedUsername, selectedEventType, logSearch]);

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    padding: '15px 16px',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Banner descriptivo */}
      <div
        style={{
          padding: '12px 16px',
          borderRadius: '10px',
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          color: '#1e3a8a',
          fontSize: '12.5px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <ShieldCheck style={{ width: '18px', height: '18px', color: '#2563eb', flexShrink: 0 }} />
        <span>
          <strong>Auditoría aislada de Equipo Interno ({days} días):</strong> Registra ingresos, búsquedas de WR, fotos vistas y exportaciones Excel realizadas por trabajadores AMEX, sin mezclar ni alterar las métricas comerciales de clientes.
        </span>
      </div>

      {/* KPIs Equipo Interno */}
      <div className="analytics-kpi-grid">
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Personal Interno</span>
            <Users style={{ width: '15px', height: '15px', color: '#1d4ed8' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a' }}>{resumen.cuentas_activas}</div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>de {resumen.total_trabajadores} cuentas creadas</span>
        </div>

        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Activos en Período</span>
            <Activity style={{ width: '15px', height: '15px', color: '#059669' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a' }}>{resumen.activos_periodo}</div>
          <span style={{ fontSize: '11px', color: '#059669', fontWeight: 700 }}>{resumen.activos_hoy} activos hoy</span>
        </div>

        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Ingresos (Logins)</span>
            <LogIn style={{ width: '15px', height: '15px', color: '#2563eb' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a' }}>{resumen.total_logins.toLocaleString()}</div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>sesiones iniciadas</span>
        </div>

        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Búsquedas WR</span>
            <Search style={{ width: '15px', height: '15px', color: '#ea580c' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a' }}>{resumen.total_busquedas.toLocaleString()}</div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>consultas registradas</span>
        </div>

        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Fotos Revisadas</span>
            <ImageIcon style={{ width: '15px', height: '15px', color: '#16a34a' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a' }}>{resumen.total_fotos.toLocaleString()}</div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>aperturas de almacén</span>
        </div>

        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Descargas Excel</span>
            <FileSpreadsheet style={{ width: '15px', height: '15px', color: '#047857' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a' }}>{resumen.total_excels.toLocaleString()}</div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>exportaciones internas</span>
        </div>
      </div>

      {/* Tabla Resumen por Trabajador */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px 20px' }}>
        <div style={{ marginBottom: '12px' }}>
          <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>Actividad por Trabajador</h2>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
            Haz clic en &quot;Filtrar bitácora&quot; en cualquier fila para auditar únicamente sus acciones.
          </p>
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '11px 12px', fontWeight: 700, color: '#475569' }}>Trabajador</th>
                <th style={{ padding: '11px 12px', fontWeight: 700, color: '#475569' }}>Estado / Excel</th>
                <th style={{ padding: '11px 12px', fontWeight: 700, color: '#475569', textAlign: 'center' }}>Logins</th>
                <th style={{ padding: '11px 12px', fontWeight: 700, color: '#475569', textAlign: 'center' }}>Búsquedas</th>
                <th style={{ padding: '11px 12px', fontWeight: 700, color: '#475569', textAlign: 'center' }}>Fotos</th>
                <th style={{ padding: '11px 12px', fontWeight: 700, color: '#475569', textAlign: 'center' }}>Excel</th>
                <th style={{ padding: '11px 12px', fontWeight: 700, color: '#475569' }}>Última Actividad</th>
                <th style={{ padding: '11px 12px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Auditoría</th>
              </tr>
            </thead>
            <tbody>
              {trabajadores.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                    No hay trabajadores internos registrados ni actividad interna en este período.
                  </td>
                </tr>
              ) : (
                trabajadores.map((t, idx) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafbfc' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{t.nombre_completo}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        <code>@{t.username}</code>
                        {t.cargo ? ` • ${t.cargo}` : ''}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                        {t.eliminado ? (
                          <span style={{ backgroundColor: '#f3f4f6', color: '#4b5563', border: '1px solid #d1d5db', padding: '2px 7px', borderRadius: '10px', fontSize: '10.5px', fontWeight: 700 }}>
                            Cuenta eliminada
                          </span>
                        ) : t.activo ? (
                          <span style={{ backgroundColor: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', padding: '2px 7px', borderRadius: '10px', fontSize: '10.5px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <CheckCircle2 style={{ width: '10px', height: '10px' }} /> Activo
                          </span>
                        ) : (
                          <span style={{ backgroundColor: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', padding: '2px 7px', borderRadius: '10px', fontSize: '10.5px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <Ban style={{ width: '10px', height: '10px' }} /> Desactivado
                          </span>
                        )}
                        {!t.eliminado && t.puede_exportar_excel && (
                          <span style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '2px 7px', borderRadius: '10px', fontSize: '10.5px', fontWeight: 700 }}>
                            Excel OK
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700 }}>{t.logins}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: t.busquedas > 0 ? '#ea580c' : '#94a3b8' }}>{t.busquedas}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: t.fotos > 0 ? '#16a34a' : '#94a3b8' }}>{t.fotos}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: t.excels > 0 ? '#047857' : '#94a3b8' }}>{t.excels}</td>
                    <td style={{ padding: '10px 12px', fontSize: '11.5px', color: '#475569' }}>
                      {formatLimaDateTime(t.ultima_actividad)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedUsername(selectedUsername === t.username ? 'ALL' : t.username)}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '6px',
                          border: selectedUsername === t.username ? '1px solid #1d4ed8' : '1px solid #cbd5e1',
                          backgroundColor: selectedUsername === t.username ? '#1d4ed8' : '#ffffff',
                          color: selectedUsername === t.username ? '#ffffff' : '#334155',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {selectedUsername === t.username ? 'Mostrando' : 'Filtrar bitácora'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bitácora Detallada */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>Bitácora de Acciones del Equipo</h2>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
              Mostrando {filteredLogs.length} de {bitacora.length} eventos registrados en los últimos {days} días.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ position: 'relative', width: '220px' }}>
              <Search style={{ width: '13px', height: '13px', color: '#94a3b8', position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                type="text"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="Buscar WR, usuario, término..."
                className="amex-input"
                style={{ width: '100%', height: '34px', paddingLeft: '28px', paddingRight: logSearch ? '26px' : '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
              />
              {logSearch && (
                <button type="button" onClick={() => setLogSearch('')} style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0, display: 'inline-flex' }}>
                  <X style={{ width: '13px', height: '13px' }} />
                </button>
              )}
            </div>

            <select
              value={selectedUsername}
              onChange={(e) => setSelectedUsername(e.target.value)}
              style={{ height: '34px', padding: '0 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', color: '#334155', backgroundColor: '#ffffff' }}
            >
              <option value="ALL">Todos los trabajadores</option>
              {trabajadores.map((t) => (
                <option key={t.id} value={t.username}>
                  {t.nombre_completo} (@{t.username})
                </option>
              ))}
            </select>

            <select
              value={selectedEventType}
              onChange={(e) => setSelectedEventType(e.target.value)}
              style={{ height: '34px', padding: '0 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', color: '#334155', backgroundColor: '#ffffff' }}
            >
              <option value="ALL">Todas las acciones</option>
              <option value="LOGIN_EXITOSO">Inicios de sesión</option>
              <option value="BUSQUEDA_INVENTARIO">Búsquedas WR</option>
              <option value="FILTRO_ESTADO">Filtros de estado</option>
              <option value="VER_FOTO_ALMACEN">Fotos consultadas</option>
              <option value="EXPORTAR_EXCEL">Exportaciones Excel</option>
            </select>

            {(selectedUsername !== 'ALL' || selectedEventType !== 'ALL' || logSearch) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedUsername('ALL');
                  setSelectedEventType('ALL');
                  setLogSearch('');
                }}
                style={{ height: '34px', padding: '0 10px', borderRadius: '6px', border: '1px solid #fecaca', backgroundColor: '#fef2f2', color: '#b91c1c', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <Filter style={{ width: '12px', height: '12px' }} />
                <span>Limpiar</span>
              </button>
            )}
          </div>
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '10px 12px', fontWeight: 700, color: '#475569' }}>Fecha / Hora (Lima)</th>
                <th style={{ padding: '10px 12px', fontWeight: 700, color: '#475569' }}>Trabajador</th>
                <th style={{ padding: '10px 12px', fontWeight: 700, color: '#475569' }}>Acción</th>
                <th style={{ padding: '10px 12px', fontWeight: 700, color: '#475569' }}>Detalle</th>
                <th style={{ padding: '10px 12px', fontWeight: 700, color: '#475569' }}>Dispositivo</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                    No se encontraron eventos de auditoría interna con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((ev, idx) => {
                  const badge = EVENT_BADGE_MAP[ev.tipo_evento] || {
                    label: ev.tipo_evento,
                    bg: '#f1f5f9',
                    color: '#334155',
                    border: '#cbd5e1',
                  };
                  return (
                    <tr key={ev.id || idx} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafbfc' }}>
                      <td style={{ padding: '9px 12px', whiteSpace: 'nowrap', color: '#475569', fontFamily: 'monospace', fontSize: '11.5px' }}>
                        {formatLimaDateTime(ev.creado_en)}
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{ev.nombre}</div>
                        <div style={{ fontSize: '10.5px', color: '#64748b' }}>@{ev.username}</div>
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <span
                          style={{
                            backgroundColor: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                            padding: '2px 8px',
                            borderRadius: '999px',
                            fontSize: '10.5px',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', color: '#334155', maxWidth: '380px', wordBreak: 'break-word' }}>
                        {summarizeEventDetails(ev.tipo_evento, ev.detalles)}
                      </td>
                      <td style={{ padding: '9px 12px', color: '#64748b', whiteSpace: 'nowrap', fontSize: '11px' }}>
                        {ev.dispositivo} • {ev.navegador}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
