-- =============================================================================
-- AMEX COURIER - MIGRACIÓN 006: ÍNDICES DE TELEMETRÍA Y OPTIMIZACIÓN DE TRIGGERS
-- DE CATÁLOGO (public.portal_eventos_uso y public.amex_portal_clientes)
-- =============================================================================

-- 1. Índices compuestos y de ordenamiento para acelerar /api/analiticas-uso
CREATE INDEX IF NOT EXISTS idx_portal_eventos_uso_creado_en
ON public.portal_eventos_uso (creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_portal_eventos_uso_email_creado_en
ON public.portal_eventos_uso (usuario_email, creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_portal_eventos_uso_tipo_creado_en
ON public.portal_eventos_uso (tipo_evento, creado_en DESC);

-- 2. Optimizar public.recalcular_consignatario_catalogo(target_nombre text)
--    Conserva su firma exacta para compatibilidad con worker/tib-mirror-daemon.mjs
--    y evita escrituras redundantes cuando los conteos no cambiaron.
CREATE OR REPLACE FUNCTION public.recalcular_consignatario_catalogo(target_nombre text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_clean text := trim(coalesce(target_nombre, ''));
  v_total int;
  v_rec int;
  v_env int;
  v_ent int;
  v_wr text;
  v_trk text;
  v_fecha text;
BEGIN
  IF v_clean = '' THEN
    RETURN;
  END IF;

  SELECT
    count(*)::int,
    count(*) FILTER (WHERE upper(coalesce(estado_tib, '')) = 'RECIBIDO')::int,
    count(*) FILTER (WHERE upper(coalesce(estado_tib, '')) = 'ENVIADO')::int,
    count(*) FILTER (WHERE upper(coalesce(estado_tib, '')) = 'ENTREGADO')::int,
    (array_agg(numero_recibo_bodega ORDER BY creado_en DESC NULLS LAST))[1],
    (array_agg(tracking ORDER BY creado_en DESC NULLS LAST))[1],
    max(creado_en)::text
  INTO v_total, v_rec, v_env, v_ent, v_wr, v_trk, v_fecha
  FROM public.paquetes_portal
  WHERE trim(nombre_consignatario) = v_clean;

  IF coalesce(v_total, 0) > 0 THEN
    INSERT INTO public.amex_portal_clientes (
      nombre,
      total_paquetes,
      recibidos,
      enviados,
      entregados,
      ultimo_wr,
      ultimo_tracking,
      ultima_fecha,
      actualizado_en
    ) VALUES (
      v_clean,
      v_total,
      v_rec,
      v_env,
      v_ent,
      v_wr,
      v_trk,
      v_fecha,
      now()
    )
    ON CONFLICT (nombre) DO UPDATE SET
      total_paquetes = EXCLUDED.total_paquetes,
      recibidos = EXCLUDED.recibidos,
      enviados = EXCLUDED.enviados,
      entregados = EXCLUDED.entregados,
      ultimo_wr = EXCLUDED.ultimo_wr,
      ultimo_tracking = COALESCE(EXCLUDED.ultimo_tracking, public.amex_portal_clientes.ultimo_tracking),
      ultima_fecha = COALESCE(EXCLUDED.ultima_fecha, public.amex_portal_clientes.ultima_fecha),
      actualizado_en = now()
    WHERE
      public.amex_portal_clientes.total_paquetes IS DISTINCT FROM EXCLUDED.total_paquetes
      OR public.amex_portal_clientes.recibidos IS DISTINCT FROM EXCLUDED.recibidos
      OR public.amex_portal_clientes.enviados IS DISTINCT FROM EXCLUDED.enviados
      OR public.amex_portal_clientes.entregados IS DISTINCT FROM EXCLUDED.entregados
      OR public.amex_portal_clientes.ultimo_wr IS DISTINCT FROM EXCLUDED.ultimo_wr;
  ELSE
    UPDATE public.amex_portal_clientes
    SET total_paquetes = 0,
        recibidos = 0,
        enviados = 0,
        entregados = 0,
        actualizado_en = now()
    WHERE nombre = v_clean
      AND (total_paquetes <> 0 OR recibidos <> 0 OR enviados <> 0 OR entregados <> 0);
  END IF;
END;
$$;

-- 3. Reemplazar el trigger FOR EACH ROW por triggers FOR EACH STATEMENT con tablas
--    de transición para que los lotes de upsert recalculen cada consignatario 1 sola vez por sentencia.
DROP TRIGGER IF EXISTS trg_sync_consignatario_catalogo ON public.paquetes_portal;
DROP TRIGGER IF EXISTS trg_sync_consignatario_catalogo_ins ON public.paquetes_portal;
DROP TRIGGER IF EXISTS trg_sync_consignatario_catalogo_upd ON public.paquetes_portal;
DROP TRIGGER IF EXISTS trg_sync_consignatario_catalogo_del ON public.paquetes_portal;

CREATE OR REPLACE FUNCTION public.trg_fn_sync_paquete_to_catalogo_ins()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT trim(coalesce(nombre_consignatario, '')) AS nombre
    FROM new_rows
    WHERE trim(coalesce(nombre_consignatario, '')) <> ''
  LOOP
    PERFORM public.recalcular_consignatario_catalogo(r.nombre);
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_fn_sync_paquete_to_catalogo_upd()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT nombre FROM (
      SELECT trim(coalesce(n.nombre_consignatario, '')) AS nombre
      FROM new_rows n
      JOIN old_rows o ON o.id = n.id
      WHERE trim(coalesce(n.nombre_consignatario, '')) IS DISTINCT FROM trim(coalesce(o.nombre_consignatario, ''))
         OR coalesce(n.estado_tib, '') IS DISTINCT FROM coalesce(o.estado_tib, '')
      UNION
      SELECT trim(coalesce(o.nombre_consignatario, '')) AS nombre
      FROM new_rows n
      JOIN old_rows o ON o.id = n.id
      WHERE trim(coalesce(n.nombre_consignatario, '')) IS DISTINCT FROM trim(coalesce(o.nombre_consignatario, ''))
    ) affected
    WHERE nombre <> ''
  LOOP
    PERFORM public.recalcular_consignatario_catalogo(r.nombre);
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_fn_sync_paquete_to_catalogo_del()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT trim(coalesce(nombre_consignatario, '')) AS nombre
    FROM old_rows
    WHERE trim(coalesce(nombre_consignatario, '')) <> ''
  LOOP
    PERFORM public.recalcular_consignatario_catalogo(r.nombre);
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_sync_consignatario_catalogo_ins
AFTER INSERT ON public.paquetes_portal
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT
EXECUTE FUNCTION public.trg_fn_sync_paquete_to_catalogo_ins();

CREATE TRIGGER trg_sync_consignatario_catalogo_upd
AFTER UPDATE ON public.paquetes_portal
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
FOR EACH STATEMENT
EXECUTE FUNCTION public.trg_fn_sync_paquete_to_catalogo_upd();

CREATE TRIGGER trg_sync_consignatario_catalogo_del
AFTER DELETE ON public.paquetes_portal
REFERENCING OLD TABLE AS old_rows
FOR EACH STATEMENT
EXECUTE FUNCTION public.trg_fn_sync_paquete_to_catalogo_del();
