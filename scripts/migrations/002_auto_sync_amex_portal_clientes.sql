-- =============================================================================
-- AMEX COURIER - MIGRACIÓN 002: RESTRICCIÓN UNIQUE Y AUTO-SINCRONIZACIÓN
-- DE CATÁLOGO DE CONSIGNATARIOS (public.amex_portal_clientes)
-- =============================================================================

-- 1. Normalizar nombres existentes en amex_portal_clientes
UPDATE public.amex_portal_clientes
SET nombre = trim(nombre)
WHERE nombre <> trim(nombre);

-- 2. Agregar restricción UNIQUE en nombre para permitir ON CONFLICT (nombre)
ALTER TABLE public.amex_portal_clientes
ADD CONSTRAINT amex_portal_clientes_nombre_key UNIQUE (nombre);

-- 3. Función y Trigger automático en PostgreSQL para mantener amex_portal_clientes
--    siempre sincronizado en tiempo real cuando llega un nuevo paquete o cambia
--    el nombre_consignatario / estado_tib en paquetes_portal.
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
      actualizado_en = now();
  ELSE
    UPDATE public.amex_portal_clientes
    SET total_paquetes = 0,
        recibidos = 0,
        enviados = 0,
        entregados = 0,
        actualizado_en = now()
    WHERE nombre = v_clean;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_fn_sync_paquete_to_catalogo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.recalcular_consignatario_catalogo(NEW.nombre_consignatario);
  ELSIF TG_OP = 'UPDATE' THEN
    IF trim(coalesce(NEW.nombre_consignatario, '')) IS DISTINCT FROM trim(coalesce(OLD.nombre_consignatario, '')) THEN
      PERFORM public.recalcular_consignatario_catalogo(OLD.nombre_consignatario);
      PERFORM public.recalcular_consignatario_catalogo(NEW.nombre_consignatario);
    ELSIF coalesce(NEW.estado_tib, '') IS DISTINCT FROM coalesce(OLD.estado_tib, '') THEN
      PERFORM public.recalcular_consignatario_catalogo(NEW.nombre_consignatario);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_sync_consignatario_catalogo
AFTER INSERT OR UPDATE OF nombre_consignatario, estado_tib
ON public.paquetes_portal
FOR EACH ROW
EXECUTE FUNCTION public.trg_fn_sync_paquete_to_catalogo();
