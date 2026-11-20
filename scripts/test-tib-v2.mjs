import test from 'node:test';
import assert from 'node:assert/strict';

import {
  cleanNullableText,
  formatCargoCanonicalWr,
  mapCargoStatusToPortalStatus,
  normalizeCargoPhotoUrls,
  mapCargoWarehouseToPortalItem,
} from '../lib/tib/cargoSystemHelpers.ts';

import {
  extractNumericWrId,
  normalizeTibWr,
} from '../lib/tib/apiClient.ts';

import {
  signTicketToken,
  verifyTicketToken,
  buildSignedTicketPath,
  isAuthorizedLegacyTicketUrl,
  parseTibV2TicketId,
  hasAvailableTicketPdf,
} from '../lib/portal/ticket-link.ts';

import {
  signPhotoToken,
} from '../lib/portal/photo-link.ts';

test('formatCargoCanonicalWr & extractNumericWrId normalizan ida y vuelta sin NaN', () => {
  assert.deepEqual(formatCargoCanonicalWr(506539), {
    numericId: 506539,
    canonicalWr: 'WR000506539',
  });
  assert.deepEqual(formatCargoCanonicalWr('000506558'), {
    numericId: 506558,
    canonicalWr: 'WR000506558',
  });
  assert.equal(formatCargoCanonicalWr('invalid'), null);
  assert.equal(formatCargoCanonicalWr(0), null);

  assert.equal(extractNumericWrId('WR000506539'), 506539);
  assert.equal(extractNumericWrId('506558'), 506558);
  assert.equal(extractNumericWrId('WR'), null);
  assert.equal(normalizeTibWr('506539'), 'WR000506539');
});

test('cleanNullableText limpia literales "null" y "undefined" devueltos por Cargo System', () => {
  assert.equal(cleanNullableText('null'), null);
  assert.equal(cleanNullableText(' NULL '), null);
  assert.equal(cleanNullableText('undefined'), null);
  assert.equal(cleanNullableText('   '), null);
  assert.equal(cleanNullableText(null), null);
  assert.equal(cleanNullableText('E08LOURDES'), 'E08LOURDES');
});

test('mapCargoStatusToPortalStatus traduce todos los estados de Cargo System', () => {
  assert.equal(mapCargoStatusToPortalStatus('PRERECEIVED'), 'RECIBIDO');
  assert.equal(mapCargoStatusToPortalStatus('RECEIVED'), 'RECIBIDO');
  assert.equal(mapCargoStatusToPortalStatus('IN_TRANSIT'), 'ENVIADO');
  assert.equal(mapCargoStatusToPortalStatus('TEMP_ASSIGNED'), 'ENVIADO');
  assert.equal(mapCargoStatusToPortalStatus('ASSIGNED'), 'ENVIADO');
  assert.equal(mapCargoStatusToPortalStatus('DELIVERED'), 'ENTREGADO');
  assert.equal(mapCargoStatusToPortalStatus('ENTREGADO'), 'ENTREGADO');
});

test('normalizeCargoPhotoUrls autoriza tibgrupo.com y tibcourier.com y bloquea SSRF', () => {
  const webp = 'https://www.tibgrupo.com/cargo_system/data/img/warehouse/d5a61644-1ed5-4b1d-a679-900470eb39d5.webp';
  const legacy = 'https://www.tibcourier.com/global-courier/ajax/fotos/123.jpg';

  assert.equal(normalizeCargoPhotoUrls(webp), webp);
  assert.equal(normalizeCargoPhotoUrls(`${webp}, ${legacy}`), `${webp},${legacy}`);
  assert.equal(normalizeCargoPhotoUrls('http://www.tibgrupo.com/insecure.webp'), null);
  assert.equal(normalizeCargoPhotoUrls('https://evil.example.com/ssrf.webp'), null);
  assert.equal(normalizeCargoPhotoUrls('null'), null);
  assert.equal(normalizeCargoPhotoUrls('https://www.tibgrupo.com/sin_imagen.jpg'), null);
});

test('mapCargoWarehouseToPortalItem mapea un payload real de Cargo System v2', () => {
  const mapped = mapCargoWarehouseToPortalItem({
    id: 506539,
    tracking: 'E08LOURDES',
    secondTracking: 'null',
    nameClient: 'AMEX JENNIFER TIZNADO',
    emailClient: 'null',
    container: 'CAJA',
    rack: 'S',
    weight: '7.08',
    status: 'RECEIVED',
    photoUrl: 'https://www.tibgrupo.com/cargo_system/data/img/warehouse/abc.webp',
    pdfUrl: null,
    dateRegister: '2026-11-20T17:17:50.707Z',
    dateModify: '2026-11-20T17:18:00.000Z',
  });

  assert.ok(mapped);
  assert.equal(mapped.numericId, 506539);
  assert.equal(mapped.canonicalWr, 'WR000506539');
  assert.equal(mapped.tracking, 'E08LOURDES');
  assert.equal(mapped.nombreConsignatario, 'AMEX JENNIFER TIZNADO');
  assert.equal(mapped.tipoEmpaque, 'CAJA');
  assert.equal(mapped.pesoKg, 7.08);
  assert.equal(mapped.estadoTib, 'RECIBIDO');
  assert.equal(mapped.tibImagenUrl, 'https://www.tibgrupo.com/cargo_system/data/img/warehouse/abc.webp');
  assert.equal(mapped.tibTicketPdfUrl, 'tibv2://receipt/506539');
  assert.equal(mapped.ubicacionAlmacen, 'S');
  assert.equal(mapped.creadoEn, '2026-11-20T17:17:50.707Z');
  assert.equal(mapped.clientEmail, null);
});

test('ticket-link firma y verifica tokens aislados de los tokens de fotos', () => {
  const secret = 'test-hmac-secret-for-unit-tests';
  const wr = 'WR000506539';
  const ticketToken = signTicketToken(wr, secret);
  const photoToken = signPhotoToken(wr, 0, secret);

  assert.notEqual(ticketToken, photoToken);
  assert.equal(verifyTicketToken(wr, ticketToken, secret), true);
  assert.equal(verifyTicketToken(wr, photoToken, secret), false);
  assert.equal(verifyTicketToken('WR000506540', ticketToken, secret), false);
  assert.equal(buildSignedTicketPath(wr, secret), `/api/ticket/WR000506539?t=${ticketToken}`);

  assert.equal(parseTibV2TicketId('tibv2://receipt/506539'), 506539);
  assert.equal(parseTibV2TicketId('tibv2://pdf/506539'), 506539);
  assert.equal(parseTibV2TicketId('https://www.tibcourier.com/global-courier/ajax/t.pdf'), null);

  assert.equal(isAuthorizedLegacyTicketUrl('https://www.tibcourier.com/global-courier/ajax/ticket.pdf'), true);
  assert.equal(isAuthorizedLegacyTicketUrl('https://evil.example.com/ticket.pdf'), false);

  assert.equal(hasAvailableTicketPdf('tibv2://receipt/506539'), true);
  assert.equal(hasAvailableTicketPdf('https://www.tibcourier.com/global-courier/ajax/ticket.pdf'), true);
  assert.equal(hasAvailableTicketPdf('null'), false);
  assert.equal(hasAvailableTicketPdf(null), false);
});
