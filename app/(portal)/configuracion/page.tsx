'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabasePortal } from '@/lib/supabase/portal-client';
import { authFetch } from '@/lib/portal/authFetch';
import { isSuperadminEmail } from '@/lib/portal/superadmin';
import { cleanExactString, normalizeSearchText } from '@/lib/portal/keywords';
import { usePortalSession } from '@/components/portal/PortalShell';
import AdminConfigView from '@/components/admin/AdminConfigView';
import AdminClientModals from '@/components/admin/AdminClientModals';
import { ClientePortalItem, KeywordsPopoverStyle, TibCatalogClient } from '@/lib/portal/types';

export default function ConfiguracionPage() {
  const router = useRouter();
  const { user, isSuperadmin, totalSystemCount, setTotalSystemCount, showToast } = usePortalSession();

  const [clientsList, setClientsList] = useState<ClientePortalItem[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [clientSearchQuery, setClientSearchQuery] = useState('');

  // Formulario de nuevo cliente
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [newClientNombre, setNewClientNombre] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientKeywordsList, setNewClientKeywordsList] = useState<string[]>([]);
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [createClientSuccess, setCreateClientSuccess] = useState<string | null>(null);
  const [createClientError, setCreateClientError] = useState<string | null>(null);

  // Reenvío y restablecimiento
  const [resendingEmail, setResendingEmail] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Activar / Desactivar / Popover keywords
  const [clientToDeactivate, setClientToDeactivate] = useState<ClientePortalItem | null>(null);
  const [clientToReset, setClientToReset] = useState<ClientePortalItem | null>(null);
  const [isTogglingActiveId, setIsTogglingActiveId] = useState<string | null>(null);
  const [openKeywordsClientId, setOpenKeywordsClientId] = useState<string | null>(null);
  const [keywordsPopoverStyle, setKeywordsPopoverStyle] = useState<KeywordsPopoverStyle | null>(null);
  const keywordsPopoverRef = useRef<HTMLDivElement>(null);

  // Estado del desplegable buscador TIB en el modal
  const [isTibDropdownOpen, setIsTibDropdownOpen] = useState(false);

  // Catálogo TIB
  const [configSubTab, setConfigSubTab] = useState<'usuarios' | 'tib'>('usuarios');
  const [tibCatalogSearch, setTibCatalogSearch] = useState('');
  const [tibCatalogList, setTibCatalogList] = useState<TibCatalogClient[]>([]);
  const [tibCatalogTotal, setTibCatalogTotal] = useState(0);
  const [isLoadingTibCatalog, setIsLoadingTibCatalog] = useState(false);
  const [tibCatalogPage, setTibCatalogPage] = useState(1);
  const tibCatalogAbortRef = useRef<AbortController | null>(null);
  const tibCatalogLastSearchRef = useRef<string>('');

  const [isSyncingAll, setIsSyncingAll] = useState(false);

  // Proteger ruta exclusiva de superadmin
  useEffect(() => {
    if (user && !isSuperadmin) {
      router.replace('/warehouse');
    }
  }, [user, isSuperadmin, router]);

  const fetchClientsList = useCallback(async () => {
    setIsLoadingClients(true);
    try {
      const res = await authFetch('/api/listar-portal').catch(() => null);
      if (res && res.ok) {
        const json = await res.json().catch(() => null);
        if (json?.clientes) {
          setClientsList(json.clientes);
          return;
        }
      }
      const { data, error } = await supabasePortal
        .from('clientes_portal')
        .select('*')
        .order('creado_en', { ascending: false });

      if (error) throw error;
      setClientsList(data || []);
    } catch (err) {
      console.warn('Aviso al cargar clientes_portal:', err);
    } finally {
      setIsLoadingClients(false);
    }
  }, []);

  const refreshSystemCount = useCallback(async () => {
    if (!user?.email) return;
    try {
      const res = await authFetch('/api/paquetes-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, onlySystemCount: true }),
      });
      if (!res.ok) return;
      const json = await res.json().catch(() => null);
      if (typeof json?.systemCount === 'number') {
        setTotalSystemCount(json.systemCount);
      }
    } catch {
      // Silencioso en recarga auxiliar
    }
  }, [user?.email, setTotalSystemCount]);

  // Carga inicial de clientes, conteo del sistema y total real del catálogo TIB
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!isSuperadmin || initializedRef.current) return;
    initializedRef.current = true;
    fetchClientsList();

    if (totalSystemCount === 0) {
      refreshSystemCount();
    }

    if (tibCatalogTotal === 0) {
      authFetch('/api/listado-amex?limit=1')
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
          if (typeof json?.total === 'number' && json.total > 0) {
            setTibCatalogTotal(json.total);
          }
        })
        .catch(() => {});
    }
  }, [isSuperadmin, totalSystemCount, tibCatalogTotal, fetchClientsList, refreshSystemCount]);

  const resetAddClientModalState = useCallback(() => {
    setNewClientNombre('');
    setNewClientEmail('');
    setNewClientKeywordsList([]);
    setCreateClientSuccess(null);
    setCreateClientError(null);
    setIsTibDropdownOpen(false);
  }, []);

  const handleCloseAddClientModal = useCallback(() => {
    if (isCreatingClient) return;
    setIsAddClientOpen(false);
    resetAddClientModalState();
  }, [isCreatingClient, resetAddClientModalState]);

  // Escape respeta prioridad de capas: primero popovers/confirmaciones/dropdown y por último el modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (clientToDeactivate) {
        if (isTogglingActiveId !== clientToDeactivate.id) setClientToDeactivate(null);
        return;
      }
      if (clientToReset) {
        if (resendingEmail !== clientToReset.email) setClientToReset(null);
        return;
      }
      if (openKeywordsClientId) {
        setOpenKeywordsClientId(null);
        setKeywordsPopoverStyle(null);
        return;
      }
      if (isTibDropdownOpen) {
        setIsTibDropdownOpen(false);
        return;
      }
      if (isAddClientOpen) {
        handleCloseAddClientModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    clientToDeactivate,
    isTogglingActiveId,
    clientToReset,
    resendingEmail,
    openKeywordsClientId,
    isTibDropdownOpen,
    isAddClientOpen,
    handleCloseAddClientModal,
  ]);

  useEffect(() => {
    if (!openKeywordsClientId) return;
    const handleViewportScroll = (e: Event) => {
      if (keywordsPopoverRef.current && e.target instanceof Node && keywordsPopoverRef.current.contains(e.target)) {
        return;
      }
      setOpenKeywordsClientId(null);
      setKeywordsPopoverStyle(null);
    };
    const handleResize = () => {
      setOpenKeywordsClientId(null);
      setKeywordsPopoverStyle(null);
    };
    window.addEventListener('scroll', handleViewportScroll, true);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('scroll', handleViewportScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [openKeywordsClientId]);

  const handleToggleKeywordsPopover = useCallback(
    (clientId: string, anchorEl: HTMLElement) => {
      if (openKeywordsClientId === clientId) {
        setOpenKeywordsClientId(null);
        setKeywordsPopoverStyle(null);
        return;
      }
      const rect = anchorEl.getBoundingClientRect();
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
      const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
      const width = Math.min(380, Math.max(240, vw - 24));
      const left = Math.min(Math.max(12, rect.left), vw - width - 12);
      const spaceBelow = vh - rect.bottom - 12;
      const spaceAbove = rect.top - 12;
      const openUp = spaceBelow < 240 && spaceAbove > spaceBelow;
      const availableSpace = openUp ? spaceAbove : spaceBelow;
      const maxHeight = Math.max(110, Math.min(220, availableSpace - 68));

      setKeywordsPopoverStyle({
        top: openUp ? undefined : rect.bottom + 6,
        bottom: openUp ? vh - rect.top + 6 : undefined,
        left,
        width,
        maxHeight,
      });
      setOpenKeywordsClientId(clientId);
    },
    [openKeywordsClientId]
  );

  const handleSyncAllFromTib = async () => {
    if (!user?.email) return;
    setIsSyncingAll(true);
    try {
      const res = await authFetch('/api/sync-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al sincronizar');

      showToast(
        'success',
        `Sincronización TIB completa: ${data.sincronizados} paquetes asignados a sus clientes con coincidencia exacta.`
      );
    } catch (err: any) {
      showToast('error', `Error en sincronización: ${err.message}`);
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleCreateClientSubmit = async (keywordsToSubmit: string[]) => {
    setIsCreatingClient(true);
    setCreateClientError(null);
    setCreateClientSuccess(null);

    try {
      const res = await authFetch('/api/crear-usuario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_completo: newClientNombre,
          email: newClientEmail,
          alias_palabras_clave: keywordsToSubmit,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al crear el usuario cliente');
      }

      const msg =
        data.mensaje ||
        `¡Cliente ${data.user.nombre_completo} registrado con éxito! Se vincularon ${data.paquetes_vinculados} paquetes y se envió el correo de activación.`;

      setCreateClientSuccess(msg);
      showToast('success', msg);

      setNewClientNombre('');
      setNewClientEmail('');
      setNewClientKeywordsList([]);
      setIsTibDropdownOpen(false);

      fetchClientsList();
      refreshSystemCount();
    } catch (err: any) {
      setCreateClientError(err.message || 'Error al crear cliente');
    } finally {
      setIsCreatingClient(false);
    }
  };

  const handleResetPassword = async (clientEmail: string) => {
    if (resendingEmail) return;
    setResendingEmail(clientEmail);
    setResendNotice(null);

    try {
      const res = await authFetch('/api/restablecer-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: clientEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al enviar enlace de restablecimiento');
      }
      const msg =
        data.message ||
        `Correo enviado exitosamente a ${clientEmail} con el enlace seguro para restablecer su contraseña.`;
      setResendNotice({ type: 'success', message: msg });
      showToast('success', msg);
      setClientToReset(null);
      setTimeout(() => setResendNotice(null), 6000);
    } catch (err: any) {
      const msg = err.message || 'Error al enviar correo para restablecer contraseña';
      setResendNotice({ type: 'error', message: msg });
      showToast('error', msg);
      setClientToReset(null);
      setTimeout(() => setResendNotice(null), 6000);
    } finally {
      setResendingEmail(null);
    }
  };

  const handleToggleClientActive = async (clientId: string, targetActive: boolean) => {
    setIsTogglingActiveId(clientId);
    try {
      const res = await authFetch('/api/toggle-estado-cliente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: clientId, activo: targetActive }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al actualizar estado de la cuenta');
      }

      setClientsList((prev) => prev.map((c) => (c.id === clientId ? { ...c, activo: targetActive } : c)));
      setResendNotice({
        type: 'success',
        message: data.message || `Cuenta ${targetActive ? 'activada' : 'desactivada'} exitosamente.`,
      });
      setTimeout(() => setResendNotice(null), 6000);
      setClientToDeactivate(null);
    } catch (err: any) {
      setResendNotice({
        type: 'error',
        message: err.message || 'Error al cambiar estado de la cuenta',
      });
      setTimeout(() => setResendNotice(null), 6000);
    } finally {
      setIsTogglingActiveId(null);
    }
  };

  const handleToggleTibKeyword = useCallback(
    (client: TibCatalogClient) => {
      const raw = cleanExactString(client.nombre);
      if (!raw) return;

      const exists = newClientKeywordsList.some((k) => cleanExactString(k) === raw);
      if (exists) {
        setNewClientKeywordsList((prev) => prev.filter((k) => cleanExactString(k) !== raw));
        return;
      }

      setNewClientKeywordsList((prev) => [...prev, raw]);
      if (!newClientNombre.trim()) {
        setNewClientNombre(raw);
      }
      if (client.email && !newClientEmail.trim()) {
        setNewClientEmail(client.email.trim());
      }
    },
    [newClientKeywordsList, newClientNombre, newClientEmail]
  );

  const handleAssignTibClientToPortal = useCallback(
    (client: TibCatalogClient) => {
      const raw = cleanExactString(client.nombre);
      resetAddClientModalState();
      if (raw) {
        setNewClientNombre(raw);
        setNewClientKeywordsList([raw]);
      }
      if (client.email) {
        setNewClientEmail(client.email.trim());
      }
      setIsAddClientOpen(true);
    },
    [resetAddClientModalState]
  );

  const fetchTibCatalog = useCallback(async (searchQuery = '', page = 1) => {
    if (tibCatalogAbortRef.current) {
      tibCatalogAbortRef.current.abort();
    }
    const controller = new AbortController();
    tibCatalogAbortRef.current = controller;

    setIsLoadingTibCatalog(true);
    try {
      const limit = 15;
      const offset = (page - 1) * limit;
      const res = await authFetch(
        `/api/listado-amex?search=${encodeURIComponent(searchQuery.trim())}&limit=${limit}&offset=${offset}`,
        { signal: controller.signal }
      );
      const json = await res.json();
      if (res.ok) {
        setTibCatalogList(json.clientes || []);
        setTibCatalogTotal(json.total || 0);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      console.warn('Error al cargar catálogo TIB:', err);
    } finally {
      if (tibCatalogAbortRef.current === controller) {
        setIsLoadingTibCatalog(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!(isSuperadmin && configSubTab === 'tib')) {
      return;
    }
    const searchChanged = tibCatalogLastSearchRef.current !== tibCatalogSearch;
    const delay = searchChanged ? 280 : 0;

    const timer = setTimeout(() => {
      tibCatalogLastSearchRef.current = tibCatalogSearch;
      fetchTibCatalog(tibCatalogSearch, tibCatalogPage);
    }, delay);

    return () => clearTimeout(timer);
  }, [isSuperadmin, configSubTab, tibCatalogSearch, tibCatalogPage, fetchTibCatalog]);

  const assignedConsigneeMap = useMemo(() => {
    const map = new Map<string, { email: string; nombre_completo: string }>();
    for (const c of clientsList) {
      if (isSuperadminEmail(c.email)) continue;
      const info = { email: c.email, nombre_completo: c.nombre_completo };
      const cleanName = cleanExactString(c.nombre_completo);
      if (cleanName && cleanName !== 'AMEX' && !map.has(cleanName)) {
        map.set(cleanName, info);
      }
      if (Array.isArray(c.alias_palabras_clave)) {
        for (const alias of c.alias_palabras_clave) {
          const cleanAlias = cleanExactString(alias);
          if (cleanAlias && cleanAlias !== 'AMEX' && !map.has(cleanAlias)) {
            map.set(cleanAlias, info);
          }
        }
      }
    }
    return map;
  }, [clientsList]);

  const filteredClientsList = useMemo(() => {
    const normalizedQuery = normalizeSearchText(clientSearchQuery);
    if (!normalizedQuery) return clientsList;
    const terms = normalizedQuery.split(' ').filter(Boolean);

    return clientsList.filter((c) => {
      const searchable = normalizeSearchText(
        [
          c.nombre_completo,
          c.email,
          ...(Array.isArray(c.alias_palabras_clave) ? c.alias_palabras_clave : []),
        ].join(' ')
      );
      return terms.every((term) => searchable.includes(term));
    });
  }, [clientsList, clientSearchQuery]);

  const activeKeywordsClient = useMemo(
    () => (openKeywordsClientId ? clientsList.find((c) => c.id === openKeywordsClientId) || null : null),
    [openKeywordsClientId, clientsList]
  );

  if (!isSuperadmin) {
    return null;
  }

  return (
    <>
      <AdminConfigView
        clientsList={clientsList}
        filteredClientsList={filteredClientsList}
        isLoadingClients={isLoadingClients}
        totalSystemCount={totalSystemCount}
        totalFilteredCount={totalSystemCount}
        isSyncingAll={isSyncingAll}
        configSubTab={configSubTab}
        setConfigSubTab={setConfigSubTab}
        clientSearchQuery={clientSearchQuery}
        setClientSearchQuery={setClientSearchQuery}
        resendNotice={resendNotice}
        setResendNotice={setResendNotice}
        resendingEmail={resendingEmail}
        isTogglingActiveId={isTogglingActiveId}
        openKeywordsClientId={openKeywordsClientId}
        tibCatalogSearch={tibCatalogSearch}
        setTibCatalogSearch={setTibCatalogSearch}
        tibCatalogList={tibCatalogList}
        tibCatalogTotal={tibCatalogTotal}
        isLoadingTibCatalog={isLoadingTibCatalog}
        tibCatalogPage={tibCatalogPage}
        setTibCatalogPage={setTibCatalogPage}
        assignedConsigneeMap={assignedConsigneeMap}
        onSelectTab={(tab) => {
          if (tab === 'warehouse') router.push('/warehouse');
          else if (tab === 'analiticas') router.push('/analiticas');
        }}
        onSyncAllFromTib={handleSyncAllFromTib}
        onOpenAddClientModal={() => {
          resetAddClientModalState();
          setIsAddClientOpen(true);
        }}
        onToggleKeywordsPopover={handleToggleKeywordsPopover}
        onRequestResetPassword={(c) => setClientToReset(c)}
        onToggleClientActive={handleToggleClientActive}
        onRequestDeactivateClient={(c) => setClientToDeactivate(c)}
        onAssignTibClientToPortal={handleAssignTibClientToPortal}
      />

      <AdminClientModals
        isAddClientOpen={isAddClientOpen}
        onCloseAddClientModal={handleCloseAddClientModal}
        newClientNombre={newClientNombre}
        setNewClientNombre={setNewClientNombre}
        newClientEmail={newClientEmail}
        setNewClientEmail={setNewClientEmail}
        newClientKeywordsList={newClientKeywordsList}
        setNewClientKeywordsList={setNewClientKeywordsList}
        isCreatingClient={isCreatingClient}
        createClientSuccess={createClientSuccess}
        createClientError={createClientError}
        onClearCreateFeedback={() => {
          setCreateClientError(null);
          setCreateClientSuccess(null);
        }}
        handleCreateClientSubmit={handleCreateClientSubmit}
        isTibDropdownOpen={isTibDropdownOpen}
        setIsTibDropdownOpen={setIsTibDropdownOpen}
        handleToggleTibKeyword={handleToggleTibKeyword}
        tibCatalogTotal={tibCatalogTotal}
        onTibCatalogTotalUpdate={(total) => {
          if (total > 0) setTibCatalogTotal(total);
        }}
        assignedConsigneeMap={assignedConsigneeMap}
        clientToDeactivate={clientToDeactivate}
        setClientToDeactivate={setClientToDeactivate}
        isTogglingActiveId={isTogglingActiveId}
        handleToggleClientActive={handleToggleClientActive}
        activeKeywordsClient={activeKeywordsClient}
        keywordsPopoverStyle={keywordsPopoverStyle}
        keywordsPopoverRef={keywordsPopoverRef}
        onCloseKeywordsPopover={() => {
          setOpenKeywordsClientId(null);
          setKeywordsPopoverStyle(null);
        }}
        clientToReset={clientToReset}
        setClientToReset={setClientToReset}
        resendingEmail={resendingEmail}
        handleResetPassword={handleResetPassword}
      />
    </>
  );
}
