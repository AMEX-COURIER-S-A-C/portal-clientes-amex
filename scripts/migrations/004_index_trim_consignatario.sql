-- =============================================================================
-- AMEX COURIER - MIGRACIÓN 004: ÍNDICE FUNCIONAL PARA TRIM(NOMBRE_CONSIGNATARIO)
-- Previene timeouts en recalcular_consignatario_catalogo al sincronizar en lote
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_paquetes_portal_trim_consignatario 
ON public.paquetes_portal (trim(nombre_consignatario));
