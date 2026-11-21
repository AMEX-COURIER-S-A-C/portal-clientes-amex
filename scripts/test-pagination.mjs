import test from 'node:test';
import assert from 'node:assert/strict';

import { computePaginationPages } from '../lib/portal/pagination.ts';

test('computePaginationPages retorna ventana centrada y maneja bordes y página única', () => {
  assert.deepEqual(computePaginationPages(1, 1), [1]);
  assert.deepEqual(computePaginationPages(1, 2), [1, 2]);
  assert.deepEqual(computePaginationPages(1, 10), [1, 2, 3, 4, 5]);
  assert.deepEqual(computePaginationPages(2, 10), [1, 2, 3, 4, 5]);
  assert.deepEqual(computePaginationPages(5, 10), [3, 4, 5, 6, 7]);
  assert.deepEqual(computePaginationPages(10, 10), [6, 7, 8, 9, 10]);
  assert.deepEqual(computePaginationPages(9, 10), [6, 7, 8, 9, 10]);
  assert.deepEqual(computePaginationPages(0, 0), [1]);
});
