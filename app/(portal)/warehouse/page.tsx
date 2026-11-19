'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { supabasePortal } from '@/lib/supabase/portal-client';
import { authFetch } from '@/lib/portal/authFetch';
import { trackPortalEvent } from '@/lib/analytics/tracker';
import { usePortalSession } from '@/components/portal/PortalShell';
import WarehouseView from '@/components/warehouse/WarehouseView';
import { formatDateForInput, PaqueteTIB } from '@/lib/portal/types';

const PhotoLightboxModal = dynamic(() => import('@/components/warehouse/PhotoLightboxModal'), {
  ssr: false,
});

const WAREHOUSE_STORAGE_KEY = 'amex_warehouse_state_v1';

interface SavedWarehouseState {
  currentPage?: number;
  filterWr?: string;
  filterTracking?: string;
  filterConsignatario?: string;
  filterTipo?: string;
  filterEstado?: string;
  filterFechaTipo?: 'creado_en' | 'actualizado_en';
  filterFechaDesde?: string;
  filterFechaHasta?: string;
  filterPesoMin?: string;
  filterPesoMax?: string;
  datePreset?: string;
  showAdvancedFilters?: boolean;
}

function readSavedWarehouseState(): SavedWarehouseState {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(WAREHOUSE_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

export default function WarehousePage() {
  const {
    user,
    isSuperadmin,
    isInternalStaff,
    canExportExcel,
    totalSystemCount,
    setTotalSystemCount,
    showToast,
  } = usePortalSession();

  const initialSaved = useMemo(() => readSavedWarehouseState(), []);

  const [paquetes, setPaquetes] = useState<PaqueteTIB[]>([]);
  const [totalFilteredCount, setTotalFilteredCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const hasInitialDataLoaded = useRef(false);
  const lastSearchedTextRef = useRef({
    wr: (initialSaved.filterWr || '').trim(),
    tracking: (initialSaved.filterTracking || '').trim(),
  });

  // Filtros individuales estilo TIB
  const [filterWr, setFilterWr] = useState(initialSaved.filterWr || '');
  const [filterTracking, setFilterTracking] = useState(initialSaved.filterTracking || '');
  const [filterConsignatario, setFilterConsignatario] = useState(initialSaved.filterConsignatario || '');
  const [filterTipo, setFilterTipo] = useState(initialSaved.filterTipo || '');
  const [filterEstado, setFilterEstado] = useState(initialSaved.filterEstado || '');

  // Selector Desplegable Inteligente de Consignatario
  const [isConsignatarioFilterOpen, setIsConsignatarioFilterOpen] = useState(false);
  const [consignatarioSearchTerm, setConsignatarioSearchTerm] = useState('');
  const [consignatarioOptions, setConsignatarioOptions] = useState<any[]>([]);
  const [consignatarioOptionsTotal, setConsignatarioOptionsTotal] = useState(0);
  const [isLoadingConsignatarioOptions, setIsLoadingConsignatarioOptions] = useState(false);
  const consignatarioDropdownRef = useRef<HTMLDivElement>(null);

  // Filtros avanzados, rangos y fechas profesionales
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(Boolean(initialSaved.showAdvancedFilters));
  const [filterFechaTipo, setFilterFechaTipo] = useState<'creado_en' | 'actualizado_en'>(
    initialSaved.filterFechaTipo === 'actualizado_en' ? 'actualizado_en' : 'creado_en'
  );
  const [filterFechaDesde, setFilterFechaDesde] = useState(initialSaved.filterFechaDesde || '');
  const [filterFechaHasta, setFilterFechaHasta] = useState(initialSaved.filterFechaHasta || '');
  const [filterPesoMin, setFilterPesoMin] = useState(initialSaved.filterPesoMin || '');
  const [filterPesoMax, setFilterPesoMax] = useState(initialSaved.filterPesoMax || '');
  const [datePreset, setDatePreset] = useState<string>(initialSaved.datePreset || 'all');

  // Paginación estilo TIB (50 filas por página)
  const [currentPage, setCurrentPage] = useState<number>(
    initialSaved.currentPage && initialSaved.currentPage > 0 ? initialSaved.currentPage : 1
  );
  const itemsPerPage = 50;

  // Modal para ver foto
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; wr: string } | null>(null);
  const [openingPhotoIndex, setOpeningPhotoIndex] = useState<number | null>(null);
  const [photoOpenError, setPhotoOpenError] = useState<string | null>(null);
  const [fallbackPhotoUrl, setFallbackPhotoUrl] = useState<{ url: string; label: string } | null>(null);

  // Guardar estado de filtros y página actual en sessionStorage de la pestaña
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const payload: SavedWarehouseState = {
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
        datePreset,
        showAdvancedFilters,
      };
      sessionStorage.setItem(WAREHOUSE_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignorar si sessionStorage no está disponible
    }
  }, [
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
    datePreset,
    showAdvancedFilters,
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedPhoto(null);
        setOpeningPhotoIndex(null);
        setPhotoOpenError(null);
        setFallbackPhotoUrl(null);
        setIsConsignatarioFilterOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
  }, [setTotalSystemCount]);

  const latestFiltersRef = useRef({
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
  }, [
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
  ]);

  const fetchPaquetes = useCallback(
    async (
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
        setFetchError(
          err?.message || 'No se pudieron cargar los paquetes. Verifica tu conexión e intenta nuevamente.'
        );
      } finally {
        if (abortControllerRef.current === controller) {
          setIsLoading(false);
          setIsSearching(false);
          setIsRefreshing(false);
        }
      }
    },
    [itemsPerPage, setTotalSystemCount]
  );

  // Carga inicial al entrar a "/warehouse"
  const initialLoadedRef = useRef(false);
  useEffect(() => {
    if (!user?.email) return;
    if (initialLoadedRef.current) return;
    initialLoadedRef.current = true;

    const cur = latestFiltersRef.current;
    const hasRestoredFilters = Boolean(
      cur.wr.trim() ||
        cur.tracking.trim() ||
        cur.consignatario.trim() ||
        cur.tipo.trim() ||
        cur.estado.trim() ||
        cur.fechaDesde.trim() ||
        cur.fechaHasta.trim() ||
        cur.pesoMin.trim() ||
        cur.pesoMax.trim()
    );
    if (hasRestoredFilters && totalSystemCount === 0) {
      fetchTotalSystemCount(user.email);
    }
    fetchPaquetes(user.email, currentPage);
  }, [user?.email, currentPage, totalSystemCount, fetchPaquetes, fetchTotalSystemCount]);

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

  const isInitialFilterMount = useRef(true);
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

      const delay = wrTrimmed.length >= 4 || trkTrimmed.length >= 4 ? 800 : 300;
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
      const {
        data: { session },
      } = await supabasePortal.auth.getSession();
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
  }, [
    filterWr,
    filterTracking,
    filterConsignatario,
    filterTipo,
    filterEstado,
    filterFechaDesde,
    filterFechaHasta,
    filterPesoMin,
    filterPesoMax,
  ]);

  const advancedFiltersCount = useMemo(() => {
    let count = 0;
    if (filterFechaDesde.trim() || filterFechaHasta.trim()) count++;
    if (filterPesoMin.trim() || filterPesoMax.trim()) count++;
    return count;
  }, [filterFechaDesde, filterFechaHasta, filterPesoMin, filterPesoMax]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    if (activeFiltersCount > 0) {
      fetchTotalSystemCount(user?.email);
    }
    fetchPaquetes(user?.email, currentPage);
  };

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
    lastSearchedTextRef.current = { wr: '', tracking: '' };
    try {
      sessionStorage.removeItem(WAREHOUSE_STORAGE_KEY);
    } catch {
      // Ignorar
    }
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

  return (
    <>
      <WarehouseView
        userEmail={user?.email}
        isSuperadmin={isSuperadmin}
        hasGlobalWarehouseAccess={isSuperadmin || isInternalStaff}
        canExportExcel={canExportExcel}
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

      {selectedPhoto && (
        <PhotoLightboxModal
          selectedPhoto={selectedPhoto}
          openingPhotoIndex={openingPhotoIndex}
          photoOpenError={photoOpenError}
          fallbackPhotoUrl={fallbackPhotoUrl}
          onClose={closePhotoModal}
          onOpenOriginalPhoto={handleOpenOriginalPhoto}
        />
      )}
    </>
  );
}
