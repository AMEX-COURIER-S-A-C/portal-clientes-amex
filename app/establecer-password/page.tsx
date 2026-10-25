'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabasePortal } from '@/lib/supabase/portal-client';
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export default function EstablecerPasswordPage() {
  const router = useRouter();

  // Estados de formulario
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Estados de validación y carga
  const [isValidatingToken, setIsValidatingToken] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [sessionUserEmail, setSessionUserEmail] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // 1. Detectar y validar el token de activación en la URL o sesión existente
  useEffect(() => {
    let isMounted = true;

    async function detectTokenAndSession() {
      try {
        // Verificar si la URL trae un error de Supabase (por ejemplo token expirado)
        if (typeof window !== 'undefined') {
          const hash = window.location.hash;
          const searchParams = new URLSearchParams(window.location.search);
          const hashParams = new URLSearchParams(hash.replace(/^#/, ''));

          const errorDesc = hashParams.get('error_description') || searchParams.get('error_description');
          if (errorDesc) {
            if (isMounted) {
              setTokenError(decodeURIComponent(errorDesc).replace(/\+/g, ' '));
              setIsValidatingToken(false);
            }
            return;
          }

          // Si el hash contiene access_token y refresh_token, establecer sesión explícitamente
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');

          if (accessToken && refreshToken) {
            const { data, error } = await supabasePortal.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (!error && data.session) {
              if (isMounted) {
                setHasValidSession(true);
                setSessionUserEmail(data.session.user.email || null);
                setIsValidatingToken(false);
              }
              return;
            }
          }
        }

        // Si ya hay una sesión activa en supabasePortal (detectada automáticamente)
        const { data: { session }, error: sessionErr } = await supabasePortal.auth.getSession();
        if (sessionErr) throw sessionErr;

        if (session?.user) {
          if (isMounted) {
            setHasValidSession(true);
            setSessionUserEmail(session.user.email || null);
            setIsValidatingToken(false);
          }
          return;
        }

        // Si no hay sesión ni tokens en el hash
        if (isMounted) {
          setTokenError('No se encontró un token de activación válido. El enlace pudo haber expirado o ya fue utilizado.');
          setIsValidatingToken(false);
        }
      } catch (err: any) {
        console.error('Error al verificar sesión de activación:', err);
        if (isMounted) {
          setTokenError(err.message || 'Error al validar el enlace de activación.');
          setIsValidatingToken(false);
        }
      }
    }

    // Escuchar cambios de autenticación (evento PASSWORD_RECOVERY o SIGNED_IN)
    const { data: authListener } = supabasePortal.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        if (isMounted) {
          setHasValidSession(true);
          setSessionUserEmail(session.user.email || null);
          setIsValidatingToken(false);
        }
      }
    });

    detectTokenAndSession();

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Validaciones
  const isLengthValid = password.length >= 6;
  const isMatch = password.length > 0 && password === confirmPassword;
  const canSubmit = isLengthValid && isMatch && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // Actualizar la contraseña del usuario en Supabase Auth
      const { data, error } = await supabasePortal.auth.updateUser({
        password: password,
        data: {
          password_establecido: true,
          activado_en: new Date().toISOString(),
        },
      });

      if (error) {
        throw error;
      }

      setIsSuccess(true);
    } catch (err: any) {
      console.error('Error al actualizar contraseña:', err);
      setErrorMessage(err.message || 'No se pudo guardar la contraseña. Inténtalo nuevamente.');
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0b1329',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '24px 16px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.45)',
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Encabezado con degradado institucional */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #065f46 100%)',
            padding: '30px 24px 24px 24px',
            textAlign: 'center',
            borderBottom: '3px solid #10b981',
          }}
        >
          <img
            src="https://www.sistemaamexcourier.online/images/logo-amex-clean.png"
            alt="AMEX Courier"
            style={{ width: '150px', height: 'auto', margin: '0 auto 12px auto', display: 'block' }}
          />
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              color: '#6ee7b7',
              padding: '3px 12px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}
          >
            <ShieldCheck style={{ width: '13px', height: '13px' }} />
            <span>Portal de Clientes • Activación</span>
          </div>
          <h1
            style={{
              margin: '12px 0 4px 0',
              fontSize: '22px',
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '-0.3px',
            }}
          >
            {isSuccess ? '¡Cuenta Activada!' : 'Crea tu Contraseña'}
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1' }}>
            {isSuccess
              ? 'Tu clave personal ha sido configurada con éxito.'
              : 'Define tu clave personal de acceso para ingresar a tu casillero.'}
          </p>
        </div>

        {/* Cuerpo del contenedor */}
        <div style={{ padding: '28px 24px' }}>
          {/* 1. Estado de carga / validando token */}
          {isValidatingToken && (
            <div style={{ textAlign: 'center', padding: '30px 10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  border: '3px solid #e2e8f0',
                  borderTopColor: '#10b981',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  margin: '0 auto 16px auto',
                }}
              />
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#334155', margin: 0 }}>
                Validando enlace de activación...
              </p>
              <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>
                Conectando con el portal seguro de AMEX Courier.
              </p>
              <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* 2. Error de token / enlace expirado */}
          {!isValidatingToken && !hasValidSession && tokenError && (
            <div>
              <div
                style={{
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '10px',
                  padding: '16px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                }}
              >
                <AlertCircle style={{ width: '22px', height: '22px', color: '#dc2626', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '13.5px', fontWeight: 800, color: '#991b1b' }}>
                    Enlace de activación caducado o no válido
                  </h4>
                  <p style={{ margin: 0, fontSize: '12.5px', color: '#b91c1c', lineHeight: 1.5 }}>
                    {tokenError}
                  </p>
                </div>
              </div>

              <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6, marginBottom: '20px' }}>
                Si ya estableciste tu contraseña anteriormente, puedes ingresar directamente al portal con tu correo. Si no la recuerdas o el enlace venció, solicita a AMEX Courier que te reenvíe el enlace.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <Link
                  href="/login"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    width: '100%',
                    height: '44px',
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    fontSize: '13.5px',
                    fontWeight: 700,
                    borderRadius: '8px',
                    textDecoration: 'none',
                  }}
                >
                  <span>Ir a Iniciar Sesión</span>
                  <ArrowRight style={{ width: '15px', height: '15px' }} />
                </Link>
              </div>
            </div>
          )}

          {/* 3. Pantalla de Éxito y Confirmación */}
          {!isValidatingToken && isSuccess && (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  backgroundColor: '#ecfdf5',
                  border: '2px solid #a7f3d0',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px auto',
                  color: '#059669',
                }}
              >
                <CheckCircle2 style={{ width: '36px', height: '36px' }} />
              </div>

              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>
                ¡Contraseña Guardada Exitosamente!
              </h3>
              <p style={{ fontSize: '13.5px', color: '#475569', lineHeight: 1.6, margin: '0 0 24px 0' }}>
                Tu cuenta ha quedado 100% activada. Tu casillero virtual y seguimiento de paquetes están listos para utilizarse.
              </p>

              <button
                type="button"
                onClick={() => router.push('/')}
                style={{
                  width: '100%',
                  height: '46px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  fontSize: '14.5px',
                  fontWeight: 800,
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
                }}
              >
                <Sparkles style={{ width: '18px', height: '18px' }} />
                <span>Entrar a mi Casillero</span>
                <ArrowRight style={{ width: '16px', height: '16px' }} />
              </button>
            </div>
          )}

          {/* 4. Formulario para ingresar contraseña 2 veces */}
          {!isValidatingToken && hasValidSession && !isSuccess && (
            <form onSubmit={handleSubmit}>
              {sessionUserEmail && (
                <div
                  style={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    marginBottom: '18px',
                    fontSize: '12.5px',
                    color: '#475569',
                  }}
                >
                  Activando cuenta para:{' '}
                  <strong style={{ color: '#0f172a' }}>{sessionUserEmail}</strong>
                </div>
              )}

              {errorMessage && (
                <div
                  style={{
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#b91c1c',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    fontSize: '12.5px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Campo 1: Nueva Contraseña */}
              <div style={{ marginBottom: '16px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#334155',
                    marginBottom: '6px',
                  }}
                >
                  Nueva Contraseña *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    style={{
                      width: '100%',
                      height: '42px',
                      padding: '0 40px 0 12px',
                      borderRadius: '8px',
                      border: `1px solid ${password.length > 0 && !isLengthValid ? '#ef4444' : '#d1d5db'}`,
                      fontSize: '14px',
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#64748b',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {showPassword ? <EyeOff style={{ width: '17px', height: '17px' }} /> : <Eye style={{ width: '17px', height: '17px' }} />}
                  </button>
                </div>
                <div style={{ marginTop: '5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: isLengthValid ? '#059669' : '#94a3b8',
                    }}
                  >
                    {isLengthValid ? '✓ Mínimo 6 caracteres superado' : '• Debe tener al menos 6 caracteres'}
                  </span>
                </div>
              </div>

              {/* Campo 2: Confirmar Contraseña */}
              <div style={{ marginBottom: '22px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#334155',
                    marginBottom: '6px',
                  }}
                >
                  Confirmar Contraseña *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Escribe la misma contraseña"
                    style={{
                      width: '100%',
                      height: '42px',
                      padding: '0 40px 0 12px',
                      borderRadius: '8px',
                      border: `1px solid ${
                        confirmPassword.length > 0
                          ? isMatch
                            ? '#10b981'
                            : '#ef4444'
                          : '#d1d5db'
                      }`,
                      fontSize: '14px',
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex={-1}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#64748b',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {showConfirmPassword ? <EyeOff style={{ width: '17px', height: '17px' }} /> : <Eye style={{ width: '17px', height: '17px' }} />}
                  </button>
                </div>
                {confirmPassword.length > 0 && (
                  <div style={{ marginTop: '5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: isMatch ? '#059669' : '#dc2626',
                      }}
                    >
                      {isMatch ? '✓ Las contraseñas coinciden' : '✕ Las contraseñas no coinciden'}
                    </span>
                  </div>
                )}
              </div>

              {/* Botón de Envío */}
              <button
                type="submit"
                disabled={!canSubmit}
                style={{
                  width: '100%',
                  height: '46px',
                  background: canSubmit
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : '#94a3b8',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 800,
                  border: 'none',
                  borderRadius: '8px',
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: canSubmit ? '0 4px 12px rgba(16, 185, 129, 0.35)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                {isSubmitting ? (
                  <>
                    <div
                      style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid #ffffff',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                      }}
                    />
                    <span>Guardando contraseña...</span>
                  </>
                ) : (
                  <>
                    <Lock style={{ width: '16px', height: '16px' }} />
                    <span>Guardar Contraseña y Activar Cuenta</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Pie del recuadro */}
        <div
          style={{
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            padding: '14px 24px',
            textAlign: 'center',
            fontSize: '11.5px',
            color: '#64748b',
          }}
        >
          AMEX Courier S.A.C. • Sistema de Casilleros y Tracking
        </div>
      </div>
    </div>
  );
}
