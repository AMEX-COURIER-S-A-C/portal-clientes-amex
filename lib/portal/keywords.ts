/**
 * Utilidades compartidas de normalización de nombres y palabras clave de matching TIB.
 */

export function cleanExactString(str: unknown): string {
  return String(str || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

export function sanitizePostgrestFilterTerm(term: string): string {
  return String(term || '').replace(/["'(),*%]/g, '').trim();
}

/**
 * Normaliza una entrada de palabras clave (array o string separado por comas),
 * aplicando respaldo con el nombre completo cuando no es Superadmin.
 */
export function normalizeClientKeywordsInput(
  rawKeywords: unknown,
  fallbackNombre?: string | null,
  isSuperadmin = false
): string[] {
  const keywords: string[] = [];

  if (Array.isArray(rawKeywords)) {
    for (const k of rawKeywords) {
      const cleaned = cleanExactString(k);
      if (cleaned && !keywords.includes(cleaned)) {
        keywords.push(cleaned);
      }
    }
  } else if (typeof rawKeywords === 'string') {
    for (const part of rawKeywords.split(',')) {
      const cleaned = cleanExactString(part);
      if (cleaned && !keywords.includes(cleaned)) {
        keywords.push(cleaned);
      }
    }
  }

  const cleanNombre = cleanExactString(fallbackNombre);
  if (keywords.length === 0 && cleanNombre && !isSuperadmin) {
    keywords.push(cleanNombre);
  }

  return keywords;
}

/**
 * Construye la lista de términos válidos de búsqueda para vincular paquetes (excluyendo genéricos como 'AMEX'),
 * incluyendo variantes compactadas sin espacios cuando tienen >= 5 caracteres.
 */
export function buildValidMatchingTerms(
  nombreCompleto?: string | null,
  aliasKeywords?: unknown,
  includeCompactVariants = false
): string[] {
  const terms: string[] = [];
  const rawList = Array.isArray(aliasKeywords) ? aliasKeywords : [];
  const candidates = [nombreCompleto, ...rawList];

  for (const item of candidates) {
    const clean = cleanExactString(item);
    if (clean && clean.length >= 2 && clean !== 'AMEX' && !terms.includes(clean)) {
      terms.push(clean);
      if (includeCompactVariants) {
        const compact = clean.replace(/\s+/g, '');
        if (compact.length >= 5 && compact !== clean && !terms.includes(compact)) {
          terms.push(compact);
        }
      }
    }
  }

  return terms;
}
