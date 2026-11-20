/**
 * AMEX COURIER - DEMONIO DE SINCRONIZACIÓN ESPEJO TIB ⇄ PORTAL (HOSTINGER VPS)
 * 
 * Este servicio se ejecuta 24/7 en segundo plano bajo PM2 en el VPS de Hostinger.
 * Consulta la API oficial de TIB cada 5 minutos (RECIBIDO, ENVIADO, ENTREGADO),
 * actualiza el inventario en Supabase (paquetes_portal) en tiempo real con detección
 * inteligente de deltas (solo escribe lo que cambió) y envía notificaciones por correo
 * vía Resend a los clientes cuando su paquete ingresa por primera vez a Miami.
 */

import fs from 'node:fs';
import { createHmac } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------------------------------------------------------------
// 1. CARGA AUTOMÁTICA DE VARIABLES DE ENTORNO (.env / .env.local)
// -------------------------------------------------------------
function loadEnv() {
  const candidatePaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(__dirname, '..', '.env'),
    path.resolve(__dirname, '..', '.env.local'),
  ];

  for (const envPath of candidatePaths) {
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf8');
        for (const line of content.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      } catch (err) {
        console.warn(`[TIB-MIRROR] Aviso al leer ${envPath}:`, err.message);
      }
    }
  }
}

loadEnv();

// -------------------------------------------------------------
// 2. CONFIGURACIÓN Y CLIENTES
// -------------------------------------------------------------
const PORTAL_URL =
  process.env.PORTAL_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_PORTAL_SUPABASE_URL ||
  'https://zftkbolgcnnkkdfzmtix.supabase.co';

const PORTAL_SERVICE_KEY =
  process.env.PORTAL_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  '';

const TIB_URL = process.env.TIB_API_URL || 'https://www.tibcourier.com/api/list-warehouse';
const TIB_EMAIL = process.env.TIB_API_EMAIL || '';
const TIB_PASSWORD = process.env.TIB_API_PASSWORD || '';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const rawResendFrom = process.env.RESEND_FROM_EMAIL || 'notificaciones@sistemaamexcourier.online';
const RESEND_FROM = rawResendFrom.includes('<') && rawResendFrom.includes('>')
  ? rawResendFrom
  : `AMEX Courier <${rawResendFrom}>`;

const ADMIN_MASTER_EMAIL = process.env.ADMIN_MASTER_EMAIL || 'sistemaamexcourier@gmail.com';
const SUPERADMIN_EMAILS = new Set([
  ADMIN_MASTER_EMAIL.toLowerCase(),
  'sistemaamexcourier@gmail.com',
  'gerencia@amexcourierperu.com',
]);
const TIB_MEDIA_BASE_URL = 'https://www.tibcourier.com/global-courier/ajax/';

// Fotos para clientes: enlace firmado al proxy del portal (oculta el dominio de TIB).
// Si PHOTO_LINK_SECRET no está configurado, se usa el enlace directo de TIB como respaldo.
const PHOTO_LINK_SECRET = process.env.PHOTO_LINK_SECRET || '';
const PHOTO_PORTAL_BASE_URL = (process.env.NEXT_PUBLIC_PORTAL_URL || 'https://clientes.sistemaamexcourier.online').replace(/\/+$/, '');

function clientPhotoUrl(wr, index, rawUrl) {
  if (!PHOTO_LINK_SECRET) {
    return rawUrl.startsWith('http') ? rawUrl : TIB_MEDIA_BASE_URL + rawUrl.replace(/^\/+/, '');
  }
  const token = createHmac('sha256', PHOTO_LINK_SECRET)
    .update(`${String(wr).toUpperCase()}.${index}`)
    .digest('base64url')
    .slice(0, 32);
  return `${PHOTO_PORTAL_BASE_URL}/api/foto/${encodeURIComponent(String(wr).toUpperCase())}/${index + 1}?t=${token}`;
}
// Cadencia Dual:
// - Ciclo Express: Consulta RECIBIDOS cada 1 minuto (ultrarrápido, ~1s)
// - Ciclo Completo: Consulta RECIBIDO + ENVIADO + ENTREGADO cada 15 ciclos (~15 min)
const FAST_INTERVAL_MINUTES = parseInt(process.env.SYNC_INTERVAL_MINUTES || '1', 10);
const FAST_INTERVAL_MS = FAST_INTERVAL_MINUTES * 60 * 1000;
const FULL_SWEEP_EVERY_N_CYCLES = parseInt(process.env.FULL_SWEEP_EVERY_N_CYCLES || '15', 10);
let cycleCounter = 0;
let isSyncRunning = false;
const POLL_INTERVAL_MS = FAST_INTERVAL_MS;

const sb = createClient(PORTAL_URL, PORTAL_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

// Jerarquía de estados: mayor valor tiene prioridad
const STATUS_PRIORITY = {
  RECIBIDO: 1,
  ENVIADO: 2,
  ENTREGADO: 3,
};

// Memoria persistente en RAM del demonio para evitar re-escrituras innecesarias
// Clave: canonicalWr -> Valor: statusTib ('RECIBIDO', 'ENVIADO', 'ENTREGADO')
const daemonWrStatusCache = new Map();
let isInitialRun = true;

// -------------------------------------------------------------
// 3. FUNCIONES AUXILIARES
// -------------------------------------------------------------
function buildRecordFingerprint(rec, fecModify) {
  return [
    rec.estado_tib || '',
    cleanExactString(rec.nombre_consignatario),
    cleanExactString(rec.tracking),
    Number(rec.peso_kg || 0).toFixed(2),
    cleanExactString(rec.tipo_empaque),
    rec.tib_imagen_url || '',
    rec.tib_ticket_pdf_url || '',
    rec.ubicacion_almacen || '',
    rec.usuario_email || '',
    fecModify || '',
  ].join('|');
}

function cleanExactString(str) {
  return String(str || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

function escapeHtml(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatShortDate(fecStr) {
  const s = String(fecStr || '').trim();
  if (!s) return '—';
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return s;
  return `${m[3]}/${m[2]} ${m[4]}:${m[5]}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableTibError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return (
    err?.name === 'TimeoutError' ||
    err?.name === 'AbortError' ||
    msg.includes('http 5') ||
    msg.includes('http 429') ||
    msg.includes('terminated') ||
    msg.includes('fetch failed') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('aborted')
  );
}

function normalizeTibWr(rawWr, seqwr) {
  const base = String(rawWr || seqwr || '').trim();
  if (!base) return '';
  const digits = base.replace(/\D/g, '');
  if (!digits) return base.toUpperCase();
  return `WR${digits.padStart(9, '0')}`;
}

function getEstadoVisiblePortal(estadoAmex, estadoTib) {
  const normTib = (estadoTib || '').toUpperCase();
  if (normTib === 'ENTREGADO' || estadoAmex === 'entregado') return 'ENTREGADO';
  if (normTib === 'ENVIADO') return 'EN VUELO';
  if (normTib === 'RECIBIDO') return 'RECIBIDO MIAMI';
  if (estadoAmex === 'en_almacen' || estadoAmex === 'recibido') return 'EN ALMACÉN LINCE';
  return 'RECIBIDO MIAMI';
}

/**
 * Notificación inmediata por correo con Resend al Superadmin (sistemaamexcourier@gmail.com)
 * cada vez que la API oficial de TIB registra un nuevo WR en almacén.
 */
async function notifyAdminNewPackage({ wr, tracking, consignatario, pesoKg, tipoEmpaque, fotoUrl, matchedEmail, clientName, fecRegister }) {
  if (!resend) {
    console.warn(`[NOTIFICACIÓN ADMIN] Resend no configurado. Omitiendo email a ${ADMIN_MASTER_EMAIL}`);
    return;
  }

  try {
    const trackingText = tracking && tracking !== '—' ? tracking : 'Sin Tracking Asignado';
    const pesoText = pesoKg != null && pesoKg > 0 ? `${Number(pesoKg).toFixed(2)} kg` : 'Por registrar';
    const tipoText = tipoEmpaque || 'Caja / Paquete';
    const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://clientes.sistemaamexcourier.online';
    const esClienteRegular = matchedEmail && matchedEmail !== ADMIN_MASTER_EMAIL;

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Nuevo WR Registrado en TIB - AMEX Courier</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b1329; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b1329; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="580" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.35); max-width: 580px; width: 100%;">
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #ff5722 100%); padding: 36px 30px; text-align: center; border-bottom: 3px solid #ff5722;">
              <img src="https://www.sistemaamexcourier.online/images/logo-amex-clean.png" alt="AMEX Courier" width="160" style="display: block; margin: 0 auto 14px auto;" />
              <span style="display: inline-block; background: rgba(255, 87, 34, 0.2); border: 1px solid rgba(255, 87, 34, 0.4); color: #ffccbc; padding: 4px 14px; border-radius: 20px; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px;">
                🔔 Alerta Superadmin • Nuevo WR en TIB
              </span>
              <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 900;">¡Nuevo WR Registrado en Almacén!</h1>
              <p style="color: #cbd5e1; margin: 8px 0 0 0; font-size: 13.5px;">El demonio VPS ha detectado un nuevo paquete registrado en la API de TIB Courier.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 30px 24px 30px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155;">Hola <strong>Superadmin AMEX</strong>,</p>
              <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569;">Se acaba de registrar un nuevo recibo de almacén (WR) en la API de TIB con las siguientes características:</p>
              
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0;">
                    <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b;">Número de Warehouse (WR)</span>
                    <div style="font-size: 19px; font-weight: 900; color: #ff5722; font-family: monospace; margin-top: 2px;">${wr}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 20px; border-bottom: 1px solid #e2e8f0;">
                    <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b;">Consignatario Reportado por TIB</span>
                    <div style="font-size: 14.5px; font-weight: 800; color: #0f172a; margin-top: 2px;">${consignatario || 'Sin Consignatario'}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 20px; border-bottom: 1px solid #e2e8f0;">
                    <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b;">Asignación en Portal de Clientes</span>
                    <div style="font-size: 13.5px; font-weight: 700; margin-top: 4px;">
                      ${esClienteRegular
                        ? `<span style="display: inline-block; background-color: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 800;">👤 Cliente Identificado: ${clientName} (${matchedEmail})</span>`
                        : `<span style="display: inline-block; background-color: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 800;">🏢 Asignado a Superadmin (${ADMIN_MASTER_EMAIL})</span>`
                      }
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 20px; border-bottom: 1px solid #e2e8f0;">
                    <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b;">Número de Tracking Original</span>
                    <div style="font-size: 13.5px; font-weight: 700; color: #1e293b; font-family: monospace; margin-top: 2px;">${trackingText}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 20px; ${fotoUrl || fecRegister ? 'border-bottom: 1px solid #e2e8f0;' : ''}">
                    <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b;">Peso y Empaque</span>
                    <div style="font-size: 14px; font-weight: 800; color: #1e293b; margin-top: 2px;">${pesoText} • ${tipoText}</div>
                  </td>
                </tr>
                ${fecRegister ? `
                <tr>
                  <td style="padding: 14px 20px; ${fotoUrl ? 'border-bottom: 1px solid #e2e8f0;' : ''}">
                    <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b;">Fecha de Registro en TIB</span>
                    <div style="font-size: 13px; font-weight: 700; color: #334155; margin-top: 2px;">${fecRegister}</div>
                  </td>
                </tr>
                ` : ''}
                ${fotoUrl ? `
                <tr>
                  <td style="padding: 14px 20px;">
                    <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b;">Foto del Paquete en TIB</span>
                    <div style="margin-top: 8px;">
                      ${fotoUrl.split(',').map((u) => u.trim()).filter(Boolean).map((u) => `<a href="${u.startsWith('http') ? u : TIB_MEDIA_BASE_URL + u.replace(/^\/+/, '')}" target="_blank" rel="noopener noreferrer" style="display:block; margin-bottom:6px;"><img src="${u.startsWith('http') ? u : TIB_MEDIA_BASE_URL + u.replace(/^\/+/, '')}" alt="Foto ${wr}" style="max-width: 100%; max-height: 220px; border-radius: 8px; border: 1px solid #cbd5e1; display: block;" /></a>`).join('') || ''}
                      <!-- multi-photo rendered above -->
                      <a href="#" style="display:none;">
                        <span style="display:none;"></span>
                      </a>
                    </div>
                  </td>
                </tr>
                ` : ''}
              </table>

              <div style="text-align: center; margin: 28px 0;">
                <a href="${portalUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 34px; font-size: 14.5px; font-weight: 800; color: #ffffff; background: linear-gradient(135deg, #ff5722 0%, #e64a19 100%); text-decoration: none; border-radius: 8px;">
                  Abrir Panel Superadmin →
                </a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    await resend.emails.send({
      from: RESEND_FROM,
      to: [ADMIN_MASTER_EMAIL],
      subject: `🔔 [Nuevo WR TIB] ${wr} - ${consignatario || 'Sin Consignatario'} (${pesoText})`,
      html: htmlContent,
    });

    console.log(`[NOTIFICACIÓN ADMIN ✅] Alerta de nuevo WR enviada a ${ADMIN_MASTER_EMAIL} para el paquete ${wr}`);
  } catch (err) {
    console.error(`[NOTIFICACIÓN ADMIN ❌] Error al enviar alerta a ${ADMIN_MASTER_EMAIL}:`, err.message);
  }
}

/**
 * Registra en tiempo real cada correo despachado en portal_eventos_uso para telemetría y analíticas
 */
async function logEmailSentToTelemetry(toEmail, subject, meta = {}) {
  try {
    const cleanTo = String(toEmail).trim().toLowerCase();
    if (SUPERADMIN_EMAILS.has(cleanTo)) {
      return;
    }
    await sb.from('portal_eventos_uso').insert({
      usuario_email: cleanTo,
      tipo_evento: 'EMAIL_ENVIADO',
      detalles: {
        asunto: subject,
        wr: meta.wr || undefined,
        wrs: Array.isArray(meta.wrs) && meta.wrs.length > 0 ? meta.wrs : undefined,
        cantidad_paquetes: meta.wrs ? meta.wrs.length : undefined,
        resend_id: meta.resendId || undefined,
        origen: meta.origen || 'TIB Mirror Daemon VPS',
      },
      dispositivo: 'Servidor VPS',
      navegador: 'TIB Daemon',
      creado_en: new Date().toISOString(),
    });
  } catch (e) {
    console.error(`[TELEMETRÍA ❌] Error registrando email para ${toEmail}:`, e.message);
  }
}

/**
 * Envía un correo mediante Resend verificando la respuesta ({ data, error }) antes de registrar telemetría.
 */
async function sendResendAndTrack({ to, subject, html, wr = null, wrs = null, origen = 'TIB Mirror Daemon VPS', tag = 'EMAIL' }) {
  if (!resend) {
    console.warn(`[NOTIFICACIÓN] Resend no configurado. Omitiendo email a ${to}`);
    return false;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: RESEND_FROM,
      to: [to],
      subject,
      html,
    });

    if (error || !data?.id) {
      console.error(`[NOTIFICACIÓN ❌] Error Resend '${tag}' a ${to}:`, error?.message || 'Sin ID de confirmación');
      return false;
    }

    await logEmailSentToTelemetry(to, subject, { wr, wrs, resendId: data.id, origen });
    return true;
  } catch (err) {
    console.error(`[NOTIFICACIÓN ❌] Excepción al enviar '${tag}' a ${to}:`, err.message);
    return false;
  }
}

/**
 * Notificación por correo con Resend al cliente cuando su paquete llega a Miami
 */
async function notifyClientNewPackage(email, nombreCompleto, wr, tracking, pesoKg, tipoEmpaque, fotoUrl, consignatario) {
  if (!resend) {
    console.warn(`[NOTIFICACIÓN] Resend no configurado. Omitiendo email a ${email}`);
    return;
  }

  try {
    const trackingText = tracking && tracking !== '—' ? tracking : 'Sin Tracking Asignado';
    const pesoText = pesoKg != null && pesoKg > 0 ? `${Number(pesoKg).toFixed(2)} kg` : 'Por registrar';
    const tipoText = tipoEmpaque || 'Caja / Paquete';
    const portalUrl = 'https://clientes.sistemaamexcourier.online/clientes';
    const cleanConsignee = consignatario || nombreCompleto;

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Paquete Recibido en Miami - AMEX Courier</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b1329; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b1329; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="580" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.35); max-width: 580px; width: 100%;">
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #ff5722 100%); padding: 36px 30px; text-align: center; border-bottom: 3px solid #ff5722;">
              <img src="https://www.sistemaamexcourier.online/images/logo-amex-clean.png" alt="AMEX Courier" width="160" style="display: block; margin: 0 auto 14px auto; max-width: 160px; height: auto;" />
              <span style="display: inline-block; background: rgba(255, 87, 34, 0.2); border: 1px solid rgba(255, 87, 34, 0.4); color: #ffccbc; padding: 4px 14px; border-radius: 20px; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px;">
                📦 Recepción en Bodega Miami • Casillero Virtual AMEX
              </span>
              <h1 style="color: #ffffff; margin: 0; font-size: 23px; font-weight: 900; letter-spacing: -0.5px;">
                ¡Tu paquete ya está en Miami!
              </h1>
              <p style="color: #cbd5e1; margin: 8px 0 0 0; font-size: 13.5px;">
                Hemos recibido e ingresado tu compra en nuestro almacén para su próximo despacho a Lima.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 30px 24px 30px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.5;">
                Hola <strong>${nombreCompleto}</strong>,
              </p>
              <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569; line-height: 1.6;">
                Te confirmamos que acabamos de recibir e ingresar a tu casillero un nuevo paquete bajo el siguiente registro:
              </p>
              
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 24px; overflow: hidden;">
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0;">
                    <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b;">Número de Warehouse (WR)</span>
                    <div style="font-size: 18px; font-weight: 900; color: #ff5722; font-family: monospace; margin-top: 2px;">${wr}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 20px; border-bottom: 1px solid #e2e8f0;">
                    <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b;">Consignatario / Destinatario</span>
                    <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 2px;">${cleanConsignee}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 20px; border-bottom: 1px solid #e2e8f0;">
                    <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b;">Número de Tracking Original</span>
                    <div style="font-size: 13.5px; font-weight: 700; color: #1e293b; font-family: monospace; margin-top: 2px;">${trackingText}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 20px; ${fotoUrl ? 'border-bottom: 1px solid #e2e8f0;' : ''}">
                    <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b;">Peso y Empaque</span>
                    <div style="font-size: 14px; font-weight: 800; color: #1e293b; margin-top: 2px;">${pesoText} • ${tipoText}</div>
                  </td>
                </tr>

                ${fotoUrl ? `
                <tr>
                  <td style="padding: 18px 20px;">
                    <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 8px;">
                      📷 Evidencia Fotográfica en Almacén Miami
                    </span>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                      ${fotoUrl.split(',').map((u) => u.trim()).filter(Boolean).map((u, i, arr) => `
                        <div style="background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; text-align: center;">
                          <a href="${clientPhotoUrl(wr, i, u)}" target="_blank" rel="noopener noreferrer" style="display: block; text-decoration: none;">
                            <img src="${clientPhotoUrl(wr, i, u)}" alt="Foto ${wr} ${arr.length > 1 ? '(' + (i + 1) + '/' + arr.length + ')' : ''}" style="max-width: 100%; max-height: 240px; border-radius: 6px; display: block; margin: 0 auto; object-fit: contain; box-shadow: 0 2px 8px rgba(0,0,0,0.08);" />
                            <span style="display: inline-block; margin-top: 8px; font-size: 11.5px; font-weight: 700; color: #ea580c;">
                              🔍 Clic aquí para ver foto ${arr.length > 1 ? (i + 1) : ''} en tamaño original →
                            </span>
                          </a>
                        </div>
                      `).join('')}
                    </div>
                  </td>
                </tr>
                ` : ''}
              </table>

              <div style="text-align: center; margin: 28px 0 10px 0;">
                <a href="${portalUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 15px 36px; font-size: 14.5px; font-weight: 800; color: #ffffff; background: linear-gradient(135deg, #ff5722 0%, #e64a19 100%); text-decoration: none; border-radius: 8px; box-shadow: 0 4px 14px rgba(255, 87, 34, 0.35);">
                  Ver en mi Portal de Clientes →
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 12px; font-weight: 700; color: #475569;">
                AMEX Courier S.A.C. • Tu conexión directa Miami - Lima
              </p>
              <p style="margin: 4px 0 0 0; font-size: 11px; color: #94a3b8;">
                Este es un mensaje automático de notificación de casillero. Si tienes consultas, escríbenos a soporte o contacta a tu asesor.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const emailSubject1 = `📦 ¡Tu paquete ya está en Miami! [${wr}]${cleanConsignee ? ' - ' + cleanConsignee : ''}`;
    const sent = await sendResendAndTrack({
      to: email,
      subject: emailSubject1,
      html: htmlContent,
      wr,
      wrs: [wr],
      tag: 'RECIBIDO',
    });

    if (sent) {
      console.log(`[NOTIFICACIÓN ✅] Email 'RECIBIDO' enviado a ${email} para el paquete ${wr} (${cleanConsignee})`);
    }
    return sent;
  } catch (err) {
    console.error(`[NOTIFICACIÓN ❌] Error al enviar email 'RECIBIDO' a ${email}:`, err.message);
    return false;
  }
}

/**
 * Envía un correo resumen consolidado cuando tras una caída/reinicio se acumularon múltiples paquetes
 * sin notificación para un mismo cliente (evita ráfagas anti-spam y límite de tamaño Gmail).
 */
async function notifyClientConsolidatedPackages(email, nombreCompleto, items, origen = 'TIB Mirror Daemon VPS (Recuperación)') {
  if (!Array.isArray(items) || items.length === 0) return false;

  const recCount = items.filter((p) => p.statusTib === 'RECIBIDO').length;
  const envCount = items.filter((p) => p.statusTib === 'ENVIADO').length;

  let breakdownText = `${items.length} paquete${items.length === 1 ? '' : 's'} registrado${items.length === 1 ? '' : 's'}`;
  if (recCount > 0 && envCount > 0) {
    breakdownText = `${recCount} en bodega Miami y ${envCount} ya en vuelo a Perú`;
  } else if (envCount > 0) {
    breakdownText = `${envCount} paquete${envCount === 1 ? '' : 's'} en vuelo a Perú`;
  } else {
    breakdownText = `${recCount} paquete${recCount === 1 ? '' : 's'} recibido${recCount === 1 ? '' : 's'} en bodega Miami`;
  }

  const headingText =
    items.length === 1
      ? 'Actualización de tu paquete'
      : `Actualización de tus ${items.length} paquetes`;

  const rowsHtml = items
    .map((p, idx) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      const trackText = p.tracking && p.tracking !== '—' ? escapeHtml(p.tracking) : 'Sin tracking';
      const weightText = p.pesoKg > 0 ? `${Number(p.pesoKg).toFixed(2)} kg` : 'Por reg.';
      const dateText = escapeHtml(formatShortDate(p.fecRegister));
      const statusBadge =
        p.statusTib === 'ENVIADO'
          ? '<span style="display:inline-block;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;padding:2px 7px;border-radius:4px;font-size:10.5px;font-weight:800;white-space:nowrap;">EN VUELO</span>'
          : '<span style="display:inline-block;background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;padding:2px 7px;border-radius:4px;font-size:10.5px;font-weight:800;white-space:nowrap;">RECIBIDO MIAMI</span>';

      const imgs = String(p.tibImagenUrl || '')
        .split(',')
        .map((u) => u.trim())
        .filter(Boolean);
      const photoLinks =
        imgs.length > 0
          ? imgs
              .map((u, i) => {
                const href = escapeHtml(clientPhotoUrl(p.wr, i, u));
                const label = imgs.length > 1 ? `Foto ${i + 1}` : 'Ver foto';
                return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="display:inline-block;color:#ea580c;font-weight:700;font-size:11px;text-decoration:none;white-space:nowrap;margin-right:4px;">${label}</a>`;
              })
              .join('')
          : '<span style="color:#94a3b8;font-size:11px;">—</span>';

      return `<tr style="background:${bg};border-bottom:1px solid #e2e8f0;"><td style="padding:8px;font-family:monospace;font-size:11.5px;font-weight:800;color:#ff5722;white-space:nowrap;">${escapeHtml(p.wr)}</td><td style="padding:8px;font-size:11.5px;font-weight:700;color:#0f172a;">${escapeHtml(p.consignatario)}</td><td style="padding:8px;font-family:monospace;font-size:11px;color:#334155;word-break:break-all;">${trackText}</td><td style="padding:8px;font-size:11.5px;font-weight:700;color:#1e293b;white-space:nowrap;">${weightText}</td><td style="padding:8px;font-size:11px;color:#475569;white-space:nowrap;">${dateText}</td><td style="padding:8px;">${statusBadge}</td><td style="padding:8px;">${photoLinks}</td></tr>`;
    })
    .join('');

  const htmlContent = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Resumen de Paquetes - AMEX Courier</title></head><body style="margin:0;padding:0;background-color:#0b1329;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0b1329;padding:28px 12px;"><tr><td align="center"><table role="presentation" width="680" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border-radius:14px;overflow:hidden;max-width:680px;width:100%;"><tr><td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 60%,#ff5722 100%);padding:30px 24px;text-align:center;border-bottom:3px solid #ff5722;"><img src="https://www.sistemaamexcourier.online/images/logo-amex-clean.png" alt="AMEX Courier" width="150" style="display:block;margin:0 auto 12px auto;" /><span style="display:inline-block;background:rgba(255,87,34,0.2);border:1px solid rgba(255,87,34,0.4);color:#ffccbc;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:800;letter-spacing:0.6px;text-transform:uppercase;margin-bottom:10px;">Resumen de Casillero • Avisos Pendientes</span><h1 style="color:#ffffff;margin:0;font-size:21px;font-weight:900;">${headingText}</h1><p style="color:#cbd5e1;margin:6px 0 0 0;font-size:13px;">${escapeHtml(breakdownText)}</p></td></tr><tr><td style="padding:24px 20px;"><p style="margin:0 0 12px 0;font-size:14.5px;color:#334155;">Hola <strong>${escapeHtml(nombreCompleto)}</strong>,</p><p style="margin:0 0 16px 0;font-size:13.5px;color:#475569;line-height:1.55;">Aquí tienes el resumen actualizado de los paquetes registrados recientemente en tu casillero:</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:8px;border-collapse:collapse;overflow:hidden;margin-bottom:20px;"><thead><tr style="background:#f1f5f9;border-bottom:2px solid #cbd5e1;text-align:left;"><th style="padding:8px;font-size:10.5px;color:#475569;text-transform:uppercase;">WR</th><th style="padding:8px;font-size:10.5px;color:#475569;text-transform:uppercase;">Consignatario</th><th style="padding:8px;font-size:10.5px;color:#475569;text-transform:uppercase;">Tracking</th><th style="padding:8px;font-size:10.5px;color:#475569;text-transform:uppercase;">Peso</th><th style="padding:8px;font-size:10.5px;color:#475569;text-transform:uppercase;">Ingreso</th><th style="padding:8px;font-size:10.5px;color:#475569;text-transform:uppercase;">Estado</th><th style="padding:8px;font-size:10.5px;color:#475569;text-transform:uppercase;">Evidencia</th></tr></thead><tbody>${rowsHtml}</tbody></table><div style="text-align:center;margin:22px 0 8px 0;"><a href="${escapeHtml(PHOTO_PORTAL_BASE_URL)}/clientes" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:13px 30px;font-size:14px;font-weight:800;color:#ffffff;background:linear-gradient(135deg,#ff5722 0%,#e64a19 100%);text-decoration:none;border-radius:8px;">Ver todo en mi Portal de Clientes →</a></div></td></tr><tr><td style="background-color:#f8fafc;padding:16px 24px;text-align:center;border-top:1px solid #e2e8f0;"><p style="margin:0;font-size:12px;font-weight:700;color:#475569;">AMEX Courier S.A.C. • Tu conexión directa Miami - Lima</p></td></tr></table></td></tr></table></body></html>`;

  const wrs = items.map((i) => i.wr);
  const subject =
    items.length === 1
      ? `📦 Tu paquete [${wrs[0]}] fue registrado en Miami - AMEX Courier`
      : `📦 Resumen de tus ${items.length} paquetes registrados en Miami - AMEX Courier`;

  const sent = await sendResendAndTrack({
    to: email,
    subject,
    html: htmlContent,
    wr: wrs.length === 1 ? wrs[0] : null,
    wrs,
    origen,
    tag: 'RESUMEN',
  });

  if (sent) {
    console.log(`[NOTIFICACIÓN ✅] Resumen consolidado (${wrs.length} WRs) enviado a ${email}`);
  }
  return sent;
}

async function notifyClientFlightPackage(email, nombreCompleto, wr, tracking, pesoKg) {
  if (!resend) {
    console.warn(`[NOTIFICACIÓN] Resend no configurado. Omitiendo email a ${email}`);
    return;
  }

  try {
    const trackingText = tracking && tracking !== '—' ? tracking : 'Sin Tracking Asignado';
    const pesoText = pesoKg != null && pesoKg > 0 ? `${Number(pesoKg).toFixed(2)} kg` : null;
    const portalUrl = 'https://clientes.sistemaamexcourier.online/clientes';

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Paquete en Vuelo a Lima - AMEX Courier</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b1329; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b1329; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="580" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.35); max-width: 580px; width: 100%;">
          <tr>
            <td style="background: linear-gradient(135deg, #1e2229 0%, #0f172a 60%, #0284c7 100%); padding: 36px 30px; text-align: center; border-bottom: 3px solid #0284c7;">
              <img src="https://www.sistemaamexcourier.online/images/logo-amex-clean.png" alt="AMEX Courier" width="160" style="display: block; margin: 0 auto 14px auto;" />
              <span style="display: inline-block; background: rgba(2, 132, 199, 0.25); border: 1px solid rgba(2, 132, 199, 0.5); color: #bae6fd; padding: 4px 14px; border-radius: 20px; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px;">
                ✈️ Despacho Aéreo • En Vuelo
              </span>
              <h1 style="color: #ffffff; margin: 0; font-size: 23px; font-weight: 900;">¡Tu paquete va en camino a Lima!</h1>
              <p style="color: #cbd5e1; margin: 8px 0 0 0; font-size: 13.5px;">Ha salido de nuestro almacén de Miami en vuelo directo hacia Perú.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 30px 24px 30px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155;">Hola <strong>${nombreCompleto}</strong>,</p>
              <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569;">Te confirmamos que tu paquete ya despegó y se encuentra en tránsito internacional hacia Lima:</p>
              
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0;">
                    <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b;">Número de Warehouse (WR)</span>
                    <div style="font-size: 17px; font-weight: 900; color: #0284c7; font-family: monospace; margin-top: 2px;">${wr}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 20px; border-bottom: 1px solid #e2e8f0;">
                    <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b;">Número de Tracking Original</span>
                    <div style="font-size: 13.5px; font-weight: 700; color: #1e293b; font-family: monospace; margin-top: 2px;">${trackingText}</div>
                  </td>
                </tr>
                ${pesoText ? `
                <tr>
                  <td style="padding: 14px 20px; border-bottom: 1px solid #e2e8f0;">
                    <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b;">Peso Registrado</span>
                    <div style="font-size: 14px; font-weight: 800; color: #1e293b; margin-top: 2px;">${pesoText}</div>
                  </td>
                </tr>` : ''}
                <tr>
                  <td style="padding: 14px 20px;">
                    <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b;">Estado Actual</span>
                    <div style="margin-top: 4px;">
                      <span style="display: inline-block; background-color: #eff6ff; color: #1d4ed8; border: 1px solid #dbeafe; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 800;">
                        ✈️ EN VUELO A PERÚ
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              <div style="text-align: center; margin: 28px 0;">
                <a href="${portalUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 34px; font-size: 14.5px; font-weight: 800; color: #ffffff; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); text-decoration: none; border-radius: 8px;">
                  Rastrear en mi Portal →
                </a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const emailSubject2 = `✈️ ¡Tu paquete va en camino a Lima! [${wr}]`;
    const sent = await sendResendAndTrack({
      to: email,
      subject: emailSubject2,
      html: htmlContent,
      wr,
      wrs: [wr],
      tag: 'EN VUELO',
    });

    if (sent) {
      console.log(`[NOTIFICACIÓN ✅] Email 'EN VUELO' enviado a ${email} para el paquete ${wr}`);
    }
    return sent;
  } catch (err) {
    console.error(`[NOTIFICACIÓN ❌] Error al enviar email 'EN VUELO' a ${email}:`, err.message);
    return false;
  }
}

/**
 * Notificación ultra-concisa por correo con Resend al cliente cuando su paquete ha sido entregado (ENTREGADO)
 */
async function notifyClientDeliveredPackage(email, nombreCompleto, wr, tracking) {
  if (!resend) {
    console.warn(`[NOTIFICACIÓN] Resend no configurado. Omitiendo email a ${email}`);
    return;
  }

  try {
    const trackingText = tracking && tracking !== '—' ? tracking : 'Sin Tracking Asignado';
    const portalUrl = 'https://clientes.sistemaamexcourier.online/clientes';

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Paquete Entregado - AMEX Courier</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b1329; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b1329; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="580" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.35); max-width: 580px; width: 100%;">
          <tr>
            <td style="background: linear-gradient(135deg, #1e2229 0%, #0f172a 60%, #059669 100%); padding: 36px 30px; text-align: center; border-bottom: 3px solid #059669;">
              <img src="https://www.sistemaamexcourier.online/images/logo-amex-clean.png" alt="AMEX Courier" width="160" style="display: block; margin: 0 auto 14px auto;" />
              <span style="display: inline-block; background: rgba(5, 150, 105, 0.25); border: 1px solid rgba(5, 150, 105, 0.5); color: #a7f3d0; padding: 4px 14px; border-radius: 20px; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px;">
                ✅ Entrega Exitosa • Finalizada
              </span>
              <h1 style="color: #ffffff; margin: 0; font-size: 23px; font-weight: 900;">¡Tu paquete ha sido entregado!</h1>
              <p style="color: #cbd5e1; margin: 8px 0 0 0; font-size: 13.5px;">El servicio ha sido completado satisfactoriamente.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 30px 24px 30px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155;">Hola <strong>${nombreCompleto}</strong>,</p>
              <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569;">Te confirmamos que la entrega de tu paquete ha sido efectuada exitosamente:</p>
              
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0;">
                    <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b;">Número de Warehouse (WR)</span>
                    <div style="font-size: 17px; font-weight: 900; color: #059669; font-family: monospace; margin-top: 2px;">${wr}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 20px; border-bottom: 1px solid #e2e8f0;">
                    <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b;">Número de Tracking Original</span>
                    <div style="font-size: 13.5px; font-weight: 700; color: #1e293b; font-family: monospace; margin-top: 2px;">${trackingText}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 20px;">
                    <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b;">Estado</span>
                    <div style="margin-top: 4px;">
                      <span style="display: inline-block; background-color: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 800;">
                        ● ENTREGADO
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              <div style="text-align: center; margin: 28px 0;">
                <a href="${portalUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 34px; font-size: 14.5px; font-weight: 800; color: #ffffff; background: linear-gradient(135deg, #059669 0%, #047857 100%); text-decoration: none; border-radius: 8px;">
                  Ver en mi Portal →
                </a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const emailSubject3 = `✅ ¡Tu paquete ha sido entregado! [${wr}]`;
    const sent = await sendResendAndTrack({
      to: email,
      subject: emailSubject3,
      html: htmlContent,
      wr,
      wrs: [wr],
      tag: 'ENTREGADO',
    });

    if (sent) {
      console.log(`[NOTIFICACIÓN ✅] Email 'ENTREGADO' enviado a ${email} para el paquete ${wr}`);
    }
    return sent;
  } catch (err) {
    console.error(`[NOTIFICACIÓN ❌] Error al enviar email 'ENTREGADO' a ${email}:`, err.message);
    return false;
  }
}

/**
 * Obtiene el conjunto de pares "email|WR" ya notificados en portal_eventos_uso durante los últimos días.
 */
async function fetchNotifiedWrEmailSet(lookbackDays = 7) {
  const cutoffIso = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
  const notifiedSet = new Set();
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await sb
      .from('portal_eventos_uso')
      .select('id, usuario_email, detalles')
      .eq('tipo_evento', 'EMAIL_ENVIADO')
      .gte('creado_en', cutoffIso)
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`No se pudo consultar portal_eventos_uso: ${error.message}`);
    }
    if (!data || data.length === 0) break;

    for (const ev of data) {
      const em = String(ev.usuario_email || '').trim().toLowerCase();
      if (!em) continue;
      if (ev.detalles?.wr) {
        notifiedSet.add(`${em}|${String(ev.detalles.wr).trim().toUpperCase()}`);
      }
      if (Array.isArray(ev.detalles?.wrs)) {
        for (const w of ev.detalles.wrs) {
          const cleanWr = String(w || '').trim().toUpperCase();
          if (cleanWr) notifiedSet.add(`${em}|${cleanWr}`);
        }
      }
    }

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return notifiedSet;
}

/**
 * En el ciclo inicial tras reiniciar el contenedor/VPS, detecta paquetes ingresados en los últimos 5 días
 * que aún no tengan registro EMAIL_ENVIADO para ese cliente y despacha los avisos (consolidando si >= 2).
 */
async function recoverMissedNotificationsOnStartup(processedWrsMap, clientDetailsMap) {
  let notifiedSet;
  try {
    notifiedSet = await fetchNotifiedWrEmailSet(7);
  } catch (err) {
    console.warn(`[TIB-MIRROR ⚠️ Recuperación] Se omite recuperación automática por fallo de telemetría: ${err.message}`);
    return 0;
  }

  const windowCutoffMs = Date.now() - 5 * 24 * 60 * 60 * 1000;
  const byClient = new Map();

  for (const [canonicalWr, entry] of processedWrsMap.entries()) {
    if (entry.statusTib !== 'RECIBIDO' && entry.statusTib !== 'ENVIADO') continue;

    const pkgTimeMs = new Date(entry.record.creado_en).getTime();
    if (isNaN(pkgTimeMs) || pkgTimeMs < windowCutoffMs) continue;

    const emails =
      entry.matchedEmails && entry.matchedEmails.size > 0
        ? Array.from(entry.matchedEmails)
        : [entry.matchedEmail];

    for (const rawEmail of emails) {
      const email = String(rawEmail || '').trim().toLowerCase();
      if (!email || SUPERADMIN_EMAILS.has(email)) continue;
      if (notifiedSet.has(`${email}|${canonicalWr}`)) continue;

      if (!byClient.has(email)) byClient.set(email, []);
      byClient.get(email).push({
        wr: canonicalWr,
        statusTib: entry.statusTib,
        consignatario: entry.record.nombre_consignatario,
        tracking: entry.record.tracking,
        pesoKg: entry.record.peso_kg,
        tipoEmpaque: entry.record.tipo_empaque,
        fecRegister: String(entry.rawItem?.fecRegister || entry.record.creado_en || ''),
        tibImagenUrl: entry.record.tib_imagen_url,
      });
    }
  }

  if (byClient.size === 0) {
    console.log(`[TIB-MIRROR 🛡️ Recuperación] Sin notificaciones recientes pendientes al arrancar.`);
    return 0;
  }

  console.log(`[TIB-MIRROR 🚨 Recuperación] Detectados ${byClient.size} cliente(s) con alertas recientes sin enviar; despachando...`);
  let sentEmailsCount = 0;
  const entries = Array.from(byClient.entries());

  for (let i = 0; i < entries.length; i++) {
    const [email, items] = entries[i];
    items.sort((a, b) => (a.fecRegister < b.fecRegister ? -1 : 1));
    const nombreCompleto = clientDetailsMap.get(email) || 'Cliente AMEX';

    let ok = false;
    if (items.length === 1 && items[0].statusTib === 'RECIBIDO') {
      const single = items[0];
      ok = await notifyClientNewPackage(
        email,
        nombreCompleto,
        single.wr,
        single.tracking,
        single.pesoKg,
        single.tipoEmpaque,
        single.tibImagenUrl,
        single.consignatario
      );
    } else {
      ok = await notifyClientConsolidatedPackages(
        email,
        nombreCompleto,
        items,
        'TIB Mirror Daemon VPS (Auto-Recuperación)'
      );
    }

    if (ok) sentEmailsCount++;
    if (i < entries.length - 1) {
      await sleep(1500);
    }
  }

  return sentEmailsCount;
}

/**
 * En sincronización completa, elimina de paquetes_portal únicamente WRs anulados/eliminados de TIB
 * (solo si el snapshot completo supera el umbral sano y dentro del límite de circuito de seguridad).
 */
async function pruneOrphanPackagesSafely(processedWrsMap) {
  if (processedWrsMap.size < 50000) {
    console.warn(`[TIB-MIRROR ⚠️ GUARD] Tamaño completo de TIB (${processedWrsMap.size}) por debajo de 50,000; se omite depuración de bajas.`);
    return 0;
  }

  const MAX_AUTO_PRUNE_PER_CYCLE = 500;
  const orphans = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await sb
      .from('paquetes_portal')
      .select('id, numero_recibo_bodega, nombre_consignatario, erp_paquete_id')
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.warn(`[TIB-MIRROR ⚠️ Prune] Error consultando Supabase:`, error.message);
      return 0;
    }
    if (!data || data.length === 0) break;

    for (const row of data) {
      if (!processedWrsMap.has(row.numero_recibo_bodega) && row.erp_paquete_id == null) {
        orphans.push(row);
      }
    }

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  if (orphans.length === 0) return 0;

  if (orphans.length > MAX_AUTO_PRUNE_PER_CYCLE) {
    console.warn(`[TIB-MIRROR ⚠️ GUARD] Detectadas ${orphans.length} posibles bajas (> ${MAX_AUTO_PRUNE_PER_CYCLE}); se aborta eliminación automática por seguridad.`);
    return 0;
  }

  let deletedCount = 0;
  const CHUNK_SIZE = 200;
  for (let i = 0; i < orphans.length; i += CHUNK_SIZE) {
    const chunk = orphans.slice(i, i + CHUNK_SIZE);
    const ids = chunk.map((r) => r.id);
    const { error: delErr } = await sb.from('paquetes_portal').delete().in('id', ids);
    if (delErr) {
      console.error(`[TIB-MIRROR ❌ Prune] Error eliminando lote:`, delErr.message);
    } else {
      deletedCount += chunk.length;
      for (const r of chunk) {
        daemonWrStatusCache.delete(r.numero_recibo_bodega);
      }
    }
  }

  const affectedConsignees = new Set(
    orphans.map((r) => cleanExactString(r.nombre_consignatario)).filter(Boolean)
  );
  for (const cName of affectedConsignees) {
    try {
      await sb.rpc('recalcular_consignatario_catalogo', { target_nombre: cName });
    } catch (rpcErr) {
      console.warn(`[TIB-MIRROR ⚠️ Prune] Error recalculando catálogo para ${cName}:`, rpcErr.message);
    }
  }

  console.log(`[TIB-MIRROR 🧹] Depurados ${deletedCount} WR(s) anulados en TIB y recalculados ${affectedConsignees.size} consignatario(s).`);
  return deletedCount;
}

// -------------------------------------------------------------
// 4. CICLO DE SINCRONIZACIÓN ESPEJO
// -------------------------------------------------------------
async function runMirrorSyncCycle() {
  if (isSyncRunning) {
    console.log('[TIB-MIRROR ⚠️] Ciclo anterior aún en curso. Omitiendo solapamiento.');
    return;
  }
  isSyncRunning = true;
  cycleCounter++;
  const isFullSweep = isInitialRun || (cycleCounter % FULL_SWEEP_EVERY_N_CYCLES === 0);
  const cycleStart = Date.now();
  const timeStr = new Date().toLocaleTimeString('es-PE', { hour12: false });
  console.log(`\n======================================================`);
  console.log(`[TIB-MIRROR 🔄 ${timeStr}] Ciclo #${cycleCounter}: Sincronización ${isFullSweep ? 'COMPLETA (60k paquetes)' : 'EXPRESS RECIBIDOS (Miami)'}...`);

  try {
    // 0. Detectar dinámicamente si existe la columna híbrida usuario_id en paquetes_portal
    const { error: colCheckErr } = await sb
      .from('paquetes_portal')
      .select('usuario_id')
      .limit(1);
    const hasUsuarioIdColumn = !colCheckErr;

    // 1. Obtener directorio de clientes registrados en tiempo real (exactos + siglas de grupo)
    const { data: clientes, error: cErr } = await sb
      .from('clientes_portal')
      .select('id, email, nombre_completo, alias_palabras_clave, palabras_clave_grupo')
      .eq('activo', true);

    if (cErr) throw new Error(`Fallo al leer clientes_portal: ${cErr.message}`);

    const BLOCKED_GROUP_KEYWORDS = new Set(['AMEX', 'COURIER', 'PERU', 'MIAMI', 'LIMA', 'SAC', 'S.A.C', 'EIRL', 'SRL']);
    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const buildWordBoundaryRegex = (term) => {
      const tokens = cleanExactString(term).split(' ').filter(Boolean).map(escapeRegex);
      if (tokens.length === 0) return null;
      return new RegExp(`(?:^|[^A-Z0-9ÁÉÍÓÚÜÑ])${tokens.join('\\s+')}(?:$|[^A-Z0-9ÁÉÍÓÚÜÑ])`, 'i');
    };

    const nclientExactMap = new Map(); // cleanConsignee -> Set<email>
    const iclientMap = new Map();       // cleanIclient -> Set<email>
    const clientDetailsMap = new Map(); // email -> name
    const clientIdMap = new Map();      // email -> id
    const groupKeywordRules = [];       // { keyword, regex, email }

    function addExactMapping(map, key, email) {
      if (!map.has(key)) map.set(key, new Set());
      map.get(key).add(email);
    }

    for (const c of clientes || []) {
      const email = c.email.trim().toLowerCase();
      clientDetailsMap.set(email, c.nombre_completo || 'Cliente AMEX');
      if (c.id) clientIdMap.set(email, c.id);
      if (SUPERADMIN_EMAILS.has(email)) continue;

      // Motor unificado: NO se inyecta nombre_completo de forma oculta.
      // 1) alias_palabras_clave -> coincidencia exacta normalizada
      if (Array.isArray(c.alias_palabras_clave)) {
        for (const alias of c.alias_palabras_clave) {
          const cleanAlias = cleanExactString(alias);
          if (cleanAlias && cleanAlias.length >= 2 && cleanAlias !== 'AMEX') {
            addExactMapping(nclientExactMap, cleanAlias, email);
          }
        }
      }

      // 2) palabras_clave_grupo -> coincidencia por palabra completa (solo siglas/agencias)
      if (Array.isArray(c.palabras_clave_grupo)) {
        for (const groupKw of c.palabras_clave_grupo) {
          const cleanGroup = cleanExactString(groupKw);
          if (cleanGroup && cleanGroup.length >= 3 && !BLOCKED_GROUP_KEYWORDS.has(cleanGroup)) {
            const regex = buildWordBoundaryRegex(cleanGroup);
            if (regex) {
              groupKeywordRules.push({ keyword: cleanGroup, regex, email });
            }
          }
        }
      }
    }

    groupKeywordRules.sort((a, b) => b.keyword.length - a.keyword.length);

    console.log(`[TIB-MIRROR] Clientes activos monitoreados: ${clientDetailsMap.size}`);

    // 2. Descargar en paralelo los estados oficiales de la API de TIB (con timeout y reintento ante HTTP 504/red)
    async function fetchTibStatus(status, maxRetries = 3) {
      let lastErr = null;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const res = await fetch(TIB_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: TIB_EMAIL, password: TIB_PASSWORD, status }),
            signal: AbortSignal.timeout(45000),
          });
          if (!res.ok) {
            throw new Error(`HTTP ${res.status} al consultar TIB ${status}`);
          }
          const json = await res.json();
          return (json.data || []).map((item) => ({ ...item, _fetchedStatus: status }));
        } catch (err) {
          lastErr = err;
          if (attempt < maxRetries && isRetryableTibError(err)) {
            const backoffMs = 2000 * attempt;
            console.warn(`[TIB-MIRROR ⚠️] Error temporal consultando TIB ${status} (intento ${attempt}/${maxRetries}): ${err.message}. Reintentando en ${backoffMs / 1000}s...`);
            await sleep(backoffMs);
            continue;
          }
          throw err;
        }
      }
      throw lastErr;
    }

    let orderedInput = [];
    if (isFullSweep) {
      const [recibidos, enviados, entregados] = await Promise.all([
      fetchTibStatus('RECIBIDO'),
      fetchTibStatus('ENVIADO'),
      fetchTibStatus('ENTREGADO'),
    ]);

      console.log(`[TIB-MIRROR] TIB API reporta (Completo): ${recibidos.length} recibidos, ${enviados.length} enviados, ${entregados.length} entregados.`);
      orderedInput = [...recibidos, ...enviados, ...entregados];
    } else {
      const recibidos = await fetchTibStatus('RECIBIDO');
      console.log(`[TIB-MIRROR] TIB API reporta (Express): ${recibidos.length} recibidos.`);
      orderedInput = recibidos;
    }

    // 3. Procesar respetando jerarquía: RECIBIDO (1) -> ENVIADO (2) -> ENTREGADO (3)
    const processedWrsMap = new Map();
    // orderedInput listo para procesar según modo express o completo

    for (const item of orderedInput) {
      const canonicalWr = normalizeTibWr(item.wr, item.seqwr);
      if (!canonicalWr) continue;

      const cleanConsignee = cleanExactString(item.nclient);
      const cleanIclient = cleanExactString(item.iclient);

      const matchedEmails = new Set();

      // Regla 1: Coincidencia exacta (alias_palabras_clave) o palabra completa (palabras_clave_grupo)
      if (cleanConsignee && nclientExactMap.has(cleanConsignee)) {
        for (const e of nclientExactMap.get(cleanConsignee)) matchedEmails.add(e);
      }
      if (cleanIclient && iclientMap.has(cleanIclient)) {
        for (const e of iclientMap.get(cleanIclient)) matchedEmails.add(e);
      }
      if (cleanConsignee) {
        for (const grpRule of groupKeywordRules) {
          if (grpRule.regex.test(cleanConsignee)) {
            matchedEmails.add(grpRule.email);
          }
        }
      }

      // Regla 2: Si no coincidió con ningún cliente regular, se asigna al Superadmin Master
      if (matchedEmails.size === 0) {
        matchedEmails.add(ADMIN_MASTER_EMAIL);
      }

      const primaryEmail = Array.from(matchedEmails)[0];
      const matchedEmail = primaryEmail;

      const statusTib = (item._fetchedStatus || item.status || 'RECIBIDO').toUpperCase();
      const currentPrio = STATUS_PRIORITY[statusTib] || 1;

      // Si ya teníamos este WR en una lista previa con mayor prioridad, no retroceder
      if (processedWrsMap.has(canonicalWr)) {
        const prev = processedWrsMap.get(canonicalWr);
        if (prev.priority >= currentPrio) {
          continue;
        }
      }

      const fullImgUrl = item.img
        ? item.img
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean)
            .map((p) => (p.startsWith('http') ? p : `${TIB_MEDIA_BASE_URL}${p.replace(/^\/+/, '')}`))
            .join(',')
        : null;
      const fullTicketUrl = item.ticket ? `${TIB_MEDIA_BASE_URL}${item.ticket.replace(/^\/+/, '')}` : null;
      const weightNum = item.weight != null ? parseFloat(String(item.weight)) : 0;

      let parsedDate = new Date().toISOString();
      if (item.fecRegister) {
        const d = new Date(item.fecRegister);
        if (!isNaN(d.getTime())) parsedDate = d.toISOString();
      }

      const recordObj = {
        numero_recibo_bodega: canonicalWr,
        tracking: item.tracking?.trim() || null,
        nombre_consignatario: (item.nclient || '').trim(),
        usuario_email: matchedEmail,
        tipo_empaque: (item.container || item.description || 'CAJA').trim().toUpperCase(),
        peso_kg: isNaN(weightNum) ? 0 : weightNum,
        estado_tib: statusTib,
        estado_amex: 'en_almacen',
        tib_imagen_url: fullImgUrl,
        tib_ticket_pdf_url: fullTicketUrl,
        ubicacion_almacen: item.rack?.trim() || null,
        erp_paquete_id: null,
        creado_en: parsedDate,
        actualizado_en: new Date().toISOString(),
      };

      if (hasUsuarioIdColumn) {
        recordObj.usuario_id = clientIdMap.get(matchedEmail) || null;
      }

      processedWrsMap.set(canonicalWr, {
        record: recordObj,
        priority: currentPrio,
        statusTib,
        matchedEmail: primaryEmail,
        matchedEmails,
        rawItem: item,
      });
    }

    // 4. Detección Inteligente de Cambios (Delta) y Transiciones de Estado:
    // Solo escribimos en la base de datos lo que es nuevo o lo que cambió de estado
    const recordsToUpsert = [];
    const clientCandidatesToNotify = [];

    for (const [canonicalWr, entry] of processedWrsMap.entries()) {
      const cached = daemonWrStatusCache.get(canonicalWr);
      const cachedStatus = typeof cached === 'object' && cached ? cached.statusTib : cached;
      const cachedFingerprint = typeof cached === 'object' && cached ? cached.fingerprint : null;
      const currentFingerprint = buildRecordFingerprint(entry.record, entry.rawItem?.fecModify);

      if (!cachedStatus) {
        // WR nuevo no visto en la caché de este demonio (nuevo paquete registrado por TIB)
        recordsToUpsert.push(entry.record);
        daemonWrStatusCache.set(canonicalWr, { statusTib: entry.statusTib, fingerprint: currentFingerprint });

        if (!isInitialRun) {
          // Notificar únicamente a clientes regulares registrados cuando su paquete ingresa en RECIBIDO a Miami
          const emailsToNotify = entry.matchedEmails && entry.matchedEmails.size > 0
            ? Array.from(entry.matchedEmails)
            : [entry.matchedEmail];

          for (const rawEmail of emailsToNotify) {
            const email = String(rawEmail || '').trim().toLowerCase();
            if (email && !SUPERADMIN_EMAILS.has(email) && entry.statusTib === 'RECIBIDO') {
              clientCandidatesToNotify.push({
                type: 'RECIBIDO',
                email,
                entry,
              });
            }
          }
        }
      } else if (cachedStatus !== entry.statusTib) {
        // WR existente cuyo estado avanzó (ej. RECIBIDO -> ENVIADO o ENVIADO -> ENTREGADO)
        recordsToUpsert.push(entry.record);
        daemonWrStatusCache.set(canonicalWr, { statusTib: entry.statusTib, fingerprint: currentFingerprint });

        // NOTA: Notificaciones por correo a clientes de ENVIADO y ENTREGADO deshabilitadas temporalmente por solicitud.
        // La actualización en la base de datos se mantiene activa para que en el portal web siempre se vea el estado real.
      } else if (cachedFingerprint && cachedFingerprint !== currentFingerprint) {
        // WR existente cuyos datos fueron editados en TIB (ej. corrección de nombre_consignatario, peso, tracking o foto)
        console.log(`[TIB-MIRROR ✏️] Edición detectada en TIB para ${canonicalWr}: "${entry.record.nombre_consignatario}" (${entry.statusTib})`);
        recordsToUpsert.push(entry.record);
        daemonWrStatusCache.set(canonicalWr, { statusTib: entry.statusTib, fingerprint: currentFingerprint });
      }
    }

    console.log(`[TIB-MIRROR] Total en memoria: ${daemonWrStatusCache.size} WRs.`);
    console.log(`[TIB-MIRROR] Deltas a escribir en base de datos: ${recordsToUpsert.length} paquetes.`);

    // 5. Inserción / Actualización por lotes de 500 en Supabase únicamente para deltas
    let upsertedCount = 0;
    if (recordsToUpsert.length > 0) {
      const CHUNK_SIZE = 500;
      for (let i = 0; i < recordsToUpsert.length; i += CHUNK_SIZE) {
        const chunk = recordsToUpsert.slice(i, i + CHUNK_SIZE);
        const { error: upsertErr } = await sb
          .from('paquetes_portal')
          .upsert(chunk, { onConflict: 'numero_recibo_bodega' });

        if (upsertErr) {
          console.error(`[TIB-MIRROR ❌] Error en lote ${i}:`, upsertErr.message);
        } else {
          upsertedCount += chunk.length;
        }
      }

      // 5.B. Actualización Automática en Tiempo Real del Catálogo de Consignatarios (amex_portal_clientes)
      if (!isInitialRun) {
        const affectedConsignees = new Set(
          recordsToUpsert
            .map((r) => cleanExactString(r.nombre_consignatario))
            .filter(Boolean)
        );

        if (affectedConsignees.size > 0) {
          for (const cName of affectedConsignees) {
            try {
              await sb.rpc('recalcular_consignatario_catalogo', { target_nombre: cName });
            } catch (rpcErr) {
              console.warn(`[TIB-MIRROR ⚠️] Error al recalcular catálogo para ${cName}:`, rpcErr.message);
            }
          }
          console.log(`[TIB-MIRROR 📊] Catálogo amex_portal_clientes recalculado exactamente para ${affectedConsignees.size} consignatario(s).`);
        }
      }
    }

    // 5.C. Depuración segura de WRs anulados/eliminados en TIB durante sincronización completa
    if (isFullSweep) {
      await pruneOrphanPackagesSafely(processedWrsMap);
    }

    // 6. Despachar correos pendientes de arranque (recuperación) o nuevos ingresos del ciclo
    let sentEmailsCount = 0;

    if (isInitialRun) {
      sentEmailsCount += await recoverMissedNotificationsOnStartup(processedWrsMap, clientDetailsMap);
    }

    // Alertas exclusivamente para clientes regulares registrados (con dosificación anti-ráfaga de Gmail)
    if (clientCandidatesToNotify.length > 0 && !isInitialRun) {
      console.log(`[TIB-MIRROR ✉️] Procesando ${clientCandidatesToNotify.length} alertas para clientes (con pausa anti-ráfaga)...`);
      for (let i = 0; i < clientCandidatesToNotify.length; i++) {
        const item = clientCandidatesToNotify[i];
        const { type, entry } = item;
        const email = item.email || entry.matchedEmail;
        const nombreCompleto = clientDetailsMap.get(email) || 'Cliente AMEX';
        const wr = entry.record.numero_recibo_bodega;
        const tracking = entry.record.tracking;
        const pesoKg = entry.record.peso_kg;
        const tipoEmpaque = entry.record.tipo_empaque;
        const fotoUrl = entry.record.tib_imagen_url;

        let ok = false;
        if (type === 'RECIBIDO') {
          ok = await notifyClientNewPackage(email, nombreCompleto, wr, tracking, pesoKg, tipoEmpaque, fotoUrl, entry.record.nombre_consignatario);
        } else if (type === 'ENVIADO') {
          ok = await notifyClientFlightPackage(email, nombreCompleto, wr, tracking, pesoKg);
        } else if (type === 'ENTREGADO') {
          ok = await notifyClientDeliveredPackage(email, nombreCompleto, wr, tracking);
        }
        if (ok) sentEmailsCount++;

        // Alternativa A: Dosificación inteligente para evitar greylisting / pausas de recepción de Gmail
        if (i < clientCandidatesToNotify.length - 1) {
          const nextEmail = clientCandidatesToNotify[i + 1]?.email || clientCandidatesToNotify[i + 1]?.entry?.matchedEmail;
          const isSameRecipient = nextEmail && nextEmail.toLowerCase() === (email || '').toLowerCase();
          const pauseMs = isSameRecipient ? 2000 : 1200;
          await sleep(pauseMs);
        }
      }
    }

    isInitialRun = false;
    const elapsed = ((Date.now() - cycleStart) / 1000).toFixed(1);
    console.log(`[TIB-MIRROR ✅] Ciclo completado en ${elapsed}s.`);
    console.log(`  - Paquetes actualizados en Supabase: ${upsertedCount}`);
    console.log(`  - Alertas enviadas por email: ${sentEmailsCount}`);
    console.log(`[TIB-MIRROR ⏳] Próximo ciclo express en ${FAST_INTERVAL_MINUTES} minuto(s).`);
  } catch (err) {
    console.error(`[TIB-MIRROR ❌ Error]:`, err.message);
    console.log(`[TIB-MIRROR ⏳] Reintentando en ${FAST_INTERVAL_MINUTES} minuto(s)...`);
  } finally {
    isSyncRunning = false;
  }
}

// -------------------------------------------------------------
// 5. ARRANQUE DEL DEMONIO Y CONTROL DE CIERRE
// -------------------------------------------------------------
console.log(`======================================================`);
console.log(`🚀 INICIANDO DEMONIO ESPEJO AMEX ⇄ TIB COURIER`);
console.log(`Frecuencia: Express cada ${FAST_INTERVAL_MINUTES} min (RECIBIDO), Completo cada ${FULL_SWEEP_EVERY_N_CYCLES * FAST_INTERVAL_MINUTES} min`);
console.log(`Base de datos destino: ${PORTAL_URL}`);
console.log(`Servicio de correo: ${RESEND_FROM}`);
console.log(`======================================================`);

// Primer ciclo inmediato
runMirrorSyncCycle();

// Intervalo recurrente
const intervalId = setInterval(runMirrorSyncCycle, POLL_INTERVAL_MS);

// Captura de señales para apagado limpio
function handleShutdown(signal) {
  console.log(`\n[TIB-MIRROR] Recibida señal ${signal}. Deteniendo demonio limpiamente...`);
  clearInterval(intervalId);
  process.exit(0);
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
