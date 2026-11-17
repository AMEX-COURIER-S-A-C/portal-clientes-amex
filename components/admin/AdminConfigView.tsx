'use client';

import React from 'react';
import Link from 'next/link';
import {
  Search,
  X,
  ChevronDown,
  Package,
  ShieldCheck,
  UserPlus,
  Users,
  RefreshCw,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Settings,
  Pencil,
  BarChart3,
  Ban,
  UserCheck,
  UserX,
} from 'lucide-react';
import { isSuperadminEmail } from '@/lib/portal/superadmin';
import { scrollElementToStart } from '@/lib/portal/scroll';
import { ClientePortalItem, formatDateTimeTIB } from '@/lib/portal/types';

export interface AdminConfigViewProps {
  clientsList: ClientePortalItem[];
  filteredClientsList: ClientePortalItem[];
  isLoadingClients: boolean;
  totalSystemCount: number;
  totalFilteredCount: number;
  isSyncingAll: boolean;
  configSubTab: 'usuarios' | 'tib';
  setConfigSubTab: React.Dispatch<React.SetStateAction<'usuarios' | 'tib'>>;
  clientSearchQuery: string;
  setClientSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  resendNotice: { type: 'success' | 'error'; message: string } | null;
  setResendNotice: React.Dispatch<React.SetStateAction<{ type: 'success' | 'error'; message: string } | null>>;
  resendingEmail: string | null;
  isTogglingActiveId: string | null;
  openKeywordsClientId: string | null;
  tibCatalogSearch: string;
  setTibCatalogSearch: React.Dispatch<React.SetStateAction<string>>;
  tibCatalogList: any[];
  tibCatalogTotal: number;
  isLoadingTibCatalog: boolean;
  tibCatalogPage: number;
  setTibCatalogPage: React.Dispatch<React.SetStateAction<number>>;
  onSelectTab: (tab: 'warehouse' | 'configuracion' | 'analiticas') => void;
  onSyncAllFromTib: () => void;
  onOpenAddClientModal: () => void;
  onToggleKeywordsPopover: (clientId: string, anchorEl: HTMLElement) => void;
  onRequestResetPassword: (client: ClientePortalItem) => void;
  onToggleClientActive: (clientId: string, targetActive: boolean) => void;
  onRequestDeactivateClient: (client: ClientePortalItem) => void;
  onAssignTibClientToPortal: (client: any) => void;
}

export default function AdminConfigView({
  clientsList,
  filteredClientsList,
  isLoadingClients,
  totalSystemCount,
  totalFilteredCount,
  isSyncingAll,
  configSubTab,
  setConfigSubTab,
  clientSearchQuery,
  setClientSearchQuery,
  resendNotice,
  setResendNotice,
  resendingEmail,
  isTogglingActiveId,
  openKeywordsClientId,
  tibCatalogSearch,
  setTibCatalogSearch,
  tibCatalogList,
  tibCatalogTotal,
  isLoadingTibCatalog,
  tibCatalogPage,
  setTibCatalogPage,
  onSelectTab,
  onSyncAllFromTib,
  onOpenAddClientModal,
  onToggleKeywordsPopover,
  onRequestResetPassword,
  onToggleClientActive,
  onRequestDeactivateClient,
  onAssignTibClientToPortal,
}: AdminConfigViewProps) {
  const tibTableRef = React.useRef<HTMLDivElement | null>(null);

  const goToTibPage = (nextPage: number) => {
    if (nextPage === tibCatalogPage) return;
    setTibCatalogPage(nextPage);
    scrollElementToStart(tibTableRef.current);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Cabecera del Panel de Configuración */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#ff5722', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', boxShadow: '0 2px 6px rgba(255,87,34,0.3)' }}>
              <Settings style={{ width: '20px', height: '20px' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', margin: 0, letterSpacing: '-0.3px' }}>
                Panel de Configuración
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#6b7280' }}>
                Administración de clientes, asignación de casilleros y sincronización de envíos.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => onSelectTab('warehouse')}
            style={{
              backgroundColor: '#ffffff',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            <Package style={{ width: '14px', height: '14px', color: '#ff5722' }} />
            <span>Volver a Listado Warehouse</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('analiticas')}
            style={{
              backgroundColor: '#ffffff',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            <BarChart3 style={{ width: '14px', height: '14px', color: '#ff5722' }} />
            <span>Estadísticas de Uso</span>
          </button>
        </div>
      </div>

      {/* Fila de Tarjetas de Resumen Técnico */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '16px' }}>
        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.5px' }}>
            Clientes Registrados en Portal
          </span>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#ff5722', marginTop: '4px' }}>
            {clientsList.length}
          </div>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>
            Usuarios con acceso activo a su casillero personal.
          </p>
        </div>

        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.5px' }}>
              Inventario en Portal
            </span>
            <div style={{ fontSize: '26px', fontWeight: 900, color: '#111827', marginTop: '4px' }}>
              {(totalSystemCount || totalFilteredCount).toLocaleString()} paquetes
            </div>
          </div>
          <button
            type="button"
            onClick={onSyncAllFromTib}
            disabled={isSyncingAll}
            style={{
              marginTop: '10px',
              backgroundColor: '#1e2229',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 14px',
              fontSize: '12.5px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: isSyncingAll ? 'not-allowed' : 'pointer',
              opacity: isSyncingAll ? 0.7 : 1,
            }}
          >
            <RefreshCw style={{ width: '13px', height: '13px', color: '#ff5722', animation: isSyncingAll ? 'spin 1s linear infinite' : 'none' }} />
            <span>{isSyncingAll ? 'Sincronizando con TIB...' : 'Sincronizar con API TIB'}</span>
          </button>
        </div>
      </div>

      {/* Tarjeta Principal de Directorio de Clientes */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', marginBottom: '18px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#111827', margin: 0 }}>
              Directorio de Clientes
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b7280' }}>
              Crea accesos, asigna códigos de casillero y define alias para matching automático de paquetes.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={onOpenAddClientModal}
              style={{
                backgroundColor: '#ff5722',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 18px',
                fontSize: '13px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(255,87,34,0.25)',
              }}
            >
              <UserPlus style={{ width: '15px', height: '15px' }} aria-hidden="true" />
              <span>Agregar Cliente</span>
            </button>
          </div>
        </div>

        {/* Sub-pestañas: Usuarios Creados vs Catálogo TIB */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px', marginBottom: '16px' }}>
          <button
            type="button"
            onClick={() => setConfigSubTab('usuarios')}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: configSubTab === 'usuarios' ? '#ff5722' : '#f3f4f6',
              color: configSubTab === 'usuarios' ? '#ffffff' : '#4b5563',
              transition: 'all 0.15s ease',
            }}
          >
            <Users style={{ width: '15px', height: '15px' }} />
            <span>Usuarios Creados en Portal ({clientsList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setConfigSubTab('tib')}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: configSubTab === 'tib' ? '#ff5722' : '#f3f4f6',
              color: configSubTab === 'tib' ? '#ffffff' : '#4b5563',
              transition: 'all 0.15s ease',
            }}
          >
            <Package style={{ width: '15px', height: '15px' }} />
            <span>Catálogo Consignatarios TIB ({tibCatalogTotal || 3360})</span>
          </button>
        </div>

        {/* Contenido Sub-Pestaña 1: Usuarios Creados */}
        {configSubTab === 'usuarios' && (
          <div>
            {resendNotice && (
              <div
                style={{
                  marginBottom: '14px',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  backgroundColor: resendNotice.type === 'success' ? '#ecfdf5' : '#fef2f2',
                  border: `1px solid ${resendNotice.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
                  color: resendNotice.type === 'success' ? '#065f46' : '#991b1b',
                  fontSize: '13px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                }}
              >
                {resendNotice.type === 'success' ? (
                  <CheckCircle2 style={{ width: '18px', height: '18px', color: '#10b981', flexShrink: 0 }} />
                ) : (
                  <AlertCircle style={{ width: '18px', height: '18px', color: '#ef4444', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1 }}>{resendNotice.message}</div>
                <button
                  type="button"
                  onClick={() => setResendNotice(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'inherit',
                    cursor: 'pointer',
                    fontSize: '18px',
                    fontWeight: 700,
                    lineHeight: 1,
                    padding: '0 4px',
                  }}
                  title="Cerrar notificación"
                >
                  ×
                </button>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
                <Search style={{ width: '14px', height: '14px', color: '#9ca3af', position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} aria-hidden="true" />
                <input
                  type="text"
                  value={clientSearchQuery}
                  onChange={(e) => setClientSearchQuery(e.target.value)}
                  placeholder="Buscar cliente, correo o consignatario..."
                  style={{
                    width: '100%',
                    height: '38px',
                    paddingLeft: '32px',
                    paddingRight: clientSearchQuery ? '32px' : '10px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '12.5px',
                    outline: 'none',
                  }}
                />
                {clientSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setClientSearchQuery('')}
                    aria-label="Limpiar búsqueda de clientes"
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      padding: '2px',
                      color: '#9ca3af',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <X style={{ width: '14px', height: '14px' }} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563' }}>Consignatario / Nombre</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563' }}>Correo (Login)</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563' }}>Palabras Clave (Matching)</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563' }}>Estado</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563' }}>Fecha Registro</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563', textAlign: 'center', minWidth: '350px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingClients ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: '#6b7280' }}>
                        <div style={{ width: '22px', height: '22px', border: '2px solid #ff5722', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
                        <span>Cargando directorio de clientes...</span>
                      </td>
                    </tr>
                  ) : filteredClientsList.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                        <Users style={{ width: '36px', height: '36px', color: '#d1d5db', margin: '0 auto 8px' }} />
                        <p style={{ fontWeight: 700, color: '#374151', margin: 0 }}>No hay clientes que coincidan</p>
                        <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>Crea un cliente nuevo con el botón &quot;+ Agregar Cliente&quot;.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredClientsList.map((c, idx) => (
                      <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafbfc' }}>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: '#111827' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span>{c.nombre_completo}</span>
                            {isSuperadminEmail(c.email) && (
                              <span style={{ backgroundColor: '#ff5722', color: '#ffffff', padding: '1px 7px', borderRadius: '4px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                Superadmin
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px', color: '#4b5563', fontFamily: 'monospace', fontSize: '12px' }}>
                          {c.email}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#6b7280', fontSize: '11.5px', position: 'relative' }}>
                          {isSuperadminEmail(c.email) ? (
                            <span style={{ backgroundColor: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', padding: '2px 7px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <ShieldCheck style={{ width: '11px', height: '11px', color: '#ea580c' }} />
                              <span>Acceso Global (Todos los paquetes)</span>
                            </span>
                          ) : Array.isArray(c.alias_palabras_clave) && c.alias_palabras_clave.length > 0 ? (
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleKeywordsPopover(c.id, e.currentTarget);
                                }}
                                aria-expanded={openKeywordsClientId === c.id}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  backgroundColor: '#f3f4f6',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '6px',
                                  padding: '4px 9px',
                                  fontSize: '11.5px',
                                  fontWeight: 600,
                                  color: '#374151',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                <span
                                  style={{
                                    backgroundColor: '#374151',
                                    color: '#ffffff',
                                    borderRadius: '10px',
                                    padding: '1px 6px',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                  }}
                                >
                                  {c.alias_palabras_clave.length}
                                </span>
                                <span>
                                  {c.alias_palabras_clave.length === 1 ? 'consignatario' : 'consignatarios'}
                                </span>
                                <ChevronDown
                                  style={{
                                    width: '12px',
                                    height: '12px',
                                    color: '#6b7280',
                                    transform: openKeywordsClientId === c.id ? 'rotate(180deg)' : 'none',
                                    transition: 'transform 0.15s ease',
                                  }}
                                />
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '11.5px' }}>
                              Sin consignatarios extra
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {c.activo === false ? (
                            <span style={{ backgroundColor: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Ban style={{ width: '11px', height: '11px', color: '#dc2626' }} />
                              <span>Desactivado</span>
                            </span>
                          ) : c.password_establecido ? (
                            <span style={{ backgroundColor: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <CheckCircle2 style={{ width: '11px', height: '11px', color: '#16a34a' }} />
                              <span>Activo</span>
                            </span>
                          ) : (
                            <span style={{ backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <span>⏳ Pendiente Activación</span>
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#6b7280', fontSize: '11.5px' }}>
                          {formatDateTimeTIB(c.creado_en).date}
                        </td>
                        <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center', flexWrap: 'nowrap' }}>
                            <button
                              type="button"
                              onClick={() => onRequestResetPassword(c)}
                              disabled={resendingEmail === c.email}
                              title={`Enviar correo automático a ${c.email} para restablecer o recuperar su contraseña`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '6px 10px',
                                backgroundColor: resendingEmail === c.email ? '#f3f4f6' : '#fff7ed',
                                border: `1px solid ${resendingEmail === c.email ? '#e5e7eb' : '#fed7aa'}`,
                                borderRadius: '6px',
                                color: resendingEmail === c.email ? '#9ca3af' : '#c2410c',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: resendingEmail === c.email ? 'not-allowed' : 'pointer',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                transition: 'all 0.15s ease',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {resendingEmail === c.email ? (
                                <>
                                  <div style={{ width: '11px', height: '11px', border: '2px solid #ea580c', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                  <span>Enviando...</span>
                                </>
                              ) : (
                                <>
                                  <KeyRound style={{ width: '12px', height: '12px', color: '#ea580c' }} />
                                  <span>Restablecer</span>
                                </>
                              )}
                            </button>

                            {isSuperadminEmail(c.email) ? (
                              <span
                                title="Las cuentas Superadmin están protegidas y no pueden ser desactivadas"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '6px 10px',
                                  backgroundColor: '#f8fafc',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '6px',
                                  color: '#64748b',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  cursor: 'not-allowed',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <ShieldCheck style={{ width: '12px', height: '12px', color: '#0284c7' }} />
                                <span>Protegido</span>
                              </span>
                            ) : c.activo === false ? (
                              <button
                                type="button"
                                onClick={() => onToggleClientActive(c.id, true)}
                                disabled={isTogglingActiveId === c.id}
                                title="Activar cuenta y permitir acceso al portal"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '6px 10px',
                                  backgroundColor: isTogglingActiveId === c.id ? '#f3f4f6' : '#f0fdf4',
                                  border: `1px solid ${isTogglingActiveId === c.id ? '#e5e7eb' : '#bbf7d0'}`,
                                  borderRadius: '6px',
                                  color: isTogglingActiveId === c.id ? '#9ca3af' : '#15803d',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  cursor: isTogglingActiveId === c.id ? 'not-allowed' : 'pointer',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                  transition: 'all 0.15s ease',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {isTogglingActiveId === c.id ? (
                                  <>
                                    <div style={{ width: '11px', height: '11px', border: '2px solid #16a34a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                    <span>Activando...</span>
                                  </>
                                ) : (
                                  <>
                                    <UserCheck style={{ width: '12px', height: '12px', color: '#16a34a' }} />
                                    <span>Activar</span>
                                  </>
                                )}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onRequestDeactivateClient(c)}
                                disabled={isTogglingActiveId === c.id}
                                title="Desactivar cuenta y restringir acceso al portal"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '6px 10px',
                                  backgroundColor: isTogglingActiveId === c.id ? '#f3f4f6' : '#fef2f2',
                                  border: `1px solid ${isTogglingActiveId === c.id ? '#e5e7eb' : '#fecaca'}`,
                                  borderRadius: '6px',
                                  color: isTogglingActiveId === c.id ? '#9ca3af' : '#b91c1c',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  cursor: isTogglingActiveId === c.id ? 'not-allowed' : 'pointer',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                  transition: 'all 0.15s ease',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {isTogglingActiveId === c.id ? (
                                  <>
                                    <div style={{ width: '11px', height: '11px', border: '2px solid #dc2626', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                    <span>Desactivando...</span>
                                  </>
                                ) : (
                                  <>
                                    <UserX style={{ width: '12px', height: '12px', color: '#dc2626' }} />
                                    <span>Desactivar</span>
                                  </>
                                )}
                              </button>
                            )}

                            <Link
                              href={`/configurar/${c.id}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '6px 11px',
                                backgroundColor: '#0284c7',
                                border: 'none',
                                borderRadius: '6px',
                                color: '#ffffff',
                                fontSize: '11px',
                                fontWeight: 700,
                                textDecoration: 'none',
                                boxShadow: '0 1px 2px rgba(2,132,199,0.25)',
                                transition: 'all 0.15s ease',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <Pencil style={{ width: '11px', height: '11px' }} />
                              <span>Configurar</span>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Contenido Sub-Pestaña 2: Catálogo Consignatarios TIB */}
        {configSubTab === 'tib' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
              <div style={{ position: 'relative', width: '360px', maxWidth: '100%' }}>
                <Search style={{ width: '14px', height: '14px', color: '#9ca3af', position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  value={tibCatalogSearch}
                  onChange={(e) => {
                    setTibCatalogSearch(e.target.value);
                    setTibCatalogPage(1);
                  }}
                  placeholder="Buscar en los 3,360 consignatarios TIB..."
                  style={{
                    width: '100%',
                    height: '38px',
                    paddingLeft: '32px',
                    paddingRight: '10px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '12.5px',
                    outline: 'none',
                  }}
                />
              </div>
              <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>
                Mostrando {tibCatalogList.length} de {tibCatalogTotal} consignatarios
              </span>
            </div>

            <div ref={tibTableRef} style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px', scrollMarginTop: '72px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563' }}>Consignatario (Nombre en TIB)</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563' }}>ID TIB</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563', textAlign: 'center' }}>Total Paquetes</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563', textAlign: 'center' }}>En Bodega</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563', textAlign: 'center' }}>En Tránsito</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563', textAlign: 'center' }}>Entregados</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563' }}>Último WR</th>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563', textAlign: 'right' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingTibCatalog ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: '#6b7280' }}>
                        <div style={{ width: '22px', height: '22px', border: '2px solid #ff5722', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
                        <span>Cargando consignatarios de TIB...</span>
                      </td>
                    </tr>
                  ) : tibCatalogList.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                        <Package style={{ width: '36px', height: '36px', color: '#d1d5db', margin: '0 auto 8px' }} />
                        <p style={{ fontWeight: 700, color: '#374151', margin: 0 }}>No hay consignatarios que coincidan</p>
                        <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>Prueba buscando otro nombre.</p>
                      </td>
                    </tr>
                  ) : (
                    tibCatalogList.map((client, idx) => (
                      <tr key={client.id || idx} style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafbfc' }}>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: '#111827' }}>
                          {client.nombre}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#6b7280', fontFamily: 'monospace', fontSize: '12px' }}>
                          #{client.iclient || 'S/ID'}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <span style={{ backgroundColor: '#ffedd5', color: '#c2410c', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 800 }}>
                            {client.total_paquetes}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center', color: client.recibidos > 0 ? '#ea580c' : '#9ca3af', fontWeight: client.recibidos > 0 ? 800 : 500 }}>
                          {client.recibidos}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center', color: client.enviados > 0 ? '#2563eb' : '#9ca3af', fontWeight: client.enviados > 0 ? 800 : 500 }}>
                          {client.enviados}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center', color: '#6b7280' }}>
                          {client.entregados}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#6b7280', fontFamily: 'monospace', fontSize: '11px' }}>
                          {client.ultimo_wr || '—'}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => onAssignTibClientToPortal(client)}
                            style={{
                              backgroundColor: '#ff5722',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '5px',
                              padding: '5px 10px',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              boxShadow: '0 1px 3px rgba(255,87,34,0.2)',
                            }}
                          >
                            <UserPlus style={{ width: '12px', height: '12px' }} aria-hidden="true" />
                            <span>Asignar Portal</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {tibCatalogTotal > 15 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginTop: '12px', fontSize: '12px', color: '#6b7280' }}>
                <span>
                  Página <strong>{tibCatalogPage}</strong> de <strong>{Math.ceil(tibCatalogTotal / 15)}</strong> ({tibCatalogTotal} clientes)
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    disabled={tibCatalogPage <= 1 || isLoadingTibCatalog}
                    onClick={() => goToTibPage(Math.max(1, tibCatalogPage - 1))}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '5px',
                      border: '1px solid #d1d5db',
                      backgroundColor: tibCatalogPage <= 1 ? '#f3f4f6' : '#ffffff',
                      color: tibCatalogPage <= 1 ? '#9ca3af' : '#374151',
                      cursor: tibCatalogPage <= 1 ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    disabled={tibCatalogPage >= Math.ceil(tibCatalogTotal / 15) || isLoadingTibCatalog}
                    onClick={() => goToTibPage(tibCatalogPage + 1)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '5px',
                      border: '1px solid #d1d5db',
                      backgroundColor: tibCatalogPage >= Math.ceil(tibCatalogTotal / 15) ? '#f3f4f6' : '#ffffff',
                      color: tibCatalogPage >= Math.ceil(tibCatalogTotal / 15) ? '#9ca3af' : '#374151',
                      cursor: tibCatalogPage >= Math.ceil(tibCatalogTotal / 15) ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
