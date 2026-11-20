/**
 * AMEX COURIER — VERIFICACIÓN EN SECO (DRY-RUN 100% SOLO LECTURA) PARA TIB v2 (Cargo System)
 *
 * NO escribe en Supabase ni envía ningún correo en Resend.
 * Audita los paquetes reales de hoy en https://api.tibgrupo.com, los cruza con
 * clientes_portal (exactos + siglas de agencia) y portal_eventos_uso (EMAIL_ENVIADO 7d),
 * y verifica una foto .webp y un Ticket PDF autenticado en vivo.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  CARGO_SYNC_STATUSES,
  PORTAL_STATUS_PRIORITY,
  mapCargoWarehouseToPortalItem,
} from '../lib/tib/cargoSystemHelpers.ts';
import {
  normalizeMatchingRules,
  getMatchedRulesForConsignee,
} from '../lib/portal/matching.ts';

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvLocal();

const TIB_V2_URL = (process.env.TIB_V2_API_URL || 'https://api.tibgrupo.com').replace(/\/+$/, '');
const TIB_V2_EMAIL = (process.env.TIB_V2_EMAIL || '').trim();
const TIB_V2_PASSWORD = (process.env.TIB_V2_PASSWORD || '').trim();
const SUPABASE_URL = process.env.PORTAL_SUPABASE_URL || process.env.NEXT_PUBLIC_PORTAL_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.PORTAL_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPERADMIN_EMAILS = new Set(['sistemaamexcourier@gmail.com', 'gerencia@amexcourierperu.com']);

if (!TIB_V2_EMAIL || !TIB_V2_PASSWORD) {
  console.error('❌ Faltan TIB_V2_EMAIL o TIB_V2_PASSWORD en .env.local');
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Faltan credenciales de Supabase en .env.local');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function toLimaDateStr(isoStr) {
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const g = (t) => parts.find((p) => p.type === t)?.value || '';
  return `${g('year')}-${g('month')}-${g('day')}`;
}

function toLimaDateTimeStr(isoStr) {
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return String(isoStr || '');
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d);
}

async function main() {
  console.log('==================================================================');
  console.log('🧪 DRY-RUN SOLO LECTURA — MIGRACIÓN TIB v2 (CARGO SYSTEM)');
  console.log('==================================================================');

  // 1. Login TIB v2
  const loginRes = await fetch(`${TIB_V2_URL}/user/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TIB_V2_EMAIL, password: TIB_V2_PASSWORD }),
    signal: AbortSignal.timeout(20000),
  });
  if (!loginRes.ok) {
    throw new Error(`Error login TIB v2: HTTP ${loginRes.status}`);
  }
  const loginJson = await loginRes.json();
  const token = loginJson?.token;
  if (!token) throw new Error('TIB v2 no devolvió token JWT');
  console.log(`✅ Autenticación TIB v2 OK (hasRefresh=${Boolean(loginJson?.refresh)})`);

  // 2. Consultar todos los estados en paralelo
  const merged = new Map();
  const countsByStatus = {};

  await Promise.all(
    CARGO_SYNC_STATUSES.map(async (st) => {
      const res = await fetch(`${TIB_V2_URL}/warehouse/warehouse/find-all-warehouse?status=${st}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} en status=${st}`);
      const j = await res.json();
      const rows = Array.isArray(j?.data) ? j.data : [];
      countsByStatus[st] = rows.length;
      for (const raw of rows) {
        const mapped = mapCargoWarehouseToPortalItem({ ...raw, _fetchedStatus: st });
        if (!mapped) continue;
        const prev = merged.get(mapped.canonicalWr);
        if (prev && PORTAL_STATUS_PRIORITY[prev.estadoTib] >= PORTAL_STATUS_PRIORITY[mapped.estadoTib]) {
          continue;
        }
        merged.set(mapped.canonicalWr, mapped);
      }
    })
  );

  console.log('📊 Conteo TIB v2 por estado:', JSON.stringify(countsByStatus));
  console.log(`📦 Total WRs únicos devueltos por Cargo System: ${merged.size}`);

  // 3. Cruzar contra paquetes_portal existentes en Supabase
  const allWrs = Array.from(merged.keys());
  const existingWrs = new Set();
  for (let i = 0; i < allWrs.length; i += 500) {
    const slice = allWrs.slice(i, i + 500);
    const { data, error } = await sb
      .from('paquetes_portal')
      .select('numero_recibo_bodega')
      .in('numero_recibo_bodega', slice);
    if (error) throw error;
    for (const r of data || []) existingWrs.add(r.numero_recibo_bodega);
  }

  const newPackages = [];
  const existingPackages = [];
  const todayLima = toLimaDateStr(new Date().toISOString());
  const todayPackages = [];

  for (const pkg of merged.values()) {
    if (existingWrs.has(pkg.canonicalWr)) {
      existingPackages.push(pkg);
    } else {
      newPackages.push(pkg);
    }
    if (toLimaDateStr(pkg.creadoEn) === todayLima) {
      todayPackages.push(pkg);
    }
  }

  newPackages.sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1));
  todayPackages.sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1));

  console.log(`\n🆕 WRs NUEVOS que no existen aún en paquetes_portal: ${newPackages.length}`);
  console.log(`🔄 WRs ya existentes en paquetes_portal (se actualizarían solo deltas): ${existingPackages.length}`);
  console.log(`📅 WRs registrados hoy (${todayLima}, hora Lima): ${todayPackages.length}`);

  // 4. Cargar clientes activos y correos enviados en últimos 7 días
  const { data: clientsData, error: cErr } = await sb
    .from('clientes_portal')
    .select('id, email, nombre_completo, alias_palabras_clave, palabras_clave_grupo')
    .eq('activo', true);
  if (cErr) throw cErr;

  const regularClients = (clientsData || [])
    .filter((c) => {
      const em = String(c.email || '').trim().toLowerCase();
      return em && !SUPERADMIN_EMAILS.has(em);
    })
    .map((c) => ({
      email: c.email.trim().toLowerCase(),
      nombre: c.nombre_completo || c.email,
      rules: normalizeMatchingRules({
        exactConsignees: c.alias_palabras_clave,
        groupKeywords: c.palabras_clave_grupo,
      }),
    }));

  const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const notifiedSet = new Set();
  let evOffset = 0;
  while (true) {
    const { data: evs, error: evErr } = await sb
      .from('portal_eventos_uso')
      .select('usuario_email, detalles')
      .eq('tipo_evento', 'EMAIL_ENVIADO')
      .gte('creado_en', cutoff7d)
      .range(evOffset, evOffset + 999);
    if (evErr) throw evErr;
    if (!evs || evs.length === 0) break;
    for (const ev of evs) {
      const em = String(ev.usuario_email || '').trim().toLowerCase();
      if (!em) continue;
      if (ev.detalles?.wr) notifiedSet.add(`${em}|${String(ev.detalles.wr).trim().toUpperCase()}`);
      if (Array.isArray(ev.detalles?.wrs)) {
        for (const w of ev.detalles.wrs) {
          notifiedSet.add(`${em}|${String(w).trim().toUpperCase()}`);
        }
      }
    }
    if (evs.length < 1000) break;
    evOffset += 1000;
  }

  // 5. Simular recuperación anti-duplicados (últimos 5 días, igual que recoverMissedNotificationsOnStartup)
  const cutoff5dMs = Date.now() - 5 * 24 * 60 * 60 * 1000;
  const pendingByClient = new Map();
  let alreadyNotifiedSkipped = 0;

  for (const pkg of merged.values()) {
    if (pkg.estadoTib !== 'RECIBIDO' && pkg.estadoTib !== 'ENVIADO') continue;
    const pkgMs = new Date(pkg.creadoEn).getTime();
    if (Number.isNaN(pkgMs) || pkgMs < cutoff5dMs) continue;

    for (const client of regularClients) {
      const match = getMatchedRulesForConsignee(
        pkg.nombreConsignatario,
        client.rules.exactConsignees,
        client.rules.groupKeywords
      );
      if (!match.matched) continue;

      if (notifiedSet.has(`${client.email}|${pkg.canonicalWr}`)) {
        alreadyNotifiedSkipped++;
        continue;
      }

      if (!pendingByClient.has(client.email)) {
        pendingByClient.set(client.email, { nombre: client.nombre, items: [] });
      }
      pendingByClient.get(client.email).items.push({
        wr: pkg.canonicalWr,
        consignatario: pkg.nombreConsignatario,
        tracking: pkg.tracking || '—',
        pesoKg: pkg.pesoKg,
        creadoLima: toLimaDateTimeStr(pkg.creadoEn),
        esNuevoEnBd: !existingWrs.has(pkg.canonicalWr),
        regla: [...match.matchedExact.map((r) => `EXACTO:${r}`), ...match.matchedGroup.map((r) => `SIGLA:${r}`)].join(', '),
      });
    }
  }

  console.log('\n==================================================================');
  console.log('✉️ SIMULACIÓN DE CORREOS PENDIENTES (VENTANA 5 DÍAS, ANTI-DUPLICADOS)');
  console.log('==================================================================');
  console.log(`🛡️ Pares cliente|WR omitidos por ya haber sido notificados en últimos 7d: ${alreadyNotifiedSkipped}`);
  console.log(`📬 Clientes que recibirían correo al activar el demonio: ${pendingByClient.size}`);

  for (const [email, info] of pendingByClient.entries()) {
    const mode = info.items.length === 1 ? '1 correo individual' : `1 correo CONSOLIDADO (${info.items.length} paquetes)`;
    console.log(`\n  • ${info.nombre} <${email}> -> ${mode}`);
    for (const it of info.items) {
      console.log(`      - ${it.wr} | ${it.consignatario} | ${it.pesoKg} kg | ${it.creadoLima} | ${it.regla} | nuevoBD=${it.esNuevoEnBd}`);
    }
  }

  // Muestra de los 8 paquetes nuevos más recientes
  console.log('\n==================================================================');
  console.log('📋 MUESTRA DE LOS 8 PAQUETES NUEVOS MÁS RECIENTES EN TIB v2');
  console.log('==================================================================');
  for (const p of newPackages.slice(0, 8)) {
    console.log(
      `  - ${p.canonicalWr} | ${p.nombreConsignatario} | trk=${p.tracking || '—'} | ${p.pesoKg}kg | ${toLimaDateTimeStr(p.creadoEn)} | foto=${Boolean(p.tibImagenUrl)}`
    );
  }

  // 6. Prueba real en solo lectura de Foto .webp + Ticket PDF del paquete más reciente con foto
  const samplePkg = newPackages.find((p) => p.tibImagenUrl) || todayPackages.find((p) => p.tibImagenUrl) || newPackages[0];
  if (samplePkg) {
    console.log('\n==================================================================');
    console.log(`🔎 VERIFICACIÓN DE MEDIA EN VIVO (${samplePkg.canonicalWr}, id=${samplePkg.numericId})`);
    console.log('==================================================================');

    if (samplePkg.tibImagenUrl) {
      const firstPhoto = samplePkg.tibImagenUrl.split(',')[0];
      const photoRes = await fetch(firstPhoto, { method: 'HEAD', signal: AbortSignal.timeout(15000) });
      console.log(`  🖼️ Foto .webp: HTTP ${photoRes.status} | content-type=${photoRes.headers.get('content-type')} | url=${firstPhoto}`);
    } else {
      console.log('  🖼️ Muestra sin photoUrl');
    }

    const receiptPdfRes = await fetch(`${TIB_V2_URL}/warehouse/warehouse/receipt/pdf/${samplePkg.numericId}/preview`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20000),
    });
    const receiptCt = receiptPdfRes.headers.get('content-type') || '';
    const receiptBuf = receiptPdfRes.ok ? await receiptPdfRes.arrayBuffer() : new ArrayBuffer(0);
    console.log(`  📄 PDF /receipt/pdf/${samplePkg.numericId}/preview: HTTP ${receiptPdfRes.status} | content-type=${receiptCt} | bytes=${receiptBuf.byteLength}`);

    const mainPdfRes = await fetch(`${TIB_V2_URL}/warehouse/warehouse/pdf/${samplePkg.numericId}/preview`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20000),
    });
    const mainCt = mainPdfRes.headers.get('content-type') || '';
    const mainBuf = mainPdfRes.ok ? await mainPdfRes.arrayBuffer() : new ArrayBuffer(0);
    console.log(`  📄 PDF /pdf/${samplePkg.numericId}/preview:         HTTP ${mainPdfRes.status} | content-type=${mainCt} | bytes=${mainBuf.byteLength}`);
  }

  console.log('\n✅ Dry-run completado sin modificar la BD ni enviar correos.');
}

main().catch((err) => {
  console.error('❌ Error en dry-run:', err.message || err);
  process.exit(1);
});
