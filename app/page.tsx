'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabasePortal } from '@/lib/supabase/portal-client';
import { authFetch } from '@/lib/portal/authFetch';
import { isSuperadminEmail } from '@/lib/portal/superadmin';
import { trackPortalEvent } from '@/lib/analytics/tracker';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';
import PortalHeader from '@/components/warehouse/PortalHeader';
import WarehouseView from '@/components/warehouse/WarehouseView';
import PhotoLightboxModal from '@/components/warehouse/PhotoLightboxModal';
import AdminConfigView from '@/components/admin/AdminConfigView';
import AdminClientModals from '@/components/admin/AdminClientModals';
import {
  ClientePortalItem,
  formatDateForInput,
  KeywordsPopoverStyle,
  PaqueteTIB,
  ToastNotice,
} from '@/lib/portal/types';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

export default function ClienteDashboardTIB() {
  const router = useRouter();

  const [user, setUser] = useState<any | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const isSuperadmin = isSuperadminEmail(user?.email);
  const [paquetes, setPaquetes] = useState<PaqueteTIB[]>([]);
  const [totalSystemCount, setTotalSystemCount] = useState<number>(0);
  const [totalFilteredCount, setTotalFilteredCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastNotice | null>(null);
  const toastTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const hasInitialDataLoaded = React.useRef(false);
  const lastSearchedTextRef = React.useRef({ wr: '', tracking: '' });
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = React.useRef<HTMLDivElement>(null);

  // Navegación entre vistas principales para Superadmin
  const [activeTab, setActiveTab] = useState<'warehouse' | 'configuracion' | 'analiticas'>('warehouse');
  const [clientSearchQuery, setClientSearchQuery] = useState('');

  // Filtros individuales estilo TIB
  const [filterWr, setFilterWr] = useState('');
  const [filterTracking, setFilterTracking] = useState('');
  const [filterConsignatario, setFilterConsignatario] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterEstado, setFilterEstado] = useState('');

  // Selector Desplegable Inteligente de Consignatario
  const [isConsignatarioFilterOpen, setIsConsignatarioFilterOpen] = useState(false);
  const [consignatarioSearchTerm, setConsignatarioSearchTerm] = useState('');
  const [consignatarioOptions, setConsignatarioOptions] = useState<any[]>([]);
  const [consignatarioOptionsTotal, setConsignatarioOptionsTotal] = useState(0);
  const [isLoadingConsignatarioOptions, setIsLoadingConsignatarioOptions] = useState(false);
  const consignatarioDropdownRef = React.useRef<HTMLDivElement>(null);

  // Filtros avanzados, rangos y fechas profesionales
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterFechaTipo, setFilterFechaTipo] = useState<'creado_en' | 'actualizado_en'>('creado_en');
  const [filterFechaDesde, setFilterFechaDesde] = useState('');
  const [filterFechaHasta, setFilterFechaHasta] = useState('');
  const [filterPesoMin, setFilterPesoMin] = useState('');
  const [filterPesoMax, setFilterPesoMax] = useState('');
  const [datePreset, setDatePreset] = useState<string>('all');

  // Modal para ver foto
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; wr: string } | null>(null);
  const [openingPhotoIndex, setOpeningPhotoIndex] = useState<number | null>(null);
  const [photoOpenError, setPhotoOpenError] = useState<string | null>(null);
  const [fallbackPhotoUrl, setFallbackPhotoUrl] = useState<{ url: string; label: string } | null>(null);

  // Estados de los Módulos de Superadmin: Agregar Cliente y Lista de Clientes
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [clientsList, setClientsList] = useState<ClientePortalItem[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(false);

  // Formulario de nuevo cliente
  const [newClientNombre, setNewClientNombre] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [resendingEmail, setResendingEmail] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [newClientKeywords, setNewClientKeywords] = useState('');
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [createClientSuccess, setCreateClientSuccess] = useState<string | null>(null);
  const [createClientError, setCreateClientError] = useState<string | null>(null);

  // Estados para Editar Cliente / Configurar Palabras Clave y Matching
  const [editingClient, setEditingClient] = useState<ClientePortalItem | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editKeywords, setEditKeywords] = useState('');
  const [isUpdatingClient, setIsUpdatingClient] = useState(false);
  const [editClientSuccess, setEditClientSuccess] = useState<string | null>(null);
  const [editClientError, setEditClientError] = useState<string | null>(null);

  // Estados para Activar / Desactivar cuenta de cliente y Modal de Confirmación
  const [clientToDeactivate, setClientToDeactivate] = useState<ClientePortalItem | null>(null);
  const [clientToReset, setClientToReset] = useState<ClientePortalItem | null>(null);
  const [isTogglingActiveId, setIsTogglingActiveId] = useState<string | null>(null);
  const [openKeywordsClientId, setOpenKeywordsClientId] = useState<string | null>(null);
  const [keywordsPopoverStyle, setKeywordsPopoverStyle] = useState<KeywordsPopoverStyle | null>(null);
  const keywordsPopoverRef = React.useRef<HTMLDivElement>(null);

  // Estados para el Buscador / Autocompletado de Consignatarios TIB
  const [tibSearchResults, setTibSearchResults] = useState<any[]>([]);
  const [isSearchingTib, setIsSearchingTib] = useState(false);
  const [isTibDropdownOpen, setIsTibDropdownOpen] = useState(false);

  // Estados para la pestaña de Catálogo TIB en Configuración
  const [configSubTab, setConfigSubTab] = useState<'usuarios' | 'tib'>('usuarios');
  const [tibCatalogSearch, setTibCatalogSearch] = useState('');
  const [tibCatalogList, setTibCatalogList] = useState<any[]>([]);
  const [tibCatalogTotal, setTibCatalogTotal] = useState(0);
  const [isLoadingTibCatalog, setIsLoadingTibCatalog] = useState(false);
  const [tibCatalogPage, setTibCatalogPage] = useState(1);
  const tibCatalogAbortRef = React.useRef<AbortController | null>(null);
  const tibCatalogLastSearchRef = React.useRef<string>('');

  // Sincronización masiva de inventario
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  // Paginación estilo TIB (50 filas por página)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const showToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ id: Date.now(), type, message });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 5500);
  }, []);

  const handleToggleKeywordsPopover = useCallback((clientId: string, anchorEl: HTMLElement) => {
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
  }, [openKeywordsClientId]);

  // Cargar lista de clientes registrados en el portal
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

  useEffect(() => {
    document.documentElement.classList.add('amex-client-portal');
    document.body.classList.add('amex-client-portal');
    document.documentElement.style.overflowY = 'auto';
    document.body.style.overflowY = 'auto';
    document.body.style.height = 'auto';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedPhoto(null);
        setOpeningPhotoIndex(null);
        setPhotoOpenError(null);
        setFallbackPhotoUrl(null);
        setUserMenuOpen(false);
        setIsConsignatarioFilterOpen(false);
        setIsAddClientOpen(false);
        setEditingClient(null);
        setClientToDeactivate(null);
        setClientToReset(null);
        setOpenKeywordsClientId(null);
        setKeywordsPopoverStyle(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('tab');
      if (p === 'configuracion') {
        setActiveTab('configuracion');
        fetchClientsList();
      } else if (p === 'analiticas') {
        setActiveTab('analiticas');
      }
    }

    return () => {
      document.documentElement.classList.remove('amex-client-portal');
      document.body.classList.remove('amex-client-portal');
      document.documentElement.style.overflowY = '';
      document.body.style.overflowY = '';
      document.body.style.height = '';
      window.removeEventListener('keydown', handleKeyDown);
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, [fetchClientsList]);

  // Cargar conteo total absoluto del sistema (sin filtros) vía servidor optimizado
  const fetchTotalSystemCount = useCallback(async (email?: string | null) => {
    if (!email) return;
    try {
      const res = await authFetch('/api/paquetes-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, onlySystemCount: true }),
      }).catch(() => null);
      if (res && res.ok) {
        const json = await res.json().catch(() => null);
        if (typeof json?.systemCount === 'number') {
          setTotalSystemCount(json.systemCount);
        }
      }
    } catch (e) {
      console.warn('Error fetching total system count:', e);
    }
  }, []);

  const latestFiltersRef = React.useRef({
    wr: filterWr,
    tracking: filterTracking,
    consignatario: filterConsignatario,
    tipo: filterTipo,
    estado: filterEstado,
    fechaTipo: filterFechaTipo,
    fechaDesde: filterFechaDesde,
    fechaHasta: filterFechaHasta,
    pesoMin: filterPesoMin,
    pesoMax: filterPesoMax,
  });

  useEffect(() => {
    latestFiltersRef.current = {
      wr: filterWr,
      tracking: filterTracking,
      consignatario: filterConsignatario,
      tipo: filterTipo,
      estado: filterEstado,
      fechaTipo: filterFechaTipo,
      fechaDesde: filterFechaDesde,
      fechaHasta: filterFechaHasta,
      pesoMin: filterPesoMin,
      pesoMax: filterPesoMax,
    };
  }, [filterWr, filterTracking, filterConsignatario, filterTipo, filterEstado, filterFechaTipo, filterFechaDesde, filterFechaHasta, filterPesoMin, filterPesoMax]);

  const fetchPaquetes = useCallback(async (
    email?: string | null,
    page: number = 1,
    customFilters?: {
      wr?: string;
      tracking?: string;
      consignatario?: string;
      tipo?: string;
      estado?: string;
      fechaTipo?: 'creado_en' | 'actualizado_en';
      fechaDesde?: string;
      fechaHasta?: string;
      pesoMin?: string;
      pesoMax?: string;
    }
  ) => {
    if (!email) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setFetchError(null);
    if (!hasInitialDataLoaded.current) {
      setIsLoading(true);
    } else {
      setIsSearching(true);
    }

    try {
      const current = latestFiltersRef.current;
      const activeWr = customFilters?.wr !== undefined ? customFilters.wr : current.wr;
      const activeTracking = customFilters?.tracking !== undefined ? customFilters.tracking : current.tracking;
      const activeConsignatario = customFilters?.consignatario !== undefined ? customFilters.consignatario : current.consignatario;
      const activeTipo = customFilters?.tipo !== undefined ? customFilters.tipo : current.tipo;
      const activeEstado = customFilters?.estado !== undefined ? customFilters.estado : current.estado;
      const activeFechaTipo = customFilters?.fechaTipo !== undefined ? customFilters.fechaTipo : current.fechaTipo;
      const activeFechaDesde = customFilters?.fechaDesde !== undefined ? customFilters.fechaDesde : current.fechaDesde;
      const activeFechaHasta = customFilters?.fechaHasta !== undefined ? customFilters.fechaHasta : current.fechaHasta;
      const activePesoMin = customFilters?.pesoMin !== undefined ? customFilters.pesoMin : current.pesoMin;
      const activePesoMax = customFilters?.pesoMax !== undefined ? customFilters.pesoMax : current.pesoMax;

      const res = await authFetch('/api/paquetes-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          email,
          page,
          itemsPerPage,
          filters: {
            wr: activeWr,
            tracking: activeTracking,
            consignatario: activeConsignatario,
            tipo: activeTipo,
            estado: activeEstado,
            fechaTipo: activeFechaTipo,
            fechaDesde: activeFechaDesde,
            fechaHasta: activeFechaHasta,
            pesoMin: activePesoMin,
            pesoMax: activePesoMax,
          },
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || 'Error al consultar paquetes');
      }

      const data = json.paquetes || [];
      setPaquetes(data);
      setFetchError(null);
      hasInitialDataLoaded.current = true;

      const countNum = json.count ?? data.length;
      setTotalFilteredCount(countNum);

      const hasFilters = Boolean(
        activeWr.trim() ||
        activeTracking.trim() ||
        activeConsignatario.trim() ||
        activeTipo.trim() ||
        activeEstado.trim() ||
        activeFechaDesde.trim() ||
        activeFechaHasta.trim() ||
        activePesoMin.trim() ||
        activePesoMax.trim()
      );
      if (!hasFilters) {
        setTotalSystemCount(countNum);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      console.error('Error fetching paquetes cliente:', err?.message || err);
      setFetchError(err?.message || 'No se pudieron cargar los paquetes. Verifica tu conexión e intenta nuevamente.');
    } finally {
      if (abortControllerRef.current === controller) {
        setIsLoading(false);
        setIsSearching(false);
        setIsRefreshing(false);
      }
    }
  }, [itemsPerPage]);

  // Cargar opciones para el Selector Desplegable Inteligente de Consignatario
  useEffect(() => {
    if (!isConsignatarioFilterOpen || !user?.email) return;
    let cancelled = false;
    setIsLoadingConsignatarioOptions(true);

    const timer = setTimeout(async () => {
      try {
        const res = await authFetch(
          `/api/listado-amex?email=${encodeURIComponent(user.email)}&search=${encodeURIComponent(consignatarioSearchTerm.trim())}&limit=40`
        );
        const json = await res.json();
        if (!cancelled && res.ok) {
          setConsignatarioOptions(json.clientes || []);
          setConsignatarioOptionsTotal(json.total || 0);
        }
      } catch (err) {
        console.warn('Error al cargar opciones de consignatarios:', err);
      } finally {
        if (!cancelled) setIsLoadingConsignatarioOptions(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isConsignatarioFilterOpen, consignatarioSearchTerm, user?.email]);

  useEffect(() => {
    if (!isConsignatarioFilterOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (consignatarioDropdownRef.current && !consignatarioDropdownRef.current.contains(e.target as Node)) {
        setIsConsignatarioFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isConsignatarioFilterOpen]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

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

  const isInitialFilterMount = React.useRef(true);
  useEffect(() => {
    let isMounted = true;

    try {
      const storedToken = typeof window !== 'undefined' ? localStorage.getItem('amex-portal-cliente-token') : null;
      if (!storedToken) {
        setIsAuthChecking(true);
        router.replace('/login');
        return;
      }
    } catch {
      // Ignorar si localStorage no está accesible
    }

    async function loadSession() {
      const { data: { session } } = await supabasePortal.auth.getSession();
      if (!isMounted) return;
      if (!session) {
        setIsAuthChecking(true);
        router.replace('/login');
        return;
      }
      setUser(session.user);
      setIsAuthChecking(false);
      fetchTotalSystemCount(session.user.email);
      fetchPaquetes(session.user.email, 1);
      if (isSuperadminEmail(session.user.email)) {
        fetchClientsList();
      }
    }
    loadSession();

    const { data: { subscription } } = supabasePortal.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        setIsAuthChecking(true);
        router.replace('/login');
      } else if (event === 'SIGNED_IN') {
        setIsAuthChecking(false);
        setUser((prev: any) => {
          if (!prev || prev.id !== session.user.id) {
            fetchTotalSystemCount(session.user.email);
            fetchPaquetes(session.user.email, 1);
            if (isSuperadminEmail(session.user.email)) {
              fetchClientsList();
            }
          }
          return session.user;
        });
      } else if (event === 'TOKEN_REFRESHED') {
        setUser(session.user);
        setIsAuthChecking(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [router, fetchPaquetes, fetchTotalSystemCount, fetchClientsList]);

  const closePhotoModal = useCallback(() => {
    setSelectedPhoto(null);
    setOpeningPhotoIndex(null);
    setPhotoOpenError(null);
    setFallbackPhotoUrl(null);
  }, []);

  const handleOpenOriginalPhoto = useCallback(async (wr: string, photoIndex: number) => {
    setPhotoOpenError(null);
    setFallbackPhotoUrl(null);
    setOpeningPhotoIndex(photoIndex);
    const popup = window.open('', '_blank');
    if (popup) {
      try {
        popup.document.title = `Cargando foto ${wr} — AMEX Courier`;
        popup.document.body.innerHTML =
          '<div style="font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#f8fafc;min-height:100dvh;display:flex;align-items:center;justify-content:center;margin:0;padding:24px;text-align:center;"><div><p style="font-size:16px;font-weight:700;margin:0 0 6px;">Cargando foto original...</p><p style="font-size:13px;color:#94a3b8;margin:0;">Un momento por favor</p></div></div>';
      } catch {
        // Ignorar si un WebView bloquea acceso al documento en blanco
      }
    }

    try {
      const { data: { session } } = await supabasePortal.auth.getSession();
      if (!session?.access_token) {
        popup?.close();
        setPhotoOpenError('Tu sesión expiró. Recarga la página para ver la foto.');
        return;
      }

      const res = await authFetch('/api/foto/sign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ wr, index: photoIndex }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.url) {
        popup?.close();
        setPhotoOpenError(json?.error || 'No se pudo abrir la foto en tamaño original.');
        return;
      }

      if (popup) {
        if (!popup.closed) {
          popup.opener = null;
          popup.location.href = json.url;
        } else {
          setFallbackPhotoUrl({ url: json.url, label: 'Abrir foto en tamaño original' });
        }
      } else {
        const opened = window.open(json.url, '_blank', 'noopener,noreferrer');
        if (!opened) {
          setFallbackPhotoUrl({ url: json.url, label: 'Abrir foto en tamaño original' });
          setPhotoOpenError('Tu navegador bloqueó la pestaña emergente. Toca el enlace directo de abajo:');
        }
      }
    } catch {
      popup?.close();
      setPhotoOpenError('Error de conexión al abrir la foto en tamaño original.');
    } finally {
      setOpeningPhotoIndex(null);
    }
  }, []);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetchTotalSystemCount(user?.email);
    fetchPaquetes(user?.email, currentPage);
    if (isSuperadminEmail(user?.email)) {
      fetchClientsList();
    }
  };

  useEffect(() => {
    if (!user?.email) return;
    if (isInitialFilterMount.current) {
      isInitialFilterMount.current = false;
      return;
    }

    const wrTrimmed = filterWr.trim();
    const trkTrimmed = filterTracking.trim();
    const prevWr = lastSearchedTextRef.current.wr;
    const prevTrk = lastSearchedTextRef.current.tracking;

    const textChanged = wrTrimmed !== prevWr || trkTrimmed !== prevTrk;

    if (textChanged) {
      const hasShortIncompleteText =
        (wrTrimmed.length > 0 && wrTrimmed.length < 4) ||
        (trkTrimmed.length > 0 && trkTrimmed.length < 4);

      if (hasShortIncompleteText) {
        return;
      }

      const delay = (wrTrimmed.length >= 4 || trkTrimmed.length >= 4) ? 800 : 300;
      const timer = setTimeout(() => {
        lastSearchedTextRef.current = { wr: wrTrimmed, tracking: trkTrimmed };
        fetchPaquetes(user.email, currentPage);
      }, delay);

      return () => clearTimeout(timer);
    }

    const dropdownTimer = setTimeout(() => {
      fetchPaquetes(user.email, currentPage);
    }, 200);

    return () => clearTimeout(dropdownTimer);
  }, [
    user?.email,
    currentPage,
    filterWr,
    filterTracking,
    filterConsignatario,
    filterTipo,
    filterEstado,
    filterFechaTipo,
    filterFechaDesde,
    filterFechaHasta,
    filterPesoMin,
    filterPesoMax,
    fetchPaquetes,
  ]);

  const handleLogout = async () => {
    await supabasePortal.auth.signOut();
    router.push('/login');
  };

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

      showToast('success', `Sincronización TIB completa: ${data.sincronizados} paquetes asignados a sus clientes con coincidencia exacta.`);
      fetchPaquetes(user.email);
    } catch (err: any) {
      showToast('error', `Error en sincronización: ${err.message}`);
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleCreateClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingClient(true);
    setCreateClientError(null);
    setCreateClientSuccess(null);

    try {
      const keywordsArray = newClientKeywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);

      const res = await authFetch('/api/crear-usuario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_completo: newClientNombre,
          email: newClientEmail,
          alias_palabras_clave: keywordsArray,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al crear el usuario cliente');
      }

      setCreateClientSuccess(
        data.mensaje ||
          `¡Cliente ${data.user.nombre_completo} registrado con éxito! Se vincularon ${data.paquetes_vinculados} paquetes y se envió el correo de activación.`
      );

      setNewClientNombre('');
      setNewClientEmail('');
      setNewClientKeywords('');

      fetchClientsList();
      if (user?.email) {
        fetchPaquetes(user.email);
      }
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
      const msg = data.message || `Correo enviado exitosamente a ${clientEmail} con el enlace seguro para restablecer su contraseña.`;
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

  const handleUpdateClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    setIsUpdatingClient(true);
    setEditClientError(null);
    setEditClientSuccess(null);

    try {
      const keywordsArray = editKeywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);

      const res = await authFetch('/api/actualizar-usuario', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingClient.id,
          nombre_completo: editNombre,
          alias_palabras_clave: keywordsArray,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al actualizar el usuario cliente');
      }

      setEditClientSuccess(
        data.message || `¡Cliente ${data.client?.nombre_completo || ''} actualizado con éxito! Se vincularon ${data.paquetes_vinculados} paquetes de TIB.`
      );

      fetchClientsList();
      if (user?.email) {
        fetchPaquetes(user.email);
      }
    } catch (err: any) {
      setEditClientError(err.message || 'Error al actualizar cliente');
    } finally {
      setIsUpdatingClient(false);
    }
  };

  const searchTibClients = useCallback(async (query: string) => {
    setIsSearchingTib(true);
    try {
      const res = await authFetch(`/api/listado-amex?search=${encodeURIComponent(query.trim())}&limit=8`);
      const json = await res.json();
      if (res.ok && Array.isArray(json.clientes)) {
        setTibSearchResults(json.clientes);
        setIsTibDropdownOpen(true);
      }
    } catch (err) {
      console.warn('Error al buscar consignatarios TIB:', err);
    } finally {
      setIsSearchingTib(false);
    }
  }, []);

  const handleAddTibKeyword = (client: any) => {
    const raw = String(client.nombre || '').trim();
    const existing = newClientKeywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    if (existing.length > 0) {
      const lastTerm = existing[existing.length - 1];
      if (raw.toLowerCase().includes(lastTerm.toLowerCase())) {
        existing.pop();
      }
    }

    if (!existing.includes(raw)) {
      existing.push(raw);
    }

    setNewClientKeywords(existing.join(', '));
    setIsTibDropdownOpen(false);

    if (!newClientNombre.trim()) {
      setNewClientNombre(raw);
    }

    if (client.email && !newClientEmail.trim()) {
      setNewClientEmail(client.email);
    }
  };

  const handleSelectTibClient = (client: any) => {
    const raw = String(client.nombre || '').trim();
    setNewClientNombre(raw);
    setNewClientKeywords(raw);
    setIsTibDropdownOpen(false);
    if (client.email && !newClientEmail.trim()) {
      setNewClientEmail(client.email);
    }
  };

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
    if (!(activeTab === 'configuracion' && isSuperadmin && configSubTab === 'tib')) {
      return;
    }
    const searchChanged = tibCatalogLastSearchRef.current !== tibCatalogSearch;
    const delay = searchChanged ? 280 : 0;

    const timer = setTimeout(() => {
      tibCatalogLastSearchRef.current = tibCatalogSearch;
      fetchTibCatalog(tibCatalogSearch, tibCatalogPage);
    }, delay);

    return () => clearTimeout(timer);
  }, [activeTab, isSuperadmin, configSubTab, tibCatalogSearch, tibCatalogPage, fetchTibCatalog]);

  const filteredClientsList = useMemo(() => {
    if (!clientSearchQuery.trim()) return clientsList;
    const q = clientSearchQuery.toLowerCase().trim();
    return clientsList.filter((c) =>
      c.nombre_completo.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (Array.isArray(c.alias_palabras_clave) &&
        c.alias_palabras_clave.some((k) => k.toLowerCase().includes(q)))
    );
  }, [clientsList, clientSearchQuery]);

  const activeKeywordsClient = useMemo(
    () => (openKeywordsClientId ? clientsList.find((c) => c.id === openKeywordsClientId) || null : null),
    [openKeywordsClientId, clientsList]
  );

  const applyDatePreset = (preset: string) => {
    setDatePreset(preset);
    const now = new Date();

    if (preset === 'all') {
      setFilterFechaDesde('');
      setFilterFechaHasta('');
      return;
    }
    if (preset === 'today') {
      const todayStr = formatDateForInput(now);
      setFilterFechaDesde(todayStr);
      setFilterFechaHasta(todayStr);
      return;
    }
    if (preset === 'yesterday') {
      const yest = new Date(now);
      yest.setDate(yest.getDate() - 1);
      const yestStr = formatDateForInput(yest);
      setFilterFechaDesde(yestStr);
      setFilterFechaHasta(yestStr);
      return;
    }
    if (preset === '7days') {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      setFilterFechaDesde(formatDateForInput(start));
      setFilterFechaHasta(formatDateForInput(now));
      return;
    }
    if (preset === '30days') {
      const start = new Date(now);
      start.setDate(start.getDate() - 29);
      setFilterFechaDesde(formatDateForInput(start));
      setFilterFechaHasta(formatDateForInput(now));
      return;
    }
    if (preset === 'thisMonth') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setFilterFechaDesde(formatDateForInput(start));
      setFilterFechaHasta(formatDateForInput(now));
      return;
    }
    if (preset === 'lastMonth') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      setFilterFechaDesde(formatDateForInput(start));
      setFilterFechaHasta(formatDateForInput(end));
      return;
    }
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterWr.trim()) count++;
    if (filterTracking.trim()) count++;
    if (filterConsignatario.trim()) count++;
    if (filterTipo.trim()) count++;
    if (filterEstado.trim()) count++;
    if (filterFechaDesde.trim() || filterFechaHasta.trim()) count++;
    if (filterPesoMin.trim() || filterPesoMax.trim()) count++;
    return count;
  }, [filterWr, filterTracking, filterConsignatario, filterTipo, filterEstado, filterFechaDesde, filterFechaHasta, filterPesoMin, filterPesoMax]);

  const advancedFiltersCount = useMemo(() => {
    let count = 0;
    if (filterFechaDesde.trim() || filterFechaHasta.trim()) count++;
    if (filterPesoMin.trim() || filterPesoMax.trim()) count++;
    return count;
  }, [filterFechaDesde, filterFechaHasta, filterPesoMin, filterPesoMax]);

  const handleClearFilters = () => {
    setFilterWr('');
    setFilterTracking('');
    setFilterConsignatario('');
    setConsignatarioSearchTerm('');
    setIsConsignatarioFilterOpen(false);
    setFilterTipo('');
    setFilterEstado('');
    setFilterFechaDesde('');
    setFilterFechaHasta('');
    setFilterPesoMin('');
    setFilterPesoMax('');
    setDatePreset('all');
    setCurrentPage(1);
    fetchPaquetes(user?.email, 1, {
      wr: '',
      tracking: '',
      consignatario: '',
      tipo: '',
      estado: '',
      fechaDesde: '',
      fechaHasta: '',
      pesoMin: '',
      pesoMax: '',
    });
  };

  const handleSearchClick = () => {
    setCurrentPage(1);
    lastSearchedTextRef.current = { wr: filterWr.trim(), tracking: filterTracking.trim() };
    fetchPaquetes(user?.email, 1);

    const queryTerms = [filterWr, filterTracking, filterConsignatario].filter(Boolean).join(' | ');
    if (queryTerms || filterEstado || filterTipo) {
      trackPortalEvent({
        usuario_email: user?.email,
        tipo_evento: 'BUSQUEDA_INVENTARIO',
        detalles: {
          wr: filterWr.trim() || undefined,
          tracking: filterTracking.trim() || undefined,
          consignatario: filterConsignatario.trim() || undefined,
          estado: filterEstado.trim() || undefined,
          query: queryTerms,
        },
      });
    }
  };

  const totalPages = Math.ceil(totalFilteredCount / itemsPerPage) || 1;

  const paginationPages = useMemo(() => {
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const half = Math.floor(maxVisible / 2);
    let start = currentPage - half;
    let end = currentPage + half;

    if (start < 1) {
      start = 1;
      end = maxVisible;
    } else if (end > totalPages) {
      end = totalPages;
      start = totalPages - maxVisible + 1;
    }

    const pages: number[] = [];
    for (let p = start; p <= end; p++) {
      pages.push(p);
    }
    return pages;
  }, [currentPage, totalPages]);

  const handleSelectTab = (tab: 'warehouse' | 'configuracion' | 'analiticas') => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `/?tab=${tab}`);
    }
    setUserMenuOpen(false);
    if (tab === 'configuracion') {
      fetchClientsList();
    }
  };

  if (isAuthChecking || !user) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          backgroundColor: '#111827',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/logo-amex-clean.png"
          alt="AMEX Courier"
          style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
        />
        <div
          style={{
            width: '28px',
            height: '28px',
            border: '3px solid #ff5722',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="amex-client-portal w-full flex-1 flex flex-col"
      data-portal="client"
      data-lenis-prevent
      style={{
        minHeight: '100dvh',
        backgroundColor: '#f1f3f6',
        color: '#2c323f',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <PortalHeader
        user={user}
        isSuperadmin={isSuperadmin}
        activeTab={activeTab}
        userMenuOpen={userMenuOpen}
        setUserMenuOpen={setUserMenuOpen}
        userMenuRef={userMenuRef}
        onSelectTab={handleSelectTab}
        onLogout={handleLogout}
      />

      <main className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8 xl:px-10" style={{ maxWidth: '1400px', width: '100%', margin: '0 auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {activeTab === 'warehouse' ? (
          <WarehouseView
            userEmail={user?.email}
            isSuperadmin={isSuperadmin}
            paquetes={paquetes}
            totalSystemCount={totalSystemCount}
            totalFilteredCount={totalFilteredCount}
            isLoading={isLoading}
            isSearching={isSearching}
            isRefreshing={isRefreshing}
            fetchError={fetchError}
            currentPage={currentPage}
            totalPages={totalPages}
            paginationPages={paginationPages}
            setCurrentPage={setCurrentPage}
            filterWr={filterWr}
            setFilterWr={setFilterWr}
            filterTracking={filterTracking}
            setFilterTracking={setFilterTracking}
            filterConsignatario={filterConsignatario}
            setFilterConsignatario={setFilterConsignatario}
            filterTipo={filterTipo}
            setFilterTipo={setFilterTipo}
            filterEstado={filterEstado}
            setFilterEstado={setFilterEstado}
            isConsignatarioFilterOpen={isConsignatarioFilterOpen}
            setIsConsignatarioFilterOpen={setIsConsignatarioFilterOpen}
            consignatarioSearchTerm={consignatarioSearchTerm}
            setConsignatarioSearchTerm={setConsignatarioSearchTerm}
            consignatarioOptions={consignatarioOptions}
            consignatarioOptionsTotal={consignatarioOptionsTotal}
            isLoadingConsignatarioOptions={isLoadingConsignatarioOptions}
            consignatarioDropdownRef={consignatarioDropdownRef}
            showAdvancedFilters={showAdvancedFilters}
            setShowAdvancedFilters={setShowAdvancedFilters}
            filterFechaTipo={filterFechaTipo}
            setFilterFechaTipo={setFilterFechaTipo}
            filterFechaDesde={filterFechaDesde}
            setFilterFechaDesde={setFilterFechaDesde}
            filterFechaHasta={filterFechaHasta}
            setFilterFechaHasta={setFilterFechaHasta}
            filterPesoMin={filterPesoMin}
            setFilterPesoMin={setFilterPesoMin}
            filterPesoMax={filterPesoMax}
            setFilterPesoMax={setFilterPesoMax}
            datePreset={datePreset}
            setDatePreset={setDatePreset}
            activeFiltersCount={activeFiltersCount}
            advancedFiltersCount={advancedFiltersCount}
            applyDatePreset={applyDatePreset}
            handleManualRefresh={handleManualRefresh}
            handleSearchClick={handleSearchClick}
            handleClearFilters={handleClearFilters}
            onRetryFetch={() => fetchPaquetes(user?.email, currentPage)}
            onSelectPhoto={(photo) => {
              setPhotoOpenError(null);
              setFallbackPhotoUrl(null);
              setOpeningPhotoIndex(null);
              setSelectedPhoto(photo);
            }}
            onShowErrorToast={(msg) => showToast('error', msg)}
          />
        ) : activeTab === 'configuracion' ? (
          <AdminConfigView
            clientsList={clientsList}
            filteredClientsList={filteredClientsList}
            isLoadingClients={isLoadingClients}
            totalSystemCount={totalSystemCount}
            totalFilteredCount={totalFilteredCount}
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
            onSelectTab={handleSelectTab}
            onSyncAllFromTib={handleSyncAllFromTib}
            onOpenAddClientModal={() => {
              setNewClientNombre('');
              setNewClientEmail('');
              setNewClientKeywords('');
              setCreateClientSuccess(null);
              setCreateClientError(null);
              setIsAddClientOpen(true);
            }}
            onToggleKeywordsPopover={handleToggleKeywordsPopover}
            onRequestResetPassword={(c) => setClientToReset(c)}
            onToggleClientActive={handleToggleClientActive}
            onRequestDeactivateClient={(c) => setClientToDeactivate(c)}
            onAssignTibClientToPortal={(client) => {
              handleSelectTibClient(client);
              setCreateClientSuccess(null);
              setCreateClientError(null);
              setIsAddClientOpen(true);
            }}
          />
        ) : (
          <AnalyticsDashboard
            adminEmail={user?.email || ''}
            onBackToWarehouse={() => handleSelectTab('warehouse')}
          />
        )}
      </main>

      <PhotoLightboxModal
        selectedPhoto={selectedPhoto}
        openingPhotoIndex={openingPhotoIndex}
        photoOpenError={photoOpenError}
        fallbackPhotoUrl={fallbackPhotoUrl}
        onClose={closePhotoModal}
        onOpenOriginalPhoto={handleOpenOriginalPhoto}
      />

      <AdminClientModals
        isAddClientOpen={isAddClientOpen}
        setIsAddClientOpen={setIsAddClientOpen}
        newClientNombre={newClientNombre}
        setNewClientNombre={setNewClientNombre}
        newClientEmail={newClientEmail}
        setNewClientEmail={setNewClientEmail}
        newClientKeywords={newClientKeywords}
        setNewClientKeywords={setNewClientKeywords}
        isCreatingClient={isCreatingClient}
        createClientSuccess={createClientSuccess}
        createClientError={createClientError}
        handleCreateClientSubmit={handleCreateClientSubmit}
        tibSearchResults={tibSearchResults}
        isSearchingTib={isSearchingTib}
        isTibDropdownOpen={isTibDropdownOpen}
        setIsTibDropdownOpen={setIsTibDropdownOpen}
        searchTibClients={searchTibClients}
        handleAddTibKeyword={handleAddTibKeyword}
        editingClient={editingClient}
        setEditingClient={setEditingClient}
        editNombre={editNombre}
        setEditNombre={setEditNombre}
        editKeywords={editKeywords}
        setEditKeywords={setEditKeywords}
        isUpdatingClient={isUpdatingClient}
        editClientSuccess={editClientSuccess}
        editClientError={editClientError}
        handleUpdateClientSubmit={handleUpdateClientSubmit}
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

      {/* Notificación Flotante (Toast) */}
      {toast && (
        <div
          key={toast.id}
          role={toast.type === 'error' ? 'alert' : 'status'}
          style={{
            position: 'fixed',
            bottom: 'calc(16px + env(safe-area-inset-bottom))',
            right: '16px',
            zIndex: 130,
            maxWidth: 'min(420px, calc(100vw - 32px))',
            backgroundColor: toast.type === 'success' ? '#ecfdf5' : toast.type === 'error' ? '#fef2f2' : '#eff6ff',
            border: `1px solid ${toast.type === 'success' ? '#a7f3d0' : toast.type === 'error' ? '#fecaca' : '#bfdbfe'}`,
            color: toast.type === 'success' ? '#065f46' : toast.type === 'error' ? '#991b1b' : '#1e40af',
            borderRadius: '10px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 4px 10px -4px rgba(0, 0, 0, 0.1)',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            fontSize: '13px',
            lineHeight: 1.4,
          }}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 style={{ width: '18px', height: '18px', color: '#16a34a', flexShrink: 0, marginTop: '1px' }} aria-hidden="true" />
          ) : (
            <AlertCircle style={{ width: '18px', height: '18px', color: toast.type === 'error' ? '#dc2626' : '#2563eb', flexShrink: 0, marginTop: '1px' }} aria-hidden="true" />
          )}
          <span style={{ flex: 1, fontWeight: 600 }}>{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Cerrar notificación"
            style={{
              background: 'none',
              border: 'none',
              padding: '2px',
              color: 'inherit',
              opacity: 0.7,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <X style={{ width: '14px', height: '14px' }} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Footer minimalista */}
      <footer style={{ borderTop: '1px solid #e5e7eb', backgroundColor: '#ffffff', padding: '14px 20px max(14px, env(safe-area-inset-bottom)) 20px', textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>
        © {new Date().getFullYear()} AMEX COURIER PERÚ — Todos los derechos reservados.
      </footer>
    </div>
  );
}
