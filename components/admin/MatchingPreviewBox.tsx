'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Eye, Package, Users } from 'lucide-react';
import { authFetch } from '@/lib/portal/authFetch';
import type { MatchingPreviewResponse } from '@/lib/portal/types';

export interface MatchingPreviewBoxProps {
  exactConsignees: string[];
  groupKeywords: string[];
  fallbackNombre?: string;
  applyFallbackWhenEmpty?: boolean;
  excludeClientId?: string;
  compact?: boolean;
}

export default function MatchingPreviewBox({
  exactConsignees,
  groupKeywords,
  fallbackNombre = '',
  applyFallbackWhenEmpty = false,
  excludeClientId,
  compact = false,
}: MatchingPreviewBoxProps) {
  const [preview, setPreview] = useState<MatchingPreviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(!compact);
  const abortRef = useRef<AbortController | null>(null);

  const payloadKey = useMemo(
    () =>
      JSON.stringify({
        exactConsignees,
        groupKeywords,
        fallbackNombre: applyFallbackWhenEmpty ? fallbackNombre.trim() : '',
        applyFallbackWhenEmpty,
        excludeClientId: excludeClientId || '',
      }),
    [exactConsignees, groupKeywords, fallbackNombre, applyFallbackWhenEmpty, excludeClientId]
  );

  const hasAnyRule =
    exactConsignees.length > 0 ||
    groupKeywords.length > 0 ||
    (applyFallbackWhenEmpty && fallbackNombre.trim().length >= 2);

  useEffect(() => {
    if (!hasAnyRule) {
      if (abortRef.current) abortRef.current.abort();
      setPreview(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await authFetch('/api/preview-matching', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            exactConsignees,
            groupKeywords,
            fallbackNombre: applyFallbackWhenEmpty ? fallbackNombre : undefined,
            applyFallbackWhenEmpty,
            excludeClientId,
          }),
        });
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) {
          throw new Error(json?.error || 'No se pudo calcular la vista previa');
        }
        setPreview(json as MatchingPreviewResponse);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error al simular reglas');
        }
      } finally {
        if (!cancelled && abortRef.current === controller) {
          setIsLoading(false);
        }
      }
    }, 260);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [payloadKey, hasAnyRule, exactConsignees, groupKeywords, fallbackNombre, applyFallbackWhenEmpty, excludeClientId]);

  if (!hasAnyRule) {
    return null;
  }

  const hasWarnings = Boolean(preview && (preview.advertencias.length > 0 || preview.conflictos.length > 0));
  const totalConsig = preview?.total_consignatarios ?? 0;
  const totalPkgs = preview?.total_paquetes ?? 0;

  return (
    <div
      style={{
        borderRadius: '10px',
        border: `1px solid ${hasWarnings ? '#fcd34d' : '#bfdbfe'}`,
        backgroundColor: hasWarnings ? '#fffbeb' : '#f0f9ff',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        style={{
          width: '100%',
          background: 'none',
          border: 'none',
          padding: compact ? '10px 12px' : '12px 14px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flexWrap: 'wrap' }}>
          {isLoading ? (
            <div
              style={{
                width: '14px',
                height: '14px',
                border: '2px solid #0284c7',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 0.9s linear infinite',
                flexShrink: 0,
              }}
            />
          ) : hasWarnings ? (
            <AlertTriangle style={{ width: '16px', height: '16px', color: '#d97706', flexShrink: 0 }} />
          ) : (
            <Eye style={{ width: '16px', height: '16px', color: '#0284c7', flexShrink: 0 }} />
          )}

          <div style={{ fontSize: '12px', color: hasWarnings ? '#92400e' : '#0c4a6e', fontWeight: 700 }}>
            {isLoading && !preview ? (
              <span>Simulando impacto de reglas en catálogo TIB...</span>
            ) : error ? (
              <span>{error}</span>
            ) : (
              <span>
                Vista previa en vivo:{' '}
                <strong>{totalConsig.toLocaleString()}</strong>{' '}
                {totalConsig === 1 ? 'consignatario' : 'consignatarios'} ·{' '}
                <strong>{totalPkgs.toLocaleString()}</strong> paquetes
              </span>
            )}
          </div>
        </div>

        <ChevronDown
          style={{
            width: '15px',
            height: '15px',
            color: hasWarnings ? '#b45309' : '#0369a1',
            transform: isExpanded ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s ease',
            flexShrink: 0,
          }}
        />
      </button>

      {isExpanded && preview && (
        <div
          style={{
            borderTop: `1px solid ${hasWarnings ? '#fde68a' : '#bae6fd'}`,
            padding: compact ? '10px 12px' : '12px 14px',
            backgroundColor: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {preview.advertencias.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {preview.advertencias.map((warn, idx) => (
                <div
                  key={idx}
                  style={{
                    fontSize: '11.5px',
                    color: '#92400e',
                    backgroundColor: '#fef3c7',
                    border: '1px solid #fde68a',
                    borderRadius: '6px',
                    padding: '6px 9px',
                    lineHeight: 1.4,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '6px',
                  }}
                >
                  <AlertTriangle style={{ width: '13px', height: '13px', color: '#d97706', flexShrink: 0, marginTop: '2px' }} />
                  <span>{warn}</span>
                </div>
              ))}
            </div>
          )}

          {preview.muestra_consignatarios.length === 0 ? (
            <div style={{ fontSize: '11.5px', color: '#64748b', fontStyle: 'italic' }}>
              Aún no existen paquetes en el catálogo TIB con estas reglas (se vincularán automáticamente en cuanto ingresen).
            </div>
          ) : (
            <div style={{ maxHeight: compact ? '160px' : '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {preview.muestra_consignatarios.map((item) => (
                <div
                  key={item.nombre}
                  style={{
                    padding: '7px 9px',
                    borderRadius: '6px',
                    border: item.compartido_con.length > 0 ? '1px solid #fde68a' : '1px solid #f1f5f9',
                    backgroundColor: item.compartido_con.length > 0 ? '#fffbeb' : '#f8fafc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ minWidth: 0, flex: '1 1 200px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', wordBreak: 'break-word' }}>
                      {item.nombre}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap', marginTop: '3px' }}>
                      {item.matched_by.map((m, mi) => (
                        <span
                          key={`${m.tipo}-${m.regla}-${mi}`}
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            backgroundColor: m.tipo === 'grupo' ? '#f5f3ff' : '#ecfdf5',
                            color: m.tipo === 'grupo' ? '#6d28d9' : '#047857',
                            border: `1px solid ${m.tipo === 'grupo' ? '#ddd6fe' : '#a7f3d0'}`,
                          }}
                        >
                          {m.tipo === 'grupo' ? `Sigla: ${m.regla}` : 'Exacto'}
                        </span>
                      ))}
                      {item.compartido_con.length > 0 && (
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            backgroundColor: '#fef3c7',
                            color: '#92400e',
                            border: '1px solid #fde68a',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <Users style={{ width: '10px', height: '10px' }} />
                          <span>
                            Compartido con: {item.compartido_con.map((o) => o.email).join(', ')}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      color: '#0369a1',
                      backgroundColor: '#e0f2fe',
                      padding: '2px 7px',
                      borderRadius: '999px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Package style={{ width: '11px', height: '11px' }} />
                    <span>{item.total_paquetes.toLocaleString()} paq.</span>
                  </span>
                </div>
              ))}
              {preview.total_consignatarios > preview.muestra_consignatarios.length && (
                <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'center', paddingTop: '4px' }}>
                  Mostrando los primeros {preview.muestra_consignatarios.length} de {preview.total_consignatarios} consignatarios coincidentes.
                </div>
              )}
            </div>
          )}

          {preview.conflictos.length === 0 && preview.muestra_consignatarios.length > 0 && (
            <div style={{ fontSize: '11px', color: '#047857', display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}>
              <CheckCircle2 style={{ width: '13px', height: '13px' }} />
              <span>Sin cruces con otras cuentas activas del portal.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
