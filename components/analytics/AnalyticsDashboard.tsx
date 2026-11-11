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
  Mail,
  Send,
} from 'lucide-react';

interface KPIResumen {
  total_clientes: number;
  activos_hoy: number;
  activos_periodo: number;
  total_busquedas: number;
  total_fotos_vistas: number;
  total_descargas_excel: number;
  total_logins: number;
  total_correos_enviados?: number;
  cliente_mas_activo: string;
  clientes_activados: number;
  clientes_nunca_ingresaron: number;
  clientes_en_riesgo: number;
  clientes_solo_correo: number;
  tasa_activacion: number;
}

interface ComparativaPeriodo {
  activos_periodo: number;
  total_actividad: number;
  total_logins: number;
  total_busquedas: number;
  total_fotos_vistas: number;
  total_descargas_excel: number;
  total_correos_enviados: number;
}

interface ConversionCorreos {
  correos_analizados: number;
  conversiones_24h: number;
  conversiones_72h: number;
  tasa_24h: number;
  tasa_72h: number;
  clientes_convertidos_24h: number;
}

interface DistribucionItem {
  nombre: string;
  cantidad: number;
  porcentaje: number;
}

interface DistribucionHora {
  hora: number;
  cantidad: number;
}

interface DistribucionData {
  dispositivos: DistribucionItem[];
  navegadores: DistribucionItem[];
  horas: DistribucionHora[];
}

interface DiaTendencia {
  fecha: string;
  dia: string;
  busquedas: number;
  fotos: number;
  excels: number;
  logins: number;
  correos?: number;
  actividad?: number;
  otros?: number;
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
  ultimo_login: string | null;
  ultima_actividad: string | null;
  dias_sin_actividad?: number | null;
  en_riesgo?: boolean;
  nunca_ingreso?: boolean;
  total_eventos: number;
  total_interacciones?: number;
  logins: number;
  busquedas: number;
  fotos_vistas: number;
  descargas_excel: number;
  correos_enviados: number;
  dispositivo_frecuente: string;
  paquetes_estimados: number;
}

interface AnalyticsData {
  periodo_dias: number;
  resumen_kpis: KPIResumen;
  tendencia_diaria: DiaTendencia[];
  top_busquedas: TopBusqueda[];
  clientes: ClienteAnalitica[];
  comparativa?: { periodo_anterior: ComparativaPeriodo };
  conversion_correos?: ConversionCorreos;
  distribucion?: DistribucionData;
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
  const [sortField, setSortField] = useState<keyof ClienteAnalitica>('total_interacciones' as any);
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Modal de auditoría por cliente
  const [selectedClientForAudit, setSelectedClientForAudit] = useState<ClienteAnalitica | null>(null);
  const [auditEvents, setAuditEvents] = useState<EventoAuditoria[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState<boolean>(false);
  const [auditTotal, setAuditTotal] = useState<number>(0);
  const [auditOffset, setAuditOffset] = useState<number>(0);
  const [auditEventType, setAuditEventType] = useState<string>('ALL');
  const [auditFrom, setAuditFrom] = useState<string>('');
  const [auditTo, setAuditTo] = useState<string>('');
  const [appliedAuditFilters, setAppliedAuditFilters] = useState<{ eventType: string; from: string; to: string }>({ eventType: 'ALL', from: '', to: '' });
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  const AUDIT_PAGE_SIZE = 30;

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

  // Cargar auditoría detallada de un cliente (con filtros y paginación)
  const fetchClientAudit = async (
    cliente: ClienteAnalitica,
    opts: { eventType?: string; from?: string; to?: string; offset?: number } = {}
  ) => {
    const eventType = opts.eventType ?? 'ALL';
    const from = opts.from ?? '';
    const to = opts.to ?? '';
    const offset = opts.offset ?? 0;

    setIsLoadingAudit(true);
    try {
      const params = new URLSearchParams({
        admin_email: adminEmail,
        client_email: cliente.email,
        event_type: eventType,
        limit: String(AUDIT_PAGE_SIZE),
        offset: String(offset),
      });
      if (from) params.set('from', from);
      if (to) params.set('to', to);

      const res = await fetch(`/api/analiticas-uso?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setAuditEvents(json.historial || []);
        setAuditTotal(typeof json.total === 'number' ? json.total : 0);
        setAuditOffset(offset);
        setAppliedAuditFilters({ eventType, from, to });
      }
    } catch (e) {
      console.error('Error al cargar historial de auditoría:', e);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  const handleOpenClientAudit = (cliente: ClienteAnalitica) => {
    setSelectedClientForAudit(cliente);
    setAuditEvents([]);
    setAuditTotal(0);
    setAuditOffset(0);
    setAuditEventType('ALL');
    setAuditFrom('');
    setAuditTo('');
    fetchClientAudit(cliente, { offset: 0 });
  };

  const applyAuditFilters = () => {
    if (!selectedClientForAudit) return;
    fetchClientAudit(selectedClientForAudit, {
      eventType: auditEventType,
      from: auditFrom,
      to: auditTo,
      offset: 0,
    });
  };

  const changeAuditPage = (nextOffset: number) => {
    if (!selectedClientForAudit || nextOffset < 0) return;
    fetchClientAudit(selectedClientForAudit, {
      eventType: appliedAuditFilters.eventType,
      from: appliedAuditFilters.from,
      to: appliedAuditFilters.to,
      offset: nextOffset,
    });
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
      timeZone: 'America/Lima',
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
      let valA: any = a[sortField];
      let valB: any = b[sortField];
      if (sortField === ('total_interacciones' as any) || sortField === 'total_eventos') {
        valA = a.total_interacciones ?? (a.total_eventos + (a.correos_enviados || 0));
        valB = b.total_interacciones ?? (b.total_eventos + (b.correos_enviados || 0));
      }
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
      'Ultimo Login',
      'Ultima Actividad (periodo)',
      'Total Actividad Web',
      'Correos Automaticos',
      'Total Interacciones Combinadas',
      `Logins (${days} dias)`,
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
      `"${formatFullDate(c.ultimo_login)}"`,
      `"${formatFullDate(c.ultima_actividad)}"`,
      c.total_eventos,
      c.correos_enviados || 0,
      (c.total_interacciones ?? (c.total_eventos + (c.correos_enviados || 0))),
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

  // Cálculo para el gráfico de barras nativo y escala del eje Y
  const yAxisMax = useMemo(() => {
    if (!data?.tendencia_diaria?.length) return 20;
    const max = Math.max(...data.tendencia_diaria.map(d => d.total), 0);
    if (max <= 5) return 5;
    if (max <= 10) return 10;
    if (max <= 20) return 20;
    if (max <= 50) return 50;
    if (max <= 100) return 100;
    if (max <= 150) return 150;
    if (max <= 200) return 200;
    return Math.ceil((max * 1.1) / 50) * 50;
  }, [data?.tendencia_diaria]);

  const maxClientEvents = useMemo(() => {
    if (!data?.clientes?.length) return 1;
    const max = Math.max(...data.clientes.map(c => c.total_eventos));
    return max > 0 ? max : 1;
  }, [data?.clientes]);

  const maxClientInteractions = useMemo(() => {
    if (!data?.clientes?.length) return 1;
    const max = Math.max(...data.clientes.map(c => (c.total_interacciones ?? (c.total_eventos + (c.correos_enviados || 0)))));
    return max > 0 ? max : 1;
  }, [data?.clientes]);

  const prev = data?.comparativa?.periodo_anterior;
  const conversion = data?.conversion_correos;
  const distribucion = data?.distribucion;
  const horas = distribucion?.horas || [];
  const maxHourCount = Math.max(...horas.map(h => h.cantidad), 1);

  const clientesEnRiesgoTop = useMemo(
    () => (data?.clientes || [])
      .filter(c => c.en_riesgo)
      .sort((a, b) => (b.dias_sin_actividad || 0) - (a.dias_sin_actividad || 0))
      .slice(0, 5),
    [data?.clientes]
  );

  const nuncaIngresaronTop = useMemo(
    () => (data?.clientes || [])
      .filter(c => c.nunca_ingreso)
      .sort((a, b) => (b.correos_enviados || 0) - (a.correos_enviados || 0))
      .slice(0, 5),
    [data?.clientes]
  );

  const oportunidadesTop = useMemo(
    () => (data?.clientes || [])
      .filter(c => (c.paquetes_estimados || 0) > 0)
      .sort((a, b) => {
        // Menor uso por paquete primero; a igual ratio, mayor volumen de paquetes.
        const ratioA = (a.total_eventos + 1) / ((a.paquetes_estimados || 0) + 1);
        const ratioB = (b.total_eventos + 1) / ((b.paquetes_estimados || 0) + 1);
        return ratioA - ratioB || (b.paquetes_estimados || 0) - (a.paquetes_estimados || 0);
      })
      .slice(0, 6),
    [data?.clientes]
  );

  const horasPico = [...horas]
    .filter(h => h.cantidad > 0)
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 3);

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
    total_correos_enviados: 0,
    cliente_mas_activo: 'Sin datos',
    clientes_activados: 0,
    clientes_nunca_ingresaron: 0,
    clientes_en_riesgo: 0,
    clientes_solo_correo: 0,
    tasa_activacion: 0,
  };

  const prettyLabel = (value: string) => {
    const clean = (value || '').trim();
    if (/^ma3vil$/i.test(clean) || /^m[oó0]vil$/i.test(clean)) return 'Móvil';
    if (/^desconocido$/i.test(clean)) return 'Desconocido';
    if (/^escritorio$/i.test(clean)) return 'Escritorio';
    return clean || 'Desconocido';
  };

  // Comparación contra el período inmediatamente anterior del mismo tamaño.
  const renderVariation = (current: number, previousValue?: number | null) => {
    if (!previousValue || previousValue <= 0) {
      return (
        <span style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: 500 }}>
          Sin base anterior
        </span>
      );
    }

    const delta = current - previousValue;
    const pct = Math.round((delta / previousValue) * 1000) / 10;
    const isUp = delta >= 0;

    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10.5px', fontWeight: 700, color: isUp ? '#16a34a' : '#dc2626', flexWrap: 'wrap' }}>
        <span>{isUp ? '▲' : '▼'} {Math.abs(pct)}%</span>
        <span style={{ color: '#94a3b8', fontWeight: 500 }}>
          vs. período anterior ({previousValue.toLocaleString()})
        </span>
      </span>
    );
  };

  const kpiCardStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    padding: '18px 20px',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
  };

  const sectionTitleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '15px',
    fontWeight: 700,
    color: '#0f172a',
  };

  const sectionSubtitleStyle: React.CSSProperties = {
    margin: '2px 0 0',
    fontSize: '12px',
    color: '#64748b',
  };

  const renderDistributionCard = (
    title: string,
    subtitle: string,
    items: DistribucionItem[] | undefined,
    icon: React.ReactNode,
    color: string
  ) => {
    const list = (items || []).map(item => ({ ...item, nombre: prettyLabel(item.nombre) }));
    const total = list.reduce((sum, item) => sum + item.cantidad, 0);

    return (
      <div style={kpiCardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>{title}</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>{subtitle}</div>
          </div>
          <div style={{ width: '30px', height: '30px', borderRadius: '8px', backgroundColor: `${color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {icon}
          </div>
        </div>

        {list.length === 0 ? (
          <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', padding: '12px 0' }}>
            Sin datos en el período.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
            {list.map(item => {
              const pct = total > 0 ? (item.cantidad / total) * 100 : 0;
              return (
                <div key={item.nombre}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '11.5px', marginBottom: '3px' }}>
                    <span style={{ color: '#475569', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.nombre}
                    </span>
                    <span style={{ color: '#0f172a', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {item.cantidad.toLocaleString()}
                      <span style={{ color: '#94a3b8', fontWeight: 500 }}> ({item.porcentaje}%)</span>
                    </span>
                  </div>
                  <div style={{ height: '5px', borderRadius: '999px', backgroundColor: '#f1f5f9', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(pct, 2)}%`, height: '100%', borderRadius: '999px', backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
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
                Actividad real del cliente en los últimos {days} días. Los correos automáticos del sistema se contabilizan aparte.
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
            <span>con actividad real en {days} días ({kpis.activos_periodo} de {kpis.total_clientes})</span>
          </div>
          <div style={{ marginTop: '4px', fontSize: '11px', color: '#64748b' }}>
            <strong style={{ color: '#2563eb' }}>{kpis.total_logins}</strong> login(s) en el período
          </div>
          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
            {renderVariation(kpis.activos_periodo, prev?.activos_periodo)}
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
          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
            {renderVariation(kpis.total_busquedas, prev?.total_busquedas)}
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
          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
            {renderVariation(kpis.total_fotos_vistas, prev?.total_fotos_vistas)}
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
          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
            {renderVariation(kpis.total_descargas_excel, prev?.total_descargas_excel)}
          </div>
        </div>

        {/* KPI 5: Correos Enviados a Clientes */}
        <div style={{ backgroundColor: '#ffffff', padding: '18px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Correos Automáticos</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#f0f9ff', border: '1px solid #e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Mail style={{ width: '17px', height: '17px', color: '#0284c7' }} />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
            {(kpis.total_correos_enviados || 0).toLocaleString()}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', fontSize: '11px', color: '#64748b' }}>
            <Send style={{ width: '12px', height: '12px', color: '#0284c7' }} />
            <span>Enviados por el sistema · no cuentan como actividad</span>
          </div>
          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
            {renderVariation(kpis.total_correos_enviados || 0, prev?.total_correos_enviados)}
          </div>
        </div>

        {/* KPI 6: Cliente Más Frecuente */}
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

      {/* 3. Salud de la Base de Clientes */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 style={sectionTitleStyle}>Salud de la Base de Clientes</h3>
            <p style={sectionSubtitleStyle}>Adopción real del portal: quién ingresó, quién nunca lo hizo y quién se está enfriando.</p>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '999px', padding: '4px 10px', fontWeight: 600 }}>
            {kpis.total_clientes} clientes registrados
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '14px' }}>

          {/* Tasa de activación */}
          <div style={{ ...kpiCardStyle, borderLeft: '3px solid #10b981' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Tasa de Activación</span>
              <CheckCircle2 style={{ width: '16px', height: '16px', color: '#10b981' }} />
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
              {kpis.tasa_activacion.toLocaleString()}%
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
              <strong style={{ color: '#059669' }}>{kpis.clientes_activados}</strong> de {kpis.total_clientes} clientes con al menos un login.
            </div>
            <div style={{ marginTop: '8px', height: '6px', borderRadius: '999px', backgroundColor: '#f1f5f9', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(kpis.tasa_activacion, 100)}%`, height: '100%', borderRadius: '999px', backgroundColor: '#10b981' }} />
            </div>
          </div>

          {/* Nunca ingresaron */}
          <div style={{ ...kpiCardStyle, borderLeft: '3px solid #f59e0b' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Nunca Ingresaron</span>
              <XCircle style={{ width: '16px', height: '16px', color: '#f59e0b' }} />
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
              {kpis.clientes_nunca_ingresaron}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
              Cuentas creadas que no registran ningún inicio de sesión.
            </div>
            <div style={{ marginTop: '8px', fontSize: '10.5px', color: '#b45309', fontWeight: 600 }}>
              Oportunidad de campaña de activación
            </div>
          </div>

          {/* En riesgo */}
          <div style={{ ...kpiCardStyle, borderLeft: '3px solid #dc2626' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Clientes en Riesgo</span>
              <Clock style={{ width: '16px', height: '16px', color: '#dc2626' }} />
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
              {kpis.clientes_en_riesgo}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
              Ya ingresaron alguna vez, pero llevan más de 30 días sin actividad.
            </div>
            <div style={{ marginTop: '8px', fontSize: '10.5px', color: '#b91c1c', fontWeight: 600 }}>
              Priorizar contacto y seguimiento
            </div>
          </div>

          {/* Solo correo */}
          <div style={{ ...kpiCardStyle, borderLeft: '3px solid #0284c7' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Solo Reciben Correos</span>
              <Mail style={{ width: '16px', height: '16px', color: '#0284c7' }} />
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
              {kpis.clientes_solo_correo}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
              Recibieron notificaciones pero no hicieron ninguna acción en el período.
            </div>
            <div style={{ marginTop: '8px', fontSize: '10.5px', color: '#0369a1', fontWeight: 600 }}>
              El correo no está generando retorno
            </div>
          </div>

        </div>
      </div>

      {/* 4. Impacto de las Notificaciones */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
          <div>
            <h3 style={sectionTitleStyle}>Impacto de las Notificaciones</h3>
            <p style={sectionSubtitleStyle}>
              Atribución simple: se cuenta un correo cuando existe un login posterior del mismo cliente dentro de la ventana. No implica causalidad.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#0369a1', backgroundColor: '#f0f9ff', border: '1px solid #e0f2fe', padding: '4px 10px', borderRadius: '999px', fontWeight: 600 }}>
            <Mail style={{ width: '12px', height: '12px' }} />
            {(conversion?.correos_analizados || 0).toLocaleString()} correos analizados
          </div>
        </div>

        {conversion && conversion.correos_analizados > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '14px' }}>

            {[
              {
                label: 'Login en 24 horas',
                tasa: conversion.tasa_24h,
                hitos: conversion.conversiones_24h,
                color: '#0284c7',
                note: 'Ventana corta: intención inmediata tras la notificación.',
              },
              {
                label: 'Login en 72 horas',
                tasa: conversion.tasa_72h,
                hitos: conversion.conversiones_72h,
                color: '#0369a1',
                note: 'Ventana amplia: incluye decisiones de compra o consulta.',
              },
            ].map(item => (
              <div key={item.label} style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>{item.label}</span>
                  <Send style={{ width: '14px', height: '14px', color: item.color }} />
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: '4px', letterSpacing: '-0.5px' }}>
                  {item.tasa}%
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                  {item.hitos.toLocaleString()} de {conversion.correos_analizados.toLocaleString()} correos con login posterior.
                </div>
                <div style={{ marginTop: '8px', height: '6px', borderRadius: '999px', backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(item.tasa, 100)}%`, height: '100%', borderRadius: '999px', backgroundColor: item.color }} />
                </div>
                <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '7px' }}>{item.note}</div>
              </div>
            ))}

            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>Clientes Convertidos</span>
                <Users style={{ width: '14px', height: '14px', color: '#059669' }} />
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: '4px', letterSpacing: '-0.5px' }}>
                {conversion.clientes_convertidos_24h}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                Clientes distintos que volvieron a ingresar dentro de las 24 horas posteriores a un correo.
              </div>
              <div style={{ marginTop: '9px', fontSize: '10.5px', color: '#059669', fontWeight: 600 }}>
                {kpis.clientes_solo_correo > 0
                  ? `${kpis.clientes_solo_correo} cliente(s) solo reciben correos y no ingresan.`
                  : 'Todos los clientes notificados muestran actividad.'}
              </div>
            </div>

          </div>
        ) : (
          <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', padding: '8px 0' }}>
            Sin correos registrados en el período para calcular conversión.
          </div>
        )}
      </div>

      {/* 5. Gráfica de Tendencia Diaria de Uso a Ancho Completo */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '20px 22px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
              Tendencia de Actividad Diaria
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
              Actividad del cliente y correos automáticos de los últimos {days} días. El tooltip separa ambos.
            </p>
          </div>

          {/* Leyenda de Colores */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '11px', fontWeight: 600, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#3b82f6' }} />
              <span style={{ color: '#475569' }}>Logins</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#10b981' }} />
              <span style={{ color: '#475569' }}>Búsquedas</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#f97316' }} />
              <span style={{ color: '#475569' }}>Fotos</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#8b5cf6' }} />
              <span style={{ color: '#475569' }}>Excels</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#94a3b8' }} />
              <span style={{ color: '#475569' }}>Otros</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#0284c7' }} />
              <span style={{ color: '#475569' }}>Correos</span>
            </div>
          </div>
        </div>

        {/* Gráfico con escala Y y barras apiladas */}
        {data?.tendencia_diaria && data.tendencia_diaria.length > 0 ? (
          <div style={{ display: 'flex', width: '100%', gap: '10px', marginTop: '10px' }}>
            {/* Columna de Escala Eje Y (Valores de referencia) */}
            <div
              style={{
                width: '38px',
                height: '220px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                paddingRight: '6px',
                fontSize: '10px',
                fontWeight: 600,
                color: '#94a3b8',
                userSelect: 'none',
              }}
            >
              <span>{yAxisMax}</span>
              <span>{Math.round(yAxisMax * 0.75)}</span>
              <span>{Math.round(yAxisMax * 0.5)}</span>
              <span>{Math.round(yAxisMax * 0.25)}</span>
              <span>0</span>
            </div>

            {/* Contenedor Principal de la Gráfica */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              {/* Área de Barras con Líneas Guía Horizontales */}
              <div
                style={{
                  position: 'relative',
                  height: '220px',
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: days > 60 ? '2px' : '4px',
                  borderBottom: '1px solid #cbd5e1',
                }}
              >
                {/* 4 Líneas de referencia de fondo */}
                <div style={{ position: 'absolute', left: 0, right: 0, top: 0, borderBottom: '1px dashed #f1f5f9', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', left: 0, right: 0, top: '25%', borderBottom: '1px dashed #f1f5f9', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', borderBottom: '1px dashed #f1f5f9', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', left: 0, right: 0, top: '75%', borderBottom: '1px dashed #f1f5f9', pointerEvents: 'none' }} />

                {/* Columnas de cada día */}
                {data.tendencia_diaria.map((d, idx) => {
                  const barHeightPct = d.total > 0 ? Math.max((d.total / yAxisMax) * 100, 3) : 0;
                  const isHovered = hoveredBarIndex === idx;
                  const actividad = d.actividad ?? Math.max(d.total - (d.correos || 0), 0);
                  const otros = d.otros || 0;
                  const pctLabel = (value: number) => {
                    if (!d.total || value <= 0) return '0%';
                    const p = (value / d.total) * 100;
                    return p < 1 ? '<1%' : `${Math.round(p)}%`;
                  };

                  // Tooltip alignment: prevent clipping on edges
                  const isNearLeft = idx < 3;
                  const isNearRight = idx > data.tendencia_diaria.length - 4;

                  return (
                    <div
                      key={d.fecha}
                      onMouseEnter={() => setHoveredBarIndex(idx)}
                      onMouseLeave={() => setHoveredBarIndex(null)}
                      style={{
                        flex: 1,
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                        position: 'relative',
                        cursor: 'pointer',
                        zIndex: isHovered ? 25 : 1,
                      }}
                    >
                      {/* Tooltip flotante interactivo */}
                      {isHovered && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: `calc(${Math.min(barHeightPct, 100)}% + 12px)`,
                            left: isNearLeft ? '0' : isNearRight ? 'auto' : '50%',
                            right: isNearRight ? '0' : 'auto',
                            transform: isNearLeft || isNearRight ? 'none' : 'translateX(-50%)',
                            backgroundColor: '#0f172a',
                            color: '#ffffff',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            fontSize: '11px',
                            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.4)',
                            pointerEvents: 'none',
                            whiteSpace: 'nowrap',
                            zIndex: 40,
                          }}
                        >
                          <div style={{ fontWeight: 700, borderBottom: '1px solid #334155', paddingBottom: '4px', marginBottom: '6px', fontSize: '11.5px', color: '#f8fafc' }}>
                            📅 {d.dia} <span style={{ color: '#94a3b8', fontWeight: 500 }}>({d.fecha})</span>
                          </div>
                          <div style={{ fontWeight: 800, color: '#38bdf8', marginBottom: '4px', fontSize: '12px' }}>
                            Total: {d.total} {d.total === 1 ? 'evento' : 'eventos'}
                          </div>
                          {d.total > 0 && (
                            <div style={{ fontSize: '10.5px', color: '#cbd5e1', marginBottom: '6px' }}>
                              Actividad cliente: <b style={{ color: '#ffffff' }}>{actividad}</b> ({pctLabel(actividad)})
                              {' · '}
                              Correos: <b style={{ color: '#ffffff' }}>{d.correos || 0}</b> ({pctLabel(d.correos || 0)})
                            </div>
                          )}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '3px', fontSize: '11px' }}>
                            {d.logins > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                                <span style={{ color: '#60a5fa' }}>● Logins:</span>
                                <b style={{ color: '#ffffff' }}>{d.logins} <span style={{ color: '#94a3b8', fontWeight: 500 }}>({pctLabel(d.logins)})</span></b>
                              </div>
                            )}
                            {d.busquedas > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                                <span style={{ color: '#34d399' }}>● Búsquedas:</span>
                                <b style={{ color: '#ffffff' }}>{d.busquedas} <span style={{ color: '#94a3b8', fontWeight: 500 }}>({pctLabel(d.busquedas)})</span></b>
                              </div>
                            )}
                            {d.fotos > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                                <span style={{ color: '#fb923c' }}>● Fotos Vistas:</span>
                                <b style={{ color: '#ffffff' }}>{d.fotos} <span style={{ color: '#94a3b8', fontWeight: 500 }}>({pctLabel(d.fotos)})</span></b>
                              </div>
                            )}
                            {d.excels > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                                <span style={{ color: '#c084fc' }}>● Excels:</span>
                                <b style={{ color: '#ffffff' }}>{d.excels} <span style={{ color: '#94a3b8', fontWeight: 500 }}>({pctLabel(d.excels)})</span></b>
                              </div>
                            )}
                            {otros > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                                <span style={{ color: '#cbd5e1' }}>● Otras acciones:</span>
                                <b style={{ color: '#ffffff' }}>{otros} <span style={{ color: '#94a3b8', fontWeight: 500 }}>({pctLabel(otros)})</span></b>
                              </div>
                            )}
                            {(d.correos || 0) > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', borderTop: '1px solid #334155', paddingTop: '4px', marginTop: '2px' }}>
                                <span style={{ color: '#38bdf8' }}>✉️ Correos automáticos:</span>
                                <b style={{ color: '#ffffff' }}>{d.correos} <span style={{ color: '#94a3b8', fontWeight: 500 }}>({pctLabel(d.correos || 0)})</span></b>
                              </div>
                            )}
                            {d.total === 0 && (
                              <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>Sin eventos registrados</div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Barra apilada o indicador neutro */}
                      {d.total > 0 ? (
                        <div
                          style={{
                            width: '100%',
                            maxWidth: '28px',
                            height: `${barHeightPct}%`,
                            borderRadius: '4px 4px 0 0',
                            display: 'flex',
                            flexDirection: 'column-reverse',
                            overflow: 'hidden',
                            boxShadow: isHovered ? '0 0 0 2px #0284c7' : 'none',
                            filter: isHovered ? 'brightness(1.1)' : 'none',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {d.logins > 0 && <div style={{ height: `${(d.logins / d.total) * 100}%`, backgroundColor: '#3b82f6' }} />}
                          {d.busquedas > 0 && <div style={{ height: `${(d.busquedas / d.total) * 100}%`, backgroundColor: '#10b981' }} />}
                          {d.fotos > 0 && <div style={{ height: `${(d.fotos / d.total) * 100}%`, backgroundColor: '#f97316' }} />}
                          {d.excels > 0 && <div style={{ height: `${(d.excels / d.total) * 100}%`, backgroundColor: '#8b5cf6' }} />}
                          {otros > 0 && <div style={{ height: `${(otros / d.total) * 100}%`, backgroundColor: '#94a3b8' }} />}
                          {(d.correos || 0) > 0 && <div style={{ height: `${((d.correos || 0) / d.total) * 100}%`, backgroundColor: '#0284c7' }} />}
                        </div>
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            maxWidth: '28px',
                            height: '2px',
                            backgroundColor: isHovered ? '#94a3b8' : '#e2e8f0',
                            transition: 'background-color 0.15s ease',
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Fila de Etiquetas de Fecha (Eje X) */}
              <div
                style={{
                  display: 'flex',
                  gap: days > 60 ? '2px' : '4px',
                  paddingTop: '8px',
                  height: '24px',
                }}
              >
                {data.tendencia_diaria.map((d, idx) => {
                  const step = days <= 7 ? 1 : days <= 15 ? 2 : days <= 30 ? 3 : days <= 90 ? 7 : 14;
                  const isVisible = idx % step === 0 || idx === data.tendencia_diaria.length - 1;
                  return (
                    <div
                      key={d.fecha}
                      style={{
                        flex: 1,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      {isVisible && (
                        <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap' }}>
                          {d.dia}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ width: '100%', textAlign: 'center', color: '#94a3b8', fontSize: '13px', padding: '40px 0' }}>
            Sin registros de actividad en este período.
          </div>
        )}
      </div>

      {/* 6. Comportamiento de Uso */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 style={sectionTitleStyle}>Comportamiento de Uso</h3>
            <p style={sectionSubtitleStyle}>
              Desde qué dispositivo y navegador ingresan los clientes, y en qué horario se concentra la actividad real.
            </p>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '999px', padding: '4px 10px', fontWeight: 600 }}>
            Solo actividad del cliente · sin correos automáticos
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
          {renderDistributionCard(
            'Dispositivos',
            'Participación sobre eventos de cliente',
            distribucion?.dispositivos,
            <Monitor style={{ width: '15px', height: '15px', color: '#7c3aed' }} />,
            '#7c3aed'
          )}

          {renderDistributionCard(
            'Navegadores',
            'Participación sobre eventos de cliente',
            distribucion?.navegadores,
            <Layers style={{ width: '15px', height: '15px', color: '#0891b2' }} />,
            '#0891b2'
          )}

          {/* Mapa de horas pico */}
          <div style={kpiCardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>Hora Pico</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>Eventos de cliente por hora (hora Perú)</div>
              </div>
              <div style={{ width: '30px', height: '30px', borderRadius: '8px', backgroundColor: '#6366f114', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock style={{ width: '15px', height: '15px', color: '#6366f1' }} />
              </div>
            </div>

            {horas.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', padding: '12px 0' }}>
                Sin datos en el período.
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '104px' }}>
                  {horas.map(h => {
                    const heightPct = maxHourCount > 0 ? (h.cantidad / maxHourCount) * 100 : 0;
                    return (
                      <div
                        key={h.hora}
                        title={`${String(h.hora).padStart(2, '0')}:00 — ${h.cantidad} evento(s)`}
                        style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end' }}
                      >
                        <div
                          style={{
                            width: '100%',
                            height: `${h.cantidad > 0 ? Math.max(heightPct, 6) : 2}%`,
                            borderRadius: '2px 2px 0 0',
                            backgroundColor: h.cantidad > 0 ? '#6366f1' : '#f1f5f9',
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', color: '#94a3b8', marginTop: '4px' }}>
                  <span>00 h</span>
                  <span>06 h</span>
                  <span>12 h</span>
                  <span>18 h</span>
                  <span>23 h</span>
                </div>
                <div style={{ marginTop: '9px', fontSize: '10.5px', color: '#64748b' }}>
                  <strong style={{ color: '#4338ca' }}>Horas pico:</strong>{' '}
                  {horasPico.length > 0
                    ? horasPico.map(h => `${String(h.hora).padStart(2, '0')}:00 (${h.cantidad})`).join(' · ')
                    : 'sin actividad registrada'}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 7. Oportunidades de Recuperación */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 style={sectionTitleStyle}>Oportunidades de Recuperación</h3>
            <p style={sectionSubtitleStyle}>
              Clientes accionables: cuentas que dejaron de entrar y clientes con volumen de paquetes pero bajo uso del portal.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>

          {/* Clientes a recuperar */}
          <div style={{ ...kpiCardStyle, padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>Clientes a Recuperar</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>
                  En riesgo (+30 días sin actividad) o que nunca ingresaron
                </div>
              </div>
              <div style={{ width: '30px', height: '30px', borderRadius: '8px', backgroundColor: '#fef2f214', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock style={{ width: '15px', height: '15px', color: '#dc2626' }} />
              </div>
            </div>

            {clientesEnRiesgoTop.length === 0 && nuncaIngresaronTop.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#059669', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '10px 12px' }}>
                <CheckCircle2 style={{ width: '15px', height: '15px' }} />
                No hay clientes en riesgo ni cuentas sin login.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {clientesEnRiesgoTop.map(c => (
                  <div key={`riesgo-${c.email}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '8px 0', borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.nombre_completo}
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.email} · {c.paquetes_estimados.toLocaleString()} paquete(s)
                      </div>
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#b91c1c', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '999px', padding: '2px 8px', whiteSpace: 'nowrap' }}>
                      {c.dias_sin_actividad ?? 0} d sin actividad
                    </span>
                  </div>
                ))}

                {nuncaIngresaronTop.map(c => (
                  <div key={`nunca-${c.email}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '8px 0', borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.nombre_completo}
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.email} · {c.correos_enviados.toLocaleString()} correo(s) recibido(s)
                      </div>
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#b45309', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '999px', padding: '2px 8px', whiteSpace: 'nowrap' }}>
                      Nunca ingresó
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Más paquetes, menos uso */}
          <div style={{ ...kpiCardStyle, padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>Más Paquetes, Menos Uso</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>
                  Menor actividad por paquete · la barra muestra eventos reales
                </div>
              </div>
              <div style={{ width: '30px', height: '30px', borderRadius: '8px', backgroundColor: '#fff7ed14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Package style={{ width: '15px', height: '15px', color: '#ea580c' }} />
              </div>
            </div>

            {oportunidadesTop.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', padding: '12px 0' }}>
                Sin clientes con paquetes registrados.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                {oportunidadesTop.map(c => {
                  const pctEventos = (c.total_eventos / maxClientEvents) * 100;
                  const ratio = c.total_eventos / (c.paquetes_estimados || 1);
                  const ratioLabel = ratio === 0 ? '0' : ratio < 0.1 ? '<0.1' : String(Math.round(ratio * 10) / 10);
                  return (
                    <div key={`paquetes-${c.email}`}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '11.5px', marginBottom: '3px' }}>
                        <span style={{ color: '#0f172a', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.nombre_completo}
                        </span>
                        <span style={{ color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {c.paquetes_estimados.toLocaleString()} pkg · {c.total_eventos.toLocaleString()} ev.
                        </span>
                      </div>
                      {c.total_eventos === 0 ? (
                        <div style={{ fontSize: '9.5px', color: '#dc2626', fontWeight: 600 }}>
                          Sin actividad en el período
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ flex: 1, height: '6px', borderRadius: '999px', backgroundColor: '#f1f5f9', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.max(pctEventos, 3)}%`, height: '100%', borderRadius: '999px', backgroundColor: '#f97316' }} />
                          </div>
                          <span style={{ fontSize: '9.5px', color: '#94a3b8', whiteSpace: 'nowrap', minWidth: '54px', textAlign: 'right' }}>
                            {ratioLabel} ev/pkg
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* 8. Tabla de Directorio Completo de Clientes y Auditoría de Uso */}
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
                <th style={{ padding: '12px 14px', cursor: 'pointer' }} onClick={() => { setSortField('ultimo_login'); setSortAsc(!sortAsc); }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>Último Login</span>
                    {sortField === 'ultimo_login' && <span>{sortAsc ? '↑' : '↓'}</span>}
                  </div>
                </th>
                <th style={{ padding: '12px 14px', cursor: 'pointer' }} onClick={() => { setSortField('ultima_actividad'); setSortAsc(!sortAsc); }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>Última Actividad</span>
                    {sortField === 'ultima_actividad' && <span>{sortAsc ? '↑' : '↓'}</span>}
                  </div>
                </th>
                <th style={{ padding: '12px 10px', textAlign: 'center', cursor: 'pointer' }} onClick={() => { setSortField('logins'); setSortAsc(!sortAsc); }} title={`Inicios de sesión acumulados en los últimos ${days} días`}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <span>Logins ({days} d)</span>
                    {sortField === 'logins' && <span>{sortAsc ? '↑' : '↓'}</span>}
                  </div>
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
                <th style={{ padding: '12px 10px', textAlign: 'center', cursor: 'pointer' }} onClick={() => { setSortField('correos_enviados'); setSortAsc(!sortAsc); }} title="Correos automáticos enviados por el sistema; no cuentan como actividad del cliente">
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <span>Correos Auto.</span>
                    {sortField === 'correos_enviados' && <span>{sortAsc ? '↑' : '↓'}</span>}
                  </div>
                </th>
                <th
                  style={{ padding: '12px 16px', minWidth: '170px', cursor: 'pointer' }}
                  onClick={() => { setSortField('total_interacciones' as any); setSortAsc(!sortAsc); }}
                  title="Nivel de interacción combinada (acciones del cliente en el portal + correos automáticos notificados)"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>Nivel Actividad</span>
                    {(sortField === ('total_interacciones' as any) || sortField === 'total_eventos') && (
                      <span>{sortAsc ? '↑' : '↓'}</span>
                    )}
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
                  const totalInteracciones = c.total_interacciones ?? (c.total_eventos + (c.correos_enviados || 0));
                  const webPct = maxClientInteractions > 0 ? (c.total_eventos / maxClientInteractions) * 100 : 0;
                  const mailPct = maxClientInteractions > 0 ? ((c.correos_enviados || 0) / maxClientInteractions) * 100 : 0;
                  const totalPct = Math.min(100, Math.round((totalInteracciones / maxClientInteractions) * 100));
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

                      {/* Último Login (histórico) */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Clock style={{ width: '13px', height: '13px', color: c.ultimo_login ? '#10b981' : '#94a3b8' }} />
                          <div>
                            <div style={{ fontWeight: 600, color: '#1e293b' }}>
                              {c.ultimo_login ? formatTimeAgo(c.ultimo_login) : 'Nunca inició sesión'}
                            </div>
                            {c.ultimo_login && (
                              <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                                {new Date(c.ultimo_login).toLocaleString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Última Actividad real del cliente dentro del período */}
                      <td style={{ padding: '12px 14px' }} title="Actividad del cliente dentro del período seleccionado; no incluye correos automáticos del sistema">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Activity style={{ width: '13px', height: '13px', color: c.ultima_actividad ? '#ea580c' : '#94a3b8' }} />
                          <div>
                            <div style={{ fontWeight: 600, color: c.ultima_actividad ? '#1e293b' : '#94a3b8' }}>
                              {c.ultima_actividad ? formatTimeAgo(c.ultima_actividad) : 'Sin actividad'}
                            </div>
                            {c.ultima_actividad && (
                              <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                                {new Date(c.ultima_actividad).toLocaleString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
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

                      {/* Correos */}
                      <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundColor: '#f0f9ff',
                            color: '#0369a1',
                            border: '1px solid #bae6fd',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                          }}
                          title={`${c.correos_enviados || 0} correo(s) automáticos enviados por el sistema`}
                        >
                          <Mail style={{ width: '11px', height: '11px', color: '#0284c7' }} />
                          <span>{c.correos_enviados || 0}</span>
                        </span>
                      </td>

                      {/* Nivel de Actividad Visual Combinado */}
                      <td
                        style={{ padding: '12px 16px' }}
                        title={`${c.nombre_completo}: ${c.total_eventos} acciones en portal + ${c.correos_enviados || 0} correos automáticos = ${totalInteracciones} interacciones totales`}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div
                            style={{
                              flex: 1,
                              height: '7px',
                              backgroundColor: '#e2e8f0',
                              borderRadius: '999px',
                              overflow: 'hidden',
                              display: 'flex',
                              cursor: 'help',
                            }}
                          >
                            {/* Segmento 1: Acciones Web en el portal */}
                            {c.total_eventos > 0 && (
                              <div
                                style={{
                                  height: '100%',
                                  width: `${webPct}%`,
                                  backgroundColor: totalPct > 50 ? '#10b981' : totalPct > 20 ? '#3b82f6' : '#f59e0b',
                                  borderTopLeftRadius: '999px',
                                  borderBottomLeftRadius: '999px',
                                  borderTopRightRadius: (c.correos_enviados || 0) > 0 ? '0' : '999px',
                                  borderBottomRightRadius: (c.correos_enviados || 0) > 0 ? '0' : '999px',
                                }}
                                title={`${c.total_eventos} acciones en portal`}
                              />
                            )}
                            {/* Segmento 2: Correos automáticos enviados */}
                            {(c.correos_enviados || 0) > 0 && (
                              <div
                                style={{
                                  height: '100%',
                                  width: `${mailPct}%`,
                                  backgroundColor: '#38bdf8',
                                  borderTopLeftRadius: c.total_eventos > 0 ? '0' : '999px',
                                  borderBottomLeftRadius: c.total_eventos > 0 ? '0' : '999px',
                                  borderTopRightRadius: '999px',
                                  borderBottomRightRadius: '999px',
                                }}
                                title={`${c.correos_enviados || 0} correos automáticos`}
                              />
                            )}
                          </div>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#334155',
                              minWidth: '48px',
                              textAlign: 'right',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {totalInteracciones} act.
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
                  <td colSpan={11} style={{ padding: '36px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
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

            {/* Filtros del historial */}
            <div style={{ padding: '12px 22px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff', display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <label style={{ fontSize: '10.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Tipo de evento</label>
                <select
                  value={auditEventType}
                  onChange={e => setAuditEventType(e.target.value)}
                  style={{ padding: '6px 10px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', backgroundColor: '#ffffff', cursor: 'pointer' }}
                >
                  <option value="ALL">Todos los eventos</option>
                  <option value="LOGIN_EXITOSO">Inicios de sesión</option>
                  <option value="BUSQUEDA_INVENTARIO">Búsquedas</option>
                  <option value="VER_FOTO_ALMACEN">Fotos de almacén</option>
                  <option value="EXPORTAR_EXCEL">Descargas Excel</option>
                  <option value="FILTRO_ESTADO">Filtros de estado</option>
                  <option value="CONSULTA_DETALLE">Consultas de detalle</option>
                  <option value="EMAIL_ENVIADO">Correos automáticos</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <label style={{ fontSize: '10.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Desde</label>
                <input
                  type="date"
                  value={auditFrom}
                  max={auditTo || undefined}
                  onChange={e => setAuditFrom(e.target.value)}
                  style={{ padding: '5px 8px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <label style={{ fontSize: '10.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Hasta</label>
                <input
                  type="date"
                  value={auditTo}
                  min={auditFrom || undefined}
                  onChange={e => setAuditTo(e.target.value)}
                  style={{ padding: '5px 8px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a' }}
                />
              </div>

              <button
                type="button"
                onClick={applyAuditFilters}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '7px 12px',
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Filter style={{ width: '12px', height: '12px' }} />
                <span>Aplicar</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuditEventType('ALL');
                  setAuditFrom('');
                  setAuditTo('');
                  if (selectedClientForAudit) {
                    fetchClientAudit(selectedClientForAudit, { eventType: 'ALL', from: '', to: '', offset: 0 });
                  }
                }}
                style={{
                  padding: '7px 12px',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Limpiar
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
                    } else if (evt.tipo_evento === 'CONSULTA_DETALLE') {
                      badgeColor = '#0d9488';
                      badgeBg = '#f0fdfa';
                      label = 'Consulta de Detalle';
                    } else if (evt.tipo_evento === 'EMAIL_ENVIADO') {
                      badgeColor = '#0284c7';
                      badgeBg = '#f0f9ff';
                      label = '✉️ Correo Notificado';
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
                          {evt.detalles?.asunto && (
                            <div><strong>Asunto:</strong> {evt.detalles.asunto}</div>
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
                  No hay eventos que coincidan con los filtros seleccionados.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '12px 22px', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', backgroundColor: '#f8fafc', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                {auditTotal > 0 ? (
                  <>
                    Mostrando <strong>{auditOffset + 1}–{Math.min(auditOffset + AUDIT_PAGE_SIZE, auditTotal)}</strong> de <strong>{auditTotal}</strong> eventos
                  </>
                ) : (
                  'Sin eventos'
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => changeAuditPage(Math.max(auditOffset - AUDIT_PAGE_SIZE, 0))}
                  disabled={isLoadingAudit || auditOffset === 0}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: isLoadingAudit || auditOffset === 0 ? '#94a3b8' : '#334155',
                    cursor: isLoadingAudit || auditOffset === 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  Anterior
                </button>

                <button
                  type="button"
                  onClick={() => changeAuditPage(auditOffset + AUDIT_PAGE_SIZE)}
                  disabled={isLoadingAudit || auditOffset + AUDIT_PAGE_SIZE >= auditTotal}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: isLoadingAudit || auditOffset + AUDIT_PAGE_SIZE >= auditTotal ? '#94a3b8' : '#334155',
                    cursor: isLoadingAudit || auditOffset + AUDIT_PAGE_SIZE >= auditTotal ? 'not-allowed' : 'pointer',
                  }}
                >
                  Siguiente
                </button>

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
        </div>
      )}

    </div>
  );
}
