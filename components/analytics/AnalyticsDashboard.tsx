'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  Image as ImageIcon,
  FileSpreadsheet,
  TrendingUp,
  RefreshCw,
  Calendar,
  Smartphone,
  Monitor,
  Tablet,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  ChevronRight,
  X,
  Download,
  Filter,
  Eye,
  Activity,
  Layers,
  Sparkles,
  BarChart3,
  Package,
} from 'lucide-react';

interface KPIResumen {
  total_clientes: number;
  activos_hoy: number;
  activos_periodo: number;
  total_busquedas: number;
  total_fotos_vistas: number;
  total_descargas_excel: number;
  total_logins: number;
  cliente_mas_activo: string;
}

interface DiaTendencia {
  fecha: string;
  dia: string;
  busquedas: number;
  fotos: number;
  excels: number;
  logins: number;
  total: number;
}

interface TopBusqueda {
  termino: string;
  cantidad: number;
}

interface ClienteAnalitica {
  id: string;
  email: string;
  nombre_completo: string;
  activo: boolean;
  es_admin?: boolean;
  alias_palabras_clave?: string[];
  creado_en: string;
  ultimo_acceso: string | null;
  total_eventos: number;
  logins: number;
  busquedas: number;
  fotos_vistas: number;
  descargas_excel: number;
  dispositivo_frecuente: string;
  paquetes_estimados: number;
}

interface AnalyticsData {
  periodo_dias: number;
  resumen_kpis: KPIResumen;
  tendencia_diaria: DiaTendencia[];
  top_busquedas: TopBusqueda[];
  clientes: ClienteAnalitica[];
}

interface EventoAuditoria {
  id: string;
  usuario_email: string;
  nombre_cliente?: string;
  tipo_evento: string;
  detalles: any;
  dispositivo?: string;
  navegador?: string;
  ip?: string;
  creado_en: string;
}

interface AnalyticsDashboardProps {
  adminEmail: string;
  onBackToWarehouse: () => void;
}

export default function AnalyticsDashboard({ adminEmail, onBackToWarehouse }: AnalyticsDashboardProps) {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filtros de tabla
  const [searchFilter, setSearchFilter] = useState('');
  const [activityStatusFilter, setActivityStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortField, setSortField] = useState<keyof ClienteAnalitica>('total_eventos');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Modal de auditoría por cliente
  const [selectedClientForAudit, setSelectedClientForAudit] = useState<ClienteAnalitica | null>(null);
  const [auditEvents, setAuditEvents] = useState<EventoAuditoria[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState<boolean>(false);

  // Cargar datos principales
  const fetchAnalytics = async (selectedDays = days, showSpinner = true) => {
    if (showSpinner) setIsLoading(true);
    else setIsRefreshing(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/analiticas-uso?admin_email=${encodeURIComponent(adminEmail)}&days=${selectedDays}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'No se pudieron cargar las analíticas');
      }
      const json: AnalyticsData = await res.json();
      setData(json);
    } catch (err: any) {
      console.error('Error fetching analytics:', err);
      setErrorMessage(err.message || 'Error de conexión al cargar estadísticas');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (adminEmail) {
      fetchAnalytics(days);
    }
  }, [adminEmail, days]);

  // Cargar auditoría detallada de un cliente
  const handleOpenClientAudit = async (cliente: ClienteAnalitica) => {
    setSelectedClientForAudit(cliente);
    setIsLoadingAudit(true);
    setAuditEvents([]);

    try {
      const res = await fetch(`/api/analiticas-uso?admin_email=${encodeURIComponent(adminEmail)}&client_email=${encodeURIComponent(cliente.email)}`);
      if (res.ok) {
        const json = await res.json();
        setAuditEvents(json.historial || []);
      }
    } catch (e) {
      console.error('Error al cargar historial de auditoría:', e);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  // Formato relativo de tiempo en español
  const formatTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return 'Nunca';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 2) return 'Hace un momento';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours} h`;
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
  };

  // Formato de fecha completa
  const formatFullDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Clientes filtrados y ordenados
  const filteredClients = useMemo(() => {
    if (!data?.clientes) return [];
    let list = [...data.clientes];

    // Filtro por texto
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase().trim();
      list = list.filter(
        c =>
          c.nombre_completo.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.alias_palabras_clave && c.alias_palabras_clave.some(k => k.toLowerCase().includes(q)))
      );
    }

    // Filtro por actividad
    if (activityStatusFilter === 'active') {
      list = list.filter(c => c.total_eventos > 0);
    } else if (activityStatusFilter === 'inactive') {
      list = list.filter(c => c.total_eventos === 0);
    }

    // Ordenamiento
    list.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortAsc ? valA - valB : valB - valA;
      }
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (!valA && valB) return 1;
      if (valA && !valB) return -1;
      return 0;
    });

    return list;
  }, [data?.clientes, searchFilter, activityStatusFilter, sortField, sortAsc]);

  // Exportar resumen a CSV
  const exportSummaryCsv = () => {
    if (!filteredClients.length) return;
    const headers = [
      'Cliente',
      'Correo',
      'Estado Cuenta',
      'Ultimo Acceso',
      'Total Eventos',
      'Logins',
      'Busquedas',
      'Fotos Vistas',
      'Descargas Excel',
      'Dispositivo Frecuente',
      'Paquetes Estimados',
    ];

    const rows = filteredClients.map(c => [
      `"${c.nombre_completo.replace(/"/g, '""')}"`,
      `"${c.email}"`,
      c.activo ? 'Activo' : 'Desactivado',
      `"${formatFullDate(c.ultimo_acceso)}"`,
      c.total_eventos,
      c.logins,
      c.busquedas,
      c.fotos_vistas,
      c.descargas_excel,
      `"${c.dispositivo_frecuente}"`,
      c.paquetes_estimados,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AMEX_Analiticas_Uso_${days}dias_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Cálculo para el gráfico de barras nativo
  const maxBarValue = useMemo(() => {
    if (!data?.tendencia_diaria?.length) return 10;
    const max = Math.max(...data.tendencia_diaria.map(d => d.total));
    return max > 0 ? max : 10;
  }, [data?.tendencia_diaria]);

  const maxClientEvents = useMemo(() => {
    if (!data?.clientes?.length) return 1;
    const max = Math.max(...data.clientes.map(c => c.total_eventos));
    return max > 0 ? max : 1;
  }, [data?.clientes]);

  if (isLoading && !data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', minHeight: '400px' }}>
        <RefreshCw style={{ width: '36px', height: '36px', color: '#ff5722', animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: '16px', fontSize: '15px', fontWeight: 600, color: '#374151' }}>
          Compilando métricas y analíticas de uso en tiempo real...
        </p>
        <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#9ca3af' }}>
          Consultando registros de auditoría y sesiones activas.
        </p>
      </div>
    );
  }

  const kpis = data?.resumen_kpis || {
    total_clientes: 0,
    activos_hoy: 0,
    activos_periodo: 0,
    total_busquedas: 0,
    total_fotos_vistas: 0,
    total_descargas_excel: 0,
    total_logins: 0,
    cliente_mas_activo: 'Sin datos',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', width: '100%' }}>
      
      {/* 1. Header del Módulo con Controles de Tiempo y Acciones */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', backgroundColor: '#ffffff', padding: '18px 22px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ backgroundColor: '#fff7ed', padding: '8px', borderRadius: '8px', border: '1px solid #ffedd5' }}>
              <BarChart3 style={{ width: '22px', height: '22px', color: '#ea580c' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Estadísticas y Analíticas de Clientes</span>
                <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#ecfdf5', color: '#047857', padding: '2px 8px', borderRadius: '999px', border: '1px solid #a7f3d0' }}>
                  En Vivo
                </span>
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                Monitoreo de actividad, recurrencia, búsquedas de paquetes y descargas en el portal.
              </p>
            </div>
          </div>
        </div>

        {/* Controles de Rango de Días y Botón Refrescar */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            {[
              { label: '7 días', val: 7 },
              { label: '15 días', val: 15 },
              { label: '30 días', val: 30 },
              { label: '90 días', val: 90 },
              { label: 'Todo el año', val: 365 },
            ].map(tab => (
              <button
                key={tab.val}
                type="button"
                onClick={() => setDays(tab.val)}
                style={{
                  padding: '5px 12px',
                  fontSize: '12px',
                  fontWeight: days === tab.val ? 700 : 500,
                  backgroundColor: days === tab.val ? '#ffffff' : 'transparent',
                  color: days === tab.val ? '#0f172a' : '#64748b',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: days === tab.val ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => fetchAnalytics(days, false)}
            disabled={isRefreshing}
            title="Actualizar datos ahora"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            <RefreshCw style={{ width: '13px', height: '13px', animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
            <span>{isRefreshing ? 'Actualizando...' : 'Refrescar'}</span>
          </button>

          <button
            type="button"
            onClick={onBackToWarehouse}
            title="Volver a la vista principal de Warehouse"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#334155',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            <Package style={{ width: '13px', height: '13px', color: '#ff5722' }} />
            <span>Volver a Warehouse</span>
          </button>

          <button
            type="button"
            onClick={exportSummaryCsv}
            title="Descargar resumen en formato CSV para Excel"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              backgroundColor: '#10b981',
              border: 'none',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              color: '#ffffff',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(16,185,129,0.2)',
            }}
          >
            <Download style={{ width: '13px', height: '13px' }} />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div style={{ padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', color: '#991b1b', fontSize: '13px' }}>
          <strong>Error:</strong> {errorMessage}
        </div>
      )}

      {/* 2. Tarjetas Ejecutivas de KPIs (5 Indicadores Clave) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
        
        {/* KPI 1: Usuarios Activos Hoy */}
        <div style={{ backgroundColor: '#ffffff', padding: '18px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Activos Hoy</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users style={{ width: '17px', height: '17px', color: '#2563eb' }} />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
            {kpis.activos_hoy}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', fontSize: '11px', color: '#64748b' }}>
            <span style={{ fontWeight: 700, color: '#16a34a' }}>
              {kpis.total_clientes > 0 ? `${Math.round((kpis.activos_periodo / kpis.total_clientes) * 100)}%` : '0%'}
            </span>
            <span>activos en el período ({kpis.activos_periodo} de {kpis.total_clientes})</span>
          </div>
        </div>

        {/* KPI 2: Búsquedas Realizadas */}
        <div style={{ backgroundColor: '#ffffff', padding: '18px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Búsquedas de Paquetes</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Search style={{ width: '17px', height: '17px', color: '#059669' }} />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
            {kpis.total_busquedas.toLocaleString()}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', fontSize: '11px', color: '#64748b' }}>
            <TrendingUp style={{ width: '12px', height: '12px', color: '#059669' }} />
            <span>Consultas WR / Guía / Consignatario</span>
          </div>
        </div>

        {/* KPI 3: Fotos de Almacén Inspeccionadas */}
        <div style={{ backgroundColor: '#ffffff', padding: '18px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Fotos Almacén Vistas</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ImageIcon style={{ width: '17px', height: '17px', color: '#ea580c' }} />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
            {kpis.total_fotos_vistas.toLocaleString()}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', fontSize: '11px', color: '#64748b' }}>
            <Eye style={{ width: '12px', height: '12px', color: '#ea580c' }} />
            <span>Inspecciones visuales de paquetes</span>
          </div>
        </div>

        {/* KPI 4: Descargas de Excel */}
        <div style={{ backgroundColor: '#ffffff', padding: '18px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Reportes Descargados</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileSpreadsheet style={{ width: '17px', height: '17px', color: '#7c3aed' }} />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
            {kpis.total_descargas_excel.toLocaleString()}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', fontSize: '11px', color: '#64748b' }}>
            <Download style={{ width: '12px', height: '12px', color: '#7c3aed' }} />
            <span>Exportaciones a Excel generadas</span>
          </div>
        </div>

        {/* KPI 5: Cliente Más Frecuente */}
        <div style={{ backgroundColor: '#ffffff', padding: '18px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Cliente Más Activo</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles style={{ width: '17px', height: '17px', color: '#d97706' }} />
            </div>
          </div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {kpis.cliente_mas_activo}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontSize: '11px', color: '#64748b' }}>
            <Activity style={{ width: '12px', height: '12px', color: '#d97706' }} />
            <span>Mayor interacción en la plataforma</span>
          </div>
        </div>

      </div>

      {/* 3. Gráfica de Tendencia Diaria de Uso a Ancho Completo */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '20px 22px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
              Tendencia de Actividad Diaria
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
              Distribución cronológica de interacciones en los últimos {days} días.
            </p>
          </div>

          {/* Leyenda de Colores */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', fontWeight: 600 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#3b82f6' }} />
              <span style={{ color: '#475569' }}>Logins</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#10b981' }} />
              <span style={{ color: '#475569' }}>Búsquedas</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#f97316' }} />
              <span style={{ color: '#475569' }}>Fotos</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#8b5cf6' }} />
              <span style={{ color: '#475569' }}>Excels</span>
            </div>
          </div>
        </div>

        {/* Gráfico Visual Responsivo a Ancho Completo */}
        <div style={{ flex: 1, minHeight: '190px', display: 'flex', alignItems: 'flex-end', gap: '4px', paddingTop: '20px', paddingBottom: '10px', borderBottom: '1px solid #f1f5f9', overflowX: 'auto' }}>
          {data?.tendencia_diaria && data.tendencia_diaria.length > 0 ? (
            data.tendencia_diaria.map((d, idx) => {
              const heightPct = Math.max(Math.min((d.total / maxBarValue) * 100, 100), d.total > 0 ? 8 : 2);
              return (
                <div
                  key={d.fecha}
                  title={`${d.dia} (${d.fecha}):\n• Total: ${d.total}\n• Logins: ${d.logins}\n• Búsquedas: ${d.busquedas}\n• Fotos: ${d.fotos}\n• Excels: ${d.excels}`}
                  style={{
                    flex: 1,
                    minWidth: days > 60 ? '12px' : '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    height: '100%',
                    justifyContent: 'flex-end',
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                >
                  {/* Barra apilada estilizada */}
                  <div
                    style={{
                      width: '100%',
                      height: `${heightPct}%`,
                      borderRadius: '4px 4px 0 0',
                      display: 'flex',
                      flexDirection: 'column-reverse',
                      backgroundColor: d.total === 0 ? '#f1f5f9' : 'transparent',
                      overflow: 'hidden',
                      transition: 'transform 0.15s ease',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scaleY(1.05)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scaleY(1)'; }}
                  >
                    {d.logins > 0 && <div style={{ height: `${(d.logins / d.total) * 100}%`, backgroundColor: '#3b82f6' }} />}
                    {d.busquedas > 0 && <div style={{ height: `${(d.busquedas / d.total) * 100}%`, backgroundColor: '#10b981' }} />}
                    {d.fotos > 0 && <div style={{ height: `${(d.fotos / d.total) * 100}%`, backgroundColor: '#f97316' }} />}
                    {d.excels > 0 && <div style={{ height: `${(d.excels / d.total) * 100}%`, backgroundColor: '#8b5cf6' }} />}
                  </div>

                  {/* Etiqueta de fecha */}
                  {(idx % (days > 30 ? 5 : 2) === 0 || idx === data.tendencia_diaria.length - 1) && (
                    <span style={{ fontSize: '9.5px', color: '#94a3b8', marginTop: '6px', whiteSpace: 'nowrap' }}>
                      {d.dia}
                    </span>
                  )}
                </div>
              );
            })
          ) : (
            <div style={{ width: '100%', textAlign: 'center', color: '#94a3b8', fontSize: '13px', padding: '40px 0' }}>
              Sin registros de actividad en este período.
            </div>
          )}
        </div>
      </div>

      {/* 4. Tabla de Directorio Completo de Clientes y Auditoría de Uso */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
        
        {/* Cabecera de la Tabla y Filtros */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
              Directorio de Clientes y Registro de Actividad
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
              Mostrando {filteredClients.length} de {data?.clientes?.length || 0} cuentas registradas en el portal.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            {/* Buscador de cliente */}
            <div style={{ position: 'relative', width: '240px' }}>
              <Search style={{ width: '14px', height: '14px', color: '#94a3b8', position: 'absolute', left: '10px', top: '10px' }} />
              <input
                type="text"
                placeholder="Buscar por cliente o correo..."
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                style={{
                  width: '100%',
                  height: '34px',
                  paddingLeft: '32px',
                  paddingRight: '10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  outline: 'none',
                  backgroundColor: '#ffffff',
                }}
              />
              {searchFilter && (
                <button
                  type="button"
                  onClick={() => setSearchFilter('')}
                  style={{ position: 'absolute', right: '8px', top: '9px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                >
                  <X style={{ width: '13px', height: '13px' }} />
                </button>
              )}
            </div>

            {/* Filtro de estado de actividad */}
            <select
              value={activityStatusFilter}
              onChange={e => setActivityStatusFilter(e.target.value as any)}
              style={{
                height: '34px',
                padding: '0 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                color: '#334155',
                backgroundColor: '#ffffff',
                cursor: 'pointer',
              }}
            >
              <option value="all">Todas las cuentas</option>
              <option value="active">Con actividad ({data?.clientes?.filter(c => c.total_eventos > 0).length || 0})</option>
              <option value="inactive">Sin actividad reciente ({data?.clientes?.filter(c => c.total_eventos === 0).length || 0})</option>
            </select>
          </div>
        </div>

        {/* Tabla Responsiva */}
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                <th style={{ padding: '12px 16px' }}>Cliente</th>
                <th style={{ padding: '12px 14px', cursor: 'pointer' }} onClick={() => { setSortField('ultimo_acceso'); setSortAsc(!sortAsc); }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>Último Acceso</span>
                    {sortField === 'ultimo_acceso' && <span>{sortAsc ? '↑' : '↓'}</span>}
                  </div>
                </th>
                <th style={{ padding: '12px 10px', textAlign: 'center', cursor: 'pointer' }} onClick={() => { setSortField('logins'); setSortAsc(!sortAsc); }}>
                  Logins
                </th>
                <th style={{ padding: '12px 10px', textAlign: 'center', cursor: 'pointer' }} onClick={() => { setSortField('busquedas'); setSortAsc(!sortAsc); }}>
                  Búsquedas
                </th>
                <th style={{ padding: '12px 10px', textAlign: 'center', cursor: 'pointer' }} onClick={() => { setSortField('fotos_vistas'); setSortAsc(!sortAsc); }}>
                  Fotos
                </th>
                <th style={{ padding: '12px 10px', textAlign: 'center', cursor: 'pointer' }} onClick={() => { setSortField('descargas_excel'); setSortAsc(!sortAsc); }}>
                  Excels
                </th>
                <th style={{ padding: '12px 16px', minWidth: '160px', cursor: 'pointer' }} onClick={() => { setSortField('total_eventos'); setSortAsc(!sortAsc); }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>Nivel Actividad</span>
                    {sortField === 'total_eventos' && <span>{sortAsc ? '↑' : '↓'}</span>}
                  </div>
                </th>
                <th style={{ padding: '12px 14px' }}>Dispositivo</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Paquetes</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Auditoría</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.length > 0 ? (
                filteredClients.map((c, i) => {
                  const activityPct = Math.round((c.total_eventos / maxClientEvents) * 100);
                  const isMobile = c.dispositivo_frecuente.toLowerCase().includes('móvil') || c.dispositivo_frecuente.toLowerCase().includes('movil');
                  const isTablet = c.dispositivo_frecuente.toLowerCase().includes('tablet');

                  return (
                    <tr
                      key={c.id || c.email}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: i % 2 === 0 ? '#ffffff' : '#fafafa',
                        transition: 'background-color 0.1s ease',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#f1f5f9'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = i % 2 === 0 ? '#ffffff' : '#fafafa'; }}
                    >
                      {/* Cliente (Nombre + Email + Estado) */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              backgroundColor: c.activo ? '#e0f2fe' : '#fee2e2',
                              color: c.activo ? '#0369a1' : '#991b1b',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '12px',
                              flexShrink: 0,
                            }}
                          >
                            {(c.nombre_completo || c.email).slice(0, 2).toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                              {c.nombre_completo || 'Sin nombre'}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                              {c.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Último Acceso */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Clock style={{ width: '13px', height: '13px', color: c.ultimo_acceso ? '#10b981' : '#94a3b8' }} />
                          <div>
                            <div style={{ fontWeight: 600, color: '#1e293b' }}>
                              {formatTimeAgo(c.ultimo_acceso)}
                            </div>
                            {c.ultimo_acceso && (
                              <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                                {new Date(c.ultimo_acceso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Logins */}
                      <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 600, color: '#334155' }}>
                        {c.logins}
                      </td>

                      {/* Búsquedas */}
                      <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 600, color: '#059669' }}>
                        {c.busquedas}
                      </td>

                      {/* Fotos */}
                      <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 600, color: '#ea580c' }}>
                        {c.fotos_vistas}
                      </td>

                      {/* Excels */}
                      <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 600, color: '#7c3aed' }}>
                        {c.descargas_excel}
                      </td>

                      {/* Nivel de Actividad Visual */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ flex: 1, height: '6px', backgroundColor: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                            <div
                              style={{
                                height: '100%',
                                width: `${Math.max(activityPct, c.total_eventos > 0 ? 5 : 0)}%`,
                                backgroundColor: activityPct > 50 ? '#10b981' : activityPct > 20 ? '#3b82f6' : '#f59e0b',
                                borderRadius: '999px',
                              }}
                            />
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', minWidth: '40px', textAlign: 'right' }}>
                            {c.total_eventos} act.
                          </span>
                        </div>
                      </td>

                      {/* Dispositivo habitual */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#475569' }}>
                          {isMobile ? (
                            <Smartphone style={{ width: '14px', height: '14px', color: '#3b82f6' }} />
                          ) : isTablet ? (
                            <Tablet style={{ width: '14px', height: '14px', color: '#8b5cf6' }} />
                          ) : (
                            <Monitor style={{ width: '14px', height: '14px', color: '#64748b' }} />
                          )}
                          <span>{c.dispositivo_frecuente}</span>
                        </div>
                      </td>

                      {/* Paquetes Estimados */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: c.es_admin ? '#c2410c' : '#0369a1',
                            backgroundColor: c.es_admin ? '#fff7ed' : '#f0f9ff',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            border: `1px solid ${c.es_admin ? '#ffedd5' : '#bae6fd'}`,
                          }}
                          title={c.es_admin ? 'Acceso total absoluto al sistema' : undefined}
                        >
                          {c.paquetes_estimados.toLocaleString()} {c.es_admin ? '(Total)' : ''}
                        </span>
                      </td>

                      {/* Botón Auditoría */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenClientAudit(c)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '5px 10px',
                            backgroundColor: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#0f172a',
                            cursor: 'pointer',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                          }}
                        >
                          <Activity style={{ width: '12px', height: '12px', color: '#ff5722' }} />
                          <span>Ver Historial</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} style={{ padding: '36px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                    No se encontraron clientes que coincidan con el filtro actual.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Modal / Drawer de Historial Detallado del Cliente */}
      {selectedClientForAudit && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(3px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setSelectedClientForAudit(null)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              maxWidth: '720px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity style={{ width: '18px', height: '18px', color: '#ff5722' }} />
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                    Historial de Actividad y Auditoría
                  </h3>
                </div>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>
                  <strong>{selectedClientForAudit.nombre_completo}</strong> ({selectedClientForAudit.email})
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedClientForAudit(null)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#64748b',
                }}
              >
                <X style={{ width: '16px', height: '16px' }} />
              </button>
            </div>

            {/* Modal Body / Timeline */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {isLoadingAudit ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                  <RefreshCw style={{ width: '24px', height: '24px', animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
                  <span style={{ fontSize: '13px' }}>Cargando eventos de auditoría...</span>
                </div>
              ) : auditEvents.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {auditEvents.map(evt => {
                    let badgeColor = '#3b82f6';
                    let badgeBg = '#eff6ff';
                    let label = evt.tipo_evento;

                    if (evt.tipo_evento === 'LOGIN_EXITOSO') {
                      badgeColor = '#2563eb';
                      badgeBg = '#eff6ff';
                      label = 'Inicio de Sesión';
                    } else if (evt.tipo_evento === 'BUSQUEDA_INVENTARIO') {
                      badgeColor = '#059669';
                      badgeBg = '#ecfdf5';
                      label = 'Búsqueda en Inventario';
                    } else if (evt.tipo_evento === 'VER_FOTO_ALMACEN') {
                      badgeColor = '#ea580c';
                      badgeBg = '#fff7ed';
                      label = 'Inspección Foto Almacén';
                    } else if (evt.tipo_evento === 'EXPORTAR_EXCEL') {
                      badgeColor = '#7c3aed';
                      badgeBg = '#f5f3ff';
                      label = 'Descarga Reporte Excel';
                    } else if (evt.tipo_evento === 'FILTRO_ESTADO') {
                      badgeColor = '#0891b2';
                      badgeBg = '#ecfeff';
                      label = 'Filtro por Estado';
                    }

                    return (
                      <div
                        key={evt.id}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          backgroundColor: '#ffffff',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: badgeColor,
                              backgroundColor: badgeBg,
                              padding: '2px 8px',
                              borderRadius: '6px',
                            }}
                          >
                            {label}
                          </span>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {formatFullDate(evt.creado_en)}
                          </span>
                        </div>

                        {/* Detalles específicos del evento */}
                        <div style={{ fontSize: '12px', color: '#334155' }}>
                          {evt.detalles?.query && (
                            <div><strong>Búsqueda:</strong> &quot;{evt.detalles.query}&quot;</div>
                          )}
                          {evt.detalles?.wr && (
                            <div><strong>Recibo Almacén (WR):</strong> {evt.detalles.wr}</div>
                          )}
                          {evt.detalles?.tracking && (
                            <div><strong>Tracking:</strong> {evt.detalles.tracking}</div>
                          )}
                          {evt.detalles?.estado && (
                            <div><strong>Filtro Estado:</strong> {evt.detalles.estado}</div>
                          )}
                          {evt.detalles?.scope && (
                            <div><strong>Alcance Excel:</strong> {evt.detalles.scope} ({evt.detalles.filename || ''})</div>
                          )}
                        </div>

                        {/* Metadata técnica (dispositivo, navegador, IP) */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '10.5px', color: '#94a3b8', borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
                          <span>📱 {evt.dispositivo || 'Escritorio'}</span>
                          <span>🌐 {evt.navegador || 'Navegador'}</span>
                          {evt.ip && <span>🔒 IP: {evt.ip}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: '13px' }}>
                  No hay eventos registrados aún para este cliente.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '14px 22px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#f8fafc' }}>
              <button
                type="button"
                onClick={() => setSelectedClientForAudit(null)}
                style={{
                  padding: '7px 18px',
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
