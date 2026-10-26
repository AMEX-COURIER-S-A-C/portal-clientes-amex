'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabasePortal } from '@/lib/supabase/portal-client';
import {
  ArrowLeft,
  Settings,
  Tag,
  CheckCircle2,
  AlertCircle,
  Package,
  Search,
  Plus,
  Trash2,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  User,
  Mail,
  Phone,
  FileText,
  Lock,
} from 'lucide-react';

export default function ConfigurarClientePage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params?.id as string;

  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // Datos del cliente a editar
  const [client, setClient] = useState<any | null>(null);
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [email, setEmail] = useState('');
  const [casilleroCodigo, setCasilleroCodigo] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [paquetesVinculados, setPaquetesVinculados] = useState(0);

  // Estados de carga y guardado
  const [isLoadingClient, setIsLoadingClient] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [resendMsg, setResendMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleResendActivation = async () => {
    if (!email || isResending) return;
    setIsResending(true);
    setResendMsg(null);
    try {
      const res = await fetch('/api/reenviar-activacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al reenviar enlace');
      setResendMsg({ type: 'success', text: data.message || `Enlace enviado exitosamente a ${email}` });
    } catch (err: any) {
      setResendMsg({ type: 'error', text: err.message || 'Error al reenviar enlace' });
    } finally {
      setIsResending(false);
    }
  };

  // Buscador de Consignatarios TIB
  const [tibQuery, setTibQuery] = useState('');
  const [tibResults, setTibResults] = useState<any[]>([]);
  const [isSearchingTib, setIsSearchingTib] = useState(false);
  const [isTibDropdownOpen, setIsTibDropdownOpen] = useState(false);
  const tibSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tibSearchRef.current && !tibSearchRef.current.contains(event.target as Node)) {
        setIsTibDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 1. Verificar autenticación de Superadmin
  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabasePortal.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      if (session.user.email?.toLowerCase() !== 'sistemaamexcourier@gmail.com') {
        router.push('/');
        return;
      }
      setCurrentUser(session.user);
      setIsLoadingAuth(false);
    }
    checkAuth();
  }, [router]);

  // 2. Cargar datos del cliente
  const loadClientData = useCallback(async () => {
    if (!clientId) return;
    setIsLoadingClient(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/actualizar-usuario?id=${encodeURIComponent(clientId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar la información del cliente');

      const c = data.client;
      setClient(c);
      setNombreCompleto(c.nombre_completo || '');
      setEmail(c.email || '');
      setCasilleroCodigo(c.casillero_codigo || '');
      setKeywords(Array.isArray(c.alias_palabras_clave) ? c.alias_palabras_clave : []);
      setPaquetesVinculados(data.paquetes_vinculados || 0);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al cargar el cliente');
    } finally {
      setIsLoadingClient(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (!isLoadingAuth && clientId) {
      loadClientData();
    }
  }, [isLoadingAuth, clientId, loadClientData]);

  // 3. Buscador de Consignatarios TIB (3,360) - Ejecución exclusiva con Enter
  const searchTib = useCallback(async (q: string) => {
    const trimmed = (q || '').trim();
    if (!trimmed || trimmed.length < 2) {
      setTibResults([]);
      setIsTibDropdownOpen(false);
      return;
    }
    setIsSearchingTib(true);
    setIsTibDropdownOpen(true);
    try {
      const res = await fetch(`/api/listado-amex?search=${encodeURIComponent(trimmed)}&limit=50`);
      const data = await res.json();
      setTibResults(data.clientes || []);
    } catch (err) {
      console.error('Error buscando en catálogo TIB:', err);
      setTibResults([]);
    } finally {
      setIsSearchingTib(false);
    }
  }, []);

  const handleAddKeywordExact = (word: string) => {
    const trimmed = word.trim().toUpperCase();
    if (!trimmed) return;
    if (!keywords.includes(trimmed)) {
      setKeywords([...keywords, trimmed]);
    }
    setKeywordInput('');
    setTibQuery('');
    setTibResults([]);
    setIsTibDropdownOpen(false);
  };

  const handleRemoveKeyword = (index: number) => {
    setKeywords(keywords.filter((_, i) => i !== index));
  };

  // 4. Guardar cambios
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/actualizar-usuario', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: clientId,
          nombre_completo: nombreCompleto,
          casillero_codigo: casilleroCodigo,
          alias_palabras_clave: keywords,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar los cambios');

      setPaquetesVinculados(data.paquetes_vinculados || 0);
      setSuccessMessage(
        `¡Configuración guardada exitosamente! Se vincularon ${(data.paquetes_vinculados || 0).toLocaleString()} paquetes al portal de este cliente.`
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al actualizar');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingAuth || isLoadingClient) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid #0284c7', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '12px' }} />
        <p style={{ fontSize: '14px', fontWeight: 600, color: '#475569' }}>Cargando configuración del cliente...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f1f5f9', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
      
      {/* 1. Header Superior */}
      <header style={{ backgroundColor: '#111827', borderBottom: '1px solid #1f2937', color: '#ffffff', padding: '0 24px', height: '62px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <img src="/images/logo-amex-clean.png" alt="AMEX Courier" style={{ height: '32px', objectFit: 'contain' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '-0.2px', color: '#f3f4f6' }}>
              Portal de Clientes
            </span>
            <span style={{ backgroundColor: '#ff5722', color: '#ffffff', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Superadmin
            </span>
          </div>
        </div>

        <Link
          href="/?tab=configuracion"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(255,255,255,0.08)',
            color: '#f8fafc',
            border: '1px solid rgba(255,255,255,0.15)',
            padding: '7px 14px',
            borderRadius: '6px',
            fontSize: '12.5px',
            fontWeight: 700,
            textDecoration: 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <ArrowLeft style={{ width: '14px', height: '14px' }} />
          <span>Volver al Directorio de Clientes</span>
        </Link>
      </header>

      {/* 2. Contenedor Principal */}
      <main style={{ maxWidth: '960px', width: '100%', margin: '0 auto', padding: '32px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '22px' }}>
        
        {/* Banner de Título */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
              <Settings style={{ width: '13px', height: '13px' }} />
              <span>Configuración Exclusiva</span>
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: 0 }}>
              Configurar Palabras Clave y Matching
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
              Página dedicada para el cliente <strong>{client?.nombre_completo}</strong> ({client?.email})
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              <Package style={{ width: '20px', height: '20px', color: '#0284c7' }} />
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Paquetes en Cuenta</div>
                <div style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a' }}>{paquetesVinculados} paquetes</div>
              </div>
            </div>
          </div>
        </div>

        {/* Notificaciones */}
        {successMessage && (
          <div style={{ padding: '14px 18px', borderRadius: '10px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <CheckCircle2 style={{ width: '20px', height: '20px', flexShrink: 0, color: '#059669' }} />
            <span style={{ fontWeight: 600 }}>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div style={{ padding: '14px 18px', borderRadius: '10px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle style={{ width: '20px', height: '20px', flexShrink: 0, color: '#dc2626' }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Tarjeta de Formulario Principal */}
        <form onSubmit={handleSave} style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', padding: '28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* SECCIÓN 1: PALABRAS CLAVE (EL MATCHING OFICIAL TIB) */}
          <div style={{ backgroundColor: '#f0f9ff', border: '1.5px solid #0284c7', borderRadius: '10px', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Tag style={{ width: '18px', height: '18px', color: '#0284c7' }} />
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0369a1', margin: 0 }}>
                  Palabras Clave de Matching Oficial TIB
                </h3>
              </div>
              <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#0284c7', color: '#ffffff', padding: '2px 8px', borderRadius: '12px' }}>
                Coincidencia Inteligente y Flexible
              </span>
            </div>
            
            <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: '#0c4a6e', lineHeight: 1.5 }}>
              Se asignarán automáticamente a este cliente todos los paquetes cuyo consignatario oficial coincida o contenga alguna de estas palabras clave (ejemplo: <strong>INK</strong> vinculará todos los <em>AMEX INK ...</em>, <strong>KENNETH MALDONADO</strong>, etc.).
            </p>

            {/* Lista Visual de Palabras Clave Activas */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px', minHeight: '38px', padding: '10px', backgroundColor: '#ffffff', border: '1px solid #bae6fd', borderRadius: '8px' }}>
              {keywords.length === 0 ? (
                <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                  No hay palabras clave configuradas. El usuario no verá paquetes hasta que agregues al menos una.
                </span>
              ) : (
                keywords.map((kw, i) => (
                  <span
                    key={i}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: '#e0f2fe',
                      color: '#0369a1',
                      border: '1px solid #7dd3fc',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                    }}
                  >
                    <span>{kw}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveKeyword(i)}
                      style={{ background: 'none', border: 'none', color: '#0369a1', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                      title="Eliminar palabra clave"
                    >
                      <Trash2 style={{ width: '13px', height: '13px' }} />
                    </button>
                  </span>
                ))
              )}
            </div>

            {/* Buscador de Consignatarios TIB (3,360) para Añadir al Matching */}
            <div ref={tibSearchRef} style={{ position: 'relative' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#0c4a6e', marginBottom: '6px' }}>
                Buscar en Catálogo Oficial TIB (3,360 consignatarios) para añadir:
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search style={{ position: 'absolute', left: '10px', top: '10px', width: '16px', height: '16px', color: '#64748b' }} />
                  <input
                    type="text"
                    value={tibQuery}
                    onChange={(e) => {
                      setTibQuery(e.target.value);
                      if (!e.target.value.trim()) {
                        setTibResults([]);
                        setIsTibDropdownOpen(false);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        searchTib(tibQuery);
                      } else if (e.key === 'Escape') {
                        setIsTibDropdownOpen(false);
                      }
                    }}
                    placeholder="Escribe el nombre y presiona Enter para buscar (ej. AMEX IVAN SARAVIA)..."
                    style={{
                      width: '100%',
                      padding: '8px 100px 8px 34px',
                      borderRadius: '6px',
                      border: '1px solid #7dd3fc',
                      fontSize: '12.5px',
                      outline: 'none',
                      backgroundColor: '#ffffff',
                    }}
                  />
                  <div style={{ position: 'absolute', right: '4px', top: '4px', bottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {isSearchingTib && (
                      <div style={{ width: '14px', height: '14px', border: '2px solid #0284c7', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', marginRight: '4px' }} />
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        searchTib(tibQuery);
                      }}
                      disabled={isSearchingTib || !tibQuery.trim()}
                      title="Buscar con Enter"
                      style={{
                        height: '100%',
                        backgroundColor: '#0284c7',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '0 10px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: tibQuery.trim() ? 'pointer' : 'default',
                        opacity: tibQuery.trim() ? 1 : 0.6,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <span>Enter ↵</span>
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    placeholder="O escribe texto manual..."
                    style={{
                      width: '210px',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px',
                      outline: 'none',
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddKeywordExact(keywordInput);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleAddKeywordExact(keywordInput)}
                    disabled={!keywordInput.trim()}
                    style={{
                      backgroundColor: '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 14px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: keywordInput.trim() ? 'pointer' : 'not-allowed',
                      opacity: keywordInput.trim() ? 1 : 0.6,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Plus style={{ width: '14px', height: '14px' }} />
                    <span>Agregar</span>
                  </button>
                </div>
              </div>

              {/* Dropdown de Resultados TIB */}
              {isTibDropdownOpen && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 50, maxHeight: '240px', overflowY: 'auto' }}>
                  {isSearchingTib ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '12.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <div style={{ width: '14px', height: '14px', border: '2px solid #0284c7', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                      <span>Buscando en catálogo oficial TIB...</span>
                    </div>
                  ) : tibResults.length > 0 ? (
                    tibResults.map((t, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleAddKeywordExact(t.nombre)}
                        style={{ padding: '9px 14px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12.5px' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0f9ff')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <div>
                          <strong style={{ color: '#0f172a' }}>{t.nombre}</strong>
                          {t.iclient && <span style={{ marginLeft: '8px', color: '#64748b', fontSize: '11px' }}>ID: {t.iclient}</span>}
                          {t.total_paquetes != null && (
                            <span style={{ marginLeft: '8px', backgroundColor: '#e0f2fe', color: '#0369a1', fontSize: '10.5px', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                              {t.total_paquetes} paquetes
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: 700 }}>+ Añadir al Matching</span>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '14px 16px', color: '#64748b', fontSize: '12px', textAlign: 'center' }}>
                      No se encontraron consignatarios en el catálogo TIB para &ldquo;<strong>{tibQuery}</strong>&rdquo;. Puedes añadirlo ingresándolo en el campo de texto manual de la derecha.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* SECCIÓN 2: INFORMACIÓN GENERAL DEL CLIENTE */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Consignatario / Nombre Completo
              </label>
              <input
                type="text"
                required
                value={nombreCompleto}
                onChange={(e) => setNombreCompleto(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Código de Casillero
              </label>
              <input
                type="text"
                value={casilleroCodigo}
                onChange={(e) => setCasilleroCodigo(e.target.value)}
                placeholder="Ej. AMX-001 o 31888"
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
              />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Correo de Acceso (Login)
              </label>
              <input
                type="email"
                disabled
                value={email}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', color: '#64748b', fontSize: '13px', fontFamily: 'monospace' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Enlazado a la cuenta de autenticación.</span>
                <button
                  type="button"
                  onClick={handleResendActivation}
                  disabled={isResending}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '4px 10px',
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '6px',
                    color: '#166534',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: isResending ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Mail style={{ width: '12px', height: '12px' }} />
                  <span>{isResending ? 'Enviando enlace...' : 'Reenviar Enlace de Activación'}</span>
                </button>
              </div>
              {resendMsg && (
                <div style={{
                  marginTop: '8px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  backgroundColor: resendMsg.type === 'success' ? '#ecfdf5' : '#fef2f2',
                  border: `1px solid ${resendMsg.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
                  color: resendMsg.type === 'success' ? '#065f46' : '#991b1b',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}>
                  {resendMsg.type === 'success' ? (
                    <CheckCircle2 style={{ width: '13px', height: '13px', flexShrink: 0 }} />
                  ) : (
                    <AlertCircle style={{ width: '13px', height: '13px', flexShrink: 0 }} />
                  )}
                  <span>{resendMsg.text}</span>
                </div>
              )}
            </div>
          </div>

          {/* Botones de Acción */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '18px', borderTop: '1px solid #e2e8f0', marginTop: '10px' }}>
            <Link
              href="/?tab=configuracion"
              style={{ padding: '10px 18px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#475569', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}
            >
              Cancelar
            </Link>

            <button
              type="submit"
              disabled={isSaving}
              style={{
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '11px 26px',
                fontSize: '13.5px',
                fontWeight: 800,
                cursor: isSaving ? 'not-allowed' : 'pointer',
                opacity: isSaving ? 0.7 : 1,
                boxShadow: '0 2px 4px rgba(2,132,199,0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {isSaving ? (
                <>
                  <div style={{ width: '16px', height: '16px', border: '2px solid #ffffff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  <span>Guardando y Consultando TIB...</span>
                </>
              ) : (
                <>
                  <RefreshCw style={{ width: '15px', height: '15px' }} />
                  <span>Guardar Cambios y Re-vincular TIB</span>
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
