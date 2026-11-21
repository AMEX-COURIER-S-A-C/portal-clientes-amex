/**
 * Calcula la ventana de números de página visibles alrededor de `currentPage`.
 * Módulo puro reutilizable para pruebas unitarias con `node --test`.
 */
export function computePaginationPages(
  currentPage: number,
  totalPages: number,
  maxVisible = 5
): number[] {
  const safeTotal = Math.max(1, Math.floor(totalPages) || 1);
  const safeCurrent = Math.min(Math.max(1, Math.floor(currentPage) || 1), safeTotal);
  const safeWindow = Math.max(1, Math.floor(maxVisible) || 5);
  const half = Math.floor(safeWindow / 2);

  let start = Math.max(1, safeCurrent - half);
  const end = Math.min(safeTotal, start + safeWindow - 1);

  if (end - start + 1 < safeWindow) {
    start = Math.max(1, end - safeWindow + 1);
  }

  const pages: number[] = [];
  for (let p = start; p <= end; p++) {
    pages.push(p);
  }
  return pages;
}
