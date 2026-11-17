'use client';

import React from 'react';
import {
  Search,
  X,
  ShieldCheck,
  UserPlus,
  KeyRound,
  Tag,
  CheckCircle2,
  AlertCircle,
  Settings,
  Ban,
} from 'lucide-react';
import { ClientePortalItem, KeywordsPopoverStyle } from '@/lib/portal/types';

export interface AdminClientModalsProps {
  isAddClientOpen: boolean;
  setIsAddClientOpen: React.Dispatch<React.SetStateAction<boolean>>;
  newClientNombre: string;
  setNewClientNombre: React.Dispatch<React.SetStateAction<string>>;
  newClientEmail: string;
  setNewClientEmail: React.Dispatch<React.SetStateAction<string>>;
  newClientKeywords: string;
  setNewClientKeywords: React.Dispatch<React.SetStateAction<string>>;
  isCreatingClient: boolean;
  createClientSuccess: string | null;
  createClientError: string | null;
  handleCreateClientSubmit: (e: React.FormEvent) => void;
  tibSearchResults: any[];
  isSearchingTib: boolean;
  isTibDropdownOpen: boolean;
  setIsTibDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  searchTibClients: (query: string) => void;
  handleAddTibKeyword: (client: any) => void;
  editingClient: ClientePortalItem | null;
  setEditingClient: React.Dispatch<React.SetStateAction<ClientePortalItem | null>>;
  editNombre: string;
  setEditNombre: React.Dispatch<React.SetStateAction<string>>;
  editKeywords: string;
  setEditKeywords: React.Dispatch<React.SetStateAction<string>>;
  isUpdatingClient: boolean;
  editClientSuccess: string | null;
  editClientError: string | null;
  handleUpdateClientSubmit: (e: React.FormEvent) => void;
  clientToDeactivate: ClientePortalItem | null;
  setClientToDeactivate: React.Dispatch<React.SetStateAction<ClientePortalItem | null>>;
  isTogglingActiveId: string | null;
  handleToggleClientActive: (clientId: string, targetActive: boolean) => void;
  activeKeywordsClient: ClientePortalItem | null;
  keywordsPopoverStyle: KeywordsPopoverStyle | null;
  keywordsPopoverRef: React.RefObject<HTMLDivElement | null>;
  onCloseKeywordsPopover: () => void;
  clientToReset: ClientePortalItem | null;
  setClientToReset: React.Dispatch<React.SetStateAction<ClientePortalItem | null>>;
  resendingEmail: string | null;
  handleResetPassword: (email: string) => void;
}

export default function AdminClientModals({
  isAddClientOpen,
  setIsAddClientOpen,
  newClientNombre,
  setNewClientNombre,
  newClientEmail,
  setNewClientEmail,
  newClientKeywords,
  setNewClientKeywords,
  isCreatingClient,
  createClientSuccess,
  createClientError,
  handleCreateClientSubmit,
  tibSearchResults,
  isSearchingTib,
  isTibDropdownOpen,
  setIsTibDropdownOpen,
  searchTibClients,
  handleAddTibKeyword,
  editingClient,
  setEditingClient,
  editNombre,
  setEditNombre,
  editKeywords,
  setEditKeywords,
  isUpdatingClient,
  editClientSuccess,
  editClientError,
  handleUpdateClientSubmit,
  clientToDeactivate,
  setClientToDeactivate,
  isTogglingActiveId,
  handleToggleClientActive,
  activeKeywordsClient,
  keywordsPopoverStyle,
  keywordsPopoverRef,
  onCloseKeywordsPopover,
  clientToReset,
  setClientToReset,
  resendingEmail,
  handleResetPassword,
}: AdminClientModalsProps) {
  return (
    <>
      {/* Modal de Agregar Usuario Cliente (Solo Superadmin) */}
      {isAddClientOpen && (
        <div
          onClick={() => setIsAddClientOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)', maxWidth: '580px', width: '100%', padding: '20px', position: 'relative', maxHeight: '90dvh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '14px', borderBottom: '1px solid #e5e7eb', marginBottom: '18px', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#ff5722', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', flexShrink: 0 }}>
                  <UserPlus style={{ width: '20px', height: '20px' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#111827', margin: 0 }}>
                    Agregar Usuario Cliente al Portal
                  </h3>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>
                    Crea el acceso y vincula automáticamente sus paquetes de bodega.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddClientOpen(false)}
                aria-label="Cerrar modal"
                style={{ minWidth: '38px', minHeight: '38px', padding: '6px', borderRadius: '6px', border: 'none', backgroundColor: '#f3f4f6', color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            </div>

            {createClientSuccess && (
              <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 style={{ width: '18px', height: '18px', flexShrink: 0 }} />
                <span>{createClientSuccess}</span>
              </div>
            )}

            {createClientError && (
              <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle style={{ width: '18px', height: '18px', flexShrink: 0 }} />
                <span>{createClientError}</span>
              </div>
            )}

            <form onSubmit={handleCreateClientSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
                  Nombre Completo o Empresa (Consignatario en Guías) *
                </label>
                <input
                  type="text"
                  required
                  value={newClientNombre}
                  onChange={(e) => setNewClientNombre(e.target.value)}
                  placeholder="Ej: AMEX JANIRA AMEX o JANIRA PAREDES"
                  style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', color: '#111827', outline: 'none' }}
                />
                <span style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px', display: 'block' }}>
                  Debe coincidir con el nombre con el que llegan los paquetes a Miami/Lince.
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
                  Correo Electrónico del Cliente *
                </label>
                <input
                  type="email"
                  required
                  value={newClientEmail}
                  onChange={(e) => setNewClientEmail(e.target.value)}
                  placeholder="cliente@gmail.com"
                  style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', color: '#111827', outline: 'none' }}
                />
              </div>

              <div
                style={{
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                }}
              >
                <ShieldCheck style={{ width: '18px', height: '18px', color: '#16a34a', flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '12px', color: '#166534', lineHeight: 1.5 }}>
                  <strong>Activación sin contraseña en panel:</strong> El Superadmin ya no define contraseñas. Al registrar al cliente, AMEX enviará automáticamente un correo de bienvenida oficial con su enlace seguro para que el cliente ingrese su propia contraseña.
                </div>
              </div>

              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px', marginBottom: '4px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151' }}>
                    Variaciones o Palabras Clave (Opcional, separadas por coma)
                  </label>
                  <span style={{ fontSize: '11px', color: '#ff5722', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Search style={{ width: '12px', height: '12px' }} />
                    Buscador TIB (3,360 clientes)
                  </span>
                </div>

                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={newClientKeywords}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewClientKeywords(val);
                      const lastTerm = val.split(',').pop()?.trim() || '';
                      if (lastTerm.length >= 2) {
                        searchTibClients(lastTerm);
                      } else {
                        setIsTibDropdownOpen(false);
                      }
                    }}
                    onFocus={() => {
                      const lastTerm = newClientKeywords.split(',').pop()?.trim() || '';
                      if (lastTerm.length >= 2) {
                        searchTibClients(lastTerm);
                      }
                    }}
                    placeholder="Ej: JANIRA, JANIRA AMEX, AMEX JANIRA (o escribe para buscar en TIB)"
                    style={{
                      width: '100%',
                      height: '40px',
                      padding: '0 36px 0 12px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      fontSize: '13px',
                      color: '#111827',
                      outline: 'none',
                    }}
                  />

                  {isSearchingTib ? (
                    <div
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: '16px',
                        height: '16px',
                        border: '2px solid #ff5722',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                      }}
                    />
                  ) : (
                    <Search
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: '16px',
                        height: '16px',
                        color: '#9ca3af',
                        pointerEvents: 'none',
                      }}
                    />
                  )}

                  {isTibDropdownOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        left: 0,
                        right: 0,
                        zIndex: 60,
                        backgroundColor: '#ffffff',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 12px 28px -4px rgba(0,0,0,0.2), 0 4px 10px rgba(0,0,0,0.06)',
                        maxHeight: '240px',
                        overflowY: 'auto',
                      }}
                    >
                      <div
                        style={{
                          padding: '8px 12px',
                          backgroundColor: '#f9fafb',
                          borderBottom: '1px solid #f3f4f6',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            color: '#4b5563',
                            textTransform: 'uppercase',
                            letterSpacing: '0.4px',
                          }}
                        >
                          Haz clic para agregar consignatario ({tibSearchResults.length} sugerencias)
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsTibDropdownOpen(false)}
                          style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '11px',
                            color: '#6b7280',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          Cerrar ✕
                        </button>
                      </div>

                      {tibSearchResults.length === 0 ? (
                        <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>
                          No se encontraron consignatarios en TIB con ese término. Puedes seguir escribiendo manualmente.
                        </div>
                      ) : (
                        tibSearchResults.map((client) => (
                          <div
                            key={client.id}
                            onClick={() => handleAddTibKeyword(client)}
                            style={{
                              padding: '10px 12px',
                              cursor: 'pointer',
                              borderBottom: '1px solid #f3f4f6',
                              transition: 'background-color 0.15s ease',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '10px',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fff7ed')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                          >
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div
                                style={{
                                  fontSize: '13px',
                                  fontWeight: 700,
                                  color: '#111827',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {client.nombre}
                              </div>
                              <div
                                style={{
                                  fontSize: '11px',
                                  color: '#6b7280',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  marginTop: '2px',
                                }}
                              >
                                <span>ID: #{client.iclient || 'S/ID'}</span>
                                <span>•</span>
                                <span style={{ color: client.recibidos > 0 ? '#ea580c' : '#6b7280' }}>
                                  {client.recibidos} en bodega
                                </span>
                                <span>•</span>
                                <span style={{ color: client.enviados > 0 ? '#2563eb' : '#6b7280' }}>
                                  {client.enviados} en vuelo
                                </span>
                              </div>
                            </div>
                            <span
                              style={{
                                backgroundColor: '#ffedd5',
                                color: '#c2410c',
                                padding: '3px 8px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: 800,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              + Agregar ({client.total_paquetes} paq.)
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <span style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px', display: 'block' }}>
                  Si una caja llega con cualquiera de estas variaciones, se asignará a este correo.
                </span>
              </div>

              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddClientOpen(false)}
                  style={{ minHeight: '42px', padding: '9px 18px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#ffffff', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreatingClient}
                  style={{
                    minHeight: '42px',
                    padding: '9px 22px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#ff5722',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: isCreatingClient ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 4px rgba(255,87,34,0.3)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {isCreatingClient ? (
                    <>
                      <div style={{ width: '14px', height: '14px', border: '2px solid #ffffff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                      <span>Creando cuenta...</span>
                    </>
                  ) : (
                    <span>Guardar y Vincular Paquetes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Cliente */}
      {editingClient && (
        <div
          onClick={() => setEditingClient(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)', maxWidth: '580px', width: '100%', padding: '24px', position: 'relative', maxHeight: '90dvh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '14px', borderBottom: '1px solid #e5e7eb', marginBottom: '18px', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', flexShrink: 0 }}>
                  <Settings style={{ width: '20px', height: '20px' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#111827', margin: 0 }}>
                    Configurar Palabras Clave y Matching
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b7280', wordBreak: 'break-word' }}>
                    Cliente: <strong>{editingClient.nombre_completo}</strong> ({editingClient.email})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingClient(null)}
                aria-label="Cerrar configuración"
                style={{ minWidth: '38px', minHeight: '38px', padding: '6px', borderRadius: '6px', border: 'none', backgroundColor: '#f3f4f6', color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            </div>

            {editClientSuccess && (
              <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 style={{ width: '18px', height: '18px', flexShrink: 0 }} />
                <span>{editClientSuccess}</span>
              </div>
            )}

            {editClientError && (
              <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle style={{ width: '18px', height: '18px', flexShrink: 0 }} />
                <span>{editClientError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateClientSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>
                  Consignatario / Nombre Completo
                </label>
                <input
                  type="text"
                  required
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', outline: 'none' }}
                />
              </div>

              <div style={{ backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <Tag style={{ width: '15px', height: '15px', color: '#0284c7' }} />
                  <label style={{ fontSize: '12.5px', fontWeight: 800, color: '#0369a1' }}>
                    Palabras Clave (Matching Oficial TIB)
                  </label>
                </div>
                <p style={{ margin: '0 0 8px', fontSize: '11.5px', color: '#0c4a6e', lineHeight: 1.4 }}>
                  Ingresa las variaciones exactas de nombre separadas por comas. Cada paquete cuyo consignatario en TIB coincida con una de estas frases se asignará a este usuario.
                </p>
                <textarea
                  rows={3}
                  value={editKeywords}
                  onChange={(e) => setEditKeywords(e.target.value)}
                  placeholder="Ej: MARTIN MALDONADO, AMEX KENNETH MALDONADO, KENNETH MALDONADO"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #7dd3fc', fontSize: '12.5px', outline: 'none', backgroundColor: '#ffffff', fontFamily: 'monospace' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', paddingTop: '14px', borderTop: '1px solid #e5e7eb' }}>
                <button
                  type="button"
                  onClick={() => setEditingClient(null)}
                  style={{ padding: '9px 18px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#ffffff', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingClient}
                  style={{
                    padding: '9px 22px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: isUpdatingClient ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 4px rgba(2,132,199,0.3)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {isUpdatingClient ? (
                    <>
                      <div style={{ width: '14px', height: '14px', border: '2px solid #ffffff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                      <span>Actualizando y Re-sincronizando...</span>
                    </>
                  ) : (
                    <span>Guardar y Re-vincular TIB</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmación de Desactivación de Cuenta */}
      {clientToDeactivate && (
        <div
          onClick={() => setClientToDeactivate(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 110,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              maxWidth: '460px',
              width: '100%',
              padding: '24px',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: '#fee2e2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#dc2626',
                  flexShrink: 0,
                }}
              >
                <Ban style={{ width: '22px', height: '22px' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#111827', margin: 0 }}>
                  Desactivar Cuenta de Cliente
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b7280' }}>
                  Restricción inmediata de acceso al portal
                </p>
              </div>
            </div>

            <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#991b1b', lineHeight: 1.5 }}>
                ¿Estás seguro de que deseas desactivar la cuenta de <strong>{clientToDeactivate.nombre_completo}</strong> ({clientToDeactivate.email})?
              </p>
              <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#b91c1c', lineHeight: 1.4 }}>
                El usuario no podrá iniciar sesión ni consultar sus envíos hasta que sea reactivado por un administrador.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setClientToDeactivate(null)}
                disabled={isTogglingActiveId === clientToDeactivate.id}
                style={{
                  padding: '9px 16px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  backgroundColor: '#ffffff',
                  color: '#4b5563',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => handleToggleClientActive(clientToDeactivate.id, false)}
                disabled={isTogglingActiveId === clientToDeactivate.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 18px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: isTogglingActiveId === clientToDeactivate.id ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 4px rgba(220, 38, 38, 0.25)',
                }}
              >
                {isTogglingActiveId === clientToDeactivate.id ? (
                  <>
                    <div style={{ width: '12px', height: '12px', border: '2px solid #ffffff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    <span>Desactivando...</span>
                  </>
                ) : (
                  <>
                    <Ban style={{ width: '14px', height: '14px' }} />
                    <span>Confirmar Desactivación</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popover Flotante de Consignatarios Vinculados */}
      {activeKeywordsClient &&
        keywordsPopoverStyle &&
        Array.isArray(activeKeywordsClient.alias_palabras_clave) &&
        activeKeywordsClient.alias_palabras_clave.length > 0 && (
          <>
            <div
              onClick={(e) => {
                e.stopPropagation();
                onCloseKeywordsPopover();
              }}
              style={{ position: 'fixed', inset: 0, zIndex: 110 }}
            />
            <div
              ref={keywordsPopoverRef}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                top: keywordsPopoverStyle.top,
                bottom: keywordsPopoverStyle.bottom,
                left: keywordsPopoverStyle.left,
                width: keywordsPopoverStyle.width,
                backgroundColor: '#ffffff',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                padding: '12px',
                zIndex: 120,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '8px', marginBottom: '8px', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Tag style={{ width: '13px', height: '13px', color: '#ff5722' }} aria-hidden="true" />
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}>
                    Consignatarios vinculados ({activeKeywordsClient.alias_palabras_clave.length})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onCloseKeywordsPopover}
                  aria-label="Cerrar lista de consignatarios"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#9ca3af', display: 'flex', alignItems: 'center', borderRadius: '4px' }}
                >
                  <X style={{ width: '14px', height: '14px' }} aria-hidden="true" />
                </button>
              </div>

              <div
                style={{
                  maxHeight: keywordsPopoverStyle.maxHeight,
                  overflowY: 'auto',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '5px',
                  paddingRight: '2px',
                }}
              >
                {activeKeywordsClient.alias_palabras_clave.map((k, ki) => (
                  <span
                    key={ki}
                    style={{
                      backgroundColor: '#f8fafc',
                      color: '#1e293b',
                      border: '1px solid #e2e8f0',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      lineHeight: 1.3,
                      wordBreak: 'break-word',
                    }}
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}

      {/* Modal Confirmación de Restablecimiento de Contraseña */}
      {clientToReset && (
        <div
          onClick={() => {
            if (resendingEmail !== clientToReset.email) {
              setClientToReset(null);
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 110,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              maxWidth: '460px',
              width: '100%',
              padding: '24px',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: '#ffedd5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ea580c',
                  flexShrink: 0,
                }}
              >
                <KeyRound style={{ width: '22px', height: '22px' }} aria-hidden="true" />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#111827', margin: 0 }}>
                  Restablecer Contraseña de Cliente
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b7280' }}>
                  Envío de enlace seguro por correo electrónico
                </p>
              </div>
            </div>

            <div style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#9a3412', lineHeight: 1.5 }}>
                ¿Deseas enviar un enlace para restablecer la contraseña de <strong>{clientToReset.nombre_completo}</strong> ({clientToReset.email})?
              </p>
              <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#c2410c', lineHeight: 1.4 }}>
                El cliente recibirá un correo con instrucciones para definir una nueva contraseña de acceso.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setClientToReset(null)}
                disabled={resendingEmail === clientToReset.email}
                style={{
                  padding: '9px 16px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  backgroundColor: '#ffffff',
                  color: '#4b5563',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: resendingEmail === clientToReset.email ? 'not-allowed' : 'pointer',
                }}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => handleResetPassword(clientToReset.email)}
                disabled={resendingEmail === clientToReset.email}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 18px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#ff5722',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: resendingEmail === clientToReset.email ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 4px rgba(255, 87, 34, 0.25)',
                }}
              >
                {resendingEmail === clientToReset.email ? (
                  <>
                    <div style={{ width: '12px', height: '12px', border: '2px solid #ffffff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    <span>Enviando enlace...</span>
                  </>
                ) : (
                  <>
                    <KeyRound style={{ width: '14px', height: '14px' }} aria-hidden="true" />
                    <span>Enviar Enlace</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
