'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabasePortal } from '@/lib/supabase/portal-client';
import { getLoginThemeTokens } from '@/lib/themes/seasonalConfig';
import { HalloweenBackdrop, HalloweenCornerWebs } from '@/components/themes/HalloweenBackdrop';

export default function ClienteLoginPage() {
  const router = useRouter();
  const theme = getLoginThemeTokens();

  // Estados de autenticación
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTransitioningIn, setIsTransitioningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.classList.add('login-page');
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.body.classList.remove('login-page');
      }
    };
  }, []);

  // Redirigir automáticamente si ya existe una sesión activa en el portal
  useEffect(() => {
    supabasePortal.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/');
      }
    });
  }, [router]);

  const handleCapsLockCheck = (
    e: React.KeyboardEvent<HTMLInputElement> | React.MouseEvent<HTMLInputElement>
  ) => {
    if (typeof e.getModifierState === 'function') {
      setIsCapsLockOn(e.getModifierState('CapsLock'));
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || isTransitioningIn) return;
    setIsLoading(true);
    setErrorMessage(null);

    const cleanEmail = email.trim().toLowerCase();

    try {
      // 1. Iniciar sesión a través de la ruta con puente de sincronización para Superadmin
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Credenciales incorrectas');
      }

      if (data.session) {
        await supabasePortal.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });

        setIsTransitioningIn(true);
        setTimeout(() => {
          router.push('/');
        }, 400);
        return;
      }

      throw new Error('No se pudo establecer la sesión.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al iniciar sesión';

      // Si la cuenta fue desactivada por administración, mostrar de inmediato
      if (msg.includes('desactivada por administración')) {
        setErrorMessage(msg);
        setIsLoading(false);
        return;
      }

      // Intento fallback directo con el cliente Supabase del Portal
      try {
        const { data: directAuth, error: directError } = await supabasePortal.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (!directError && directAuth.session) {
          // Verificar si está activo en clientes_portal
          const { data: profile } = await supabasePortal
            .from('clientes_portal')
            .select('activo')
            .eq('email', cleanEmail)
            .maybeSingle();

          if (profile && profile.activo === false) {
            await supabasePortal.auth.signOut();
            setErrorMessage('Tu cuenta ha sido desactivada por administración. Contacta con soporte AMEX Courier.');
            setIsLoading(false);
            return;
          }

          setIsTransitioningIn(true);
          setTimeout(() => {
            router.push('/');
          }, 400);
          return;
        }
      } catch (_) {}

      setErrorMessage(
        msg === 'Invalid login credentials'
          ? 'Correo o contraseña incorrectos. Revisa tus datos.'
          : msg
      );
      setIsLoading(false);
    }
  };

  // ==================== CORTINA DE ENTRADA AL INICIAR SESIÓN ====================
  if (isTransitioningIn) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: theme.pageBackground,
          color: '#f8fafc',
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          padding: 24,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {theme.isHalloween && <HalloweenBackdrop />}
        <style>{`
          @keyframes amexEntryCardIn {
            from { opacity: 0; transform: scale(0.97) translateY(6px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }
          @keyframes amexProgressSlide {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(250%); }
          }
        `}</style>
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            padding: '28px 36px',
            borderRadius: 20,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(16px)',
            border: theme.shellBorder,
            boxShadow: theme.shellShadow,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            maxWidth: 380,
            width: '100%',
            textAlign: 'center',
            animation: 'amexEntryCardIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          }}
        >
          <div
            style={{
              padding: '12px 20px',
              borderRadius: 14,
              background: 'rgba(9, 13, 22, 0.88)',
              border: theme.logoBoxBorder,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 18,
            }}
          >
            <img
              src="/images/logo-amex-clean.png"
              alt="AMEX Courier"
              style={{ height: 40, width: 'auto', objectFit: 'contain', filter: theme.logoDropShadow }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
            <i className="fa-solid fa-circle-notch fa-spin" style={{ color: theme.spinnerColor, fontSize: 15 }} />
            <span style={{ fontSize: 14.5, fontWeight: 800, letterSpacing: '-0.2px', color: '#f8fafc' }}>
              Abriendo Casillero de Clientes
            </span>
          </div>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 18px 0', lineHeight: 1.45 }}>
            Sincronizando estado de paquetes y guías...
          </p>

          <div
            style={{
              width: '100%',
              height: 4,
              borderRadius: 999,
              background: 'rgba(255, 255, 255, 0.07)',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: '45%',
                height: '100%',
                borderRadius: 999,
                background: theme.progressGradient,
                animation: 'amexProgressSlide 1.15s cubic-bezier(0.4, 0, 0.2, 1) infinite',
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="amex-login-viewport"
      style={{
        minHeight: '100dvh',
        width: '100%',
        background: theme.pageBackground,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        position: 'relative',
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {theme.isHalloween && <HalloweenBackdrop />}

      <style>{`
        @keyframes amexLoginShellIn {
          from { opacity: 0; transform: translateY(10px) scale(0.992); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .amex-login-shell {
          position: relative;
          z-index: 2;
          width: 100%;
          max-width: 980px;
          display: grid;
          grid-template-columns: 1.08fr 1fr;
          border-radius: 22px;
          overflow: hidden;
          background: rgba(15, 23, 42, 0.8);
          backdrop-filter: blur(20px);
          border: ${theme.shellBorder};
          box-shadow: ${theme.shellShadow};
          animation: amexLoginShellIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          --spot-x: 50%;
          --spot-y: 50%;
          --spot-opacity: 0;
        }
        .amex-login-shell::before {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 4;
          background: radial-gradient(
            420px circle at var(--spot-x) var(--spot-y),
            ${theme.isHalloween ? 'rgba(249, 115, 22, 0.11)' : 'rgba(56, 189, 248, 0.08)'},
            transparent 65%
          );
          opacity: var(--spot-opacity);
          transition: opacity 0.25s ease;
        }
        .amex-login-left {
          position: relative;
          padding: 42px 38px;
          background: ${theme.leftPanelBackground};
          border-right: 1px solid rgba(255, 255, 255, 0.07);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 28px;
        }
        .amex-login-right {
          position: relative;
          padding: 42px 38px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          background: rgba(15, 23, 42, 0.58);
          color: #f8fafc;
        }
        .amex-input-field {
          width: 100%;
          padding: 12px 14px 12px 38px;
          border-radius: 10px;
          background: rgba(9, 13, 22, 0.72);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #f8fafc;
          font-size: 13.5px;
          outline: none;
          box-sizing: border-box;
          transition: all 0.18s ease;
        }
        .amex-input-field:focus {
          border-color: ${theme.inputFocusBorder};
          box-shadow: ${theme.inputFocusShadow};
          background: rgba(9, 13, 22, 0.92);
        }
        .amex-submit-btn {
          margin-top: 6px;
          padding: 13px 16px;
          min-height: 48px;
          border-radius: 10px;
          background: ${theme.submitBtnBackground};
          color: #ffffff;
          border: ${theme.submitBtnBorder};
          font-weight: 800;
          font-size: 14px;
          letter-spacing: 0.2px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          box-shadow: ${theme.submitBtnShadow};
          transition: all 0.18s ease;
          width: 100%;
          touch-action: manipulation;
        }
        .amex-submit-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: ${theme.submitBtnHoverShadow};
          filter: brightness(1.06);
        }
        .amex-submit-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }
        @media (max-width: 860px) {
          .amex-login-viewport {
            padding: 16px 12px 32px 12px !important;
            align-items: center !important;
          }
          .amex-login-shell {
            grid-template-columns: 1fr;
            max-width: 480px;
            margin: auto;
          }
          .amex-login-left {
            padding: 22px 20px;
            border-right: none;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            gap: 16px;
          }
          .amex-login-right {
            padding: 24px 20px 28px 20px;
          }
        }
        @media (max-width: 640px) {
          .amex-login-viewport {
            padding: 10px 8px 36px 8px !important;
            min-height: 100dvh !important;
            display: flex !important;
            align-items: flex-start !important;
          }
          .amex-login-shell {
            border-radius: 16px !important;
            max-width: 100% !important;
            margin-top: 6px !important;
            margin-bottom: 20px !important;
          }
          .amex-login-left {
            padding: 14px 16px 10px 16px !important;
            gap: 8px !important;
          }
          .amex-login-left-badge {
            margin-bottom: 8px !important;
            font-size: 10px !important;
            padding: 4px 10px !important;
          }
          .amex-login-left-logo-box {
            padding: 10px 14px !important;
            margin-bottom: 8px !important;
            border-radius: 12px !important;
          }
          .amex-login-left-logo-img {
            max-width: 190px !important;
            max-height: 36px !important;
          }
          .amex-login-left-desc {
            display: none !important;
          }
          .amex-login-left-footer {
            display: none !important;
          }
          .amex-login-right {
            padding: 16px 16px 22px 16px !important;
          }
          .amex-login-right-head {
            margin-bottom: 14px !important;
          }
          .amex-login-right-title {
            font-size: 19px !important;
          }
          .amex-login-right-desc {
            font-size: 11.5px !important;
            margin-top: 3px !important;
          }
          .amex-input-field {
            font-size: 14px !important;
            padding: 11px 12px 11px 36px !important;
          }
          .amex-submit-btn {
            min-height: 48px !important;
            padding: 13px 16px !important;
            font-size: 14px !important;
            margin-top: 10px !important;
            margin-bottom: 4px !important;
          }
          .amex-login-mobile-footer {
            display: block !important;
            margin-top: 14px;
            text-align: center;
            font-size: 11px;
            color: #64748b;
          }
        }
      `}</style>

      <div
        className="amex-login-shell"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          e.currentTarget.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
          e.currentTarget.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);
          e.currentTarget.style.setProperty('--spot-opacity', '1');
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.setProperty('--spot-opacity', '0');
        }}
      >
        {theme.isHalloween && <HalloweenCornerWebs />}

        {/* ==================== PANEL CORPORATIVO IZQUIERDO ==================== */}
        <div className="amex-login-left">
          {/* Top Badge & Logo Oficial */}
          <div>
            <div
              className="amex-login-left-badge"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '5px 12px',
                borderRadius: '999px',
                background: theme.badgeBackground,
                border: theme.badgeBorder,
                color: theme.badgeColor,
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.7px',
                textTransform: 'uppercase',
                marginBottom: '22px',
              }}
            >
              <i className={theme.badgeIcon} style={{ fontSize: '11px' }} />
              <span>{theme.isHalloween ? 'Edición Halloween' : 'Casillero Postal Miami – Lima'}</span>
            </div>

            {/* Contenedor del Logo Oficial AMEX Courier */}
            <div
              className="amex-login-left-logo-box"
              style={{
                background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.9) 0%, rgba(7, 11, 20, 0.95) 100%)',
                border: theme.logoBoxBorder,
                borderRadius: '16px',
                padding: '22px 24px',
                marginBottom: '18px',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 12px 30px rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                className="amex-login-left-logo-img"
                src="/images/logo-amex-clean.png"
                alt="AMEX Courier Logo Oficial"
                style={{
                  width: '100%',
                  maxWidth: '290px',
                  height: 'auto',
                  objectFit: 'contain',
                  filter: theme.logoDropShadow,
                }}
              />
            </div>

            <p
              className="amex-login-left-desc"
              style={{
                fontSize: '13.5px',
                color: '#94a3b8',
                margin: 0,
                lineHeight: 1.55,
              }}
            >
              Plataforma oficial para clientes de AMEX Courier: casillero postal Miami – Lima, seguimiento de Warehouse (WR) y fotos de bodega en tiempo real.
            </p>
          </div>

          {/* Pie Institucional */}
          <div
            className="amex-login-left-footer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
              paddingTop: '14px',
              borderTop: '1px solid rgba(255, 255, 255, 0.07)',
              fontSize: '11.5px',
              color: '#64748b',
            }}
          >
            <span>AMEX Courier S.A.C. • RUC 20607649082</span>
          </div>
        </div>

        {/* ==================== PANEL DE AUTENTICACIÓN DERECHO ==================== */}
        <div className="amex-login-right">
          {/* Cabecera del Formulario: PORTAL DE CLIENTES (No Operaciones) */}
          <div className="amex-login-right-head" style={{ marginBottom: '26px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11.5px',
                fontWeight: 700,
                color: theme.portalLabelColor,
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              <i className={theme.portalIcon} />
              <span>Portal de Clientes</span>
            </div>
            <h1
              className="amex-login-right-title"
              style={{
                fontSize: '23px',
                fontWeight: 900,
                margin: 0,
                letterSpacing: '-0.3px',
                color: '#ffffff',
              }}
            >
              Iniciar Sesión
            </h1>
            <p
              className="amex-login-right-desc"
              style={{ fontSize: '13px', color: '#94a3b8', marginTop: '6px', marginBottom: 0 }}
            >
              Ingresa tus credenciales autorizadas de AMEX Courier.
            </p>
          </div>

          {errorMessage && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#fca5a5',
                padding: '12px 14px',
                borderRadius: '10px',
                fontSize: '13px',
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <i className="fa-solid fa-circle-exclamation" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#cbd5e1',
                  marginBottom: '6px',
                }}
              >
                Correo Electrónico
              </label>
              <div style={{ position: 'relative' }}>
                <i
                  className="fa-solid fa-envelope"
                  style={{
                    position: 'absolute',
                    left: '13px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#64748b',
                    fontSize: '14px',
                  }}
                />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu-correo@ejemplo.com"
                  className="amex-input-field"
                />
              </div>
            </div>

            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '6px',
                }}
              >
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#cbd5e1' }}>
                  Contraseña
                </label>
                <a
                  href="https://wa.me/51924811106?text=Hola%20AMEX%20Courier,%20necesito%20asistencia%20con%20la%20clave%20de%20mi%20casillero"
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#fbbf24',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    textDecoration: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'color 0.2s ease',
                  }}
                >
                  ¿Olvidaste tu contraseña?
                </a>
              </div>
              <div style={{ position: 'relative' }}>
                <i
                  className="fa-solid fa-lock"
                  style={{
                    position: 'absolute',
                    left: '13px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#64748b',
                    fontSize: '14px',
                  }}
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleCapsLockCheck}
                  onKeyUp={handleCapsLockCheck}
                  onClick={handleCapsLockCheck}
                  onBlur={() => setIsCapsLockOn(false)}
                  placeholder="••••••••"
                  className="amex-input-field"
                  style={{ paddingRight: '40px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: showPassword ? '#fbbf24' : '#64748b',
                    cursor: 'pointer',
                    fontSize: '14px',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  tabIndex={-1}
                  title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  <i className={showPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'} />
                </button>
              </div>

              {/* Aviso de Bloq Mayús (Caps Lock) Activo */}
              {isCapsLockOn && (
                <div
                  role="status"
                  style={{
                    marginTop: '8px',
                    padding: '7px 11px',
                    borderRadius: '8px',
                    background: 'rgba(245, 158, 11, 0.14)',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    color: '#fcd34d',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                  }}
                >
                  <i className="fa-solid fa-triangle-exclamation" style={{ color: '#f59e0b' }} />
                  <span>Bloq Mayús (Caps Lock) está activado</span>
                </div>
              )}
            </div>

            <button type="submit" disabled={isLoading} className="amex-submit-btn">
              {isLoading ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin" />
                  <span>Validando credenciales...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-arrow-right-to-bracket" />
                  <span>Ingresar a mi Casillero</span>
                </>
              )}
            </button>
          </form>

          {/* Pie Institucional visible solo en Móviles al final del formulario */}
          <div className="amex-login-mobile-footer" style={{ display: 'none' }}>
            <span>AMEX Courier S.A.C. • RUC 20607649082</span>
          </div>
        </div>
      </div>

    </div>
  );
}
