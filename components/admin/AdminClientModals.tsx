'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Search,
  X,
  ShieldCheck,
  UserPlus,
  KeyRound,
  Tag,
  CheckCircle2,
  AlertCircle,
  Ban,
  Plus,
} from 'lucide-react';
import { cleanExactString } from '@/lib/portal/keywords';
import { BLOCKED_GROUP_KEYWORDS } from '@/lib/portal/matching';
import { ClientePortalItem, KeywordsPopoverStyle, TibCatalogClient } from '@/lib/portal/types';
import TibConsigneeSearchInput from './TibConsigneeSearchInput';
import MatchingPreviewBox from './MatchingPreviewBox';

export interface AdminClientModalsProps {
  isAddClientOpen: boolean;
  onCloseAddClientModal: () => void;
  newClientNombre: string;
  setNewClientNombre: React.Dispatch<React.SetStateAction<string>>;
  newClientEmail: string;
  setNewClientEmail: React.Dispatch<React.SetStateAction<string>>;
  newClientKeywordsList: string[];
  setNewClientKeywordsList: React.Dispatch<React.SetStateAction<string[]>>;
  newClientGroupKeywordsList: string[];
  setNewClientGroupKeywordsList: React.Dispatch<React.SetStateAction<string[]>>;
  isCreatingClient: boolean;
  createClientSuccess: string | null;
  createClientError: string | null;
  onClearCreateFeedback: () => void;
  handleCreateClientSubmit: (exactKeywordsToSubmit: string[], groupKeywordsToSubmit: string[]) => void | Promise<void>;
  isTibDropdownOpen: boolean;
  setIsTibDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleToggleTibKeyword: (client: TibCatalogClient) => void;
  tibCatalogTotal: number;
  onTibCatalogTotalUpdate: (total: number) => void;
  assignedConsigneeMap: Map<string, { email: string; nombre_completo: string }>;
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

function parseKeywordsBatch(rawText: string): string[] {
  return rawText
    .split(',')
    .map((k) => cleanExactString(k))
    .filter(Boolean);
}

export default function AdminClientModals({
  isAddClientOpen,
  onCloseAddClientModal,
  newClientNombre,
  setNewClientNombre,
  newClientEmail,
  setNewClientEmail,
  newClientKeywordsList,
  setNewClientKeywordsList,
  newClientGroupKeywordsList,
  setNewClientGroupKeywordsList,
  isCreatingClient,
  createClientSuccess,
  createClientError,
  onClearCreateFeedback,
  handleCreateClientSubmit,
  isTibDropdownOpen,
  setIsTibDropdownOpen,
  handleToggleTibKeyword,
  tibCatalogTotal,
  onTibCatalogTotalUpdate,
  assignedConsigneeMap,
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
  const [manualKeywordInput, setManualKeywordInput] = useState('');
  const [groupKeywordInput, setGroupKeywordInput] = useState('');
  const [groupInputHint, setGroupInputHint] = useState<string | null>(null);
  const [showAgencySection, setShowAgencySection] = useState(false);
  const [searchResetSignal, setSearchResetSignal] = useState(0);
  const modalBodyRef = useRef<HTMLDivElement | null>(null);
  const nombreInputRef = useRef<HTMLInputElement | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);

  // Enfocar automáticamente el campo pertinente al abrir el modal sin desplegar el buscador TIB
  useEffect(() => {
    if (!isAddClientOpen) {
      setManualKeywordInput('');
      setGroupKeywordInput('');
      setGroupInputHint(null);
      setShowAgencySection(false);
      return;
    }
    const timer = setTimeout(() => {
      if (newClientNombre.trim() && !newClientEmail.trim()) {
        emailInputRef.current?.focus();
      } else {
        nombreInputRef.current?.focus();
      }
    }, 40);
    return () => clearTimeout(timer);
    // Solo al abrir el modal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAddClientOpen]);

  // Asegurar que mensajes de éxito o error queden visibles arriba del scroll del modal
  useEffect(() => {
    if (createClientSuccess || createClientError) {
      modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (createClientSuccess) {
      setManualKeywordInput('');
      setGroupKeywordInput('');
      setGroupInputHint(null);
      setSearchResetSignal((prev) => prev + 1);
    }
  }, [createClientSuccess, createClientError]);

  const handleAddManualKeywords = (rawText = manualKeywordInput) => {
    const parsed = parseKeywordsBatch(rawText);
    if (parsed.length === 0) return;

    setNewClientKeywordsList((prev) => {
      const next = [...prev];
      for (const kw of parsed) {
        if (kw.length >= 2 && kw !== 'AMEX' && !next.includes(kw)) {
          next.push(kw);
        }
      }
      return next;
    });
    setManualKeywordInput('');
  };

  const handleAddGroupKeywords = (rawText = groupKeywordInput) => {
    const parsed = parseKeywordsBatch(rawText);
    if (parsed.length === 0) return;

    const valid: string[] = [];
    const rejected: string[] = [];
    for (const kw of parsed) {
      if (kw.length < 3 || BLOCKED_GROUP_KEYWORDS.has(kw)) {
        rejected.push(kw);
      } else {
        valid.push(kw);
      }
    }

    if (rejected.length > 0) {
      setGroupInputHint(
        `Ignorado (${rejected.join(', ')}): las siglas de agencia requieren mínimo 3 letras y no pueden ser genéricas como AMEX.`
      );
    } else {
      setGroupInputHint(null);
    }

    if (valid.length > 0) {
      setNewClientGroupKeywordsList((prev) => {
        const next = [...prev];
        for (const kw of valid) {
          if (!next.includes(kw)) next.push(kw);
        }
        return next;
      });
    }
    setGroupKeywordInput('');
  };

  const handleRemoveKeywordChip = (idxToRemove: number) => {
    setNewClientKeywordsList((prev) => prev.filter((_, idx) => idx !== idxToRemove));
  };

  const handleRemoveGroupKeywordChip = (idxToRemove: number) => {
    setNewClientGroupKeywordsList((prev) => prev.filter((_, idx) => idx !== idxToRemove));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreatingClient) return;

    const pendingExact = parseKeywordsBatch(manualKeywordInput).filter((k) => k.length >= 2 && k !== 'AMEX');
    const mergedExact = [...newClientKeywordsList];
    for (const kw of pendingExact) {
      if (!mergedExact.includes(kw)) mergedExact.push(kw);
    }
    if (pendingExact.length > 0) {
      setNewClientKeywordsList(mergedExact);
      setManualKeywordInput('');
    }

    const pendingGroup = parseKeywordsBatch(groupKeywordInput).filter(
      (k) => k.length >= 3 && !BLOCKED_GROUP_KEYWORDS.has(k)
    );
    const mergedGroup = [...newClientGroupKeywordsList];
    for (const kw of pendingGroup) {
      if (!mergedGroup.includes(kw)) mergedGroup.push(kw);
    }
    if (pendingGroup.length > 0) {
      setNewClientGroupKeywordsList(mergedGroup);
      setGroupKeywordInput('');
    }

    setIsTibDropdownOpen(false);
    await handleCreateClientSubmit(mergedExact, mergedGroup);
  };

  const hasUnsavedDraft = Boolean(
    newClientNombre.trim() ||
      newClientEmail.trim() ||
      newClientKeywordsList.length > 0 ||
      newClientGroupKeywordsList.length > 0 ||
      manualKeywordInput.trim() ||
      groupKeywordInput.trim()
  );

  const handleBackdropClick = () => {
    if (isCreatingClient) return;
    if (isTibDropdownOpen) {
      setIsTibDropdownOpen(false);
      return;
    }
    if (!hasUnsavedDraft || createClientSuccess) {
      onCloseAddClientModal();
    }
  };

  const showCloseLabel = Boolean(createClientSuccess && !hasUnsavedDraft);

  return (
    <>
      {/* Modal de Agregar Usuario Cliente (Solo Superadmin) */}
      {isAddClientOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-client-modal-title"
          onClick={handleBackdropClick}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            backgroundColor: 'rgba(15, 23, 42, 0.72)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '90dvh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* Cabecera fija del modal */}
            <div
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderBottom: '1px solid #e5e7eb',
                gap: '10px',
                backgroundColor: '#ffffff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: '#ff5722',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    flexShrink: 0,
                  }}
                >
                  <UserPlus style={{ width: '20px', height: '20px' }} aria-hidden="true" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3 id="add-client-modal-title" style={{ fontSize: '17px', fontWeight: 800, color: '#111827', margin: 0 }}>
                    Agregar Usuario Cliente al Portal
                  </h3>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>
                    Crea el acceso y vincula automáticamente sus paquetes de bodega.
                  </span>
                </div>
              </div>
              <button
                type="button"
                disabled={isCreatingClient}
                onClick={onCloseAddClientModal}
                aria-label="Cerrar modal"
                className="amex-focus-ring"
                style={{
                  minWidth: '38px',
                  minHeight: '38px',
                  padding: '6px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#f3f4f6',
                  color: '#6b7280',
                  cursor: isCreatingClient ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <X style={{ width: '18px', height: '18px' }} aria-hidden="true" />
              </button>
            </div>

            <form
              onSubmit={handleFormSubmit}
              style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
            >
              {/* Cuerpo scrolleable */}
              <div
                ref={modalBodyRef}
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                  padding: '18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                {createClientSuccess && (
                  <div
                    role="status"
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      backgroundColor: '#ecfdf5',
                      border: '1px solid #a7f3d0',
                      color: '#065f46',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                    }}
                  >
                    <CheckCircle2 style={{ width: '18px', height: '18px', color: '#10b981', flexShrink: 0, marginTop: '1px' }} />
                    <span>{createClientSuccess}</span>
                  </div>
                )}

                {createClientError && (
                  <div
                    role="alert"
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fecaca',
                      color: '#991b1b',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                    }}
                  >
                    <AlertCircle style={{ width: '18px', height: '18px', color: '#ef4444', flexShrink: 0, marginTop: '1px' }} />
                    <span>{createClientError}</span>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="new-client-nombre"
                    style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}
                  >
                    Nombre Completo o Empresa (Consignatario en Guías) *
                  </label>
                  <input
                    id="new-client-nombre"
                    ref={nombreInputRef}
                    type="text"
                    required
                    disabled={isCreatingClient}
                    value={newClientNombre}
                    onChange={(e) => {
                      setNewClientNombre(e.target.value);
                      if (createClientError || createClientSuccess) onClearCreateFeedback();
                    }}
                    placeholder="Ej: AMEX JANIRA AMEX o JANIRA PAREDES"
                    className="amex-input"
                    style={{
                      width: '100%',
                      height: '40px',
                      padding: '0 12px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      fontSize: '13px',
                      color: '#111827',
                    }}
                  />
                  <span style={{ fontSize: '11px', color: '#6b7280', marginTop: '3px', display: 'block' }}>
                    Debe coincidir con el nombre con el que llegan los paquetes a Miami/Lince.
                  </span>
                </div>

                <div>
                  <label
                    htmlFor="new-client-email"
                    style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}
                  >
                    Correo Electrónico del Cliente *
                  </label>
                  <input
                    id="new-client-email"
                    ref={emailInputRef}
                    type="email"
                    required
                    disabled={isCreatingClient}
                    value={newClientEmail}
                    onChange={(e) => {
                      setNewClientEmail(e.target.value);
                      if (createClientError || createClientSuccess) onClearCreateFeedback();
                    }}
                    placeholder="cliente@gmail.com"
                    className="amex-input"
                    style={{
                      width: '100%',
                      height: '40px',
                      padding: '0 12px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      fontSize: '13px',
                      color: '#111827',
                    }}
                  />
                </div>

                <div
                  style={{
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '8px',
                    padding: '11px 14px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                  }}
                >
                  <ShieldCheck style={{ width: '18px', height: '18px', color: '#16a34a', flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ fontSize: '12px', color: '#166534', lineHeight: 1.45 }}>
                    <strong>Activación sin contraseña en panel:</strong> Al registrar al cliente, AMEX enviará automáticamente un correo oficial con su enlace seguro para que defina su propia contraseña.
                  </div>
                </div>

                {/* Sección separada: Buscador TIB + Chips seleccionados + Entrada manual */}
                <div
                  style={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#374151' }}>
                      <Tag style={{ width: '13px', height: '13px', color: '#ff5722' }} aria-hidden="true" />
                      <span>Consignatarios y Variaciones (Opcional)</span>
                    </label>
                    <span style={{ fontSize: '11px', color: '#ff5722', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Search style={{ width: '12px', height: '12px' }} aria-hidden="true" />
                      {tibCatalogTotal > 0
                        ? `Buscador TIB (${tibCatalogTotal.toLocaleString()} clientes)`
                        : 'Buscador TIB en vivo'}
                    </span>
                  </div>

                  {/* Buscador dedicado (no acoplado al texto de chips ni recortado por overflow) */}
                  <TibConsigneeSearchInput
                    selectedKeywords={newClientKeywordsList}
                    assignedConsigneeMap={assignedConsigneeMap}
                    tibTotalCount={tibCatalogTotal}
                    isOpen={isTibDropdownOpen}
                    setIsOpen={setIsTibDropdownOpen}
                    onToggleConsignee={handleToggleTibKeyword}
                    onTotalCountUpdate={onTibCatalogTotalUpdate}
                    disabled={isCreatingClient}
                    resetSignal={searchResetSignal}
                  />

                  {/* Chips seleccionados */}
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '6px',
                      minHeight: '36px',
                      padding: '8px',
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      alignItems: 'center',
                    }}
                  >
                    {newClientKeywordsList.length === 0 ? (
                      <span style={{ fontSize: '11.5px', color: '#94a3b8', fontStyle: 'italic' }}>
                        Sin variaciones agregadas todavía (si lo dejas vacío se usará el Nombre Completo).
                      </span>
                    ) : (
                      newClientKeywordsList.map((kw, idx) => (
                        <span
                          key={kw}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            backgroundColor: '#fff7ed',
                            color: '#c2410c',
                            border: '1px solid #fed7aa',
                            borderRadius: '6px',
                            padding: '3px 8px',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            wordBreak: 'break-word',
                          }}
                        >
                          <span>{kw}</span>
                          <button
                            type="button"
                            disabled={isCreatingClient}
                            onClick={() => handleRemoveKeywordChip(idx)}
                            aria-label={`Quitar variación ${kw}`}
                            className="amex-focus-ring"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#c2410c',
                              cursor: 'pointer',
                              padding: '1px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              borderRadius: '4px',
                            }}
                          >
                            <X style={{ width: '12px', height: '12px' }} aria-hidden="true" />
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  {/* Entrada manual de variaciones adicionales */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      disabled={isCreatingClient}
                      value={manualKeywordInput}
                      onChange={(e) => setManualKeywordInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault();
                          handleAddManualKeywords();
                        }
                      }}
                      placeholder="O escribe otra variación manual (Enter o coma para añadir)..."
                      className="amex-input"
                      style={{
                        flex: '1 1 220px',
                        minWidth: 0,
                        height: '36px',
                        padding: '0 10px',
                        borderRadius: '6px',
                        border: '1px solid #d1d5db',
                        fontSize: '12px',
                        color: '#111827',
                        backgroundColor: '#ffffff',
                      }}
                    />
                    <button
                      type="button"
                      disabled={isCreatingClient || !manualKeywordInput.trim()}
                      onClick={() => handleAddManualKeywords()}
                      className="amex-focus-ring"
                      style={{
                        height: '36px',
                        padding: '0 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: manualKeywordInput.trim() ? '#1e293b' : '#f1f5f9',
                        color: manualKeywordInput.trim() ? '#ffffff' : '#94a3b8',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: manualKeywordInput.trim() && !isCreatingClient ? 'pointer' : 'not-allowed',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Plus style={{ width: '13px', height: '13px' }} aria-hidden="true" />
                      <span>Añadir</span>
                    </button>
                  </div>

                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Coincidencia <strong>exacta</strong> del nombre del consignatario (evita cruces con homónimos como AMEX BRIGITTE CORDOVA).
                  </span>
                </div>

                {/* Sección Avanzada: Siglas / Prefijos de Agencia (Palabra Completa) */}
                <div
                  style={{
                    backgroundColor: '#faf5ff',
                    border: '1px solid #e9d5ff',
                    borderRadius: '10px',
                    overflow: 'hidden',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setShowAgencySection((v) => !v)}
                    style={{
                      width: '100%',
                      background: 'none',
                      border: 'none',
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#6d28d9' }}>
                      Siglas / Prefijos de Agencia — Solo Couriers (Opcional)
                      {newClientGroupKeywordsList.length > 0 ? ` (${newClientGroupKeywordsList.length})` : ''}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#7c3aed' }}>
                      {showAgencySection ? 'Ocultar' : 'Configurar'}
                    </span>
                  </button>

                  {(showAgencySection || newClientGroupKeywordsList.length > 0) && (
                    <div
                      style={{
                        borderTop: '1px solid #e9d5ff',
                        padding: '10px 14px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <p style={{ margin: 0, fontSize: '11.5px', color: '#5b21b6', lineHeight: 1.4 }}>
                        Úsalo solo para agencias/couriers (ej. <strong>RUTA</strong>, <strong>AMC</strong>, <strong>MDS</strong>). Busca por <strong>palabra completa</strong>, así <em>AURA</em> jamás coincide con <em>LAURA</em>.
                      </p>

                      {newClientGroupKeywordsList.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {newClientGroupKeywordsList.map((kw, idx) => (
                            <span
                              key={kw}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                backgroundColor: '#f3e8ff',
                                color: '#6b21a8',
                                border: '1px solid #d8b4fe',
                                borderRadius: '6px',
                                padding: '3px 8px',
                                fontSize: '11.5px',
                                fontWeight: 700,
                              }}
                            >
                              <span>Sigla: {kw}</span>
                              <button
                                type="button"
                                disabled={isCreatingClient}
                                onClick={() => handleRemoveGroupKeywordChip(idx)}
                                aria-label={`Quitar sigla ${kw}`}
                                style={{ background: 'none', border: 'none', color: '#6b21a8', cursor: 'pointer', padding: '1px', display: 'inline-flex' }}
                              >
                                <X style={{ width: '12px', height: '12px' }} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <input
                          type="text"
                          disabled={isCreatingClient}
                          value={groupKeywordInput}
                          onChange={(e) => setGroupKeywordInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ',') {
                              e.preventDefault();
                              handleAddGroupKeywords();
                            }
                          }}
                          placeholder="Ej: RUTA, AMC, MDS (mín. 3 letras)..."
                          className="amex-input"
                          style={{
                            flex: '1 1 200px',
                            minWidth: 0,
                            height: '35px',
                            padding: '0 10px',
                            borderRadius: '6px',
                            border: '1px solid #d8b4fe',
                            fontSize: '12px',
                            backgroundColor: '#ffffff',
                          }}
                        />
                        <button
                          type="button"
                          disabled={isCreatingClient || !groupKeywordInput.trim()}
                          onClick={() => handleAddGroupKeywords()}
                          style={{
                            height: '35px',
                            padding: '0 12px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: groupKeywordInput.trim() ? '#7c3aed' : '#ede9fe',
                            color: groupKeywordInput.trim() ? '#ffffff' : '#a78bfa',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: groupKeywordInput.trim() && !isCreatingClient ? 'pointer' : 'not-allowed',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Plus style={{ width: '13px', height: '13px' }} />
                          <span>Añadir sigla</span>
                        </button>
                      </div>

                      {groupInputHint && (
                        <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 600 }}>
                          {groupInputHint}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Simulador de impacto en vivo */}
                <MatchingPreviewBox
                  compact
                  exactConsignees={newClientKeywordsList}
                  groupKeywords={newClientGroupKeywordsList}
                  fallbackNombre={newClientNombre}
                  applyFallbackWhenEmpty
                />
              </div>

              {/* Pie fijo del modal (siempre visible, sin ocultarse tras el dropdown ni requerir scroll) */}
              <div
                style={{
                  flexShrink: 0,
                  padding: '14px 20px',
                  borderTop: '1px solid #e5e7eb',
                  backgroundColor: '#f8fafc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <button
                  type="button"
                  disabled={isCreatingClient}
                  onClick={onCloseAddClientModal}
                  className="amex-focus-ring"
                  style={{
                    minHeight: '40px',
                    padding: '8px 18px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    backgroundColor: '#ffffff',
                    color: '#374151',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: isCreatingClient ? 'not-allowed' : 'pointer',
                  }}
                >
                  {showCloseLabel ? 'Cerrar' : 'Cancelar'}
                </button>
                <button
                  type="submit"
                  disabled={isCreatingClient}
                  className="amex-focus-ring"
                  style={{
                    minHeight: '40px',
                    padding: '8px 22px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#ff5722',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: isCreatingClient ? 'not-allowed' : 'pointer',
                    opacity: isCreatingClient ? 0.85 : 1,
                    boxShadow: '0 2px 4px rgba(255, 87, 34, 0.3)',
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

      {/* Modal Confirmación de Desactivación de Cuenta */}
      {clientToDeactivate && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => {
            if (isTogglingActiveId !== clientToDeactivate.id) {
              setClientToDeactivate(null);
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

      {/* Popover Flotante de Consignatarios y Siglas Vinculadas */}
      {activeKeywordsClient &&
        keywordsPopoverStyle &&
        ((Array.isArray(activeKeywordsClient.alias_palabras_clave) &&
          activeKeywordsClient.alias_palabras_clave.length > 0) ||
          (Array.isArray(activeKeywordsClient.palabras_clave_grupo) &&
            activeKeywordsClient.palabras_clave_grupo.length > 0)) && (
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
                    Reglas de Matching (
                    {(activeKeywordsClient.alias_palabras_clave?.length || 0) +
                      (activeKeywordsClient.palabras_clave_grupo?.length || 0)}
                    )
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onCloseKeywordsPopover}
                  aria-label="Cerrar lista de reglas de matching"
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
                  flexDirection: 'column',
                  gap: '8px',
                  paddingRight: '2px',
                }}
              >
                {Array.isArray(activeKeywordsClient.alias_palabras_clave) &&
                  activeKeywordsClient.alias_palabras_clave.length > 0 && (
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
                        Consignatarios exactos ({activeKeywordsClient.alias_palabras_clave.length})
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                        {activeKeywordsClient.alias_palabras_clave.map((k, ki) => (
                          <span
                            key={`ex-${ki}`}
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
                  )}

                {Array.isArray(activeKeywordsClient.palabras_clave_grupo) &&
                  activeKeywordsClient.palabras_clave_grupo.length > 0 && (
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', marginBottom: '4px' }}>
                        Siglas de agencia — palabra completa ({activeKeywordsClient.palabras_clave_grupo.length})
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                        {activeKeywordsClient.palabras_clave_grupo.map((g, gi) => (
                          <span
                            key={`grp-${gi}`}
                            style={{
                              backgroundColor: '#f5f3ff',
                              color: '#6d28d9',
                              border: '1px solid #ddd6fe',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                              lineHeight: 1.3,
                            }}
                          >
                            Sigla: {g}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
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
