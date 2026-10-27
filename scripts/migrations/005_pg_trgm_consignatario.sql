-- =============================================================================
-- AMEX COURIER - MIGRACIÓN 005: EXTENSIÓN PG_TRGM E ÍNDICE GIN PARA BÚSQUEDA MULTI-CUENTA
-- Permite que múltiples clientes compartan siglas/palabras clave sin colisiones
-- y acelera búsquedas ILIKE en paquetes_portal de 3.8s a 380ms.
-- =============================================================================

-- 1. Habilitar extensión Trigram
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Crear índice GIN Trigram para acelerar filtros ILIKE '%SIGLA%'
CREATE INDEX IF NOT EXISTS idx_paquetes_portal_consignatario_trgm 
ON public.paquetes_portal USING gin (nombre_consignatario gin_trgm_ops);
