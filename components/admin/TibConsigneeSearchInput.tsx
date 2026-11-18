'use client';

import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, AlertCircle, RefreshCw, Check } from 'lucide-react';
import { authFetch } from '@/lib/portal/authFetch';
import { cleanExactString } from '@/lib/portal/keywords';
import { TibCatalogClient } from '@/lib/portal/types';

interface DropdownPosition {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxBodyHeight: number;
  openUp: boolean;
}

export interface TibConsigneeSearchInputProps {
  selectedKeywords: string[];
  assignedConsigneeMap?: Map<string, { email: string; nombre_completo: string }>;
  tibTotalCount?: number;
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onToggleConsignee: (client: TibCatalogClient) => void;
  onTotalCountUpdate?: (total: number) => void;
  disabled?: boolean;
  resetSignal?: number;
}

export default function TibConsigneeSearchInput({
  selectedKeywords,
  assignedConsigneeMap,
  tibTotalCount = 0,
  isOpen,
  setIsOpen,
  onToggleConsignee,
  onTotalCountUpdate,
  disabled = false,
  resetSignal = 0,
}: TibConsigneeSearchInputProps) {
  const listboxId = useId();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TibCatalogClient[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dropdownPos, setDropdownPos] = useState<DropdownPosition | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const idleCacheRef = useRef<{ clientes: TibCatalogClient[]; total: number } | null>(null);

  const updatePosition = useCallback(() => {
    if (!wrapperRef.current || typeof window === 'undefined') return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(Math.max(rect.width, 260), vw - 24);
    const left = Math.max(12, Math.min(rect.left, vw - width - 12));
    const spaceBelow = vh - rect.bottom - 14;
    const spaceAbove = rect.top - 14;
    const openUp = spaceBelow < 245 && spaceAbove > spaceBelow;
    const availableSpace = openUp ? spaceAbove : spaceBelow;
    const maxBodyHeight = Math.max(120, Math.min(265, availableSpace - 44));

    setDropdownPos({
      top: openUp ? undefined : rect.bottom + 6,
      bottom: openUp ? vh - rect.top + 6 : undefined,
      left,
      width,
      maxBodyHeight,
      openUp,
    });
  }, []);

  // Posicionar dropdown respecto al viewport para evitar recortes dentro del modal con scroll
  useLayoutEffect(() => {
    if (!isOpen) {
      setDropdownPos(null);
      return;
    }
    updatePosition();

    let rafId: number | null = null;
    const handleScroll = (e: Event) => {
      if (dropdownRef.current && e.target instanceof Node && dropdownRef.current.contains(e.target)) {
        return;
      }
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => updatePosition());
    };
    const handleResize = () => updatePosition();

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, updatePosition]);

  // Cerrar dropdown al hacer clic fuera tanto del input como del portal flotante
  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapperRef.current?.contains(target) || dropdownRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen, setIsOpen]);

  // Búsqueda debounced con AbortController para evitar condiciones de carrera
  useEffect(() => {
    if (!isOpen) {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      return;
    }

    const cleanQuery = query.trim();
    if (!cleanQuery && idleCacheRef.current && retryToken === 0) {
      setResults(idleCacheRef.current.clientes);
      setTotalMatches(idleCacheRef.current.total);
      setSearchError(null);
      setIsSearching(false);
      setActiveIndex(idleCacheRef.current.clientes.length > 0 ? 0 : -1);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    setSearchError(null);

    const delay = cleanQuery.length > 0 ? 220 : 0;
    const timer = setTimeout(async () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await authFetch(
          `/api/listado-amex?search=${encodeURIComponent(cleanQuery)}&limit=15`,
          { signal: controller.signal }
        );
        const json = await res.json().catch(() => null);
        if (cancelled) return;

        if (!res.ok) {
          throw new Error(json?.error || 'No se pudo consultar el catálogo TIB');
        }

        const list: TibCatalogClient[] = Array.isArray(json?.clientes) ? json.clientes : [];
        const total = typeof json?.total === 'number' ? json.total : list.length;

        setResults(list);
        setTotalMatches(total);
        setSearchError(null);
        setActiveIndex(list.length > 0 ? 0 : -1);

        if (!cleanQuery) {
          idleCacheRef.current = { clientes: list, total };
          if (total > 0 && onTotalCountUpdate) {
            onTotalCountUpdate(total);
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (!cancelled) {
          setSearchError(err instanceof Error ? err.message : 'Error de conexión al buscar');
          setResults([]);
        }
      } finally {
        if (!cancelled && abortRef.current === controller) {
          setIsSearching(false);
        }
      }
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, query, retryToken, onTotalCountUpdate]);

  useEffect(() => {
    if (resetSignal > 0) {
      setQuery('');
      setActiveIndex(-1);
    }
  }, [resetSignal]);

  const handleSelectItem = (client: TibCatalogClient) => {
    const normalized = cleanExactString(client.nombre);
    const alreadySelected = selectedKeywords.some((k) => cleanExactString(k) === normalized);
    onToggleConsignee(client);
    if (!alreadySelected) {
      setQuery('');
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      if (results.length > 0) {
        setActiveIndex((prev) => {
          const next = prev < results.length - 1 ? prev + 1 : 0;
          itemRefs.current[next]?.scrollIntoView({ block: 'nearest' });
          return next;
        });
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      if (results.length > 0) {
        setActiveIndex((prev) => {
          const next = prev > 0 ? prev - 1 : results.length - 1;
          itemRefs.current[next]?.scrollIntoView({ block: 'nearest' });
          return next;
        });
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && results.length > 0) {
        const chosen = results[activeIndex >= 0 && activeIndex < results.length ? activeIndex : 0];
        if (chosen) handleSelectItem(chosen);
      } else if (!isOpen) {
        setIsOpen(true);
      }
    } else if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
      }
    }
  };

  const normalizedSelectedSet = new Set(selectedKeywords.map((k) => cleanExactString(k)));

  const dropdownContent =
    isOpen && dropdownPos && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={dropdownRef}
            id={listboxId}
            role="listbox"
            aria-label="Resultados de consignatarios TIB"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: dropdownPos.top,
              bottom: dropdownPos.bottom,
              left: dropdownPos.left,
              width: dropdownPos.width,
              zIndex: 140,
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              boxShadow: '0 18px 36px -8px rgba(15, 23, 42, 0.25), 0 6px 12px -4px rgba(15, 23, 42, 0.1)',
              overflow: 'hidden',
            }}
          >
            {/* Cabecera del desplegable */}
            <div
              style={{
                padding: '8px 12px',
                backgroundColor: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
              }}
            >
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.35px',
                }}
              >
                {isSearching
                  ? 'Buscando en TIB...'
                  : query.trim()
                    ? totalMatches > results.length
                      ? `Mostrando ${results.length} de ${totalMatches.toLocaleString()} coincidencias`
                      : `${results.length} ${results.length === 1 ? 'sugerencia' : 'sugerencias'}`
                    : `Top consignatarios TIB (${(totalMatches || tibTotalCount).toLocaleString()})`}
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="amex-focus-ring"
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                <span>Cerrar</span>
                <X style={{ width: '12px', height: '12px' }} aria-hidden="true" />
              </button>
            </div>

            {/* Lista scrolleable */}
            <div style={{ maxHeight: `${dropdownPos.maxBodyHeight}px`, overflowY: 'auto' }}>
              {searchError ? (
                <div style={{ padding: '16px 12px', textAlign: 'center', fontSize: '12px', color: '#991b1b' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontWeight: 600 }}>
                    <AlertCircle style={{ width: '15px', height: '15px', color: '#dc2626' }} />
                    <span>{searchError}</span>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => setRetryToken((prev) => prev + 1)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '5px 10px',
                        borderRadius: '6px',
                        border: '1px solid #fecaca',
                        backgroundColor: '#fef2f2',
                        color: '#b91c1c',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <RefreshCw style={{ width: '12px', height: '12px' }} />
                      <span>Reintentar</span>
                    </button>
                  </div>
                </div>
              ) : isSearching && results.length === 0 ? (
                <div style={{ padding: '18px 12px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
                  Buscando consignatarios...
                </div>
              ) : results.length === 0 ? (
                <div style={{ padding: '16px 12px', textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>
                  No se encontraron consignatarios TIB para <strong>&ldquo;{query.trim()}&rdquo;</strong>.
                  <br />
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                    Puedes ingresar una variación manual en el campo de abajo.
                  </span>
                </div>
              ) : (
                results.map((client, idx) => {
                  const normalizedName = cleanExactString(client.nombre);
                  const isAdded = normalizedSelectedSet.has(normalizedName);
                  const existingPortalUser = assignedConsigneeMap?.get(normalizedName);
                  const isHighlighted = activeIndex === idx;

                  return (
                    <button
                      key={client.id}
                      ref={(el) => {
                        itemRefs.current[idx] = el;
                      }}
                      type="button"
                      role="option"
                      aria-selected={isAdded}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => handleSelectItem(client)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        border: 'none',
                        borderBottom: '1px solid #f1f5f9',
                        padding: '10px 12px',
                        cursor: 'pointer',
                        backgroundColor: isAdded
                          ? '#f0fdf4'
                          : isHighlighted
                            ? '#fff7ed'
                            : '#ffffff',
                        transition: 'background-color 0.12s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: '12.5px',
                              fontWeight: 700,
                              color: isAdded ? '#166534' : '#111827',
                              wordBreak: 'break-word',
                            }}
                          >
                            {client.nombre}
                          </span>
                          {existingPortalUser && !isAdded && (
                            <span
                              title={`Consignatario ya vinculado a ${existingPortalUser.email}`}
                              style={{
                                backgroundColor: '#fef3c7',
                                color: '#92400e',
                                border: '1px solid #fde68a',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: 700,
                                maxWidth: '190px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              En portal: {existingPortalUser.email}
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: '11px',
                            color: '#6b7280',
                            display: 'flex',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '6px',
                            marginTop: '2px',
                          }}
                        >
                          <span>ID: #{client.iclient || 'S/ID'}</span>
                          <span>•</span>
                          <span style={{ color: client.recibidos > 0 ? '#ea580c' : '#6b7280', fontWeight: client.recibidos > 0 ? 700 : 400 }}>
                            {client.recibidos || 0} en bodega
                          </span>
                          <span>•</span>
                          <span style={{ color: client.enviados > 0 ? '#2563eb' : '#6b7280', fontWeight: client.enviados > 0 ? 700 : 400 }}>
                            {client.enviados || 0} en vuelo
                          </span>
                        </div>
                      </div>

                      <span
                        style={{
                          backgroundColor: isAdded ? '#dcfce7' : '#ffedd5',
                          color: isAdded ? '#15803d' : '#c2410c',
                          border: `1px solid ${isAdded ? '#bbf7d0' : '#fed7aa'}`,
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 800,
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        {isAdded ? (
                          <>
                            <Check style={{ width: '11px', height: '11px' }} aria-hidden="true" />
                            <span>Agregado</span>
                          </>
                        ) : (
                          <span>+ Agregar ({client.total_paquetes || 0} paq.)</span>
                        )}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        disabled={disabled}
        value={query}
        onFocus={() => setIsOpen(true)}
        onClick={() => {
          if (!isOpen) setIsOpen(true);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!isOpen) setIsOpen(true);
        }}
        onKeyDown={handleInputKeyDown}
        placeholder="Buscar en catálogo TIB (ej: anthony, amex aguilar)..."
        className="amex-input"
        style={{
          width: '100%',
          height: '40px',
          paddingLeft: '36px',
          paddingRight: query ? '36px' : '12px',
          borderRadius: '6px',
          border: isOpen ? '1px solid #ff5722' : '1px solid #d1d5db',
          boxShadow: isOpen ? '0 0 0 3px rgba(255, 87, 34, 0.15)' : 'none',
          fontSize: '13px',
          color: '#111827',
          backgroundColor: disabled ? '#f9fafb' : '#ffffff',
        }}
      />

      {isSearching ? (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '15px',
            height: '15px',
            border: '2px solid #ff5722',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            pointerEvents: 'none',
          }}
        />
      ) : (
        <Search
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '15px',
            height: '15px',
            color: isOpen ? '#ff5722' : '#9ca3af',
            pointerEvents: 'none',
          }}
        />
      )}

      {query && (
        <button
          type="button"
          onClick={() => {
            setQuery('');
            setIsOpen(true);
            inputRef.current?.focus();
          }}
          aria-label="Limpiar búsqueda TIB"
          className="amex-focus-ring"
          style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            padding: '4px',
            color: '#9ca3af',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
          }}
        >
          <X style={{ width: '14px', height: '14px' }} aria-hidden="true" />
        </button>
      )}

      {dropdownContent}
    </div>
  );
}
