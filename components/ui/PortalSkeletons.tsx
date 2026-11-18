import React from 'react';

interface SkeletonBlockProps {
  width?: string | number;
  height?: string | number;
  radius?: string | number;
  dark?: boolean;
  style?: React.CSSProperties;
}

/**
 * Bloque base de skeleton con animación shimmer por GPU (clase .amex-skeleton).
 */
export function SkeletonBlock({
  width = '100%',
  height = 14,
  radius = 6,
  dark = false,
  style,
}: SkeletonBlockProps) {
  return (
    <div
      aria-hidden="true"
      className={dark ? 'amex-skeleton amex-skeleton-dark' : 'amex-skeleton'}
      style={{
        width,
        height,
        borderRadius: radius,
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

/**
 * Filas skeleton con la estructura exacta de las 9 columnas del Listado Warehouse.
 */
export function WarehouseTableSkeletonRows({ rows = 10 }: { rows?: number }) {
  const rowWidths = [
    ['92px', '118px', '72%', '54px', '42px', '82px', '76px', '76px', '108px'],
    ['86px', '134px', '64%', '48px', '46px', '96px', '72px', '72px', '108px'],
    ['94px', '104px', '80%', '52px', '38px', '88px', '76px', '76px', '108px'],
    ['88px', '128px', '58%', '56px', '44px', '80px', '74px', '74px', '108px'],
  ];

  return (
    <>
      {Array.from({ length: rows }).map((_, idx) => {
        const w = rowWidths[idx % rowWidths.length];
        return (
          <tr
            key={`wh-skel-${idx}`}
            style={{
              borderBottom: '1px solid #f1f3f6',
              backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafbfc',
            }}
          >
            <td style={{ padding: '14px' }}>
              <SkeletonBlock width={w[0]} height={15} radius={5} />
            </td>
            <td style={{ padding: '14px' }}>
              <SkeletonBlock width={w[1]} height={13} radius={5} />
            </td>
            <td style={{ padding: '14px' }}>
              <SkeletonBlock width={w[2]} height={14} radius={5} />
            </td>
            <td style={{ padding: '14px' }}>
              <SkeletonBlock width={w[3]} height={13} radius={5} />
            </td>
            <td style={{ padding: '14px' }}>
              <SkeletonBlock width={w[4]} height={14} radius={5} />
            </td>
            <td style={{ padding: '14px' }}>
              <SkeletonBlock width={w[5]} height={20} radius={999} />
            </td>
            <td style={{ padding: '12px 14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <SkeletonBlock width={w[6]} height={12} radius={4} />
                <SkeletonBlock width={48} height={10} radius={4} />
              </div>
            </td>
            <td style={{ padding: '12px 14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <SkeletonBlock width={w[7]} height={12} radius={4} />
                <SkeletonBlock width={48} height={10} radius={4} />
              </div>
            </td>
            <td style={{ padding: '12px 14px', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <SkeletonBlock width={w[8]} height={30} radius={6} />
              </div>
            </td>
          </tr>
        );
      })}
    </>
  );
}

/**
 * Skeleton completo de /warehouse (cabecera, tarjeta de filtros y tabla de paquetes).
 */
export function WarehousePageSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', width: '100%' }} aria-busy="true">
      {/* Cabecera de sección */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
          <SkeletonBlock width={190} height={24} radius={6} />
          <SkeletonBlock width={310} height={13} radius={4} style={{ maxWidth: '78vw' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SkeletonBlock width={104} height={32} radius={6} />
          <SkeletonBlock width={96} height={32} radius={6} />
        </div>
      </div>

      {/* Tarjeta de filtros */}
      <div
        className="p-3.5 sm:p-5"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <SkeletonBlock height={42} radius={6} />
          <SkeletonBlock height={42} radius={6} />
          <SkeletonBlock height={42} radius={6} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SkeletonBlock height={42} radius={6} />
          <SkeletonBlock height={42} radius={6} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', paddingTop: '4px' }}>
          <SkeletonBlock width={108} height={42} radius={6} />
          <SkeletonBlock width={164} height={42} radius={6} />
          <SkeletonBlock width={156} height={42} radius={6} />
        </div>
      </div>

      {/* Tabla */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          overflow: 'hidden',
        }}
      >
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #e5e7eb' }}>
                {['120px', '145px', '190px', '85px', '95px', '135px', '110px', '110px', '130px'].map((minW, i) => (
                  <th key={i} style={{ padding: '14px', minWidth: minW }}>
                    <SkeletonBlock width={i === 2 ? 70 : 54} height={11} radius={4} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <WarehouseTableSkeletonRows rows={9} />
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid #e5e7eb', backgroundColor: '#f8f9fa' }}>
          <SkeletonBlock width={160} height={14} radius={4} />
          <div style={{ display: 'flex', gap: '6px' }}>
            <SkeletonBlock width={72} height={32} radius={4} />
            <SkeletonBlock width={32} height={32} radius={4} />
            <SkeletonBlock width={32} height={32} radius={4} />
            <SkeletonBlock width={72} height={32} radius={4} />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Filas skeleton para las tablas de /configuracion (directorio de usuarios o catálogo TIB).
 */
export function ConfigTableSkeletonRows({
  rows = 7,
  variant = 'usuarios',
}: {
  rows?: number;
  variant?: 'usuarios' | 'tib';
}) {
  if (variant === 'tib') {
    return (
      <>
        {Array.from({ length: rows }).map((_, idx) => (
          <tr
            key={`tib-skel-${idx}`}
            style={{
              borderBottom: '1px solid #f3f4f6',
              backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafbfc',
            }}
          >
            <td style={{ padding: '13px 14px' }}>
              <SkeletonBlock width={idx % 2 === 0 ? '72%' : '58%'} height={14} radius={5} />
            </td>
            <td style={{ padding: '13px 14px' }}>
              <SkeletonBlock width={52} height={13} radius={4} />
            </td>
            <td style={{ padding: '13px 14px', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <SkeletonBlock width={44} height={22} radius={999} />
              </div>
            </td>
            <td style={{ padding: '13px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <SkeletonBlock width={28} height={14} radius={4} />
              </div>
            </td>
            <td style={{ padding: '13px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <SkeletonBlock width={28} height={14} radius={4} />
              </div>
            </td>
            <td style={{ padding: '13px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <SkeletonBlock width={28} height={14} radius={4} />
              </div>
            </td>
            <td style={{ padding: '13px 14px' }}>
              <SkeletonBlock width={82} height={12} radius={4} />
            </td>
            <td style={{ padding: '13px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <SkeletonBlock width={104} height={28} radius={5} />
              </div>
            </td>
          </tr>
        ))}
      </>
    );
  }

  return (
    <>
      {Array.from({ length: rows }).map((_, idx) => (
        <tr
          key={`cfg-skel-${idx}`}
          style={{
            borderBottom: '1px solid #f3f4f6',
            backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafbfc',
          }}
        >
          <td style={{ padding: '13px 14px' }}>
            <SkeletonBlock width={idx % 2 === 0 ? 150 : 128} height={14} radius={5} />
          </td>
          <td style={{ padding: '13px 14px' }}>
            <SkeletonBlock width={175} height={13} radius={4} />
          </td>
          <td style={{ padding: '13px 14px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <SkeletonBlock width={84} height={22} radius={999} />
              <SkeletonBlock width={64} height={22} radius={999} />
            </div>
          </td>
          <td style={{ padding: '13px 14px' }}>
            <SkeletonBlock width={68} height={22} radius={999} />
          </td>
          <td style={{ padding: '13px 14px' }}>
            <SkeletonBlock width={76} height={12} radius={4} />
          </td>
          <td style={{ padding: '13px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
              <SkeletonBlock width={82} height={28} radius={5} />
              <SkeletonBlock width={86} height={28} radius={5} />
              <SkeletonBlock width={74} height={28} radius={5} />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

/**
 * Skeleton completo de /configuracion.
 */
export function ConfiguracionPageSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }} aria-busy="true">
      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <SkeletonBlock width={38} height={38} radius={10} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <SkeletonBlock width={220} height={22} radius={6} />
            <SkeletonBlock width={290} height={12} radius={4} style={{ maxWidth: '72vw' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <SkeletonBlock width={190} height={36} radius={6} />
          <SkeletonBlock width={145} height={36} radius={6} />
        </div>
      </div>

      {/* Tarjeta principal de configuración */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', paddingBottom: '14px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <SkeletonBlock width={180} height={36} radius={8} />
            <SkeletonBlock width={180} height={36} radius={8} />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <SkeletonBlock width={135} height={36} radius={6} />
            <SkeletonBlock width={145} height={36} radius={6} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <SkeletonBlock width={320} height={38} radius={6} style={{ maxWidth: '100%' }} />
          <SkeletonBlock width={180} height={14} radius={4} />
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #e5e7eb' }}>
                {['150px', '180px', '180px', '90px', '100px', '280px'].map((w, i) => (
                  <th key={i} style={{ padding: '12px 14px', minWidth: w }}>
                    <SkeletonBlock width={80} height={11} radius={4} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <ConfigTableSkeletonRows rows={7} variant="usuarios" />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton completo de /analiticas (header, 6 KPIs, 4 tarjetas de salud, gráfico y tabla).
 */
export function AnaliticasPageSkeleton() {
  const barHeights = [42, 68, 54, 88, 76, 48, 92, 62, 74, 84, 58, 95, 70, 64];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', width: '100%' }} aria-busy="true">
      {/* Header del módulo */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          backgroundColor: '#ffffff',
          padding: '18px 22px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <SkeletonBlock width={38} height={38} radius={8} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <SkeletonBlock width={270} height={20} radius={5} style={{ maxWidth: '72vw' }} />
            <SkeletonBlock width={340} height={12} radius={4} style={{ maxWidth: '78vw' }} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <SkeletonBlock width={260} height={34} radius={8} />
          <SkeletonBlock width={145} height={34} radius={8} />
          <SkeletonBlock width={120} height={34} radius={8} />
        </div>
      </div>

      {/* Fila de 6 KPIs */}
      <div className="analytics-kpi-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={`kpi-skel-${i}`}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <SkeletonBlock width={90} height={12} radius={4} />
              <SkeletonBlock width={30} height={30} radius={8} />
            </div>
            <SkeletonBlock width={72} height={26} radius={6} />
            <SkeletonBlock width="85%" height={11} radius={4} />
          </div>
        ))}
      </div>

      {/* 4 Tarjetas Salud de la Base */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={`health-skel-${i}`}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <SkeletonBlock width={115} height={13} radius={4} />
              <SkeletonBlock width={28} height={28} radius={8} />
            </div>
            <SkeletonBlock width={64} height={24} radius={6} />
            <SkeletonBlock width="90%" height={11} radius={4} />
          </div>
        ))}
      </div>

      {/* Gráfico de Tendencia Diaria */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <SkeletonBlock width={220} height={16} radius={5} />
            <SkeletonBlock width={280} height={12} radius={4} style={{ maxWidth: '75vw' }} />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <SkeletonBlock width={74} height={14} radius={4} />
            <SkeletonBlock width={74} height={14} radius={4} />
            <SkeletonBlock width={74} height={14} radius={4} />
          </div>
        </div>
        <div style={{ height: '165px', display: 'flex', alignItems: 'flex-end', gap: '8px', paddingTop: '12px' }}>
          {barHeights.map((h, i) => (
            <div key={i} style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end' }}>
              <SkeletonBlock width="100%" height={`${h}%`} radius="6px 6px 2px 2px" />
            </div>
          ))}
        </div>
      </div>

      {/* Tabla Directorio de Actividad */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <SkeletonBlock width={230} height={18} radius={5} />
          <div style={{ display: 'flex', gap: '8px' }}>
            <SkeletonBlock width={180} height={34} radius={6} />
            <SkeletonBlock width={130} height={34} radius={6} />
          </div>
        </div>
        <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', padding: '6px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 200px' }}>
                <SkeletonBlock width={34} height={34} radius={999} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
                  <SkeletonBlock width={140} height={13} radius={4} />
                  <SkeletonBlock width={180} height={10} radius={4} />
                </div>
              </div>
              <SkeletonBlock width={76} height={13} radius={4} />
              <SkeletonBlock width={110} height={8} radius={999} />
              <SkeletonBlock width={86} height={28} radius={6} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton para la línea de tiempo dentro del modal de auditoría en /analiticas.
 */
export function AuditTimelineSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }} aria-busy="true">
      {Array.from({ length: rows }).map((_, idx) => (
        <div
          key={`audit-skel-${idx}`}
          style={{
            padding: '12px 14px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <SkeletonBlock width={132} height={20} radius={6} />
            <SkeletonBlock width={110} height={12} radius={4} />
          </div>
          <SkeletonBlock width={idx % 2 === 0 ? '72%' : '56%'} height={13} radius={4} />
          <SkeletonBlock width={150} height={11} radius={4} />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton completo de la página dedicada /configurar/[id].
 */
export function ConfigurarClientePageSkeleton() {
  return (
    <div style={{ minHeight: '100dvh', backgroundColor: '#f1f5f9', display: 'flex', flexDirection: 'column' }} aria-busy="true">
      <header
        style={{
          backgroundColor: '#111827',
          borderBottom: '1px solid #1f2937',
          padding: '10px 16px',
          minHeight: '62px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo-amex-clean.png" alt="AMEX Courier" style={{ height: '30px', objectFit: 'contain' }} />
          <SkeletonBlock width={140} height={16} radius={4} dark />
        </div>
        <SkeletonBlock width={210} height={32} radius={6} dark />
      </header>

      <main style={{ maxWidth: '960px', width: '100%', margin: '0 auto', padding: '32px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '22px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <SkeletonBlock width={165} height={24} radius={6} />
          <SkeletonBlock width={340} height={28} radius={6} style={{ maxWidth: '85vw' }} />
          <SkeletonBlock width={280} height={14} radius={4} style={{ maxWidth: '75vw' }} />
        </div>

        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <SkeletonBlock width={180} height={18} radius={5} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SkeletonBlock height={42} radius={8} />
            <SkeletonBlock height={42} radius={8} />
          </div>
          <SkeletonBlock width={220} height={40} radius={8} />
        </div>

        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <SkeletonBlock width={240} height={18} radius={5} />
          <SkeletonBlock height={44} radius={8} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <SkeletonBlock width={140} height={30} radius={999} />
            <SkeletonBlock width={168} height={30} radius={999} />
            <SkeletonBlock width={120} height={30} radius={999} />
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * Skeleton de entrada al portal mientras se verifica la sesión en PortalShell.
 * Mantiene exactamente la misma estructura visual que el portal autenticado (sin pantalla oscura de salto).
 */
export function PortalEntryShellSkeleton({ pathname }: { pathname?: string | null }) {
  const isConfig = pathname?.startsWith('/configuracion');
  const isAnalytics = pathname?.startsWith('/analiticas');

  return (
    <div
      className="amex-client-portal w-full flex-1 flex flex-col"
      style={{
        minHeight: '100dvh',
        backgroundColor: '#f1f3f6',
        color: '#2c323f',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Header fiel al PortalHeader */}
      <header
        style={{
          backgroundColor: '#1e2229',
          color: '#ffffff',
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <div
          className="px-4 sm:px-6 lg:px-8 xl:px-10"
          style={{
            maxWidth: '1400px',
            width: '100%',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/logo-amex-clean.png"
              alt="AMEX Courier"
              style={{ height: '28px', width: 'auto', objectFit: 'contain' }}
            />
            <span
              className="hidden md:inline"
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: '#f3f4f6',
                borderLeft: '1px solid #4b5563',
                paddingLeft: '10px',
                letterSpacing: '-0.2px',
                whiteSpace: 'nowrap',
              }}
            >
              Gestor de Almacén AMEX Courier
            </span>
          </div>
          <SkeletonBlock width={168} height={32} radius={6} dark />
        </div>
      </header>

      <main
        className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8 xl:px-10"
        style={{
          maxWidth: '1400px',
          width: '100%',
          margin: '0 auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
        }}
      >
        {isAnalytics ? (
          <AnaliticasPageSkeleton />
        ) : isConfig ? (
          <ConfiguracionPageSkeleton />
        ) : (
          <WarehousePageSkeleton />
        )}
      </main>

      <footer
        style={{
          borderTop: '1px solid #e5e7eb',
          backgroundColor: '#ffffff',
          padding: '14px 20px max(14px, env(safe-area-inset-bottom)) 20px',
          textAlign: 'center',
          fontSize: '12px',
          color: '#6b7280',
        }}
      >
        © {new Date().getFullYear()} AMEX COURIER PERÚ — Todos los derechos reservados.
      </footer>
    </div>
  );
}
