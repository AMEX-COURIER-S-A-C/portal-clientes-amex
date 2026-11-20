import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseLimaDateRangeBound,
  formatLimaDateForInput,
  getLimaDatePresetRange,
  formatLimaDateTimeParts,
  formatLimaDateTimeString,
} from '../lib/portal/limaTime.ts';

test('parseLimaDateRangeBound convierte YYYY-MM-DD a límites UTC exactos de America/Lima (-05:00)', () => {
  assert.equal(parseLimaDateRangeBound('2026-11-20', 'start'), '2026-11-20T05:00:00.000Z');
  assert.equal(parseLimaDateRangeBound('2026-11-20', 'end'), '2026-11-21T04:59:59.999Z');

  // Un paquete registrado el 20/11 a las 21:30 hora Lima (= 21/11 02:30Z) cae dentro de "2026-11-20"
  const pkgNightLimaUtc = '2026-11-21T02:30:00.000Z';
  const start = parseLimaDateRangeBound('2026-11-20', 'start');
  const end = parseLimaDateRangeBound('2026-11-20', 'end');
  assert.ok(start && end);
  assert.equal(pkgNightLimaUtc >= start && pkgNightLimaUtc <= end, true);

  // Fechas inexistentes o vacías se rechazan limpiamente
  assert.equal(parseLimaDateRangeBound('2026-02-31', 'start'), null);
  assert.equal(parseLimaDateRangeBound('', 'start'), null);
  assert.equal(parseLimaDateRangeBound('invalida', 'end'), null);
});

test('formatLimaDateTimeParts y formatLimaDateTimeString siempre muestran hora Lima aunque el servidor corra en UTC', () => {
  // 2026-11-20T19:35:13.983Z = 20/11/2026 14:35:13 Lima
  assert.deepEqual(formatLimaDateTimeParts('2026-11-20T19:35:13.983Z'), {
    date: '20/11/2026',
    time: '14:35:13',
  });
  assert.equal(formatLimaDateTimeString('2026-11-20T19:35:13.983Z'), '20/11/2026 14:35:13');

  // 2026-11-21T01:15:00.000Z = 20/11/2026 20:15:00 Lima (cruza medianoche UTC, sigue siendo día 20 en Lima)
  assert.deepEqual(formatLimaDateTimeParts('2026-11-21T01:15:00.000Z'), {
    date: '20/11/2026',
    time: '20:15:00',
  });
  assert.equal(formatLimaDateTimeString(null), '—');
});

test('getLimaDatePresetRange calcula presets anclados al calendario de Lima incluso tras medianoche UTC', () => {
  // 2026-11-21T02:00:00.000Z es todavía 2026-11-20 21:00 en Lima
  const ref = new Date('2026-11-21T02:00:00.000Z');
  assert.equal(formatLimaDateForInput(ref), '2026-11-20');
  assert.deepEqual(getLimaDatePresetRange('today', ref), { desde: '2026-11-20', hasta: '2026-11-20' });
  assert.deepEqual(getLimaDatePresetRange('yesterday', ref), { desde: '2026-11-19', hasta: '2026-11-19' });
  assert.deepEqual(getLimaDatePresetRange('7days', ref), { desde: '2026-11-14', hasta: '2026-11-20' });
  assert.deepEqual(getLimaDatePresetRange('thisMonth', ref), { desde: '2026-11-01', hasta: '2026-11-20' });
  assert.deepEqual(getLimaDatePresetRange('lastMonth', ref), { desde: '2026-10-01', hasta: '2026-10-31' });
  assert.deepEqual(getLimaDatePresetRange('all', ref), { desde: '', hasta: '' });
});
