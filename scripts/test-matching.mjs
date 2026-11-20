import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildExactPostgresPattern,
  buildGroupPostgresPattern,
  buildPostgrestMatchingOrFilter,
  matchesConsigneeRule,
  matchesExactConsignee,
  matchesGroupKeyword,
  normalizeMatchingRules,
} from '../lib/portal/matching.ts';

test('Caso JAVIER: nombre_completo no se inyecta y exactos bloquean terceros', () => {
  const rules = normalizeMatchingRules({
    exactConsignees: ['AMEX JAVIER AMEX', 'AMEX JAVIER VALERO'],
    groupKeywords: [],
    fallbackNombre: 'JAVIER',
    applyFallbackWhenEmpty: true,
  });

  assert.deepEqual(rules.exactConsignees, ['AMEX JAVIER AMEX', 'AMEX JAVIER VALERO']);
  assert.deepEqual(rules.groupKeywords, []);

  assert.equal(matchesConsigneeRule('AMEX JAVIER AMEX', rules.exactConsignees, rules.groupKeywords), true);
  assert.equal(matchesConsigneeRule('  amex  javier   valero ', rules.exactConsignees, rules.groupKeywords), true);
  assert.equal(matchesConsigneeRule('AMEX JAVIER HURTADO', rules.exactConsignees, rules.groupKeywords), false);
  assert.equal(
    matchesConsigneeRule('AMEX HECTOR JAVIER ENDO GUTIERREZ RUTA', rules.exactConsignees, rules.groupKeywords),
    false
  );
});

test('Caso AURA y AMEX BRIGITTE: exactos no capturan CORDOVA ni LAURA/MAURA/ROSAURA', () => {
  const exactos = ['AMEX BRIGITTE', 'AMEX BRIGITTE PESANTES', 'AMEX BRIGITE AMEX'];

  assert.equal(matchesConsigneeRule('AMEX BRIGITTE', exactos, []), true);
  assert.equal(matchesConsigneeRule('AMEX BRIGITTE PESANTES', exactos, []), true);
  assert.equal(matchesConsigneeRule('AMEX BRIGITTE CORDOVA', exactos, []), false);
  assert.equal(matchesConsigneeRule('AMEX LAURA PEREZ', exactos, []), false);
  assert.equal(matchesConsigneeRule('AMEX MAURA MORALES', exactos, []), false);
  assert.equal(matchesConsigneeRule('AMEX MARIA ROSAURA CORDOVA GONGORA', exactos, []), false);
});

test('Palabra completa en siglas de agencia: AURA no captura LAURA y RUTA no captura FRUTA', () => {
  assert.equal(matchesGroupKeyword('AMEX AURA JESSENIA ZEVALLOS', 'AURA'), true);
  assert.equal(matchesGroupKeyword('AMEX GLX DAYRON CORREA AURA', 'AURA'), true);
  assert.equal(matchesGroupKeyword('AMEX LAURA PEREZ', 'AURA'), false);
  assert.equal(matchesGroupKeyword('AMEX MAURA MORALES', 'AURA'), false);
  assert.equal(matchesGroupKeyword('AMEX MARIA ROSAURA CORDOVA GONGORA', 'AURA'), false);

  assert.equal(matchesGroupKeyword('AMEX RUTA ERIKA', 'RUTA'), true);
  assert.equal(matchesGroupKeyword('AMEX HECTOR JAVIER ENDO GUTIERREZ RUTA', 'RUTA'), true);
  assert.equal(matchesGroupKeyword('AMEX FRUTA FRESCA', 'RUTA'), false);

  assert.equal(matchesGroupKeyword('AMEX  MDS ROSITA ALCANTARA', 'MDS'), true);
  assert.equal(matchesGroupKeyword('AMEX AMC DEIVY BARTUREN YOPLAC', 'AMC'), true);
  assert.equal(matchesGroupKeyword('AMEX CAMACHO', 'AMC'), false);
});

test('Caracteres especiales (barras y ñ) en exactos y generador PostgREST imatch', () => {
  assert.equal(matchesExactConsignee('AMEX / OSCAR FIGUEROA', 'AMEX / OSCAR FIGUEROA'), true);
  assert.equal(matchesExactConsignee('AMEX / OSCAR FIGUEROA OLIVA', 'AMEX / OSCAR FIGUEROA'), false);
  assert.equal(matchesExactConsignee('AMEX MARIA MUÑOZ', 'amex  maria muñoz'), true);

  assert.equal(buildExactPostgresPattern('AMEX / OSCAR FIGUEROA'), '^\\s*AMEX\\s+/\\s+OSCAR\\s+FIGUEROA\\s*$');
  assert.equal(buildGroupPostgresPattern('RUTA'), '\\yRUTA\\y');
  assert.equal(buildGroupPostgresPattern('AMEX'), null);
  assert.equal(buildGroupPostgresPattern('AB'), null);

  const orFilter = buildPostgrestMatchingOrFilter('nombre_consignatario', ['AMEX BRIGITTE'], ['RUTA']);
  assert.equal(
    orFilter,
    'nombre_consignatario.imatch."^\\\\s*AMEX\\\\s+BRIGITTE\\\\s*$",nombre_consignatario.imatch."\\\\yRUTA\\\\y"'
  );
});

test('Fallback de nombre_completo solo aplica en alta inicial vacía', () => {
  const createdEmpty = normalizeMatchingRules({
    exactConsignees: [],
    groupKeywords: [],
    fallbackNombre: 'NUEVO CLIENTE SAC',
    applyFallbackWhenEmpty: true,
  });
  assert.deepEqual(createdEmpty.exactConsignees, ['NUEVO CLIENTE SAC']);

  const updatedEmpty = normalizeMatchingRules({
    exactConsignees: [],
    groupKeywords: [],
    fallbackNombre: 'JAVIER',
    applyFallbackWhenEmpty: false,
  });
  assert.deepEqual(updatedEmpty.exactConsignees, []);
});
