import { NextResponse } from 'next/server';
import { requireSuperadminSession } from '@/lib/supabase/auth-guard';
import { isSuperadminEmail } from '@/lib/portal/superadmin';
import {
  getMatchedRulesForConsignee,
  matchesConsigneeRule,
  normalizeMatchingRules,
} from '@/lib/portal/matching';
import { cleanExactString } from '@/lib/portal/keywords';
import type {
  MatchingConflictItem,
  MatchingPreviewMatchItem,
  MatchingPreviewResponse,
} from '@/lib/portal/types';

export const dynamic = 'force-dynamic';

/**
 * Simulador en vivo de impacto de reglas de matching contra amex_portal_clientes y clientes_portal.
 * Permite al Superadmin/Gerencia verificar exactamente cuántos consignatarios y paquetes
 * capturará una configuración (y detectar cuentas compartidas) antes de guardar.
 */
export async function POST(req: Request) {
  try {
    const auth = await requireSuperadminSession(req);
    if (!auth.ok) return auth.response;
    const { portalAdmin } = auth;

    const body = await req.json().catch(() => ({}));
    const excludeClientId = body?.excludeClientId ? String(body.excludeClientId).trim() : null;
    const fallbackNombre = body?.fallbackNombre ? String(body.fallbackNombre) : null;
    const applyFallbackWhenEmpty = Boolean(body?.applyFallbackWhenEmpty);

    const { exactConsignees, groupKeywords } = normalizeMatchingRules({
      exactConsignees: body?.exactConsignees,
      groupKeywords: body?.groupKeywords,
      fallbackNombre,
      applyFallbackWhenEmpty,
      isSuperadmin: false,
    });

    if (exactConsignees.length === 0 && groupKeywords.length === 0) {
      const emptyResponse: MatchingPreviewResponse = {
        total_consignatarios: 0,
        total_paquetes: 0,
        muestra_consignatarios: [],
        conflictos: [],
        advertencias: [],
      };
      return NextResponse.json(emptyResponse);
    }

    const fetchAllCatalog = async () => {
      const all: any[] = [];
      let from = 0;
      const step = 1000;
      while (true) {
        const { data, error } = await portalAdmin
          .from('amex_portal_clientes')
          .select('nombre, total_paquetes, recibidos, enviados')
          .order('total_paquetes', { ascending: false })
          .range(from, from + step - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < step) break;
        from += step;
      }
      return all;
    };

    const fetchActiveClients = async () => {
      const all: any[] = [];
      let from = 0;
      const step = 1000;
      while (true) {
        const { data, error } = await portalAdmin
          .from('clientes_portal')
          .select('id, nombre_completo, email, alias_palabras_clave, palabras_clave_grupo')
          .eq('activo', true)
          .range(from, from + step - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < step) break;
        from += step;
      }
      return all;
    };

    const [catalogRows, activeClientsRaw] = await Promise.all([
      fetchAllCatalog(),
      fetchActiveClients(),
    ]);

    const otherActiveClients = activeClientsRaw
      .filter((c) => !isSuperadminEmail(c.email) && (!excludeClientId || c.id !== excludeClientId))
      .map((c) => ({
        id: String(c.id),
        nombre_completo: String(c.nombre_completo || ''),
        email: String(c.email || '').toLowerCase(),
        rules: normalizeMatchingRules({
          exactConsignees: c.alias_palabras_clave,
          groupKeywords: c.palabras_clave_grupo,
        }),
      }));

    const matchedItems: MatchingPreviewMatchItem[] = [];
    const conflicts: MatchingConflictItem[] = [];
    const groupHitCounts = new Map<string, number>();
    let totalPackages = 0;

    for (const row of catalogRows) {
      const name = String(row.nombre || '').trim();
      if (!name) continue;
      const detail = getMatchedRulesForConsignee(name, exactConsignees, groupKeywords);
      if (!detail.matched) continue;

      const pkgs = Number(row.total_paquetes || 0);
      totalPackages += pkgs;

      for (const grp of detail.matchedGroup) {
        groupHitCounts.set(grp, (groupHitCounts.get(grp) || 0) + 1);
      }

      const sharedWith: Array<{ id: string; nombre_completo: string; email: string }> = [];
      for (const other of otherActiveClients) {
        if (matchesConsigneeRule(name, other.rules.exactConsignees, other.rules.groupKeywords)) {
          sharedWith.push({
            id: other.id,
            nombre_completo: other.nombre_completo,
            email: other.email,
          });
        }
      }

      if (sharedWith.length > 0) {
        conflicts.push({
          consignatario: cleanExactString(name),
          clientes: sharedWith,
        });
      }

      matchedItems.push({
        nombre: name,
        total_paquetes: pkgs,
        recibidos: Number(row.recibidos || 0),
        enviados: Number(row.enviados || 0),
        matched_by: [
          ...detail.matchedExact.map((regla) => ({ tipo: 'exacto' as const, regla })),
          ...detail.matchedGroup.map((regla) => ({ tipo: 'grupo' as const, regla })),
        ],
        compartido_con: sharedWith,
      });
    }

    const warnings: string[] = [];
    for (const [grp, count] of groupHitCounts.entries()) {
      if (count >= 10) {
        warnings.push(
          `La sigla "${grp}" coincide con ${count} consignatarios distintos. Verifica que todos pertenezcan a esta agencia/courier.`
        );
      }
    }
    if (conflicts.length > 0) {
      warnings.push(
        `${conflicts.length} consignatario(s) ya pertenecen a otra cuenta activa (modo cuenta compartida).`
      );
    }

    const response: MatchingPreviewResponse = {
      total_consignatarios: matchedItems.length,
      total_paquetes: totalPackages,
      muestra_consignatarios: matchedItems.slice(0, 30),
      conflictos: conflicts.slice(0, 20),
      advertencias: warnings,
    };

    return NextResponse.json(response);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al simular reglas de matching';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
