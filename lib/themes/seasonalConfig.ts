/**
 * ============================================================================
 * CONFIGURACIÓN MAESTRA DE TEMÁTICA POR TEMPORADA (LOGIN Y TRANSICIONES)
 * ============================================================================
 * Cambia `ACTIVE_LOGIN_THEME` entre:
 *  - 'halloween' : Escena Halloween 60/120 FPS (calaveras, calabazas, brujas, telarañas)
 *  - 'default'   : Diseño corporativo clásico AMEX Courier (azul y dorado)
 *
 * NOTA: Esta temática solo se aplica en la pantalla de Login (/login) y en las
 * cortinas de transición (entrada y salida). El interior del sistema operativo
 * permanece 100% neutro para no distraer la operación diaria.
 */
export type LoginSeasonTheme = 'default' | 'halloween';

export const ACTIVE_LOGIN_THEME: LoginSeasonTheme = 'halloween';

export interface LoginThemeTokens {
  id: LoginSeasonTheme;
  isHalloween: boolean;
  pageBackground: string;
  shellBorder: string;
  shellShadow: string;
  leftPanelBackground: string;
  badgeBackground: string;
  badgeBorder: string;
  badgeColor: string;
  badgeIcon: string;
  badgeText: string;
  logoBoxBorder: string;
  logoDropShadow: string;
  portalLabelColor: string;
  portalIcon: string;
  inputFocusBorder: string;
  inputFocusShadow: string;
  submitBtnBackground: string;
  submitBtnBorder: string;
  submitBtnShadow: string;
  submitBtnHoverShadow: string;
  progressGradient: string;
  spinnerColor: string;
  logoutShieldColor: string;
}

export function getLoginThemeTokens(
  theme: LoginSeasonTheme = ACTIVE_LOGIN_THEME
): LoginThemeTokens {
  if (theme === 'halloween') {
    return {
      id: 'halloween',
      isHalloween: true,
      pageBackground:
        'radial-gradient(circle at 18% 18%, rgba(249, 115, 22, 0.14) 0%, transparent 45%), radial-gradient(circle at 82% 82%, rgba(168, 85, 247, 0.18) 0%, transparent 52%), linear-gradient(135deg, #05030a 0%, #0d0818 52%, #070510 100%)',
      shellBorder: '1px solid rgba(249, 115, 22, 0.28)',
      shellShadow:
        '0 30px 75px -15px rgba(0, 0, 0, 0.85), 0 0 40px -10px rgba(249, 115, 22, 0.22), 0 0 0 1px rgba(168, 85, 247, 0.16)',
      leftPanelBackground:
        'radial-gradient(circle at 20% 15%, rgba(249, 115, 22, 0.18) 0%, transparent 55%), radial-gradient(circle at 85% 90%, rgba(168, 85, 247, 0.22) 0%, transparent 55%), linear-gradient(160deg, #07040d 0%, #10091d 60%, #130d24 100%)',
      badgeBackground: 'rgba(249, 115, 22, 0.15)',
      badgeBorder: '1px solid rgba(249, 115, 22, 0.42)',
      badgeColor: '#fb923c',
      badgeIcon: 'fa-solid fa-ghost',
      badgeText: 'Edición Halloween • ERP Logístico',
      logoBoxBorder: '1px solid rgba(249, 115, 22, 0.32)',
      logoDropShadow: 'drop-shadow(0 4px 16px rgba(249, 115, 22, 0.32))',
      portalLabelColor: '#c084fc',
      portalIcon: 'fa-solid fa-hat-wizard',
      inputFocusBorder: '#f97316',
      inputFocusShadow: '0 0 0 3px rgba(249, 115, 22, 0.18)',
      submitBtnBackground: 'linear-gradient(135deg, #ea580c 0%, #9333ea 100%)',
      submitBtnBorder: '1px solid rgba(251, 146, 60, 0.4)',
      submitBtnShadow: '0 8px 22px -4px rgba(234, 88, 12, 0.55)',
      submitBtnHoverShadow: '0 12px 28px -4px rgba(168, 85, 247, 0.65)',
      progressGradient: 'linear-gradient(90deg, #f97316, #a855f7, #f59e0b)',
      spinnerColor: '#f97316',
      logoutShieldColor: '#fb923c',
    };
  }

  return {
    id: 'default',
    isHalloween: false,
    pageBackground:
      'radial-gradient(circle at 15% 20%, rgba(245, 158, 11, 0.08) 0%, transparent 45%), radial-gradient(circle at 85% 80%, rgba(37, 99, 235, 0.14) 0%, transparent 50%), linear-gradient(135deg, #070b14 0%, #0f172a 55%, #090d16 100%)',
    shellBorder: '1px solid rgba(255, 255, 255, 0.09)',
    shellShadow:
      '0 30px 70px -15px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(245, 158, 11, 0.08)',
    leftPanelBackground:
      'radial-gradient(circle at 20% 15%, rgba(245, 158, 11, 0.14) 0%, transparent 55%), radial-gradient(circle at 85% 90%, rgba(37, 99, 235, 0.18) 0%, transparent 55%), linear-gradient(160deg, #060911 0%, #0b1120 60%, #0f172a 100%)',
    badgeBackground: 'rgba(245, 158, 11, 0.12)',
    badgeBorder: '1px solid rgba(245, 158, 11, 0.3)',
    badgeColor: '#fbbf24',
    badgeIcon: 'fa-solid fa-plane-departure',
    badgeText: 'ERP Logístico Internacional',
    logoBoxBorder: '1px solid rgba(245, 158, 11, 0.22)',
    logoDropShadow: 'drop-shadow(0 4px 14px rgba(245, 158, 11, 0.2))',
    portalLabelColor: '#38bdf8',
    portalIcon: 'fa-solid fa-shield-halved',
    inputFocusBorder: '#f59e0b',
    inputFocusShadow: '0 0 0 3px rgba(245, 158, 11, 0.15)',
    submitBtnBackground: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    submitBtnBorder: '1px solid rgba(56, 189, 248, 0.25)',
    submitBtnShadow: '0 8px 20px -4px rgba(37, 99, 235, 0.5)',
    submitBtnHoverShadow: '0 12px 24px -4px rgba(37, 99, 235, 0.65)',
    progressGradient: 'linear-gradient(90deg, #2563eb, #f59e0b)',
    spinnerColor: '#f59e0b',
    logoutShieldColor: '#38bdf8',
  };
}
