'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { supabasePortal } from '@/lib/supabase/portal-client';
import { isSuperadminEmail } from '@/lib/portal/superadmin';
import { ToastNotice } from '@/lib/portal/types';
import PortalHeader from '@/components/warehouse/PortalHeader';
import { PortalEntryShellSkeleton } from '@/components/ui/PortalSkeletons';

interface PortalSessionContextValue {
  user: any;
  isSuperadmin: boolean;
  totalSystemCount: number;
  setTotalSystemCount: React.Dispatch<React.SetStateAction<number>>;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

const PortalSessionContext = createContext<PortalSessionContextValue | null>(null);

/**
 * Devuelve el usuario autenticado, rol de superadmin y utilidades compartidas del portal.
 */
export function usePortalSession(): PortalSessionContextValue {
  const ctx = useContext(PortalSessionContext);
  if (!ctx) {
    throw new Error('usePortalSession debe usarse dentro de PortalShell');
  }
  return ctx;
}

/**
 * Contenedor autenticado compartido para "/", "/configuracion" y "/analiticas".
 * Mantiene la sesión y el encabezado montados al navegar entre rutas sin parpadeos.
 */
export default function PortalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [totalSystemCount, setTotalSystemCount] = useState<number>(0);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<ToastNotice | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSuperadmin = isSuperadminEmail(user?.email);

  const showToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ id: Date.now(), type, message });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 5500);
  }, []);

  useEffect(() => {
    document.documentElement.classList.add('amex-client-portal');
    document.body.classList.add('amex-client-portal');
    document.documentElement.style.overflowY = 'auto';
    document.body.style.overflowY = 'auto';
    document.body.style.height = 'auto';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setUserMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

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
  }, []);

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
    let isMounted = true;

    try {
      const storedToken =
        typeof window !== 'undefined' ? localStorage.getItem('amex-portal-cliente-token') : null;
      if (!storedToken) {
        setIsAuthChecking(true);
        router.replace('/login');
        return;
      }
    } catch {
      // Ignorar si localStorage no está accesible
    }

    async function loadSession() {
      const {
        data: { session },
      } = await supabasePortal.auth.getSession();
      if (!isMounted) return;
      if (!session) {
        setIsAuthChecking(true);
        router.replace('/login');
        return;
      }
      setUser(session.user);
      setIsAuthChecking(false);
    }
    loadSession();

    const {
      data: { subscription },
    } = supabasePortal.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        setIsAuthChecking(true);
        router.replace('/login');
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setUser(session.user);
        setIsAuthChecking(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  const handleLogout = useCallback(async () => {
    await supabasePortal.auth.signOut();
    router.push('/login');
  }, [router]);

  if (isAuthChecking || !user) {
    return <PortalEntryShellSkeleton pathname={pathname} />;
  }

  return (
    <PortalSessionContext.Provider
      value={{ user, isSuperadmin, totalSystemCount, setTotalSystemCount, showToast }}
    >
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
          userMenuOpen={userMenuOpen}
          setUserMenuOpen={setUserMenuOpen}
          userMenuRef={userMenuRef}
          onLogout={handleLogout}
        />

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
          {children}
        </main>

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
              backgroundColor:
                toast.type === 'success'
                  ? '#ecfdf5'
                  : toast.type === 'error'
                  ? '#fef2f2'
                  : '#eff6ff',
              border: `1px solid ${
                toast.type === 'success'
                  ? '#a7f3d0'
                  : toast.type === 'error'
                  ? '#fecaca'
                  : '#bfdbfe'
              }`,
              color:
                toast.type === 'success'
                  ? '#065f46'
                  : toast.type === 'error'
                  ? '#991b1b'
                  : '#1e40af',
              borderRadius: '10px',
              boxShadow:
                '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 4px 10px -4px rgba(0, 0, 0, 0.1)',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              fontSize: '13px',
              lineHeight: 1.4,
            }}
          >
            {toast.type === 'success' ? (
              <CheckCircle2
                style={{ width: '18px', height: '18px', color: '#16a34a', flexShrink: 0, marginTop: '1px' }}
                aria-hidden="true"
              />
            ) : (
              <AlertCircle
                style={{
                  width: '18px',
                  height: '18px',
                  color: toast.type === 'error' ? '#dc2626' : '#2563eb',
                  flexShrink: 0,
                  marginTop: '1px',
                }}
                aria-hidden="true"
              />
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
    </PortalSessionContext.Provider>
  );
}
