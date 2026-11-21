'use client';

import React from 'react';
import { computePaginationPages } from '@/lib/portal/pagination';

export interface TablePaginationBarProps {
  currentPage: number;
  totalPages: number;
  paginationPages?: number[];
  summary: React.ReactNode;
  onPageChange: (nextPage: number) => void;
  disabled?: boolean;
  position?: 'top' | 'bottom' | 'inline';
  showPageNumbers?: boolean;
  padding?: string;
  backgroundColor?: string;
  trailingSlot?: React.ReactNode;
}

/**
 * Barra de paginación reutilizable para colocarse arriba y abajo de las tablas/listas.
 * Siempre renderiza el resumen y, cuando `totalPages > 1`, los controles de navegación.
 */
export default function TablePaginationBar({
  currentPage,
  totalPages,
  paginationPages,
  summary,
  onPageChange,
  disabled = false,
  position = 'bottom',
  showPageNumbers = true,
  padding = '12px 16px',
  backgroundColor = '#f8f9fa',
  trailingSlot,
}: TablePaginationBarProps) {
  const safeTotal = Math.max(1, totalPages || 1);
  const safeCurrent = Math.min(Math.max(1, currentPage || 1), safeTotal);
  const pages = paginationPages && paginationPages.length > 0
    ? paginationPages
    : computePaginationPages(safeCurrent, safeTotal);

  const isPrevDisabled = disabled || safeCurrent <= 1;
  const isNextDisabled = disabled || safeCurrent >= safeTotal;

  const containerBorder: React.CSSProperties =
    position === 'top'
      ? { borderBottom: '1px solid #e5e7eb' }
      : position === 'bottom'
        ? { borderTop: '1px solid #e5e7eb' }
        : {};

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding,
        backgroundColor,
        flexWrap: 'wrap',
        gap: '8px',
        ...containerBorder,
      }}
    >
      <span style={{ fontSize: '12px', color: '#6b7280' }}>{summary}</span>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {safeTotal > 1 && (
          <>
            <div className="flex sm:hidden items-center gap-2">
              <button
                type="button"
                onClick={() => onPageChange(Math.max(1, safeCurrent - 1))}
                disabled={isPrevDisabled}
                style={{
                  minHeight: '40px',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #d1d5db',
                  color: '#374151',
                  cursor: isPrevDisabled ? 'not-allowed' : 'pointer',
                  opacity: isPrevDisabled ? 0.4 : 1,
                  fontSize: '12.5px',
                  fontWeight: 600,
                }}
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => onPageChange(Math.min(safeTotal, safeCurrent + 1))}
                disabled={isNextDisabled}
                style={{
                  minHeight: '40px',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #d1d5db',
                  color: '#374151',
                  cursor: isNextDisabled ? 'not-allowed' : 'pointer',
                  opacity: isNextDisabled ? 0.4 : 1,
                  fontSize: '12.5px',
                  fontWeight: 600,
                }}
              >
                Siguiente
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-1">
              {showPageNumbers && safeCurrent > 3 && (
                <button
                  type="button"
                  onClick={() => onPageChange(1)}
                  disabled={disabled}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '4px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #d1d5db',
                    color: '#374151',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.4 : 1,
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                  title="Primera página"
                >
                  « 1
                </button>
              )}

              <button
                type="button"
                onClick={() => onPageChange(Math.max(1, safeCurrent - 1))}
                disabled={isPrevDisabled}
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #d1d5db',
                  color: '#374151',
                  cursor: isPrevDisabled ? 'not-allowed' : 'pointer',
                  opacity: isPrevDisabled ? 0.4 : 1,
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                Anterior
              </button>

              {showPageNumbers && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  {pages.map((page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => onPageChange(page)}
                      disabled={disabled}
                      style={{
                        minWidth: '32px',
                        height: '32px',
                        padding: '0 6px',
                        borderRadius: '4px',
                        border: safeCurrent === page ? 'none' : '1px solid #d1d5db',
                        backgroundColor: safeCurrent === page ? '#ff5722' : '#ffffff',
                        color: safeCurrent === page ? '#ffffff' : '#374151',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        opacity: disabled && safeCurrent !== page ? 0.5 : 1,
                      }}
                    >
                      {page}
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => onPageChange(Math.min(safeTotal, safeCurrent + 1))}
                disabled={isNextDisabled}
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #d1d5db',
                  color: '#374151',
                  cursor: isNextDisabled ? 'not-allowed' : 'pointer',
                  opacity: isNextDisabled ? 0.4 : 1,
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                Siguiente
              </button>

              {showPageNumbers && safeCurrent < safeTotal - 2 && (
                <button
                  type="button"
                  onClick={() => onPageChange(safeTotal)}
                  disabled={disabled}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '4px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #d1d5db',
                    color: '#374151',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.4 : 1,
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                  title="Última página"
                >
                  {safeTotal.toLocaleString()} »
                </button>
              )}
            </div>
          </>
        )}

        {trailingSlot}
      </div>
    </div>
  );
}
