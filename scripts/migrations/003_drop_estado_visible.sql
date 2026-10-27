-- =============================================================================
-- AMEX COURIER - MIGRACIÓN 003: ELIMINACIÓN DE estado_visible Y OPTIMIZACIÓN
-- Unificación total de estados en estado_tib ('RECIBIDO', 'ENVIADO', 'ENTREGADO')
-- =============================================================================

-- 1. Crear índice B-Tree dedicado para acelerar filtros de estado en los 60,000+ paquetes
CREATE INDEX IF NOT EXISTS idx_paquetes_estado_tib
ON public.paquetes_portal(estado_tib);

-- 2. Eliminar la columna redundante estado_visible de la tabla de paquetes
ALTER TABLE public.paquetes_portal
DROP COLUMN IF EXISTS estado_visible;
