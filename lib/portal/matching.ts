function cleanExactString(str: unknown): string {
  return String(str || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

export const BLOCKED_GROUP_KEYWORDS = new Set([
  'AMEX',
  'COURIER',
  'PERU',
  'MIAMI',
  'LIMA',
  'SAC',
  'S.A.C',
  'EIRL',
  'SRL',
]);

export interface NormalizedMatchingRules {
  exactConsignees: string[];
  groupKeywords: string[];
}

export interface ConsigneeMatchDetail {
  matched: boolean;
  matchedExact: string[];
  matchedGroup: string[];
}

function parseRawTerms(raw: unknown): string[] {
  const out: string[] = [];
  const pushClean = (val: unknown) => {
    const clean = cleanExactString(val);
    if (clean && !out.includes(clean)) {
      out.push(clean);
    }
  };

  if (Array.isArray(raw)) {
    for (const item of raw) pushClean(item);
  } else if (typeof raw === 'string') {
    for (const part of raw.split(',')) pushClean(part);
  }
  return out;
}

/**
 * Normaliza reglas separadas de matching:
 * - exactConsignees: consignatarios exactos del catálogo TIB (mín. 2 caracteres, excluye 'AMEX').
 * - groupKeywords: siglas o prefijos de agencia por palabra completa (mín. 3 caracteres, excluye genéricos).
 *
 * IMPORTANTE: nunca inyecta `fallbackNombre` si ya existen reglas explícitas.
 * Solo copia `fallbackNombre` a `exactConsignees` cuando `applyFallbackWhenEmpty` es true (alta inicial sin reglas).
 */
export function normalizeMatchingRules(options: {
  exactConsignees?: unknown;
  groupKeywords?: unknown;
  fallbackNombre?: string | null;
  isSuperadmin?: boolean;
  applyFallbackWhenEmpty?: boolean;
}): NormalizedMatchingRules {
  const {
    exactConsignees: rawExact,
    groupKeywords: rawGroup,
    fallbackNombre,
    isSuperadmin = false,
    applyFallbackWhenEmpty = false,
  } = options;

  const exactConsignees = parseRawTerms(rawExact).filter(
    (term) => term.length >= 2 && term !== 'AMEX'
  );

  const groupKeywords = parseRawTerms(rawGroup).filter(
    (term) => term.length >= 3 && !BLOCKED_GROUP_KEYWORDS.has(term)
  );

  if (
    applyFallbackWhenEmpty &&
    !isSuperadmin &&
    exactConsignees.length === 0 &&
    groupKeywords.length === 0
  ) {
    const cleanNombre = cleanExactString(fallbackNombre);
    if (cleanNombre && cleanNombre.length >= 2 && cleanNombre !== 'AMEX') {
      exactConsignees.push(cleanNombre);
    }
  }

  return { exactConsignees, groupKeywords };
}

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Coincidencia exacta normalizada (ignora mayúsculas y espacios repetidos).
 */
export function matchesExactConsignee(consigneeName: unknown, exactRule: unknown): boolean {
  const cleanConsignee = cleanExactString(consigneeName);
  const cleanRule = cleanExactString(exactRule);
  if (!cleanConsignee || !cleanRule || cleanRule.length < 2 || cleanRule === 'AMEX') {
    return false;
  }
  return cleanConsignee === cleanRule;
}

/**
 * Coincidencia por palabra completa (incluye letras españolas Ñ y vocales acentuadas).
 * Ej.: 'AURA' coincide con 'AMEX AURA JESSENIA', pero jamás con 'AMEX LAURA PEREZ'.
 * Ej.: 'RUTA' coincide con 'AMEX RUTA ERIKA', pero jamás con 'FRUTA'.
 */
export function matchesGroupKeyword(consigneeName: unknown, groupRule: unknown): boolean {
  const cleanConsignee = cleanExactString(consigneeName);
  const cleanRule = cleanExactString(groupRule);
  if (!cleanConsignee || !cleanRule || cleanRule.length < 3 || BLOCKED_GROUP_KEYWORDS.has(cleanRule)) {
    return false;
  }

  const tokens = cleanRule.split(' ').filter(Boolean).map(escapeRegex);
  if (tokens.length === 0) return false;
  const body = tokens.join('\\s+');
  const pattern = new RegExp(`(?:^|[^A-Z0-9ÁÉÍÓÚÜÑ])${body}(?:$|[^A-Z0-9ÁÉÍÓÚÜÑ])`, 'i');
  return pattern.test(cleanConsignee);
}

/**
 * Evalúa si un consignatario coincide con cualquiera de las reglas exactas o de grupo.
 */
export function getMatchedRulesForConsignee(
  consigneeName: unknown,
  exactConsignees: string[] = [],
  groupKeywords: string[] = []
): ConsigneeMatchDetail {
  const matchedExact: string[] = [];
  const matchedGroup: string[] = [];

  for (const exact of exactConsignees) {
    if (matchesExactConsignee(consigneeName, exact)) {
      matchedExact.push(cleanExactString(exact));
    }
  }

  for (const group of groupKeywords) {
    if (matchesGroupKeyword(consigneeName, group)) {
      matchedGroup.push(cleanExactString(group));
    }
  }

  return {
    matched: matchedExact.length > 0 || matchedGroup.length > 0,
    matchedExact,
    matchedGroup,
  };
}

export function matchesConsigneeRule(
  consigneeName: unknown,
  exactConsignees: string[] = [],
  groupKeywords: string[] = []
): boolean {
  return getMatchedRulesForConsignee(consigneeName, exactConsignees, groupKeywords).matched;
}

/**
 * Construye un patrón PostgreSQL POSIX (~*) para coincidencia exacta tolerante a espacios múltiples.
 */
export function buildExactPostgresPattern(rawRule: string): string | null {
  const clean = cleanExactString(rawRule);
  if (!clean || clean.length < 2 || clean === 'AMEX') return null;
  const tokens = clean.split(' ').filter(Boolean).map(escapeRegex);
  if (tokens.length === 0) return null;
  return `^\\s*${tokens.join('\\s+')}\\s*$`;
}

/**
 * Construye un patrón PostgreSQL POSIX (~*) de palabra completa (\y...\y) para siglas de agencia.
 */
export function buildGroupPostgresPattern(rawRule: string): string | null {
  const clean = cleanExactString(rawRule);
  if (!clean || clean.length < 3 || BLOCKED_GROUP_KEYWORDS.has(clean)) return null;
  const tokens = clean.split(' ').filter(Boolean).map(escapeRegex);
  if (tokens.length === 0) return null;
  return `\\y${tokens.join('\\s+')}\\y`;
}

function escapePostgrestDoubleQuoted(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * Construye el filtro `.or(...)` de PostgREST usando `imatch` (~*) sobre la columna indicada
 * (acelerado por el índice GIN trigram existente en paquetes_portal).
 */
export function buildPostgrestMatchingOrFilter(
  column: string,
  exactConsignees: string[] = [],
  groupKeywords: string[] = []
): string | null {
  const conditions: string[] = [];

  for (const exact of exactConsignees) {
    const pattern = buildExactPostgresPattern(exact);
    if (pattern) {
      conditions.push(`${column}.imatch.${escapePostgrestDoubleQuoted(pattern)}`);
    }
  }

  for (const group of groupKeywords) {
    const pattern = buildGroupPostgresPattern(group);
    if (pattern) {
      conditions.push(`${column}.imatch.${escapePostgrestDoubleQuoted(pattern)}`);
    }
  }

  return conditions.length > 0 ? conditions.join(',') : null;
}
