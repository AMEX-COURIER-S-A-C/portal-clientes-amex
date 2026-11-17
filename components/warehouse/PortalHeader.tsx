'use client';

import React from 'react';
import { ChevronDown, Package, Settings, BarChart3, LogOut } from 'lucide-react';

export interface PortalHeaderProps {
  user: any;
  isSuperadmin: boolean;
  activeTab: 'warehouse' | 'configuracion' | 'analiticas';
  userMenuOpen: boolean;
  setUserMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  userMenuRef: React.RefObject<HTMLDivElement | null>;
  onSelectTab: (tab: 'warehouse' | 'configuracion' | 'analiticas') => void;
  onLogout: () => void;
}

export default function PortalHeader({
  user,
  isSuperadmin,
  activeTab,
  userMenuOpen,
  setUserMenuOpen,
  userMenuRef,
  onSelectTab,
  onLogout,
}: PortalHeaderProps) {
  return (
    <header style={{ backgroundColor: '#1e2229', color: '#ffffff', height: '56px', display: 'flex', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.15)', position: 'sticky', top: 0, zIndex: 40 }}>
      <div className="px-4 sm:px-6 lg:px-8 xl:px-10" style={{ maxWidth: '1400px', width: '100%', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        {/* Logo y título */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/logo-amex-clean.png"
            alt="AMEX Courier"
            style={{
              height: '28px',
              width: 'auto',
              objectFit: 'contain',
              flexShrink: 0,
            }}
          />
          <span
            className="hidden md:inline"
            style={{ fontSize: '13px', fontWeight: 700, color: '#f3f4f6', borderLeft: '1px solid #4b5563', paddingLeft: '10px', letterSpacing: '-0.2px', whiteSpace: 'nowrap' }}
          >
            Gestor de Almacén AMEX Courier
          </span>
        </div>

        {/* Usuario / Dropdown a la derecha */}
        <div ref={userMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, color: '#f3f4f6', cursor: 'pointer', padding: '5px 12px', borderRadius: '6px', maxWidth: 'min(260px, 52vw)' }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Hola! {user?.user_metadata?.nombre_completo || user?.email?.split('@')[0]?.toUpperCase() || 'USUARIO'}
            </span>
            <ChevronDown style={{ width: '14px', height: '14px', color: '#9ca3af', flexShrink: 0 }} />
          </button>

          {userMenuOpen && (
            <div style={{ position: 'absolute', right: 0, marginTop: '6px', minWidth: '250px', width: 'max-content', maxWidth: 'calc(100vw - 24px)', backgroundColor: '#ffffff', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', border: '1px solid #e5e7eb', padding: '6px 0', zIndex: 50 }}>
              <div style={{ padding: '8px 14px', borderBottom: '1px solid #f3f4f6', fontSize: '12px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <div style={{ fontWeight: 700, color: '#111827', fontSize: '13px' }}>Cuenta Conectada</div>
                <div>{user?.email}</div>
              </div>

              {isSuperadmin && (
                <div style={{ padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <div style={{ padding: '4px 14px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: '#9ca3af', letterSpacing: '0.5px' }}>
                    Configuración
                  </div>

                  <button
                    onClick={() => onSelectTab('warehouse')}
                    style={{ width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', color: activeTab === 'warehouse' ? '#ff5722' : '#1f2937', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Package style={{ width: '14px', height: '14px', color: '#ff5722' }} />
                    <span>Listado Warehouse</span>
                  </button>

                  <button
                    onClick={() => onSelectTab('configuracion')}
                    style={{ width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', color: activeTab === 'configuracion' ? '#ff5722' : '#1f2937', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Settings style={{ width: '14px', height: '14px', color: '#ff5722' }} />
                    <span>Panel de Configuración</span>
                  </button>

                  <button
                    onClick={() => onSelectTab('analiticas')}
                    style={{ width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', color: activeTab === 'analiticas' ? '#ff5722' : '#1f2937', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <BarChart3 style={{ width: '14px', height: '14px', color: '#ff5722' }} />
                    <span>Estadísticas y Analíticas</span>
                  </button>
                </div>
              )}

              <button
                onClick={onLogout}
                style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', color: '#dc2626', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <LogOut style={{ width: '14px', height: '14px' }} />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
