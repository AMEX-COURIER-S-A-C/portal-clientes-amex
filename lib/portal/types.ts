export interface PaqueteTIB {
  id: string;
  numero_recibo_bodega: string;
  tracking: string;
  nombre_consignatario: string | null;
  tipo_empaque: string | null;
  peso_kg: number | null;
  estado_tib: string | null;
  estado_amex: string | null;
  tib_imagen_url: string | null;
  tib_ticket_pdf_url: string | null;
  creado_en: string;
  actualizado_en: string | null;
}

export interface ClientePortalItem {
  id: string;
  nombre_completo: string;
  email: string;
  alias_palabras_clave: string[] | null;
  activo: boolean;
  password_establecido?: boolean;
  ultimo_acceso?: string | null;
  invitado_en?: string | null;
  creado_en: string;
}

export interface TibCatalogClient {
  id: string | number;
  nombre: string;
  iclient?: string | null;
  total_paquetes: number;
  recibidos: number;
  enviados: number;
  entregados: number;
  ultimo_wr?: string | null;
  email?: string | null;
}

export interface UsuarioInternoItem {
  id: string;
  username: string;
  auth_email: string;
  nombre_completo: string;
  cargo: string | null;
  puede_exportar_excel: boolean;
  activo: boolean;
  creado_por: string | null;
  creado_en: string;
  actualizado_en: string;
  ultimo_acceso?: string | null;
}

export interface ToastNotice {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

export interface KeywordsPopoverStyle {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
}

export const TIPOS_EMPAQUE = ['CAJA', 'SOBRE', 'BOLSA'] as const;
export const ESTADOS_DISPONIBLES = ['RECIBIDO', 'ENVIADO', 'ENTREGADO'] as const;

export function formatDateForInput(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateTimeTIB(isoString?: string | null): { date: string; time: string } {
  if (!isoString) return { date: '—', time: '' };
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return { date: '—', time: '' };
    const pad = (n: number) => String(n).padStart(2, '0');
    const date = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    return { date, time };
  } catch {
    return { date: '—', time: '' };
  }
}

export function getEstadoTexto(pkg: PaqueteTIB): string {
  return (pkg.estado_tib || 'RECIBIDO').toUpperCase();
}
