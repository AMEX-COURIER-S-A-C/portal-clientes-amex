/**
 * Motor de Telemetría Invisible AMEX Courier
 * Envía eventos de uso y actividad en segundo plano sin bloquear la experiencia del usuario.
 */

export type PortalEventType =
  | 'LOGIN_EXITOSO'
  | 'BUSQUEDA_INVENTARIO'
  | 'FILTRO_ESTADO'
  | 'VER_FOTO_ALMACEN'
  | 'EXPORTAR_EXCEL'
  | 'CONSULTA_DETALLE';

export interface TrackEventOptions {
  tipo_evento: PortalEventType;
  usuario_email?: string | null;
  nombre_cliente?: string | null;
  detalles?: Record<string, any>;
}

export function trackPortalEvent(options: TrackEventOptions): void {
  if (typeof window === 'undefined') return;
  if (!options.usuario_email) return;

  const payload = JSON.stringify({
    usuario_email: options.usuario_email,
    nombre_cliente: options.nombre_cliente || '',
    tipo_evento: options.tipo_evento,
    detalles: options.detalles || {},
  });

  // Prioridad 1: navigator.sendBeacon (proceso en segundo plano del navegador, cero bloqueo)
  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: 'application/json' });
    const success = navigator.sendBeacon('/api/telemetria/evento', blob);
    if (success) return;
  }

  // Prioridad 2: fetch asíncrono con keepalive y captura de errores silenciosa
  try {
    fetch('/api/telemetria/evento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {
      // Silenciar completamente para jamás afectar la interacción del usuario
    });
  } catch (_) {
    // Silencio operativo
  }
}
