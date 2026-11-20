import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getLimaDayKeyFromValue,
  summarizeHistoricalClientLogins,
} from '../lib/analytics/loginStats.ts';

test('summarizeHistoricalClientLogins acumula todos los logins históricos de clientes y los de hoy en hora Lima', () => {
  const isClient = (email) =>
    email !== 'sistemaamexcourier@gmail.com' &&
    email !== 'gerencia@amexcourierperu.com' &&
    !email.endsWith('@interno.amex.local');

  const rows = [
    // Hoy 20/11 en hora Lima (20/11 16:11 Lima = 20/11 21:11Z)
    { usuario_email: 'courrier.rs26@gmail.com', creado_en: '2026-11-20T21:11:08.000Z' },
    // Hoy 20/11 noche Lima (20/11 22:30 Lima = 21/11 03:30Z -> sigue siendo 2026-11-20 en Lima)
    { usuario_email: 'COQUETICASS@GMAIL.COM', creado_en: '2026-11-21T03:30:00.000Z' },
    // Histórico hace más de 30 días (debe sumarse al histórico aunque days=7 o days=30)
    { usuario_email: 'courrier.rs26@gmail.com', creado_en: '2026-09-10T15:00:00.000Z' },
    { usuario_email: 'auradorp@gmail.com', creado_en: '2026-10-29T05:16:46.000Z' },
    // Superadmins e internos deben excluirse completamente
    { usuario_email: 'sistemaamexcourier@gmail.com', creado_en: '2026-11-20T20:00:00.000Z' },
    { usuario_email: 'martin@interno.amex.local', creado_en: '2026-11-20T16:02:44.000Z' },
  ];

  const summary = summarizeHistoricalClientLogins(rows, {
    todayLimaKey: '2026-11-20',
    isEligibleClientEmail: isClient,
  });

  assert.equal(summary.totalLoginsHistoricos, 4);
  assert.equal(summary.loginsHoy, 2);
  assert.equal(summary.clientesConLoginHistorico, 3);
});

test('getLimaDayKeyFromValue maneja fechas válidas e inválidas correctamente', () => {
  assert.equal(getLimaDayKeyFromValue('2026-11-21T04:59:59.000Z'), '2026-11-20');
  assert.equal(getLimaDayKeyFromValue('2026-11-21T05:00:00.000Z'), '2026-11-21');
  assert.equal(getLimaDayKeyFromValue('invalid-date'), '');
});
