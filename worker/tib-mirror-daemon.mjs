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

const ADMIN_MASTER_EMAIL = 'sistemaamexcourier@gmail.com';
const TIB_MEDIA_BASE_URL = 'https://www.tibcourier.com/global-courier/ajax/';
const POLL_INTERVAL_MINUTES = parseInt(process.env.SYNC_INTERVAL_MINUTES || '5', 10);
const POLL_INTERVAL_MS = POLL_INTERVAL_MINUTES * 60 * 1000;

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
function cleanExactString(str) {
  return String(str || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
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
 * Notificación por correo con Resend al cliente cuando su paquete llega a Miami
 */
async function notifyClientNewPackage(email, nombreCompleto, wr, tracking, pesoKg, tipoEmpaque, fotoUrl) {
  if (!resend) {
    console.warn(`[NOTIFICACIÓN] Resend no configurado. Omitiendo email a ${email}`);
    return;
  }

  try {
    const trackingText = tracking && tracking !== '—' ? tracking : 'Sin Tracking Asignado';
    const pesoText = pesoKg != null && pesoKg > 0 ? `${Number(pesoKg).toFixed(2)} kg` : 'Por registrar';
    const tipoText = tipoEmpaque || 'Caja / Paquete';
    const portalUrl = 'https://clientes.sistemaamexcourier.online/clientes';

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
            <td style="background: linear-gradient(135deg, #1e2229 0%, #0f172a 60%, #ff5722 100%); padding: 36px 30px; text-align: center; border-bottom: 3px solid #ff5722;">
              <img src="https://www.sistemaamexcourier.online/images/logo-amex-clean.png" alt="AMEX Courier" width="160" style="display: block; margin: 0 auto 14px auto;" />
              <span style="display: inline-block; background: rgba(255, 87, 34, 0.2); border: 1px solid rgba(255, 87, 34, 0.4); color: #ffccbc; padding: 4px 14px; border-radius: 20px; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px;">
                ✈️ Recepción en Miami • Casillero Virtual
              </span>
              <h1 style="color: #ffffff; margin: 0; font-size: 23px; font-weight: 900;">¡Tu paquete ya está en Miami!</h1>
              <p style="color: #cbd5e1; margin: 8px 0 0 0; font-size: 13.5px;">Hemos recibido y registrado tu paquete en nuestro almacén para su próximo despacho a Lima.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 30px 24px 30px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155;">Hola <strong>${nombreCompleto}</strong>,</p>
              <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569;">Te confirmamos que tu compra o envío acaba de ingresar a nuestras instalaciones de Miami bajo el siguiente registro:</p>
              
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0;">
                    <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b;">Número de Warehouse (WR)</span>
                    <div style="font-size: 17px; font-weight: 900; color: #ff5722; font-family: monospace; margin-top: 2px;">${wr}</div>
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
                    <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b;">Peso Registrado</span>
                    <div style="font-size: 14px; font-weight: 800; color: #1e293b; margin-top: 2px;">${pesoText} (${tipoText})</div>
                  </td>
                </tr>
              </table>

              <div style="text-align: center; margin: 28px 0;">
                <a href="${portalUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 34px; font-size: 14.5px; font-weight: 800; color: #ffffff; background: linear-gradient(135deg, #ff5722 0%, #e64a19 100%); text-decoration: none; border-radius: 8px;">
                  Ver Paquete en mi Portal →
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
      to: [email],
      subject: `📦 ¡Tu paquete ha llegado a nuestro almacén de Miami! [${wr}]`,
      html: htmlContent,
    });

    console.log(`[NOTIFICACIÓN ✅] Email 'RECIBIDO' enviado a ${email} para el paquete ${wr}`);
  } catch (err) {
    console.error(`[NOTIFICACIÓN ❌] Error al enviar email 'RECIBIDO' a ${email}:`, err.message);
  }
}

/**
 * Notificación express por correo con Resend al cliente cuando su paquete va en vuelo a Lima (EN VUELO)
 */
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

    await resend.emails.send({
      from: RESEND_FROM,
      to: [email],
      subject: `✈️ ¡Tu paquete va en camino a Lima! [${wr}]`,
      html: htmlContent,
    });

    console.log(`[NOTIFICACIÓN ✅] Email 'EN VUELO' enviado a ${email} para el paquete ${wr}`);
  } catch (err) {
    console.error(`[NOTIFICACIÓN ❌] Error al enviar email 'EN VUELO' a ${email}:`, err.message);
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

    await resend.emails.send({
      from: RESEND_FROM,
      to: [email],
      subject: `✅ ¡Tu paquete ha sido entregado! [${wr}]`,
      html: htmlContent,
    });

    console.log(`[NOTIFICACIÓN ✅] Email 'ENTREGADO' enviado a ${email} para el paquete ${wr}`);
  } catch (err) {
    console.error(`[NOTIFICACIÓN ❌] Error al enviar email 'ENTREGADO' a ${email}:`, err.message);
  }
}

// -------------------------------------------------------------
// 4. CICLO DE SINCRONIZACIÓN ESPEJO
// -------------------------------------------------------------
async function runMirrorSyncCycle() {
  const cycleStart = Date.now();
  const timeStr = new Date().toLocaleTimeString('es-PE', { hour12: false });
  console.log(`\n======================================================`);
  console.log(`[TIB-MIRROR 🔄 ${timeStr}] Iniciando ciclo de sincronización espejo...`);

  try {
    // 1. Obtener directorio de clientes registrados en tiempo real
    const { data: clientes, error: cErr } = await sb
      .from('clientes_portal')
      .select('email, nombre_completo, alias_palabras_clave, casillero_codigo')
      .eq('activo', true);

    if (cErr) throw new Error(`Fallo al leer clientes_portal: ${cErr.message}`);

    const nclientExactMap = new Map();
    const iclientMap = new Map();
    const clientDetailsMap = new Map();

    for (const c of clientes || []) {
      const email = c.email.trim().toLowerCase();
      clientDetailsMap.set(email, c.nombre_completo || 'Cliente AMEX');
      if (email === ADMIN_MASTER_EMAIL) continue;

      const cleanNombre = cleanExactString(c.nombre_completo);
      if (cleanNombre) nclientExactMap.set(cleanNombre, email);

      if (Array.isArray(c.alias_palabras_clave)) {
        for (const alias of c.alias_palabras_clave) {
          const cleanAlias = cleanExactString(alias);
          if (cleanAlias && cleanAlias.length >= 3) {
            nclientExactMap.set(cleanAlias, email);
          }
        }
      }

      if (c.casillero_codigo) {
        const cleanCasillero = cleanExactString(c.casillero_codigo);
        if (cleanCasillero) iclientMap.set(cleanCasillero, email);
      }
    }

    console.log(`[TIB-MIRROR] Clientes activos monitoreados: ${clientDetailsMap.size}`);

    // 2. Descargar en paralelo los 3 estados oficiales de la API de TIB
    async function fetchTibStatus(status) {
      const res = await fetch(TIB_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: TIB_EMAIL, password: TIB_PASSWORD, status }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} al consultar TIB ${status}`);
      const json = await res.json();
      return (json.data || []).map((item) => ({ ...item, _fetchedStatus: status }));
    }

    const [recibidos, enviados, entregados] = await Promise.all([
      fetchTibStatus('RECIBIDO'),
      fetchTibStatus('ENVIADO'),
      fetchTibStatus('ENTREGADO'),
    ]);

    console.log(`[TIB-MIRROR] TIB API reporta: ${recibidos.length} recibidos, ${enviados.length} enviados, ${entregados.length} entregados.`);

    // 3. Procesar respetando jerarquía: RECIBIDO (1) -> ENVIADO (2) -> ENTREGADO (3)
    const processedWrsMap = new Map();
    const orderedInput = [...recibidos, ...enviados, ...entregados];

    for (const item of orderedInput) {
      const canonicalWr = normalizeTibWr(item.wr, item.seqwr);
      if (!canonicalWr) continue;

      const cleanConsignee = cleanExactString(item.nclient);
      const cleanIclient = cleanExactString(item.iclient);

      let matchedEmail = undefined;

      // Regla 1: Coincidencia exacta con cliente regular
      if (cleanConsignee && nclientExactMap.has(cleanConsignee)) {
        matchedEmail = nclientExactMap.get(cleanConsignee);
      } else if (cleanIclient && iclientMap.has(cleanIclient)) {
        matchedEmail = iclientMap.get(cleanIclient);
      }

      // Regla 2: Cualquier paquete no asignado a un cliente regular se asigna al Superadmin Master
      if (!matchedEmail) {
        matchedEmail = ADMIN_MASTER_EMAIL;
      }

      if (!matchedEmail) continue;

      const statusTib = (item._fetchedStatus || item.status || 'RECIBIDO').toUpperCase();
      const currentPrio = STATUS_PRIORITY[statusTib] || 1;

      // Si ya teníamos este WR en una lista previa con mayor prioridad, no retroceder
      if (processedWrsMap.has(canonicalWr)) {
        const prev = processedWrsMap.get(canonicalWr);
        if (prev.priority >= currentPrio) {
          continue;
        }
      }

      const fullImgUrl = item.img ? `${TIB_MEDIA_BASE_URL}${item.img.replace(/^\/+/, '')}` : null;
      const fullTicketUrl = item.ticket ? `${TIB_MEDIA_BASE_URL}${item.ticket.replace(/^\/+/, '')}` : null;
      const weightNum = item.weight != null ? parseFloat(String(item.weight)) : 0;

      let parsedDate = new Date().toISOString();
      if (item.fecRegister) {
        const d = new Date(item.fecRegister);
        if (!isNaN(d.getTime())) parsedDate = d.toISOString();
      }

      processedWrsMap.set(canonicalWr, {
        record: {
          numero_recibo_bodega: canonicalWr,
          tracking: item.tracking?.trim() || null,
          nombre_consignatario: (item.nclient || '').trim(),
          usuario_email: matchedEmail,
          tipo_empaque: (item.container || item.description || 'CAJA').trim().toUpperCase(),
          peso_kg: isNaN(weightNum) ? 0 : weightNum,
          estado_tib: statusTib,
          estado_amex: 'en_almacen',
          estado_visible: getEstadoVisiblePortal('en_almacen', statusTib),
          tib_imagen_url: fullImgUrl,
          tib_ticket_pdf_url: fullTicketUrl,
          ubicacion_almacen: item.rack?.trim() || null,
          erp_paquete_id: null,
          creado_en: parsedDate,
          actualizado_en: new Date().toISOString(),
        },
        priority: currentPrio,
        statusTib,
        matchedEmail,
        rawItem: item,
      });
    }

    // 4. Detección Inteligente de Cambios (Delta) y Transiciones de Estado:
    // Solo escribimos en la base de datos lo que es nuevo o lo que cambió de estado
    const recordsToUpsert = [];
    const clientCandidatesToNotify = [];

    for (const [canonicalWr, entry] of processedWrsMap.entries()) {
      const cachedStatus = daemonWrStatusCache.get(canonicalWr);

      if (!cachedStatus) {
        // WR nuevo no visto en la caché de este demonio
        recordsToUpsert.push(entry.record);
        daemonWrStatusCache.set(canonicalWr, entry.statusTib);

        // Si no es el ciclo de arranque inicial y pertenece a un cliente regular registrado
        if (!isInitialRun && entry.matchedEmail !== ADMIN_MASTER_EMAIL) {
          clientCandidatesToNotify.push({
            type: entry.statusTib, // 'RECIBIDO' | 'ENVIADO' | 'ENTREGADO'
            entry,
          });
        }
      } else if (cachedStatus !== entry.statusTib) {
        // WR existente cuyo estado avanzó (ej. RECIBIDO -> ENVIADO o ENVIADO -> ENTREGADO)
        recordsToUpsert.push(entry.record);
        daemonWrStatusCache.set(canonicalWr, entry.statusTib);

        if (!isInitialRun && entry.matchedEmail !== ADMIN_MASTER_EMAIL) {
          if (entry.statusTib === 'ENVIADO') {
            clientCandidatesToNotify.push({
              type: 'ENVIADO',
              entry,
            });
          } else if (entry.statusTib === 'ENTREGADO') {
            clientCandidatesToNotify.push({
              type: 'ENTREGADO',
              entry,
            });
          }
        }
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
    }

    // 6. Si hay candidatos a notificar y no es el ciclo inicial, despachar correos según tipo de evento
    let sentEmailsCount = 0;
    if (clientCandidatesToNotify.length > 0 && !isInitialRun) {
      console.log(`[TIB-MIRROR ✉️] Procesando ${clientCandidatesToNotify.length} alertas para clientes...`);
      for (const item of clientCandidatesToNotify) {
        const { type, entry } = item;
        const email = entry.matchedEmail;
        const nombreCompleto = clientDetailsMap.get(email) || 'Cliente AMEX';
        const wr = entry.record.numero_recibo_bodega;
        const tracking = entry.record.tracking;
        const pesoKg = entry.record.peso_kg;
        const tipoEmpaque = entry.record.tipo_empaque;
        const fotoUrl = entry.record.tib_imagen_url;

        if (type === 'RECIBIDO') {
          await notifyClientNewPackage(email, nombreCompleto, wr, tracking, pesoKg, tipoEmpaque, fotoUrl);
          sentEmailsCount++;
        } else if (type === 'ENVIADO') {
          await notifyClientFlightPackage(email, nombreCompleto, wr, tracking, pesoKg);
          sentEmailsCount++;
        } else if (type === 'ENTREGADO') {
          await notifyClientDeliveredPackage(email, nombreCompleto, wr, tracking);
          sentEmailsCount++;
        }
      }
    }

    isInitialRun = false;
    const elapsed = ((Date.now() - cycleStart) / 1000).toFixed(1);
    console.log(`[TIB-MIRROR ✅] Ciclo completado en ${elapsed}s.`);
    console.log(`  - Paquetes actualizados en Supabase: ${upsertedCount}`);
    console.log(`  - Alertas enviadas por email: ${sentEmailsCount}`);
    console.log(`[TIB-MIRROR ⏳] Próximo ciclo en ${POLL_INTERVAL_MINUTES} minutos.`);
  } catch (err) {
    console.error(`[TIB-MIRROR ❌ Error]:`, err.message);
    console.log(`[TIB-MIRROR ⏳] Reintentando en ${POLL_INTERVAL_MINUTES} minutos...`);
  }
}

// -------------------------------------------------------------
// 5. ARRANQUE DEL DEMONIO Y CONTROL DE CIERRE
// -------------------------------------------------------------
console.log(`======================================================`);
console.log(`🚀 INICIANDO DEMONIO ESPEJO AMEX ⇄ TIB COURIER`);
console.log(`Frecuencia de sincronización: Cada ${POLL_INTERVAL_MINUTES} minutos`);
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
