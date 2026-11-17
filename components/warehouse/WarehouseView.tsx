'use client';

import React from 'react';
import {
  Search,
  RotateCw,
  Camera,
  X,
  ChevronDown,
  Package,
  FilterX,
  Users,
  RefreshCw,
  AlertCircle,
  ArrowRightLeft,
  SlidersHorizontal,
  Calendar,
} from 'lucide-react';
import ExcelExportDropdown from '@/components/ExcelExportDropdown';
import { trackPortalEvent } from '@/lib/analytics/tracker';
import {
  ESTADOS_DISPONIBLES,
  formatDateTimeTIB,
  getEstadoTexto,
  PaqueteTIB,
  TIPOS_EMPAQUE,
} from '@/lib/portal/types';

export interface WarehouseViewProps {
  userEmail?: string | null;
  isSuperadmin: boolean;
  paquetes: PaqueteTIB[];
  totalSystemCount: number;
  totalFilteredCount: number;
  isLoading: boolean;
  isSearching: boolean;
  isRefreshing: boolean;
  fetchError: string | null;
  currentPage: number;
  totalPages: number;
  paginationPages: number[];
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  filterWr: string;
  setFilterWr: React.Dispatch<React.SetStateAction<string>>;
  filterTracking: string;
  setFilterTracking: React.Dispatch<React.SetStateAction<string>>;
  filterConsignatario: string;
  setFilterConsignatario: React.Dispatch<React.SetStateAction<string>>;
  filterTipo: string;
  setFilterTipo: React.Dispatch<React.SetStateAction<string>>;
  filterEstado: string;
  setFilterEstado: React.Dispatch<React.SetStateAction<string>>;
  isConsignatarioFilterOpen: boolean;
  setIsConsignatarioFilterOpen: React.Dispatch<React.SetStateAction<boolean>>;
  consignatarioSearchTerm: string;
  setConsignatarioSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  consignatarioOptions: any[];
  consignatarioOptionsTotal: number;
  isLoadingConsignatarioOptions: boolean;
  consignatarioDropdownRef: React.RefObject<HTMLDivElement | null>;
  showAdvancedFilters: boolean;
  setShowAdvancedFilters: React.Dispatch<React.SetStateAction<boolean>>;
  filterFechaTipo: 'creado_en' | 'actualizado_en';
  setFilterFechaTipo: React.Dispatch<React.SetStateAction<'creado_en' | 'actualizado_en'>>;
  filterFechaDesde: string;
  setFilterFechaDesde: React.Dispatch<React.SetStateAction<string>>;
  filterFechaHasta: string;
  setFilterFechaHasta: React.Dispatch<React.SetStateAction<string>>;
  filterPesoMin: string;
  setFilterPesoMin: React.Dispatch<React.SetStateAction<string>>;
  filterPesoMax: string;
  setFilterPesoMax: React.Dispatch<React.SetStateAction<string>>;
  datePreset: string;
  setDatePreset: React.Dispatch<React.SetStateAction<string>>;
  activeFiltersCount: number;
  advancedFiltersCount: number;
  applyDatePreset: (preset: string) => void;
  handleManualRefresh: () => void;
  handleSearchClick: () => void;
  handleClearFilters: () => void;
  onRetryFetch: () => void;
  onSelectPhoto: (photo: { url: string; wr: string }) => void;
  onShowErrorToast: (msg: string) => void;
}

export default function WarehouseView({
  userEmail,
  isSuperadmin,
  paquetes,
  totalSystemCount,
  totalFilteredCount,
  isLoading,
  isSearching,
  isRefreshing,
  fetchError,
  currentPage,
  totalPages,
  paginationPages,
  setCurrentPage,
  filterWr,
  setFilterWr,
  filterTracking,
  setFilterTracking,
  filterConsignatario,
  setFilterConsignatario,
  filterTipo,
  setFilterTipo,
  filterEstado,
  setFilterEstado,
  isConsignatarioFilterOpen,
  setIsConsignatarioFilterOpen,
  consignatarioSearchTerm,
  setConsignatarioSearchTerm,
  consignatarioOptions,
  consignatarioOptionsTotal,
  isLoadingConsignatarioOptions,
  consignatarioDropdownRef,
  showAdvancedFilters,
  setShowAdvancedFilters,
  filterFechaTipo,
  setFilterFechaTipo,
  filterFechaDesde,
  setFilterFechaDesde,
  filterFechaHasta,
  setFilterFechaHasta,
  filterPesoMin,
  setFilterPesoMin,
  filterPesoMax,
  setFilterPesoMax,
  datePreset,
  setDatePreset,
  activeFiltersCount,
  advancedFiltersCount,
  applyDatePreset,
  handleManualRefresh,
  handleSearchClick,
  handleClearFilters,
  onRetryFetch,
  onSelectPhoto,
  onShowErrorToast,
}: WarehouseViewProps) {
  return (
    <>
      {/* Título de la sección estilo TIB */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#ff5722', margin: 0, letterSpacing: '-0.3px' }}>
            Listado Warehouse
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b7280' }}>
            Control y seguimiento de paquetes recibidos en el almacén de Miami y despachos a Lima.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#6b7280', backgroundColor: '#ffffff', padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            Total: <strong style={{ color: '#111827', fontWeight: 800 }}>{(totalSystemCount || totalFilteredCount).toLocaleString()}</strong>
          </span>

          {activeFiltersCount > 0 && (
            <span style={{ fontSize: '11.5px', color: '#ff5722', backgroundColor: '#fff3e0', border: '1px solid #ffccbc', padding: '6px 10px', borderRadius: '6px', fontWeight: 700 }}>
              {totalFilteredCount.toLocaleString()} coincidencia(s)
            </span>
          )}

          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            style={{
              backgroundColor: '#ffffff',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
            title="Refrescar lista de paquetes"
          >
            <RotateCw style={{ width: '13px', height: '13px', color: '#ff5722', animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Tarjeta de Filtros Estilo TIB */}
      <div className="p-3.5 sm:p-5" style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Fila 1: 3 inputs amplios e independientes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Input # Warehouse */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search style={{ position: 'absolute', left: '12px', width: '16px', height: '16px', color: '#9ca3af' }} />
            <input
              type="text"
              value={filterWr}
              onChange={(e) => {
                setFilterWr(e.target.value);
                setCurrentPage(1);
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearchClick(); }}
              placeholder="# Warehouse"
              style={{
                width: '100%',
                height: '42px',
                paddingLeft: '38px',
                paddingRight: '12px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '13px',
                color: '#111827',
                outline: 'none',
                backgroundColor: '#ffffff',
                transition: 'border-color 0.15s ease',
              }}
            />
          </div>

          {/* Input # Tracking */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search style={{ position: 'absolute', left: '12px', width: '16px', height: '16px', color: '#9ca3af' }} />
            <input
              type="text"
              value={filterTracking}
              onChange={(e) => {
                setFilterTracking(e.target.value);
                setCurrentPage(1);
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearchClick(); }}
              placeholder="# Tracking"
              style={{
                width: '100%',
                height: '42px',
                paddingLeft: '38px',
                paddingRight: '12px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '13px',
                color: '#111827',
                outline: 'none',
                backgroundColor: '#ffffff',
                transition: 'border-color 0.15s ease',
              }}
            />
          </div>

          {/* Selector Desplegable Inteligente de Consignatario */}
          <div ref={consignatarioDropdownRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setIsConsignatarioFilterOpen((prev) => !prev)}
              style={{
                width: '100%',
                height: '42px',
                paddingLeft: '36px',
                paddingRight: filterConsignatario ? '58px' : '34px',
                borderRadius: '6px',
                border: isConsignatarioFilterOpen
                  ? '1px solid #2563eb'
                  : filterConsignatario
                  ? '1px solid #3b82f6'
                  : '1px solid #d1d5db',
                fontSize: '12.5px',
                fontWeight: filterConsignatario ? 700 : 500,
                color: filterConsignatario ? '#1e3a8a' : '#6b7280',
                backgroundColor: filterConsignatario ? '#eff6ff' : '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                textAlign: 'left',
                outline: 'none',
                transition: 'all 0.15s ease',
                boxShadow: isConsignatarioFilterOpen ? '0 0 0 3px rgba(37, 99, 235, 0.12)' : 'none',
              }}
              title={filterConsignatario || 'Seleccionar consignatario de la lista'}
            >
              <Users
                style={{
                  position: 'absolute',
                  left: '11px',
                  width: '16px',
                  height: '16px',
                  color: filterConsignatario ? '#2563eb' : '#9ca3af',
                }}
              />
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'block',
                  width: '100%',
                }}
              >
                {filterConsignatario || 'CONSIGNATARIO (SELECCIONAR)'}
              </span>
              <ChevronDown
                style={{
                  position: 'absolute',
                  right: '11px',
                  width: '16px',
                  height: '16px',
                  color: filterConsignatario ? '#2563eb' : '#6b7280',
                  transform: isConsignatarioFilterOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.15s ease',
                }}
              />
            </button>

            {filterConsignatario && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFilterConsignatario('');
                  setCurrentPage(1);
                }}
                title="Quitar filtro de consignatario"
                style={{
                  position: 'absolute',
                  right: '30px',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: '#dbeafe',
                  color: '#1d4ed8',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <X style={{ width: '12px', height: '12px' }} />
              </button>
            )}

            {isConsignatarioFilterOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '46px',
                  left: 0,
                  right: 0,
                  minWidth: 'min(310px, calc(100vw - 32px))',
                  maxWidth: 'calc(100vw - 32px)',
                  backgroundColor: '#ffffff',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  boxShadow: '0 14px 32px rgba(15, 23, 42, 0.18)',
                  zIndex: 80,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '10px 12px',
                    backgroundColor: '#f8fafc',
                    borderBottom: '1px solid #e2e8f0',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '6px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        color: '#334155',
                        textTransform: 'uppercase',
                        letterSpacing: '0.4px',
                      }}
                    >
                      {isSuperadmin ? 'Catálogo de Consignatarios' : 'Mis Consignatarios Asignados'}
                    </span>
                    <span
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 700,
                        color: '#1d4ed8',
                        backgroundColor: '#dbeafe',
                        padding: '2px 7px',
                        borderRadius: '999px',
                      }}
                    >
                      {consignatarioOptionsTotal.toLocaleString()} disp.
                    </span>
                  </div>

                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Search
                      style={{
                        position: 'absolute',
                        left: '10px',
                        width: '14px',
                        height: '14px',
                        color: '#64748b',
                      }}
                    />
                    <input
                      type="text"
                      autoFocus={typeof window !== 'undefined' && window.innerWidth >= 768}
                      value={consignatarioSearchTerm}
                      onChange={(e) => setConsignatarioSearchTerm(e.target.value)}
                      placeholder="Filtrar nombre en esta lista..."
                      style={{
                        width: '100%',
                        height: '34px',
                        paddingLeft: '30px',
                        paddingRight: consignatarioSearchTerm ? '28px' : '10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '12px',
                        color: '#0f172a',
                        backgroundColor: '#ffffff',
                        outline: 'none',
                      }}
                    />
                    {consignatarioSearchTerm && (
                      <button
                        type="button"
                        onClick={() => setConsignatarioSearchTerm('')}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          background: 'none',
                          border: 'none',
                          color: '#64748b',
                          cursor: 'pointer',
                          padding: 0,
                          display: 'inline-flex',
                        }}
                      >
                        <X style={{ width: '13px', height: '13px' }} />
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                  <div
                    onClick={() => {
                      setFilterConsignatario('');
                      setCurrentPage(1);
                      setIsConsignatarioFilterOpen(false);
                    }}
                    style={{
                      padding: '9px 12px',
                      borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: !filterConsignatario ? '#eff6ff' : '#ffffff',
                      fontWeight: !filterConsignatario ? 700 : 600,
                      fontSize: '12px',
                      color: !filterConsignatario ? '#1d4ed8' : '#334155',
                    }}
                  >
                    <span>📋 Todos los consignatarios (Ver todo)</span>
                    {!filterConsignatario && (
                      <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 800 }}>✓ Activo</span>
                    )}
                  </div>

                  {isLoadingConsignatarioOptions ? (
                    <div style={{ padding: '18px 12px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
                      Cargando consignatarios...
                    </div>
                  ) : consignatarioOptions.length === 0 ? (
                    <div style={{ padding: '18px 12px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
                      No se encontraron consignatarios con ese nombre.
                    </div>
                  ) : (
                    consignatarioOptions.map((item) => {
                      const isSelected = filterConsignatario === item.nombre;
                      return (
                        <div
                          key={item.id || item.nombre}
                          onClick={() => {
                            setFilterConsignatario(item.nombre);
                            setCurrentPage(1);
                            setIsConsignatarioFilterOpen(false);
                          }}
                          style={{
                            padding: '9px 12px',
                            borderBottom: '1px solid #f8fafc',
                            cursor: 'pointer',
                            backgroundColor: isSelected ? '#dbeafe' : '#ffffff',
                            transition: 'background-color 0.1s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) e.currentTarget.style.backgroundColor = '#f1f5f9';
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) e.currentTarget.style.backgroundColor = '#ffffff';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                            <span
                              style={{
                                fontSize: '12px',
                                fontWeight: 700,
                                color: isSelected ? '#1e3a8a' : '#0f172a',
                                wordBreak: 'break-word',
                              }}
                            >
                              {item.nombre}
                            </span>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                color: '#0369a1',
                                backgroundColor: '#e0f2fe',
                                padding: '2px 7px',
                                borderRadius: '999px',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {Number(item.total_paquetes || 0).toLocaleString()} paq.
                            </span>
                          </div>
                          <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '3px', display: 'flex', gap: '8px' }}>
                            <span>Recibidos: {item.recibidos || 0}</span>
                            <span>•</span>
                            <span>Enviados: {item.enviados || 0}</span>
                            <span>•</span>
                            <span>Entregados: {item.entregados || 0}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Fila 2: Selects de Tipo y Estado */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <select
              value={filterTipo}
              onChange={(e) => {
                setFilterTipo(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                width: '100%',
                height: '42px',
                padding: '0 12px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '13px',
                color: '#374151',
                outline: 'none',
                backgroundColor: '#ffffff',
                cursor: 'pointer',
              }}
            >
              <option value="">Tipo de Paquete (Todos)</option>
              {TIPOS_EMPAQUE.map((tipo) => (
                <option key={tipo} value={tipo}>{tipo}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={filterEstado}
              onChange={(e) => {
                const val = e.target.value;
                setFilterEstado(val);
                setCurrentPage(1);
                if (val) {
                  trackPortalEvent({
                    usuario_email: userEmail,
                    tipo_evento: 'FILTRO_ESTADO',
                    detalles: { estado: val },
                  });
                }
              }}
              style={{
                width: '100%',
                height: '42px',
                padding: '0 12px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '13px',
                color: '#374151',
                outline: 'none',
                backgroundColor: '#ffffff',
                cursor: 'pointer',
              }}
            >
              <option value="">Estado (Todos)</option>
              {ESTADOS_DISPONIBLES.map((estado) => (
                <option key={estado} value={estado}>{estado}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Fila 3: Botones de Acción TIB */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '4px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleSearchClick}
            disabled={isSearching}
            className="w-auto"
            style={{
              backgroundColor: isSearching ? '#374151' : '#1e2229',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '9px 24px',
              minHeight: '42px',
              fontSize: '13px',
              fontWeight: 700,
              letterSpacing: '0.4px',
              cursor: isSearching ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
              transition: 'all 0.15s ease',
              textAlign: 'center',
              justifyContent: 'center',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {isSearching ? (
              <>
                <RefreshCw style={{ width: '13px', height: '13px', animation: 'spin 1s linear infinite' }} />
                <span>BUSCANDO...</span>
              </>
            ) : (
              <span>BUSCAR</span>
            )}
          </button>

          <div className="w-auto">
            <ExcelExportDropdown
              userEmail={userEmail}
              filters={{
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
              }}
              totalFilteredCount={totalFilteredCount}
              totalSystemCount={totalSystemCount}
              onErrorToast={onShowErrorToast}
            />
          </div>

          <button
            type="button"
            onClick={() => setShowAdvancedFilters((prev) => !prev)}
            className="w-auto"
            style={{
              backgroundColor: showAdvancedFilters || advancedFiltersCount > 0 ? '#fff7ed' : '#ffffff',
              color: showAdvancedFilters || advancedFiltersCount > 0 ? '#c2410c' : '#374151',
              border: showAdvancedFilters || advancedFiltersCount > 0 ? '1.5px solid #ff5722' : '1px solid #d1d5db',
              borderRadius: '6px',
              padding: '8px 16px',
              minHeight: '42px',
              fontSize: '13px',
              fontWeight: 700,
              letterSpacing: '0.3px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              boxShadow: showAdvancedFilters ? '0 1px 3px rgba(234, 88, 12, 0.15)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <SlidersHorizontal style={{ width: '14px', height: '14px', color: showAdvancedFilters || advancedFiltersCount > 0 ? '#ea580c' : '#4b5563' }} />
            <span>FILTROS Y FECHAS</span>
            {advancedFiltersCount > 0 && (
              <span
                style={{
                  backgroundColor: '#ff5722',
                  color: '#ffffff',
                  fontSize: '10.5px',
                  fontWeight: 900,
                  padding: '1px 6px',
                  borderRadius: '999px',
                  minWidth: '18px',
                  textAlign: 'center',
                }}
              >
                {advancedFiltersCount}
              </span>
            )}
            <ChevronDown
              style={{
                width: '13px',
                height: '13px',
                transform: showAdvancedFilters ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
                color: showAdvancedFilters || advancedFiltersCount > 0 ? '#ea580c' : '#6b7280',
              }}
            />
          </button>

          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="w-full sm:w-auto"
              style={{
                backgroundColor: '#ffffff',
                color: '#4b5563',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                padding: '8px 18px',
                minHeight: '42px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              <FilterX style={{ width: '14px', height: '14px', color: '#6b7280' }} />
              <span>LIMPIAR TODO</span>
            </button>
          )}
        </div>

        {/* Panel Desplegable de Filtros Profesionales y Rangos */}
        {showAdvancedFilters && (
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '16px',
              marginTop: '6px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar style={{ width: '16px', height: '16px', color: '#ff5722' }} />
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#111827', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                  Filtro Avanzado por Fechas y Rangos
                </span>
              </div>
              {advancedFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    applyDatePreset('all');
                    setFilterPesoMin('');
                    setFilterPesoMax('');
                    setCurrentPage(1);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#dc2626',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: '2px 6px',
                  }}
                >
                  Limpiar fechas y peso
                </button>
              )}
            </div>

            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Períodos Rápidos:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {[
                  { id: 'all', label: 'Todo el historial' },
                  { id: 'today', label: 'Hoy' },
                  { id: 'yesterday', label: 'Ayer' },
                  { id: '7days', label: 'Últimos 7 días' },
                  { id: '30days', label: 'Últimos 30 días' },
                  { id: 'thisMonth', label: 'Este mes' },
                  { id: 'lastMonth', label: 'Mes anterior' },
                ].map((p) => {
                  const isActive = datePreset === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        applyDatePreset(p.id);
                        setCurrentPage(1);
                      }}
                      style={{
                        backgroundColor: isActive ? '#1e2229' : '#ffffff',
                        color: isActive ? '#ffffff' : '#374151',
                        border: isActive ? '1px solid #1e2229' : '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '5px 12px',
                        fontSize: '12px',
                        fontWeight: isActive ? 700 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
              <div style={{ minWidth: 0 }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  CRITERIO DE FECHA
                </label>
                <select
                  value={filterFechaTipo}
                  onChange={(e) => {
                    setFilterFechaTipo(e.target.value as 'creado_en' | 'actualizado_en');
                    setCurrentPage(1);
                  }}
                  style={{
                    width: '100%',
                    height: '40px',
                    padding: '0 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px',
                    color: '#111827',
                    backgroundColor: '#ffffff',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="creado_en">Fecha Registro (Miami)</option>
                  <option value="actualizado_en">Fecha Modificado</option>
                </select>
              </div>

              <div style={{ minWidth: 0 }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  FECHA DESDE
                </label>
                <input
                  type="date"
                  value={filterFechaDesde}
                  onChange={(e) => {
                    setDatePreset('custom');
                    setFilterFechaDesde(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    width: '100%',
                    minWidth: 0,
                    height: '40px',
                    padding: '0 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px',
                    color: '#111827',
                    backgroundColor: '#ffffff',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ minWidth: 0 }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  FECHA HASTA
                </label>
                <input
                  type="date"
                  value={filterFechaHasta}
                  onChange={(e) => {
                    setDatePreset('custom');
                    setFilterFechaHasta(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    width: '100%',
                    minWidth: 0,
                    height: '40px',
                    padding: '0 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px',
                    color: '#111827',
                    backgroundColor: '#ffffff',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ minWidth: 0 }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  RANGO DE PESO (KG)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    placeholder="Mín"
                    value={filterPesoMin}
                    onChange={(e) => {
                      setFilterPesoMin(e.target.value);
                      setCurrentPage(1);
                    }}
                    style={{
                      width: '50%',
                      minWidth: 0,
                      height: '40px',
                      padding: '0 8px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12.5px',
                      color: '#111827',
                      backgroundColor: '#ffffff',
                      outline: 'none',
                    }}
                  />
                  <span style={{ color: '#94a3b8', fontSize: '12px' }}>–</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    placeholder="Máx"
                    value={filterPesoMax}
                    onChange={(e) => {
                      setFilterPesoMax(e.target.value);
                      setCurrentPage(1);
                    }}
                    style={{
                      width: '50%',
                      minWidth: 0,
                      height: '40px',
                      padding: '0 8px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12.5px',
                      color: '#111827',
                      backgroundColor: '#ffffff',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Chips de Filtros Activos */}
        {activeFiltersCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', paddingTop: '6px' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Filtros aplicados:
            </span>
            {filterWr.trim() && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '2px 8px', fontSize: '11.5px', fontWeight: 600 }}>
                WR: {filterWr}
                <button
                  type="button"
                  onClick={() => { setFilterWr(''); setCurrentPage(1); }}
                  aria-label="Quitar filtro WR"
                  style={{ background: 'none', border: 'none', padding: '1px', color: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                >
                  <X style={{ width: '12px', height: '12px' }} aria-hidden="true" />
                </button>
              </span>
            )}
            {filterTracking.trim() && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '2px 8px', fontSize: '11.5px', fontWeight: 600 }}>
                Tracking: {filterTracking}
                <button
                  type="button"
                  onClick={() => { setFilterTracking(''); setCurrentPage(1); }}
                  aria-label="Quitar filtro Tracking"
                  style={{ background: 'none', border: 'none', padding: '1px', color: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                >
                  <X style={{ width: '12px', height: '12px' }} aria-hidden="true" />
                </button>
              </span>
            )}
            {filterConsignatario.trim() && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '2px 8px', fontSize: '11.5px', fontWeight: 600 }}>
                Cliente: {filterConsignatario}
                <button
                  type="button"
                  onClick={() => { setFilterConsignatario(''); setCurrentPage(1); }}
                  aria-label="Quitar filtro Cliente"
                  style={{ background: 'none', border: 'none', padding: '1px', color: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                >
                  <X style={{ width: '12px', height: '12px' }} aria-hidden="true" />
                </button>
              </span>
            )}
            {filterTipo.trim() && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '2px 8px', fontSize: '11.5px', fontWeight: 600 }}>
                Tipo: {filterTipo}
                <button
                  type="button"
                  onClick={() => { setFilterTipo(''); setCurrentPage(1); }}
                  aria-label="Quitar filtro Tipo"
                  style={{ background: 'none', border: 'none', padding: '1px', color: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                >
                  <X style={{ width: '12px', height: '12px' }} aria-hidden="true" />
                </button>
              </span>
            )}
            {filterEstado.trim() && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '2px 8px', fontSize: '11.5px', fontWeight: 600 }}>
                Estado: {filterEstado}
                <button
                  type="button"
                  onClick={() => { setFilterEstado(''); setCurrentPage(1); }}
                  aria-label="Quitar filtro Estado"
                  style={{ background: 'none', border: 'none', padding: '1px', color: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                >
                  <X style={{ width: '12px', height: '12px' }} aria-hidden="true" />
                </button>
              </span>
            )}
            {(filterFechaDesde.trim() || filterFechaHasta.trim()) && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', borderRadius: '4px', padding: '2px 8px', fontSize: '11.5px', fontWeight: 600 }}>
                📅 {filterFechaTipo === 'actualizado_en' ? 'Modificado' : 'Registro'}: {filterFechaDesde || 'Inicio'} al {filterFechaHasta || 'Hoy'}
                <button
                  type="button"
                  onClick={() => { applyDatePreset('all'); setCurrentPage(1); }}
                  aria-label="Quitar filtro Fecha"
                  style={{ background: 'none', border: 'none', padding: '1px', color: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                >
                  <X style={{ width: '12px', height: '12px' }} aria-hidden="true" />
                </button>
              </span>
            )}
            {(filterPesoMin.trim() || filterPesoMax.trim()) && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', borderRadius: '4px', padding: '2px 8px', fontSize: '11.5px', fontWeight: 600 }}>
                ⚖ Peso: {filterPesoMin ? `${filterPesoMin}kg` : '0'} a {filterPesoMax ? `${filterPesoMax}kg` : '∞'}
                <button
                  type="button"
                  onClick={() => { setFilterPesoMin(''); setFilterPesoMax(''); setCurrentPage(1); }}
                  aria-label="Quitar filtro Peso"
                  style={{ background: 'none', border: 'none', padding: '1px', color: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                >
                  <X style={{ width: '12px', height: '12px' }} aria-hidden="true" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {fetchError && (
        <div
          role="alert"
          style={{
            marginBottom: '12px',
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            fontSize: '13px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <AlertCircle style={{ width: '16px', height: '16px', color: '#dc2626', flexShrink: 0 }} aria-hidden="true" />
            <span style={{ fontWeight: 600 }}>{fetchError}</span>
          </div>
          <button
            type="button"
            onClick={onRetryFetch}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #fca5a5',
              backgroundColor: '#ffffff',
              color: '#b91c1c',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <RefreshCw style={{ width: '13px', height: '13px' }} aria-hidden="true" />
            <span>Reintentar</span>
          </button>
        </div>
      )}

      {/* Tabla Principal Estilo TIB */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <div className="flex md:hidden items-center justify-between px-4 py-2.5 bg-[#f8fafc] border-b border-gray-200 text-xs">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#374151' }}>
            <ArrowRightLeft style={{ width: '13px', height: '13px', color: '#ff5722' }} />
            <span>Desliza para ver más datos</span>
          </div>
          <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500 }}>
            ↔ 9 columnas
          </span>
        </div>

        {isSearching && (
          <div style={{ height: '3px', width: '100%', backgroundColor: '#ffedd5', overflow: 'hidden', position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                backgroundColor: '#ff5722',
                borderRadius: '999px',
                animation: 'indeterminateBar 1s ease-in-out infinite alternate',
              }}
            />
          </div>
        )}

        <div style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <th style={{ padding: '12px 14px', minWidth: '120px' }}>WR</th>
                <th style={{ padding: '12px 14px', minWidth: '145px' }}># TRACKING</th>
                <th style={{ padding: '12px 14px', minWidth: '190px' }}>CLIENTE</th>
                <th style={{ padding: '12px 14px', minWidth: '85px' }}>TIPO</th>
                <th style={{ padding: '12px 14px', minWidth: '95px' }}>PESO(KG)</th>
                <th style={{ padding: '12px 14px', minWidth: '135px' }}>ESTADO</th>
                <th style={{ padding: '12px 14px', minWidth: '110px' }}>REGISTRADO</th>
                <th style={{ padding: '12px 14px', minWidth: '110px' }}>MODIFICADO</th>
                <th style={{ padding: '12px 14px', minWidth: '130px', textAlign: 'center' }}>DOCUMENTOS</th>
              </tr>
            </thead>

            <tbody style={{ opacity: isSearching ? 0.55 : 1, transition: 'opacity 0.2s ease' }}>
              {isLoading && paquetes.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '60px 16px', textAlign: 'center', color: '#6b7280' }}>
                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '28px', height: '28px', border: '3px solid #ff5722', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>Cargando paquetes desde almacén...</span>
                    </div>
                  </td>
                </tr>
              ) : paquetes.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '60px 16px', textAlign: 'center', color: '#6b7280' }}>
                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <Package style={{ width: '36px', height: '36px', color: '#d1d5db' }} />
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#374151' }}>No se encontraron paquetes registrados</span>
                      <span style={{ fontSize: '12px', color: '#9ca3af' }}>Intenta ajustar los filtros de búsqueda o consulta tu número de Warehouse.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                paquetes.map((pkg, idx) => {
                  const creado = formatDateTimeTIB(pkg.creado_en);
                  const modificado = formatDateTimeTIB(pkg.actualizado_en || pkg.creado_en);
                  const estadoTexto = getEstadoTexto(pkg);

                  return (
                    <tr
                      key={pkg.id || pkg.numero_recibo_bodega}
                      style={{
                        borderBottom: '1px solid #f1f3f6',
                        backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafbfc',
                        transition: 'background-color 0.12s ease',
                      }}
                    >
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#111827', fontFamily: 'monospace', fontSize: '13px' }}>
                        {pkg.numero_recibo_bodega}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#374151', fontFamily: 'monospace', fontSize: '12.5px' }}>
                        {pkg.tracking || '—'}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#111827' }}>
                        {pkg.nombre_consignatario || 'CLIENTE AMEX'}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#4b5563', textTransform: 'uppercase', fontSize: '12px', fontWeight: 600 }}>
                        {pkg.tipo_empaque || 'CAJA'}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#111827' }}>
                        {pkg.peso_kg != null ? Number(pkg.peso_kg).toFixed(2) : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '11.5px', fontWeight: 700, color: '#1f2937', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                        {estadoTexto}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '12px', color: '#4b5563', lineHeight: '1.3' }}>
                        <div style={{ fontWeight: 600, color: '#111827' }}>{creado.date}</div>
                        <div style={{ fontSize: '11px', color: '#9ca3af' }}>{creado.time}</div>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '12px', color: '#4b5563', lineHeight: '1.3' }}>
                        <div style={{ fontWeight: 600, color: '#111827' }}>{modificado.date}</div>
                        <div style={{ fontSize: '11px', color: '#9ca3af' }}>{modificado.time}</div>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        {pkg.tib_imagen_url ? (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectPhoto({ url: pkg.tib_imagen_url!, wr: pkg.numero_recibo_bodega });
                              trackPortalEvent({
                                usuario_email: userEmail,
                                tipo_evento: 'VER_FOTO_ALMACEN',
                                detalles: { wr: pkg.numero_recibo_bodega, url: pkg.tib_imagen_url },
                              });
                            }}
                            style={{
                              backgroundColor: '#fff7ed',
                              color: '#c2410c',
                              border: '1px solid #ffedd5',
                              borderRadius: '6px',
                              padding: '6px 12px',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                            }}
                            title="Ver foto tomada en bodega Miami"
                          >
                            <Camera style={{ width: '14px', height: '14px', color: '#ea580c' }} />
                            <span>Ver imagen</span>
                          </button>
                        ) : (
                          <span
                            style={{
                              backgroundColor: '#f3f4f6',
                              color: '#9ca3af',
                              border: '1px solid #e5e7eb',
                              borderRadius: '6px',
                              padding: '6px 12px',
                              fontSize: '12px',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <Camera style={{ width: '14px', height: '14px', opacity: 0.5 }} />
                            <span>Sin imagen</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación estilo TIB */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid #e5e7eb', backgroundColor: '#f8f9fa', flexWrap: 'wrap', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#6b7280' }}>
            Pág. <strong style={{ color: '#111827' }}>{currentPage}</strong> de <strong style={{ color: '#111827' }}>{totalPages.toLocaleString()}</strong> ({totalFilteredCount.toLocaleString()} registros)
          </span>

          {totalPages > 1 && (
            <>
              <div className="flex sm:hidden items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  style={{ minHeight: '40px', padding: '6px 14px', borderRadius: '6px', backgroundColor: '#ffffff', border: '1px solid #d1d5db', color: '#374151', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.4 : 1, fontSize: '12.5px', fontWeight: 600 }}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  style={{ minHeight: '40px', padding: '6px 14px', borderRadius: '6px', backgroundColor: '#ffffff', border: '1px solid #d1d5db', color: '#374151', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.4 : 1, fontSize: '12.5px', fontWeight: 600 }}
                >
                  Siguiente
                </button>
              </div>

              <div className="hidden sm:flex items-center gap-1">
                {currentPage > 3 && (
                  <button
                    type="button"
                    onClick={() => setCurrentPage(1)}
                    style={{ padding: '6px 10px', borderRadius: '4px', backgroundColor: '#ffffff', border: '1px solid #d1d5db', color: '#374151', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                    title="Primera página"
                  >
                    « 1
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  style={{ padding: '6px 12px', borderRadius: '4px', backgroundColor: '#ffffff', border: '1px solid #d1d5db', color: '#374151', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.4 : 1, fontSize: '12px', fontWeight: 600 }}
                >
                  Anterior
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  {paginationPages.map((page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      style={{
                        minWidth: '32px',
                        height: '32px',
                        padding: '0 6px',
                        borderRadius: '4px',
                        border: currentPage === page ? 'none' : '1px solid #d1d5db',
                        backgroundColor: currentPage === page ? '#ff5722' : '#ffffff',
                        color: currentPage === page ? '#ffffff' : '#374151',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {page}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  style={{ padding: '6px 12px', borderRadius: '4px', backgroundColor: '#ffffff', border: '1px solid #d1d5db', color: '#374151', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.4 : 1, fontSize: '12px', fontWeight: 600 }}
                >
                  Siguiente
                </button>

                {currentPage < totalPages - 2 && (
                  <button
                    type="button"
                    onClick={() => setCurrentPage(totalPages)}
                    style={{ padding: '6px 10px', borderRadius: '4px', backgroundColor: '#ffffff', border: '1px solid #d1d5db', color: '#374151', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                    title="Última página"
                  >
                    {totalPages.toLocaleString()} »
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
