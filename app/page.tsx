'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabasePortal } from '@/lib/supabase/portal-client';
import ExcelExportDropdown from '@/components/ExcelExportDropdown';
import { 
  Search, 
  RotateCw, 
  Camera, 
  X, 
  LogOut, 
  ChevronDown, 
  ExternalLink,
  Package,
  ShieldCheck,
  FilterX,
  UserPlus,
  Users,
  RefreshCw,
  Mail,
  Lock,
  Phone,
  FileText,
  Tag,
  CheckCircle2,
  AlertCircle,
  Settings,
  Pencil,
  ArrowRightLeft,
  SlidersHorizontal,
  Calendar
} from 'lucide-react';

interface PaqueteTIB {
  id: string;
  numero_recibo_bodega: string;
  tracking: string;
  nombre_consignatario: string | null;
  tipo_empaque: string | null;
  peso_kg: number | null;
  estado_tib: string | null;
  estado_amex: string | null;
  estado_visible?: string | null;
  tib_imagen_url: string | null;
  tib_ticket_pdf_url: string | null;
  creado_en: string;

  actualizado_en: string | null;
}

interface ClientePortalItem {
  id: string;
  nombre_completo: string;
  email: string;
  telefono: string | null;
  documento_identidad: string | null;
  casillero_codigo: string | null;
  alias_palabras_clave: string[] | null;
  activo: boolean;
  password_establecido?: boolean;
  ultimo_acceso?: string | null;
  invitado_en?: string | null;
  creado_en: string;

}

const TIPOS_EMPAQUE = ['CAJA', 'SOBRE', 'BOLSA'];
const ESTADOS_DISPONIBLES = ['RECIBIDO', 'ENVIADO', 'ENTREGADO'];

export default function ClienteDashboardTIB() {
  const router = useRouter();

  const [user, setUser] = useState<any | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const isSuperadmin = user?.email?.toLowerCase() === 'sistemaamexcourier@gmail.com';
  const [paquetes, setPaquetes] = useState<PaqueteTIB[]>([]);
  const [totalSystemCount, setTotalSystemCount] = useState<number>(0);
  const [totalFilteredCount, setTotalFilteredCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Navegación entre vistas principales para Superadmin
  const [activeTab, setActiveTab] = useState<'warehouse' | 'configuracion'>('warehouse');
  const [clientSearchQuery, setClientSearchQuery] = useState('');

  // Filtros individuales estilo TIB
  const [filterWr, setFilterWr] = useState('');
  const [filterTracking, setFilterTracking] = useState('');
  const [filterConsignatario, setFilterConsignatario] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterEstado, setFilterEstado] = useState('');

  // Filtros avanzados, rangos y fechas profesionales
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterFechaTipo, setFilterFechaTipo] = useState<'creado_en' | 'actualizado_en'>('creado_en');
  const [filterFechaDesde, setFilterFechaDesde] = useState('');
  const [filterFechaHasta, setFilterFechaHasta] = useState('');
  const [filterPesoMin, setFilterPesoMin] = useState('');
  const [filterPesoMax, setFilterPesoMax] = useState('');
  const [datePreset, setDatePreset] = useState<string>('all');

  // Modal para ver foto
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; wr: string } | null>(null);

  // Estados de los Módulos de Superadmin: Agregar Cliente y Lista de Clientes
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [isClientsListOpen, setIsClientsListOpen] = useState(false);
  const [clientsList, setClientsList] = useState<ClientePortalItem[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(false);

  // Formulario de nuevo cliente
  const [newClientNombre, setNewClientNombre] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [resendingEmail, setResendingEmail] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [newClientTelefono, setNewClientTelefono] = useState('');
  const [newClientDni, setNewClientDni] = useState('');
  const [newClientKeywords, setNewClientKeywords] = useState('');
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [createClientSuccess, setCreateClientSuccess] = useState<string | null>(null);
  const [createClientError, setCreateClientError] = useState<string | null>(null);

  // Estados para Editar Cliente / Configurar Palabras Clave y Matching
  const [editingClient, setEditingClient] = useState<ClientePortalItem | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editTelefono, setEditTelefono] = useState('');
  const [editDni, setEditDni] = useState('');
  const [editCasillero, setEditCasillero] = useState('');
  const [editKeywords, setEditKeywords] = useState('');
  const [isUpdatingClient, setIsUpdatingClient] = useState(false);
  const [editClientSuccess, setEditClientSuccess] = useState<string | null>(null);
  const [editClientError, setEditClientError] = useState<string | null>(null);

  // Estados para el Buscador / Autocompletado de Consignatarios TIB (3,360)
  const [tibSearchResults, setTibSearchResults] = useState<any[]>([]);
  const [isSearchingTib, setIsSearchingTib] = useState(false);
  const [isTibDropdownOpen, setIsTibDropdownOpen] = useState(false);
  const [selectedTibClient, setSelectedTibClient] = useState<any | null>(null);

  // Estados para la pestaña de Catálogo TIB en Configuración
  const [configSubTab, setConfigSubTab] = useState<'usuarios' | 'tib'>('usuarios');
  const [tibCatalogSearch, setTibCatalogSearch] = useState('');
  const [tibCatalogList, setTibCatalogList] = useState<any[]>([]);
  const [tibCatalogTotal, setTibCatalogTotal] = useState(0);
  const [isLoadingTibCatalog, setIsLoadingTibCatalog] = useState(false);
  const [tibCatalogPage, setTibCatalogPage] = useState(1);

  // Sincronización masiva de inventario
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  // Paginación estilo TIB
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // 1. Garantizar scroll vertical libre y nativo en el navegador
  useEffect(() => {
    document.documentElement.classList.add('amex-client-portal');
    document.body.classList.add('amex-client-portal');
    document.documentElement.style.overflowY = 'auto';
    document.body.style.overflowY = 'auto';
    document.body.style.height = 'auto';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedPhoto(null);
        setUserMenuOpen(false);
        setIsAddClientOpen(false);
        setIsClientsListOpen(false);
        setEditingClient(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('tab');
      if (p === 'configuracion') {
        setActiveTab('configuracion');
        fetchClientsList();
      }
    }

    return () => {
      document.documentElement.classList.remove('amex-client-portal');
      document.body.classList.remove('amex-client-portal');
      document.documentElement.style.overflowY = '';
      document.body.style.overflowY = '';
      document.body.style.height = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Cargar conteo total absoluto del sistema (sin filtros)
  const fetchTotalSystemCount = useCallback(async (email?: string | null) => {
    if (!email) return;
    try {
      let query = supabasePortal
        .from('paquetes_portal')
        .select('id', { count: 'exact', head: true });

      if (email.toLowerCase() !== 'sistemaamexcourier@gmail.com') {
        query = query.eq('usuario_email', email);
      }
      const { count, error } = await query;
      if (!error && count != null) {
        setTotalSystemCount(count);
      }
    } catch (e) {
      console.warn('Error fetching total system count:', e);
    }
  }, []);

  const fetchPaquetes = useCallback(async (
    email?: string | null,
    page: number = 1,
    customFilters?: {
      wr?: string;
      tracking?: string;
      consignatario?: string;
      tipo?: string;
      estado?: string;
      fechaTipo?: 'creado_en' | 'actualizado_en';
      fechaDesde?: string;
      fechaHasta?: string;
      pesoMin?: string;
      pesoMax?: string;
    }
  ) => {
    if (!email) return;
    setIsLoading(true);
    try {
      let query = supabasePortal
        .from('paquetes_portal')
        .select(`
          id, 
          numero_recibo_bodega, 
          tracking, 
          nombre_consignatario,
          tipo_empaque,
          peso_kg, 
          estado_tib, 
          estado_amex, 
          estado_visible,
          tib_imagen_url, 
          tib_ticket_pdf_url,
          creado_en, 
          actualizado_en
        `, { count: 'exact' });

      // Si es cliente regular, filtrar solo los suyos; si es superadmin AMEX, permitir ver todo para supervisión
      if (email.toLowerCase() !== 'sistemaamexcourier@gmail.com') {
        query = query.eq('usuario_email', email);
      }

      const activeWr = customFilters?.wr !== undefined ? customFilters.wr : filterWr;
      const activeTracking = customFilters?.tracking !== undefined ? customFilters.tracking : filterTracking;
      const activeConsignatario = customFilters?.consignatario !== undefined ? customFilters.consignatario : filterConsignatario;
      const activeTipo = customFilters?.tipo !== undefined ? customFilters.tipo : filterTipo;
      const activeEstado = customFilters?.estado !== undefined ? customFilters.estado : filterEstado;
      const activeFechaTipo = customFilters?.fechaTipo !== undefined ? customFilters.fechaTipo : filterFechaTipo;
      const activeFechaDesde = customFilters?.fechaDesde !== undefined ? customFilters.fechaDesde : filterFechaDesde;
      const activeFechaHasta = customFilters?.fechaHasta !== undefined ? customFilters.fechaHasta : filterFechaHasta;
      const activePesoMin = customFilters?.pesoMin !== undefined ? customFilters.pesoMin : filterPesoMin;
      const activePesoMax = customFilters?.pesoMax !== undefined ? customFilters.pesoMax : filterPesoMax;

      if (activeWr.trim()) {
        query = query.ilike('numero_recibo_bodega', `%${activeWr.trim()}%`);
      }
      if (activeTracking.trim()) {
        query = query.ilike('tracking', `%${activeTracking.trim()}%`);
      }
      if (activeConsignatario.trim()) {
        query = query.ilike('nombre_consignatario', `%${activeConsignatario.trim()}%`);
      }
      if (activeTipo.trim()) {
        query = query.eq('tipo_empaque', activeTipo.trim());
      }
      if (activeEstado.trim()) {
        query = query.eq('estado_visible', activeEstado.trim());
      }
      if (activeFechaDesde.trim()) {
        try {
          const d = new Date(`${activeFechaDesde.trim()}T00:00:00`);
          if (!isNaN(d.getTime())) {
            query = query.gte(activeFechaTipo || 'creado_en', d.toISOString());
          }
        } catch (_) {}
      }
      if (activeFechaHasta.trim()) {
        try {
          const d = new Date(`${activeFechaHasta.trim()}T23:59:59.999`);
          if (!isNaN(d.getTime())) {
            query = query.lte(activeFechaTipo || 'creado_en', d.toISOString());
          }
        } catch (_) {}
      }
      if (activePesoMin.trim() && !isNaN(Number(activePesoMin))) {
        query = query.gte('peso_kg', Number(activePesoMin));
      }
      if (activePesoMax.trim() && !isNaN(Number(activePesoMax))) {
        query = query.lte('peso_kg', Number(activePesoMax));
      }

      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      query = query.order('creado_en', { ascending: false }).range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;
      setPaquetes(data || []);

      const countNum = count ?? (data?.length || 0);
      setTotalFilteredCount(countNum);

      const hasFilters = Boolean(
        activeWr.trim() ||
        activeTracking.trim() ||
        activeConsignatario.trim() ||
        activeTipo.trim() ||
        activeEstado.trim() ||
        activeFechaDesde.trim() ||
        activeFechaHasta.trim() ||
        activePesoMin.trim() ||
        activePesoMax.trim()
      );
      if (!hasFilters) {
        setTotalSystemCount(countNum);
      }
    } catch (err: any) {
      console.error('Error fetching paquetes cliente:', err?.message || err?.details || err?.hint || (typeof err === 'object' ? JSON.stringify(err) : err));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [filterWr, filterTracking, filterConsignatario, filterTipo, filterEstado, filterFechaTipo, filterFechaDesde, filterFechaHasta, filterPesoMin, filterPesoMax, itemsPerPage]);

  // Cargar lista de clientes registrados en el portal
  const fetchClientsList = useCallback(async () => {
    setIsLoadingClients(true);
    try {
      const res = await fetch('/api/listar-portal');
      if (res.ok) {
        const json = await res.json();
        if (json.clientes) {
          setClientsList(json.clientes);
          return;
        }
      }
      const { data, error } = await supabasePortal
        .from('clientes_portal')
        .select('*')
        .order('creado_en', { ascending: false });

      if (error) throw error;
      setClientsList(data || []);
    } catch (err) {
      console.error('Error al cargar clientes_portal:', err);
    } finally {
      setIsLoadingClients(false);
    }
  }, []);

  // Cargar sesión del usuario una sola vez
  const isInitialFilterMount = React.useRef(true);
  useEffect(() => {
    let isMounted = true;

    // Verificación inmediata en localStorage para redirigir sin mostrar la interfaz
    try {
      const storedToken = typeof window !== 'undefined' ? localStorage.getItem('amex-portal-cliente-token') : null;
      if (!storedToken) {
        setIsAuthChecking(true);
        router.replace('/login');
        return;
      }
    } catch {
      // Ignorar si localStorage no está accesible
    }

    async function loadSession() {
      const { data: { session } } = await supabasePortal.auth.getSession();
      if (!isMounted) return;
      if (!session) {
        setIsAuthChecking(true);
        router.replace('/login');
        return;
      }
      setUser(session.user);
      setIsAuthChecking(false);
      fetchTotalSystemCount(session.user.email);
      fetchPaquetes(session.user.email, 1);
      if (session.user.email?.toLowerCase() === 'sistemaamexcourier@gmail.com') {
        fetchClientsList();
      }
    }
    loadSession();

    const { data: { subscription } } = supabasePortal.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        setIsAuthChecking(true);
        router.replace('/login');
      } else if (event === 'SIGNED_IN') {
        setIsAuthChecking(false);
        setUser((prev: any) => {
          // Solo recargar si no había usuario o cambió de cuenta
          if (!prev || prev.id !== session.user.id) {
            fetchTotalSystemCount(session.user.email);
            fetchPaquetes(session.user.email, 1);
            if (session.user.email?.toLowerCase() === 'sistemaamexcourier@gmail.com') {
              fetchClientsList();
            }
          }
          return session.user;
        });
      } else if (event === 'TOKEN_REFRESHED') {
        // En renovación silenciosa de token (al cambiar de ventana/foco), solo actualizar estado en memoria sin recargar la tabla
        setUser(session.user);
        setIsAuthChecking(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [router, fetchPaquetes, fetchTotalSystemCount, fetchClientsList]);

  // Manejo de refresh manual
  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetchTotalSystemCount(user?.email);
    fetchPaquetes(user?.email, currentPage);
    if (user?.email?.toLowerCase() === 'sistemaamexcourier@gmail.com') {
      fetchClientsList();
    }
  };

  // Búsqueda y filtrado automático con debounce (ignora el montaje inicial ya cargado)
  useEffect(() => {
    if (!user?.email) return;
    if (isInitialFilterMount.current) {
      isInitialFilterMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      fetchPaquetes(user.email, currentPage);
    }, 350);

    return () => clearTimeout(timer);
  }, [user?.email, currentPage, filterWr, filterTracking, filterConsignatario, filterTipo, filterEstado, filterFechaTipo, filterFechaDesde, filterFechaHasta, filterPesoMin, filterPesoMax, fetchPaquetes]);

  const handleLogout = async () => {
    await supabasePortal.auth.signOut();
    router.push('/login');
  };

  // Sincronizar todos los paquetes aprobados desde el ERP hacia la base de clientes
  const handleSyncAllFromTib = async () => {
    if (!user?.email) return;
    setIsSyncingAll(true);
    try {
      const res = await fetch('/api/sync-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al sincronizar');
      
      alert(`Sincronización TIB completa: ${data.sincronizados} paquetes asignados a sus clientes con coincidencia exacta.`);
      fetchPaquetes(user.email);
    } catch (err: any) {
      alert(`Error en sincronización: ${err.message}`);
    } finally {
      setIsSyncingAll(false);
    }
  };

  // Crear nuevo usuario cliente
  const handleCreateClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingClient(true);
    setCreateClientError(null);
    setCreateClientSuccess(null);

    try {
      const keywordsArray = newClientKeywords
        .split(',')
        .map(k => k.trim())
        .filter(Boolean);

      const res = await fetch('/api/crear-usuario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_completo: newClientNombre,
          email: newClientEmail,
          alias_palabras_clave: keywordsArray,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al crear el usuario cliente');
      }

      setCreateClientSuccess(
        data.mensaje ||
          `¡Cliente ${data.user.nombre_completo} registrado con éxito! Se vincularon ${data.paquetes_vinculados} paquetes y se envió el correo de activación.`
      );

      // Limpiar formulario
      setNewClientNombre('');
      setSelectedTibClient(null);
      setNewClientEmail('');
      setNewClientKeywords('');

      // Recargar listas
      fetchClientsList();
      if (user?.email) {
        fetchPaquetes(user.email);
      }
    } catch (err: any) {
      setCreateClientError(err.message || 'Error al crear cliente');
    } finally {
      setIsCreatingClient(false);
    }
  };

  // Reenviar enlace de activación y contraseña al cliente
  const handleResendActivation = async (clientEmail: string) => {
    if (resendingEmail) return;
    setResendingEmail(clientEmail);
    setResendNotice(null);

    try {
      const res = await fetch('/api/reenviar-activacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: clientEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al reenviar enlace');
      }
      setResendNotice({
        type: 'success',
        message: data.message || `Enlace de activación reenviado a ${clientEmail}`,
      });
      setTimeout(() => setResendNotice(null), 5000);
    } catch (err: any) {
      setResendNotice({
        type: 'error',
        message: err.message || 'Error al reenviar enlace de activación',
      });
      setTimeout(() => setResendNotice(null), 5000);
    } finally {
      setResendingEmail(null);
    }
  };

  // Abrir modal de edición de cliente y configuración de matching
  const handleOpenEditClient = (c: ClientePortalItem) => {
    setEditingClient(c);
    setEditNombre(c.nombre_completo || '');
    setEditTelefono(c.telefono || '');
    setEditDni(c.documento_identidad || '');
    setEditCasillero(c.casillero_codigo || '');
    setEditKeywords(Array.isArray(c.alias_palabras_clave) ? c.alias_palabras_clave.join(', ') : '');
    setEditClientSuccess(null);
    setEditClientError(null);
  };

  // Guardar cambios del cliente y re-vincular paquetes TIB
  const handleUpdateClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    setIsUpdatingClient(true);
    setEditClientError(null);
    setEditClientSuccess(null);

    try {
      const keywordsArray = editKeywords
        .split(',')
        .map(k => k.trim())
        .filter(Boolean);

      const res = await fetch('/api/actualizar-usuario', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingClient.id,
          nombre_completo: editNombre,
          casillero_codigo: editCasillero,
          alias_palabras_clave: keywordsArray,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al actualizar el usuario cliente');
      }

      setEditClientSuccess(
        data.message || `¡Cliente ${data.client?.nombre_completo || ''} actualizado con éxito! Se vincularon ${data.paquetes_vinculados} paquetes de TIB.`
      );

      fetchClientsList();
      if (user?.email) {
        fetchPaquetes(user.email);
      }
    } catch (err: any) {
      setEditClientError(err.message || 'Error al actualizar cliente');
    } finally {
      setIsUpdatingClient(false);
    }
  };

  // Buscador en vivo de Consignatarios TIB (3,360)
  const searchTibClients = useCallback(async (query: string) => {
    setIsSearchingTib(true);
    try {
      const res = await fetch(`/api/listado-amex?search=${encodeURIComponent(query.trim())}&limit=8`);
      const json = await res.json();
      if (res.ok && Array.isArray(json.clientes)) {
        setTibSearchResults(json.clientes);
        setIsTibDropdownOpen(true);
      }
    } catch (err) {
      console.warn('Error al buscar consignatarios TIB:', err);
    } finally {
      setIsSearchingTib(false);
    }
  }, []);

  const handleAddTibKeyword = (client: any) => {
    const raw = String(client.nombre || '').trim();
    const existing = newClientKeywords
      .split(',')
      .map(k => k.trim())
      .filter(Boolean);

    // Si el usuario estaba escribiendo un término de búsqueda, reemplazar el último incompleto
    if (existing.length > 0) {
      const lastTerm = existing[existing.length - 1];
      if (raw.toLowerCase().includes(lastTerm.toLowerCase())) {
        existing.pop();
      }
    }

    // Agregar el nombre oficial de TIB
    if (!existing.includes(raw)) {
      existing.push(raw);
    }

    // Agregar la versión limpia sin "AMEX /" si aplica
    const sinAmex = raw;
    if (sinAmex && sinAmex !== raw && !existing.includes(sinAmex)) {
      existing.push(sinAmex);
    }

    setNewClientKeywords(existing.join(', '));
    setIsTibDropdownOpen(false);

    // Si el nombre de arriba está vacío, prellenarlo con el nombre de la persona
    if (!newClientNombre.trim()) {
      setNewClientNombre(sinAmex || raw);
    }

    // Si el email está vacío y TIB tenía email, autocompletar
    if (client.email && !newClientEmail.trim()) {
      setNewClientEmail(client.email);
    }
  };

  const handleSelectTibClient = (client: any) => {
    const raw = String(client.nombre || '').trim();
    const sinAmex = raw;

    // En el campo superior: Nombre del cliente
    setNewClientNombre(sinAmex || raw);

    // En el campo inferior de Variaciones: el nombre de TIB y sus variantes
    const variants = new Set<string>();
    variants.add(raw);
    if (sinAmex && sinAmex !== raw) {
      variants.add(sinAmex);
    }
    const parts = sinAmex.split(' ').filter(p => p.length > 2);
    if (parts.length >= 2) {
      variants.add(`${parts[0]} ${parts[parts.length - 1]}`);
    }

    setNewClientKeywords(raw);
    setIsTibDropdownOpen(false);

    if (client.email && !newClientEmail.trim()) {
      setNewClientEmail(client.email);
    }
  };

  // Cargar Catálogo TIB para la pestaña de Configuración
  const fetchTibCatalog = useCallback(async (searchQuery = '', page = 1) => {
    setIsLoadingTibCatalog(true);
    try {
      const limit = 15;
      const offset = (page - 1) * limit;
      const res = await fetch(`/api/listado-amex?search=${encodeURIComponent(searchQuery.trim())}&limit=${limit}&offset=${offset}`);
      const json = await res.json();
      if (res.ok) {
        setTibCatalogList(json.clientes || []);
        setTibCatalogTotal(json.total || 0);
      }
    } catch (err) {
      console.warn('Error al cargar catálogo TIB:', err);
    } finally {
      setIsLoadingTibCatalog(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'configuracion' && isSuperadmin && configSubTab === 'tib') {
      fetchTibCatalog(tibCatalogSearch, tibCatalogPage);
    }
  }, [activeTab, isSuperadmin, configSubTab, tibCatalogSearch, tibCatalogPage, fetchTibCatalog]);

  // Paquetes paginados (ya provistos directamente por la consulta del servidor)
  const paginatedPaquetes = paquetes;

  // Filtrado de clientes para el Panel de Configuración
  const filteredClientsList = useMemo(() => {
    if (!clientSearchQuery.trim()) return clientsList;
    const q = clientSearchQuery.toLowerCase();
    return clientsList.filter(c => 
      c.nombre_completo.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.casillero_codigo && c.casillero_codigo.toLowerCase().includes(q)) ||
      (c.telefono && c.telefono.includes(q)) ||
      (c.documento_identidad && c.documento_identidad.includes(q))
    );
  }, [clientsList, clientSearchQuery]);

  // Helper para formatear Date a input type="date" YYYY-MM-DD
  const formatDateForInput = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Selector rápido de períodos de fechas
  const applyDatePreset = (preset: string) => {
    setDatePreset(preset);
    const now = new Date();

    if (preset === 'all') {
      setFilterFechaDesde('');
      setFilterFechaHasta('');
      return;
    }
    if (preset === 'today') {
      const todayStr = formatDateForInput(now);
      setFilterFechaDesde(todayStr);
      setFilterFechaHasta(todayStr);
      return;
    }
    if (preset === 'yesterday') {
      const yest = new Date(now);
      yest.setDate(yest.getDate() - 1);
      const yestStr = formatDateForInput(yest);
      setFilterFechaDesde(yestStr);
      setFilterFechaHasta(yestStr);
      return;
    }
    if (preset === '7days') {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      setFilterFechaDesde(formatDateForInput(start));
      setFilterFechaHasta(formatDateForInput(now));
      return;
    }
    if (preset === '30days') {
      const start = new Date(now);
      start.setDate(start.getDate() - 29);
      setFilterFechaDesde(formatDateForInput(start));
      setFilterFechaHasta(formatDateForInput(now));
      return;
    }
    if (preset === 'thisMonth') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setFilterFechaDesde(formatDateForInput(start));
      setFilterFechaHasta(formatDateForInput(now));
      return;
    }
    if (preset === 'lastMonth') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      setFilterFechaDesde(formatDateForInput(start));
      setFilterFechaHasta(formatDateForInput(end));
      return;
    }
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterWr.trim()) count++;
    if (filterTracking.trim()) count++;
    if (filterConsignatario.trim()) count++;
    if (filterTipo.trim()) count++;
    if (filterEstado.trim()) count++;
    if (filterFechaDesde.trim() || filterFechaHasta.trim()) count++;
    if (filterPesoMin.trim() || filterPesoMax.trim()) count++;
    return count;
  }, [filterWr, filterTracking, filterConsignatario, filterTipo, filterEstado, filterFechaDesde, filterFechaHasta, filterPesoMin, filterPesoMax]);

  const advancedFiltersCount = useMemo(() => {
    let count = 0;
    if (filterFechaDesde.trim() || filterFechaHasta.trim()) count++;
    if (filterPesoMin.trim() || filterPesoMax.trim()) count++;
    return count;
  }, [filterFechaDesde, filterFechaHasta, filterPesoMin, filterPesoMax]);

  const handleClearFilters = () => {
    setFilterWr('');
    setFilterTracking('');
    setFilterConsignatario('');
    setFilterTipo('');
    setFilterEstado('');
    setFilterFechaDesde('');
    setFilterFechaHasta('');
    setFilterPesoMin('');
    setFilterPesoMax('');
    setDatePreset('all');
    setCurrentPage(1);
    fetchPaquetes(user?.email, 1, {
      wr: '',
      tracking: '',
      consignatario: '',
      tipo: '',
      estado: '',
      fechaDesde: '',
      fechaHasta: '',
      pesoMin: '',
      pesoMax: '',
    });
  };

  const handleSearchClick = () => {
    setCurrentPage(1);
    fetchPaquetes(user?.email, 1);
  };

  // Paginación en servidor
  const totalPages = Math.ceil(totalFilteredCount / itemsPerPage) || 1;

  // Cálculo de páginas visibles
  const paginationPages = useMemo(() => {
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const half = Math.floor(maxVisible / 2);
    let start = currentPage - half;
    let end = currentPage + half;

    if (start < 1) {
      start = 1;
      end = maxVisible;
    } else if (end > totalPages) {
      end = totalPages;
      start = totalPages - maxVisible + 1;
    }

    const pages: number[] = [];
    for (let p = start; p <= end; p++) {
      pages.push(p);
    }
    return pages;
  }, [currentPage, totalPages]);

  // Formato de fecha en dos líneas como TIB
  const formatDateTimeTIB = (isoString?: string | null) => {
    if (!isoString) return { date: '—', time: '' };
    try {
      const d = new Date(isoString);
      const pad = (n: number) => String(n).padStart(2, '0');
      const date = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
      const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      return { date, time };
    } catch {
      return { date: '—', time: '' };
    }
  };

  // Texto exacto del estado según la información extraída de TIB
  const getEstadoTexto = (pkg: PaqueteTIB) => {
    if (pkg.estado_tib) return pkg.estado_tib.toUpperCase();
    if (pkg.estado_visible) {
      const v = pkg.estado_visible.toUpperCase();
      if (v === 'RECIBIDO MIAMI') return 'RECIBIDO';
      if (v === 'EN VUELO') return 'ENVIADO';
      return v;
    }
    return 'RECIBIDO';
  };

  // Pantalla de carga mientras se valida la autenticación para evitar cualquier parpadeo de contenido no autenticado
  if (isAuthChecking || !user) {
    return (
      <div 
        style={{ 
          minHeight: '100vh', 
          backgroundColor: '#111827', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          gap: '16px' 
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/logo-amex-clean.png"
          alt="AMEX Courier"
          style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
        />
        <div 
          style={{ 
            width: '28px', 
            height: '28px', 
            border: '3px solid #ff5722', 
            borderTopColor: 'transparent', 
            borderRadius: '50%', 
            animation: 'spin 0.8s linear infinite' 
          }} 
        />
      </div>
    );
  }

  return (
    <div 
      className="amex-client-portal w-full flex-1 flex flex-col"
      data-portal="client"
      data-lenis-prevent
      style={{ 
        minHeight: '100vh', 
        backgroundColor: '#f1f3f6', 
        color: '#2c323f', 
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' 
      }}
    >
      
      {/* 1. Header superior estilo TIB */}
      <header style={{ backgroundColor: '#1e2229', color: '#ffffff', height: '56px', display: 'flex', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.15)', position: 'sticky', top: 0, zIndex: 40 }}>
        <div className="px-4 sm:px-6 lg:px-8 xl:px-10" style={{ maxWidth: '1400px', width: '100%', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          
          {/* Logo y título */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/logo-amex-clean.png"
              alt="AMEX Courier"
              style={{
                height: '28px',
                width: 'auto',
                objectFit: 'contain',
                flexShrink: 0,
              }}
            />
            <span
              className="hidden md:inline"
              style={{ fontSize: '13px', fontWeight: 700, color: '#f3f4f6', borderLeft: '1px solid #4b5563', paddingLeft: '10px', letterSpacing: '-0.2px', whiteSpace: 'nowrap' }}
            >
              Gestor de Almacén AMEX Courier
            </span>
          </div>

          {/* Usuario / Dropdown a la derecha */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, color: '#f3f4f6', cursor: 'pointer', padding: '5px 10px', borderRadius: '6px', maxWidth: '180px' }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Hola! {user?.user_metadata?.nombre_completo || user?.email?.split('@')[0]?.toUpperCase() || 'USUARIO'}
              </span>
              <ChevronDown style={{ width: '14px', height: '14px', color: '#9ca3af', flexShrink: 0 }} />
            </button>

            {userMenuOpen && (
              <div style={{ position: 'absolute', right: 0, marginTop: '6px', width: '250px', backgroundColor: '#ffffff', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', border: '1px solid #e5e7eb', padding: '6px 0', zIndex: 50 }}>
                <div style={{ padding: '8px 14px', borderBottom: '1px solid #f3f4f6', fontSize: '12px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <div style={{ fontWeight: 700, color: '#111827', fontSize: '13px' }}>Cuenta Conectada</div>
                  <div>{user?.email}</div>
                </div>

                {isSuperadmin && (
                  <div style={{ padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ padding: '4px 14px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: '#9ca3af', letterSpacing: '0.5px' }}>
                      Configuración
                    </div>

                    <button
                      onClick={() => {
                        if (activeTab === 'configuracion') {
                          setActiveTab('warehouse');
                          if (typeof window !== 'undefined') window.history.replaceState(null, '', '/?tab=warehouse');
                        } else {
                          setActiveTab('configuracion');
                          if (typeof window !== 'undefined') window.history.replaceState(null, '', '/?tab=configuracion');
                        }
                        setUserMenuOpen(false);
                        fetchClientsList();
                      }}
                      style={{ width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', color: '#1f2937', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      <Settings style={{ width: '14px', height: '14px', color: '#ff5722' }} />
                      <span>{activeTab === 'configuracion' ? 'Volver a Listado Warehouse' : 'Panel de Configuración'}</span>
                    </button>

                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        handleSyncAllFromTib();
                      }}
                      style={{ width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', color: '#1f2937', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      <RefreshCw style={{ width: '14px', height: '14px', color: '#6b7280' }} />
                      <span>Sincronizar con API TIB</span>
                    </button>
                  </div>
                )}

                <button
                  onClick={handleLogout}
                  style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', color: '#dc2626', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <LogOut style={{ width: '14px', height: '14px' }} />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. Contenedor de Contenido Principal */}
      <main className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8 xl:px-10" style={{ maxWidth: '1400px', width: '100%', margin: '0 auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '18px' }}>
        
        {/* ================= VISTA 1: LISTADO WAREHOUSE (LIMPIO, SIN BOTONES DE CONFIGURACIÓN) ================= */}
        {activeTab === 'warehouse' ? (
          <>
            {/* Título de la sección estilo TIB */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#ff5722', margin: 0, letterSpacing: '-0.3px' }}>
                  Listado Warehouse
                </h1>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b7280' }}>
                  Control y seguimiento de paquetes recibidos en el almacén de Miami y despachos a Lima.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#6b7280', backgroundColor: '#ffffff', padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                  Total: <strong style={{ color: '#111827', fontWeight: 800 }}>{(totalSystemCount || totalFilteredCount).toLocaleString()}</strong>
                </span>

                {activeFiltersCount > 0 && (
                  <span style={{ fontSize: '11.5px', color: '#ff5722', backgroundColor: '#fff3e0', border: '1px solid #ffccbc', padding: '6px 10px', borderRadius: '6px', fontWeight: 700 }}>
                    {totalFilteredCount.toLocaleString()} coincidencia(s)
                  </span>
                )}

                <button
                  type="button"
                  onClick={handleManualRefresh}
                  disabled={isRefreshing}
                  style={{
                    backgroundColor: '#ffffff',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  }}
                  title="Refrescar lista de paquetes"
                >
                  <RotateCw style={{ width: '13px', height: '13px', color: '#ff5722', animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
                  <span>Actualizar</span>
                </button>
              </div>
            </div>

            {/* Tarjeta de Filtros Estilo TIB */}
            <div className="p-3.5 sm:p-5" style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* Fila 1: 3 inputs amplios e independientes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                
                {/* Input # Warehouse */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search style={{ position: 'absolute', left: '12px', width: '16px', height: '16px', color: '#9ca3af' }} />
                  <input
                    type="text"
                    value={filterWr}
                    onChange={(e) => {
                      setFilterWr(e.target.value);
                      setCurrentPage(1);
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSearchClick(); }} placeholder="# Warehouse"
                    style={{
                      width: '100%',
                      height: '42px',
                      paddingLeft: '38px',
                      paddingRight: '12px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      fontSize: '13px',
                      color: '#111827',
                      outline: 'none',
                      backgroundColor: '#ffffff',
                      transition: 'border-color 0.15s ease'
                    }}
                  />
                </div>

                {/* Input # Tracking */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search style={{ position: 'absolute', left: '12px', width: '16px', height: '16px', color: '#9ca3af' }} />
                  <input
                    type="text"
                    value={filterTracking}
                    onChange={(e) => {
                      setFilterTracking(e.target.value);
                      setCurrentPage(1);
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSearchClick(); }} placeholder="# Tracking"
                    style={{
                      width: '100%',
                      height: '42px',
                      paddingLeft: '38px',
                      paddingRight: '12px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      fontSize: '13px',
                      color: '#111827',
                      outline: 'none',
                      backgroundColor: '#ffffff',
                      transition: 'border-color 0.15s ease'
                    }}
                  />
                </div>

                {/* Input Consignatario */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search style={{ position: 'absolute', left: '12px', width: '16px', height: '16px', color: '#9ca3af' }} />
                  <input
                    type="text"
                    value={filterConsignatario}
                    onChange={(e) => {
                      setFilterConsignatario(e.target.value);
                      setCurrentPage(1);
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSearchClick(); }} placeholder="CONSIGNATARIO"
                    style={{
                      width: '100%',
                      height: '42px',
                      paddingLeft: '38px',
                      paddingRight: '12px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      fontSize: '13px',
                      color: '#111827',
                      outline: 'none',
                      backgroundColor: '#ffffff',
                      transition: 'border-color 0.15s ease'
                    }}
                  />
                </div>
              </div>

              {/* Fila 2: Selects de Tipo y Estado */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                
                {/* Select Tipo de Paquete */}
                <div>
                  <select
                    value={filterTipo}
                    onChange={(e) => {
                      setFilterTipo(e.target.value);
                      setCurrentPage(1);
                    }}
                    style={{
                      width: '100%',
                      height: '42px',
                      padding: '0 12px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      fontSize: '13px',
                      color: '#374151',
                      outline: 'none',
                      backgroundColor: '#ffffff',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="">Tipo de Paquete (Todos)</option>
                    {TIPOS_EMPAQUE.map(tipo => (
                      <option key={tipo} value={tipo}>{tipo}</option>
                    ))}
                  </select>
                </div>

                {/* Select Estado */}
                <div>
                  <select
                    value={filterEstado}
                    onChange={(e) => {
                      setFilterEstado(e.target.value);
                      setCurrentPage(1);
                    }}
                    style={{
                      width: '100%',
                      height: '42px',
                      padding: '0 12px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      fontSize: '13px',
                      color: '#374151',
                      outline: 'none',
                      backgroundColor: '#ffffff',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="">Estado (Todos)</option>
                    {ESTADOS_DISPONIBLES.map(estado => (
                      <option key={estado} value={estado}>{estado}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Fila 3: Botones de Acción TIB */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '4px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleSearchClick}
                  className="w-auto"
                  style={{
                    backgroundColor: '#1e2229',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '9px 24px',
                    fontSize: '13px',
                    fontWeight: 700,
                    letterSpacing: '0.4px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                    transition: 'all 0.15s ease',
                    textAlign: 'center',
                    justifyContent: 'center',
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  BUSCAR
                </button>

                <div className="w-auto">
                  <ExcelExportDropdown
                    userEmail={user?.email}
                    filters={{
                      wr: filterWr,
                      tracking: filterTracking,
                      consignatario: filterConsignatario,
                      tipo: filterTipo,
                      estado: filterEstado,
                      fechaTipo: filterFechaTipo,
                      fechaDesde: filterFechaDesde,
                      fechaHasta: filterFechaHasta,
                      pesoMin: filterPesoMin,
                      pesoMax: filterPesoMax,
                    }}
                    totalFilteredCount={totalFilteredCount}
                    totalSystemCount={totalSystemCount}
                  />
                </div>

                {/* Botón de Filtros Profesionales y Rangos */}
                <button
                  type="button"
                  onClick={() => setShowAdvancedFilters(prev => !prev)}
                  className="w-auto"
                  style={{
                    backgroundColor: showAdvancedFilters || advancedFiltersCount > 0 ? '#fff7ed' : '#ffffff',
                    color: showAdvancedFilters || advancedFiltersCount > 0 ? '#c2410c' : '#374151',
                    border: showAdvancedFilters || advancedFiltersCount > 0 ? '1.5px solid #ff5722' : '1px solid #d1d5db',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: 700,
                    letterSpacing: '0.3px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    boxShadow: showAdvancedFilters ? '0 1px 3px rgba(234, 88, 12, 0.15)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <SlidersHorizontal style={{ width: '14px', height: '14px', color: showAdvancedFilters || advancedFiltersCount > 0 ? '#ea580c' : '#4b5563' }} />
                  <span>FILTROS Y FECHAS</span>
                  {advancedFiltersCount > 0 && (
                    <span
                      style={{
                        backgroundColor: '#ff5722',
                        color: '#ffffff',
                        fontSize: '10.5px',
                        fontWeight: 900,
                        padding: '1px 6px',
                        borderRadius: '999px',
                        minWidth: '18px',
                        textAlign: 'center'
                      }}
                    >
                      {advancedFiltersCount}
                    </span>
                  )}
                  <ChevronDown 
                    style={{ 
                      width: '13px', 
                      height: '13px', 
                      transform: showAdvancedFilters ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                      color: showAdvancedFilters || advancedFiltersCount > 0 ? '#ea580c' : '#6b7280'
                    }} 
                  />
                </button>

                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="w-full sm:w-auto"
                    style={{
                      backgroundColor: '#ffffff',
                      color: '#4b5563',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      padding: '8px 18px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <FilterX style={{ width: '14px', height: '14px', color: '#6b7280' }} />
                    <span>LIMPIAR TODO</span>
                  </button>
                )}
              </div>

              {/* Panel Desplegable de Filtros Profesionales y Rangos */}
              {showAdvancedFilters && (
                <div
                  style={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '16px',
                    marginTop: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.03)'
                  }}
                >
                  {/* Encabezado del panel avanzado */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Calendar style={{ width: '16px', height: '16px', color: '#ff5722' }} />
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#111827', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                        Filtro Avanzado por Fechas y Rangos
                      </span>
                    </div>
                    {advancedFiltersCount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          applyDatePreset('all');
                          setFilterPesoMin('');
                          setFilterPesoMax('');
                          setCurrentPage(1);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#dc2626',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: '2px 6px'
                        }}
                      >
                        Limpiar fechas y peso
                      </button>
                    )}
                  </div>

                  {/* Selector rápido por períodos (Presets) */}
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Períodos Rápidos:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {[
                        { id: 'all', label: 'Todo el historial' },
                        { id: 'today', label: 'Hoy' },
                        { id: 'yesterday', label: 'Ayer' },
                        { id: '7days', label: 'Últimos 7 días' },
                        { id: '30days', label: 'Últimos 30 días' },
                        { id: 'thisMonth', label: 'Este mes' },
                        { id: 'lastMonth', label: 'Mes anterior' },
                      ].map((p) => {
                        const isActive = datePreset === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              applyDatePreset(p.id);
                              setCurrentPage(1);
                            }}
                            style={{
                              backgroundColor: isActive ? '#1e2229' : '#ffffff',
                              color: isActive ? '#ffffff' : '#374151',
                              border: isActive ? '1px solid #1e2229' : '1px solid #cbd5e1',
                              borderRadius: '6px',
                              padding: '5px 12px',
                              fontSize: '12px',
                              fontWeight: isActive ? 700 : 500,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            {p.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Configuración detallada de fechas y rango de peso */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                    {/* Selector de Campo Fecha */}
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                        CRITERIO DE FECHA
                      </label>
                      <select
                        value={filterFechaTipo}
                        onChange={(e) => {
                          setFilterFechaTipo(e.target.value as 'creado_en' | 'actualizado_en');
                          setCurrentPage(1);
                        }}
                        style={{
                          width: '100%',
                          height: '38px',
                          padding: '0 10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '12.5px',
                          color: '#111827',
                          backgroundColor: '#ffffff',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="creado_en">Fecha Registro (Miami)</option>
                        <option value="actualizado_en">Fecha Modificado</option>
                      </select>
                    </div>

                    {/* Fecha Desde */}
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                        FECHA DESDE
                      </label>
                      <input
                        type="date"
                        value={filterFechaDesde}
                        onChange={(e) => {
                          setDatePreset('custom');
                          setFilterFechaDesde(e.target.value);
                          setCurrentPage(1);
                        }}
                        style={{
                          width: '100%',
                          height: '38px',
                          padding: '0 10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '12.5px',
                          color: '#111827',
                          backgroundColor: '#ffffff',
                          outline: 'none'
                        }}
                      />
                    </div>

                    {/* Fecha Hasta */}
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                        FECHA HASTA
                      </label>
                      <input
                        type="date"
                        value={filterFechaHasta}
                        onChange={(e) => {
                          setDatePreset('custom');
                          setFilterFechaHasta(e.target.value);
                          setCurrentPage(1);
                        }}
                        style={{
                          width: '100%',
                          height: '38px',
                          padding: '0 10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '12.5px',
                          color: '#111827',
                          backgroundColor: '#ffffff',
                          outline: 'none'
                        }}
                      />
                    </div>

                    {/* Rango de Peso */}
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                        RANGO DE PESO (KG)
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Mín"
                          value={filterPesoMin}
                          onChange={(e) => {
                            setFilterPesoMin(e.target.value);
                            setCurrentPage(1);
                          }}
                          style={{
                            width: '50%',
                            height: '38px',
                            padding: '0 8px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '12.5px',
                            color: '#111827',
                            backgroundColor: '#ffffff',
                            outline: 'none'
                          }}
                        />
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>–</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Máx"
                          value={filterPesoMax}
                          onChange={(e) => {
                            setFilterPesoMax(e.target.value);
                            setCurrentPage(1);
                          }}
                          style={{
                            width: '50%',
                            height: '38px',
                            padding: '0 8px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '12.5px',
                            color: '#111827',
                            backgroundColor: '#ffffff',
                            outline: 'none'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Chips de Filtros Activos con eliminación rápida */}
              {activeFiltersCount > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', paddingTop: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Filtros aplicados:
                  </span>
                  {filterWr.trim() && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '2px 8px', fontSize: '11.5px', fontWeight: 600 }}>
                      WR: {filterWr}
                      <X onClick={() => { setFilterWr(''); setCurrentPage(1); }} style={{ width: '12px', height: '12px', cursor: 'pointer' }} />
                    </span>
                  )}
                  {filterTracking.trim() && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '2px 8px', fontSize: '11.5px', fontWeight: 600 }}>
                      Tracking: {filterTracking}
                      <X onClick={() => { setFilterTracking(''); setCurrentPage(1); }} style={{ width: '12px', height: '12px', cursor: 'pointer' }} />
                    </span>
                  )}
                  {filterConsignatario.trim() && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '2px 8px', fontSize: '11.5px', fontWeight: 600 }}>
                      Cliente: {filterConsignatario}
                      <X onClick={() => { setFilterConsignatario(''); setCurrentPage(1); }} style={{ width: '12px', height: '12px', cursor: 'pointer' }} />
                    </span>
                  )}
                  {filterTipo.trim() && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '2px 8px', fontSize: '11.5px', fontWeight: 600 }}>
                      Tipo: {filterTipo}
                      <X onClick={() => { setFilterTipo(''); setCurrentPage(1); }} style={{ width: '12px', height: '12px', cursor: 'pointer' }} />
                    </span>
                  )}
                  {filterEstado.trim() && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '2px 8px', fontSize: '11.5px', fontWeight: 600 }}>
                      Estado: {filterEstado}
                      <X onClick={() => { setFilterEstado(''); setCurrentPage(1); }} style={{ width: '12px', height: '12px', cursor: 'pointer' }} />
                    </span>
                  )}
                  {(filterFechaDesde.trim() || filterFechaHasta.trim()) && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', borderRadius: '4px', padding: '2px 8px', fontSize: '11.5px', fontWeight: 600 }}>
                      📅 {filterFechaTipo === 'actualizado_en' ? 'Modificado' : 'Registro'}: {filterFechaDesde || 'Inicio'} al {filterFechaHasta || 'Hoy'}
                      <X onClick={() => { applyDatePreset('all'); setCurrentPage(1); }} style={{ width: '12px', height: '12px', cursor: 'pointer' }} />
                    </span>
                  )}
                  {(filterPesoMin.trim() || filterPesoMax.trim()) && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', borderRadius: '4px', padding: '2px 8px', fontSize: '11.5px', fontWeight: 600 }}>
                      ⚖ Peso: {filterPesoMin ? `${filterPesoMin}kg` : '0'} a {filterPesoMax ? `${filterPesoMax}kg` : '∞'}
                      <X onClick={() => { setFilterPesoMin(''); setFilterPesoMax(''); setCurrentPage(1); }} style={{ width: '12px', height: '12px', cursor: 'pointer' }} />
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* 4. Tabla Principal Estilo TIB (Visualización en Tabla con Scroll Horizontal Táctil en Móvil) */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              
              {/* Indicador móvil de deslizamiento horizontal con separación limpia */}
              <div className="flex md:hidden items-center justify-between px-4 py-2.5 bg-[#f8fafc] border-b border-gray-200 text-xs">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#374151' }}>
                  <ArrowRightLeft style={{ width: '13px', height: '13px', color: '#ff5722' }} />
                  <span>Desliza para ver más datos</span>
                </div>
                <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500 }}>
                  ↔ 9 columnas
                </span>
              </div>

              {/* Tabla completa estilo TIB accesible en todos los dispositivos con scroll horizontal */}
              <div style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  
                  {/* Encabezado estilo TIB */}
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      <th style={{ padding: '12px 14px', minWidth: '120px' }}>WR</th>
                      <th style={{ padding: '12px 14px', minWidth: '145px' }}># TRACKING</th>
                      <th style={{ padding: '12px 14px', minWidth: '190px' }}>CLIENTE</th>
                      <th style={{ padding: '12px 14px', minWidth: '85px' }}>TIPO</th>
                      <th style={{ padding: '12px 14px', minWidth: '95px' }}>PESO(KG)</th>
                      <th style={{ padding: '12px 14px', minWidth: '135px' }}>ESTADO</th>
                      <th style={{ padding: '12px 14px', minWidth: '110px' }}>REGISTRADO</th>
                      <th style={{ padding: '12px 14px', minWidth: '110px' }}>MODIFICADO</th>
                      <th style={{ padding: '12px 14px', minWidth: '130px', textAlign: 'center' }}>DOCUMENTOS</th>
                    </tr>
                  </thead>

                  {/* Cuerpo de la tabla */}
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={9} style={{ padding: '60px 16px', textAlign: 'center', color: '#6b7280' }}>
                          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '28px', height: '28px', border: '3px solid #ff5722', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                            <span style={{ fontSize: '13px', fontWeight: 600 }}>Cargando paquetes desde almacén...</span>
                          </div>
                        </td>
                      </tr>
                    ) : paginatedPaquetes.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ padding: '60px 16px', textAlign: 'center', color: '#6b7280' }}>
                          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <Package style={{ width: '36px', height: '36px', color: '#d1d5db' }} />
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#374151' }}>No se encontraron paquetes registrados</span>
                            <span style={{ fontSize: '12px', color: '#9ca3af' }}>Intenta ajustar los filtros de búsqueda o consulta tu número de Warehouse.</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedPaquetes.map((pkg, idx) => {
                        const creado = formatDateTimeTIB(pkg.creado_en);
                        const modificado = formatDateTimeTIB(pkg.actualizado_en || pkg.creado_en);
                        const estadoTexto = getEstadoTexto(pkg);

                        return (
                          <tr 
                            key={pkg.id || pkg.numero_recibo_bodega} 
                            style={{ 
                              borderBottom: '1px solid #f1f3f6', 
                              backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafbfc',
                              transition: 'background-color 0.12s ease'
                            }}
                          >
                            {/* WR */}
                            <td style={{ padding: '12px 14px', fontWeight: 700, color: '#111827', fontFamily: 'monospace', fontSize: '13px' }}>
                              {pkg.numero_recibo_bodega}
                            </td>

                            {/* Tracking */}
                            <td style={{ padding: '12px 14px', color: '#374151', fontFamily: 'monospace', fontSize: '12.5px' }}>
                              {pkg.tracking || '—'}
                            </td>

                            {/* Cliente / Consignatario */}
                            <td style={{ padding: '12px 14px', fontWeight: 700, color: '#111827' }}>
                              {pkg.nombre_consignatario || 'CLIENTE AMEX'}
                            </td>

                            {/* Tipo */}
                            <td style={{ padding: '12px 14px', color: '#4b5563', textTransform: 'uppercase', fontSize: '12px', fontWeight: 600 }}>
                              {pkg.tipo_empaque || 'CAJA'}
                            </td>

                            {/* Peso */}
                            <td style={{ padding: '12px 14px', fontWeight: 700, color: '#111827' }}>
                              {pkg.peso_kg != null ? Number(pkg.peso_kg).toFixed(2) : '—'}
                            </td>

                            {/* Estado (Solo Texto Plano, sin fondo ni colores) */}
                            <td style={{ padding: '12px 14px', fontSize: '11.5px', fontWeight: 700, color: '#1f2937', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                              {estadoTexto}
                            </td>

                            {/* Registrado (2 líneas estilo TIB) */}
                            <td style={{ padding: '12px 14px', fontSize: '12px', color: '#4b5563', lineHeight: '1.3' }}>
                              <div style={{ fontWeight: 600, color: '#111827' }}>{creado.date}</div>
                              <div style={{ fontSize: '11px', color: '#9ca3af' }}>{creado.time}</div>
                            </td>

                            {/* Modificado (2 líneas estilo TIB) */}
                            <td style={{ padding: '12px 14px', fontSize: '12px', color: '#4b5563', lineHeight: '1.3' }}>
                              <div style={{ fontWeight: 600, color: '#111827' }}>{modificado.date}</div>
                              <div style={{ fontSize: '11px', color: '#9ca3af' }}>{modificado.time}</div>
                            </td>

                            {/* Documentos / Foto */}
                            <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                              {pkg.tib_imagen_url ? (
                                <button
                                  type="button"
                                  onClick={() => setSelectedPhoto({ url: pkg.tib_imagen_url!, wr: pkg.numero_recibo_bodega })}
                                  style={{
                                    backgroundColor: '#fff7ed',
                                    color: '#c2410c',
                                    border: '1px solid #ffedd5',
                                    borderRadius: '6px',
                                    padding: '6px 12px',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                  }}
                                  title="Ver foto tomada en bodega Miami"
                                >
                                  <Camera style={{ width: '14px', height: '14px', color: '#ea580c' }} />
                                  <span>Ver imagen</span>
                                </button>
                              ) : (
                                <span style={{ 
                                  backgroundColor: '#f3f4f6', 
                                  color: '#9ca3af', 
                                  border: '1px solid #e5e7eb', 
                                  borderRadius: '6px', 
                                  padding: '6px 12px', 
                                  fontSize: '12px', 
                                  fontWeight: 600, 
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  gap: '6px' 
                                }}>
                                  <Camera style={{ width: '14px', height: '14px', opacity: 0.5 }} />
                                  <span>Sin imagen</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginación estilo TIB (Adaptada Responsive) */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid #e5e7eb', backgroundColor: '#f8f9fa', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>
                  Pág. <strong style={{ color: '#111827' }}>{currentPage}</strong> de <strong style={{ color: '#111827' }}>{totalPages.toLocaleString()}</strong> ({totalFilteredCount.toLocaleString()} registros)
                </span>

                {totalPages > 1 && (
                  <>
                    {/* Botones móviles compactos */}
                    <div className="flex sm:hidden items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        style={{ padding: '6px 12px', borderRadius: '4px', backgroundColor: '#ffffff', border: '1px solid #d1d5db', color: '#374151', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.4 : 1, fontSize: '12px', fontWeight: 600 }}
                      >
                        Anterior
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        style={{ padding: '6px 12px', borderRadius: '4px', backgroundColor: '#ffffff', border: '1px solid #d1d5db', color: '#374151', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.4 : 1, fontSize: '12px', fontWeight: 600 }}
                      >
                        Siguiente
                      </button>
                    </div>

                    {/* Botones escritorio completos */}
                    <div className="hidden sm:flex items-center gap-1">
                      {currentPage > 3 && (
                        <button
                          type="button"
                          onClick={() => setCurrentPage(1)}
                          style={{ padding: '6px 10px', borderRadius: '4px', backgroundColor: '#ffffff', border: '1px solid #d1d5db', color: '#374151', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                          title="Primera página"
                        >
                          « 1
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        style={{ padding: '6px 12px', borderRadius: '4px', backgroundColor: '#ffffff', border: '1px solid #d1d5db', color: '#374151', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.4 : 1, fontSize: '12px', fontWeight: 600 }}
                      >
                        Anterior
                      </button>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        {paginationPages.map(page => (
                          <button
                            key={page}
                            type="button"
                            onClick={() => setCurrentPage(page)}
                            style={{
                              minWidth: '32px',
                              height: '32px',
                              padding: '0 6px',
                              borderRadius: '4px',
                              border: currentPage === page ? 'none' : '1px solid #d1d5db',
                              backgroundColor: currentPage === page ? '#ff5722' : '#ffffff',
                              color: currentPage === page ? '#ffffff' : '#374151',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            {page}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        style={{ padding: '6px 12px', borderRadius: '4px', backgroundColor: '#ffffff', border: '1px solid #d1d5db', color: '#374151', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.4 : 1, fontSize: '12px', fontWeight: 600 }}
                      >
                        Siguiente
                      </button>

                      {currentPage < totalPages - 2 && (
                        <button
                          type="button"
                          onClick={() => setCurrentPage(totalPages)}
                          style={{ padding: '6px 10px', borderRadius: '4px', backgroundColor: '#ffffff', border: '1px solid #d1d5db', color: '#374151', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                          title="Última página"
                        >
                          {totalPages.toLocaleString()} »
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        ) : (
          /* ================= VISTA 2: PANEL DE CONFIGURACIÓN Y CLIENTES ================= */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Cabecera del Panel de Configuración */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#ff5722', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', boxShadow: '0 2px 6px rgba(255,87,34,0.3)' }}>
                    <Settings style={{ width: '20px', height: '20px' }} />
                  </div>
                  <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', margin: 0, letterSpacing: '-0.3px' }}>
                      Panel de Configuración
                    </h1>
                    <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#6b7280' }}>
                      Administración de clientes, asignación de casilleros y sincronización de envíos.
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => { setActiveTab('warehouse'); if (typeof window !== 'undefined') window.history.replaceState(null, '', '/?tab=warehouse'); }}
                  style={{
                    backgroundColor: '#ffffff',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  }}
                >
                  <Package style={{ width: '14px', height: '14px', color: '#ff5722' }} />
                  <span>Volver a Listado Warehouse</span>
                </button>
              </div>
            </div>

            {/* Fila de Tarjetas de Resumen Técnico */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>

              {/* Tarjeta Clientes */}
              <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.5px' }}>
                  Clientes Registrados en Portal
                </span>
                <div style={{ fontSize: '26px', fontWeight: 900, color: '#ff5722', marginTop: '4px' }}>
                  {clientsList.length}
                </div>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>
                  Usuarios con acceso activo a su casillero personal.
                </p>
              </div>

              {/* Tarjeta Sincronización ERP */}
              <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.5px' }}>
                    Inventario en Portal
                  </span>
                  <div style={{ fontSize: '26px', fontWeight: 900, color: '#111827', marginTop: '4px' }}>
                    {(totalSystemCount || totalFilteredCount).toLocaleString()} paquetes
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSyncAllFromTib}
                  disabled={isSyncingAll}
                  style={{
                    marginTop: '10px',
                    backgroundColor: '#1e2229',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 14px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: isSyncingAll ? 'not-allowed' : 'pointer',
                    opacity: isSyncingAll ? 0.7 : 1,
                  }}
                >
                  <RefreshCw style={{ width: '13px', height: '13px', color: '#ff5722', animation: isSyncingAll ? 'spin 1s linear infinite' : 'none' }} />
                  <span>{isSyncingAll ? 'Sincronizando con TIB...' : 'Sincronizar con API TIB'}</span>
                </button>
              </div>

            </div>

            {/* Tarjeta Principal de Directorio de Clientes */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '22px' }}>
              
              {/* Header de la sección de clientes */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', marginBottom: '18px' }}>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#111827', margin: 0 }}>
                    Directorio de Clientes
                  </h2>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b7280' }}>
                    Crea accesos, asigna códigos de casillero y define alias para matching automático de paquetes.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTibClient(null);
                      setNewClientNombre('');
                      setNewClientEmail('');
                
                      setNewClientTelefono('');
                      setNewClientDni('');
                      setNewClientKeywords('');
                      setCreateClientSuccess(null);
                      setCreateClientError(null);
                      setIsAddClientOpen(true);
                    }}
                    style={{
                      backgroundColor: '#ff5722',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 18px',
                      fontSize: '13px',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(255,87,34,0.25)',
                    }}
                  >
                    <UserPlus style={{ width: '15px', height: '15px' }} />
                    <span>+ Agregar Cliente</span>
                  </button>
                </div>
              </div>

              {/* Sub-pestañas: Usuarios Creados vs Catálogo TIB */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px', marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={() => setConfigSubTab('usuarios')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: configSubTab === 'usuarios' ? '#ff5722' : '#f3f4f6',
                    color: configSubTab === 'usuarios' ? '#ffffff' : '#4b5563',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Users style={{ width: '15px', height: '15px' }} />
                  <span>Usuarios Creados en Portal ({clientsList.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setConfigSubTab('tib');
                    if (tibCatalogList.length === 0) {
                      fetchTibCatalog(tibCatalogSearch, 1);
                    }
                  }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: configSubTab === 'tib' ? '#ff5722' : '#f3f4f6',
                    color: configSubTab === 'tib' ? '#ffffff' : '#4b5563',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Package style={{ width: '15px', height: '15px' }} />
                  <span>Catálogo Consignatarios TIB ({tibCatalogTotal || 3360})</span>
                </button>
              </div>

              {/* Contenido Sub-Pestaña 1: Usuarios Creados */}
              {configSubTab === 'usuarios' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
                      <Search style={{ width: '14px', height: '14px', color: '#9ca3af', position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        type="text"
                        value={clientSearchQuery}
                        onChange={(e) => setClientSearchQuery(e.target.value)}
                        placeholder="Buscar cliente por nombre o correo..."
                        style={{
                          width: '100%',
                          height: '38px',
                          paddingLeft: '32px',
                          paddingRight: '10px',
                          borderRadius: '6px',
                          border: '1px solid #d1d5db',
                          fontSize: '12.5px',
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #e5e7eb' }}>
                          <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563' }}>Consignatario / Nombre</th>
                          <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563' }}>Correo (Login)</th>
                          <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563' }}>Casillero</th>
                          <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563' }}>Palabras Clave (Matching)</th>
                          <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563' }}>Estado</th>
                          <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563' }}>Fecha Registro</th>
                          <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563', textAlign: 'center' }}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {isLoadingClients ? (
                          <tr>
                            <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: '#6b7280' }}>
                              <div style={{ width: '22px', height: '22px', border: '2px solid #ff5722', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
                              <span>Cargando directorio de clientes...</span>
                            </td>
                          </tr>
                        ) : filteredClientsList.length === 0 ? (
                          <tr>
                            <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                              <Users style={{ width: '36px', height: '36px', color: '#d1d5db', margin: '0 auto 8px' }} />
                              <p style={{ fontWeight: 700, color: '#374151', margin: 0 }}>No hay clientes que coincidan</p>
                              <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>Crea un cliente nuevo con el botón "+ Agregar Cliente".</p>
                            </td>
                          </tr>
                        ) : (
                          filteredClientsList.map((c, idx) => (
                            <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafbfc' }}>
                              <td style={{ padding: '12px 14px', fontWeight: 700, color: '#111827' }}>
                                {c.nombre_completo}
                              </td>
                              <td style={{ padding: '12px 14px', color: '#4b5563', fontFamily: 'monospace', fontSize: '12px' }}>
                                {c.email}
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                <span style={{ backgroundColor: '#f3f4f6', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, color: '#374151', fontFamily: 'monospace' }}>
                                  {c.casillero_codigo || `AMX-${String(idx + 1).padStart(3, '0')}`}
                                </span>
                              </td>
                              <td style={{ padding: '12px 14px', color: '#6b7280', fontSize: '11.5px', maxWidth: '240px' }}>
                                {Array.isArray(c.alias_palabras_clave) && c.alias_palabras_clave.length > 0 ? (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                    {c.alias_palabras_clave.map((k, ki) => (
                                      <span key={ki} style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '1px 6px', borderRadius: '3px', fontSize: '10.5px', fontWeight: 600 }}>
                                        {k}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span>Nombre exacto</span>
                                )}
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                {c.password_establecido ? (
                                  <span style={{ backgroundColor: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <CheckCircle2 style={{ width: '11px', height: '11px' }} />
                                    <span>Activo</span>
                                  </span>
                                ) : (
                                  <span style={{ backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <span>⏳ Pendiente Activación</span>
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '12px 14px', color: '#6b7280', fontSize: '11.5px' }}>
                                {formatDateTimeTIB(c.creado_en).date}
                              </td>
                              <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleResendActivation(c.email)}
                                    disabled={resendingEmail === c.email}
                                    title="Reenviar enlace de activación por correo"
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      padding: '6px 10px',
                                      backgroundColor: '#f8fafc',
                                      border: '1px solid #cbd5e1',
                                      borderRadius: '6px',
                                      color: '#1e293b',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      cursor: resendingEmail === c.email ? 'not-allowed' : 'pointer',
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                      transition: 'all 0.15s ease',
                                    }}
                                  >
                                    <Mail style={{ width: '12px', height: '12px', color: '#0284c7' }} />
                                    <span>{resendingEmail === c.email ? 'Enviando...' : 'Reenviar Enlace'}</span>
                                  </button>

                                  <Link
                                    href={`/configurar/${c.id}`}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                      padding: '6px 12px',
                                      backgroundColor: '#0284c7',
                                      border: 'none',
                                      borderRadius: '6px',
                                      color: '#ffffff',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      textDecoration: 'none',
                                      boxShadow: '0 1px 2px rgba(2,132,199,0.25)',
                                      transition: 'all 0.15s ease',
                                    }}
                                  >
                                    <Pencil style={{ width: '11px', height: '11px' }} />
                                    <span>Configurar</span>
                                  </Link>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Contenido Sub-Pestaña 2: Catálogo Consignatarios TIB (3,360) */}
              {configSubTab === 'tib' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                    <div style={{ position: 'relative', width: '360px', maxWidth: '100%' }}>
                      <Search style={{ width: '14px', height: '14px', color: '#9ca3af', position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        type="text"
                        value={tibCatalogSearch}
                        onChange={(e) => {
                          setTibCatalogSearch(e.target.value);
                          setTibCatalogPage(1);
                          fetchTibCatalog(e.target.value, 1);
                        }}
                        placeholder="Buscar en los 3,360 consignatarios TIB..."
                        style={{
                          width: '100%',
                          height: '38px',
                          paddingLeft: '32px',
                          paddingRight: '10px',
                          borderRadius: '6px',
                          border: '1px solid #d1d5db',
                          fontSize: '12.5px',
                          outline: 'none',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>
                      Mostrando {tibCatalogList.length} de {tibCatalogTotal} consignatarios
                    </span>
                  </div>

                  <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #e5e7eb' }}>
                          <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563' }}>Consignatario (Nombre en TIB)</th>
                          <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563' }}>ID TIB</th>
                          <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563', textAlign: 'center' }}>Total Paquetes</th>
                          <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563', textAlign: 'center' }}>En Bodega</th>
                          <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563', textAlign: 'center' }}>En Tránsito</th>
                          <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563', textAlign: 'center' }}>Entregados</th>
                          <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563' }}>Último WR</th>
                          <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563', textAlign: 'right' }}>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {isLoadingTibCatalog ? (
                          <tr>
                            <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: '#6b7280' }}>
                              <div style={{ width: '22px', height: '22px', border: '2px solid #ff5722', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
                              <span>Cargando consignatarios de TIB...</span>
                            </td>
                          </tr>
                        ) : tibCatalogList.length === 0 ? (
                          <tr>
                            <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                              <Package style={{ width: '36px', height: '36px', color: '#d1d5db', margin: '0 auto 8px' }} />
                              <p style={{ fontWeight: 700, color: '#374151', margin: 0 }}>No hay consignatarios que coincidan</p>
                              <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>Prueba buscando otro nombre.</p>
                            </td>
                          </tr>
                        ) : (
                          tibCatalogList.map((client, idx) => (
                            <tr key={client.id || idx} style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafbfc' }}>
                              <td style={{ padding: '12px 14px', fontWeight: 700, color: '#111827' }}>
                                {client.nombre}
                              </td>
                              <td style={{ padding: '12px 14px', color: '#6b7280', fontFamily: 'monospace', fontSize: '12px' }}>
                                #{client.iclient || 'S/ID'}
                              </td>
                              <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                <span style={{ backgroundColor: '#ffedd5', color: '#c2410c', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 800 }}>
                                  {client.total_paquetes}
                                </span>
                              </td>
                              <td style={{ padding: '12px 14px', textAlign: 'center', color: client.recibidos > 0 ? '#ea580c' : '#9ca3af', fontWeight: client.recibidos > 0 ? 800 : 500 }}>
                                {client.recibidos}
                              </td>
                              <td style={{ padding: '12px 14px', textAlign: 'center', color: client.enviados > 0 ? '#2563eb' : '#9ca3af', fontWeight: client.enviados > 0 ? 800 : 500 }}>
                                {client.enviados}
                              </td>
                              <td style={{ padding: '12px 14px', textAlign: 'center', color: '#6b7280' }}>
                                {client.entregados}
                              </td>
                              <td style={{ padding: '12px 14px', color: '#6b7280', fontFamily: 'monospace', fontSize: '11px' }}>
                                {client.ultimo_wr || '—'}
                              </td>
                              <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleSelectTibClient(client);
                                    setCreateClientSuccess(null);
                                    setCreateClientError(null);
                                    setIsAddClientOpen(true);
                                  }}
                                  style={{
                                    backgroundColor: '#ff5722',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '5px',
                                    padding: '5px 10px',
                                    fontSize: '11.5px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    boxShadow: '0 1px 3px rgba(255,87,34,0.2)'
                                  }}
                                >
                                  <UserPlus style={{ width: '12px', height: '12px' }} />
                                  <span>+ Asignar Portal</span>
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Paginación Catálogo TIB */}
                  {tibCatalogTotal > 15 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', fontSize: '12px', color: '#6b7280' }}>
                      <span>
                        Página <strong>{tibCatalogPage}</strong> de <strong>{Math.ceil(tibCatalogTotal / 15)}</strong> ({tibCatalogTotal} clientes)
                      </span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          disabled={tibCatalogPage <= 1 || isLoadingTibCatalog}
                          onClick={() => {
                            const newP = Math.max(1, tibCatalogPage - 1);
                            setTibCatalogPage(newP);
                            fetchTibCatalog(tibCatalogSearch, newP);
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '5px',
                            border: '1px solid #d1d5db',
                            backgroundColor: tibCatalogPage <= 1 ? '#f3f4f6' : '#ffffff',
                            color: tibCatalogPage <= 1 ? '#9ca3af' : '#374151',
                            cursor: tibCatalogPage <= 1 ? 'not-allowed' : 'pointer',
                            fontSize: '12px',
                            fontWeight: 600
                          }}
                        >
                          Anterior
                        </button>
                        <button
                          type="button"
                          disabled={tibCatalogPage >= Math.ceil(tibCatalogTotal / 15) || isLoadingTibCatalog}
                          onClick={() => {
                            const newP = tibCatalogPage + 1;
                            setTibCatalogPage(newP);
                            fetchTibCatalog(tibCatalogSearch, newP);
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '5px',
                            border: '1px solid #d1d5db',
                            backgroundColor: tibCatalogPage >= Math.ceil(tibCatalogTotal / 15) ? '#f3f4f6' : '#ffffff',
                            color: tibCatalogPage >= Math.ceil(tibCatalogTotal / 15) ? '#9ca3af' : '#374151',
                            cursor: tibCatalogPage >= Math.ceil(tibCatalogTotal / 15) ? 'not-allowed' : 'pointer',
                            fontSize: '12px',
                            fontWeight: 600
                          }}
                        >
                          Siguiente
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>

          </div>
        )}

      </main>

      {/* Modal de Foto Flotante */}
      {selectedPhoto && (
        <div 
          onClick={() => setSelectedPhoto(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backgroundColor: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(4px)' }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: '#ffffff', borderRadius: '10px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)', maxWidth: '720px', width: '100%', padding: '16px', position: 'relative', maxHeight: '92vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #e5e7eb', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: '#fff3e0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Camera style={{ width: '18px', height: '18px', color: '#ff5722' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#111827', margin: 0 }}>
                    Foto de Recepción Miami — WR {selectedPhoto.wr}
                  </h3>
                  <span style={{ fontSize: '11px', color: '#6b7280' }}>Evidencia fotográfica registrada en bodega Miami</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                style={{ padding: '6px', borderRadius: '6px', border: 'none', backgroundColor: '#f3f4f6', color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            </div>

            <div style={{ backgroundColor: '#0f172a', borderRadius: '8px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', maxHeight: '65vh', border: '1px solid #e2e8f0' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedPhoto.url}
                alt={`Paquete ${selectedPhoto.wr}`}
                style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain' }}
              />
            </div>

            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>
                Presiona <kbd style={{ padding: '2px 6px', background: '#e2e8f0', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>ESC</kbd> o haz clic afuera para cerrar
              </span>
              <a
                href={selectedPhoto.url}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', backgroundColor: '#ff5722', color: '#ffffff', fontWeight: 700, borderRadius: '6px', fontSize: '12px', textDecoration: 'none', cursor: 'pointer', boxShadow: '0 2px 6px rgba(255,87,34,0.3)' }}
              >
                <span>Ver tamaño original</span>
                <ExternalLink style={{ width: '14px', height: '14px' }} />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Agregar Usuario Cliente (Solo Superadmin) */}
      {isAddClientOpen && (
        <div 
          onClick={() => setIsAddClientOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)', maxWidth: '580px', width: '100%', padding: '20px', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '14px', borderBottom: '1px solid #e5e7eb', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#ff5722', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
                  <UserPlus style={{ width: '20px', height: '20px' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#111827', margin: 0 }}>
                    Agregar Usuario Cliente al Portal
                  </h3>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>
                    Crea el acceso y vincula automáticamente sus paquetes de bodega.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddClientOpen(false)}
                style={{ padding: '6px', borderRadius: '6px', border: 'none', backgroundColor: '#f3f4f6', color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            </div>

            {createClientSuccess && (
              <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 style={{ width: '18px', height: '18px', flexShrink: 0 }} />
                <span>{createClientSuccess}</span>
              </div>
            )}

            {createClientError && (
              <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle style={{ width: '18px', height: '18px', flexShrink: 0 }} />
                <span>{createClientError}</span>
              </div>
            )}

            <form onSubmit={handleCreateClientSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* Nombre Completo / Consignatario */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
                  Nombre Completo o Empresa (Consignatario en Guías) *
                </label>
                <input
                  type="text"
                  required
                  value={newClientNombre}
                  onChange={(e) => setNewClientNombre(e.target.value)}
                  placeholder="Ej: AMEX JANIRA AMEX o JANIRA PAREDES"
                  style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', color: '#111827', outline: 'none' }}
                />
                <span style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px', display: 'block' }}>
                  Debe coincidir con el nombre con el que llegan los paquetes a Miami/Lince.
                </span>
              </div>

              {/* Correo Electrónico y Aviso de Activación Segura */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
                  Correo Electrónico del Cliente *
                </label>
                <input
                  type="email"
                  required
                  value={newClientEmail}
                  onChange={(e) => setNewClientEmail(e.target.value)}
                  placeholder="cliente@gmail.com"
                  style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', color: '#111827', outline: 'none' }}
                />
              </div>

              {/* Banner informativo de activación segura sin contraseña */}
              <div
                style={{
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                }}
              >
                <ShieldCheck style={{ width: '18px', height: '18px', color: '#16a34a', flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '12px', color: '#166534', lineHeight: 1.5 }}>
                  <strong>Activación sin contraseña en panel:</strong> El Superadmin ya no define contraseñas. Al registrar al cliente, AMEX enviará automáticamente un correo de bienvenida oficial con su enlace seguro para que el cliente ingrese su propia contraseña.
                </div>
              </div>

              {/* Variaciones o Palabras Clave con Buscador TIB */}
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151' }}>
                    Variaciones o Palabras Clave (Opcional, separadas por coma)
                  </label>
                  <span style={{ fontSize: '11px', color: '#ff5722', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Search style={{ width: '12px', height: '12px' }} />
                    Buscador TIB (3,360 clientes)
                  </span>
                </div>

                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={newClientKeywords}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewClientKeywords(val);
                      // Extraer el último término que se está escribiendo
                      const lastTerm = val.split(',').pop()?.trim() || '';
                      if (lastTerm.length >= 2) {
                        searchTibClients(lastTerm);
                      } else {
                        setIsTibDropdownOpen(false);
                      }
                    }}
                    onFocus={() => {
                      const lastTerm = newClientKeywords.split(',').pop()?.trim() || '';
                      if (lastTerm.length >= 2) {
                        searchTibClients(lastTerm);
                      }
                    }}
                    placeholder="Ej: JANIRA, JANIRA AMEX, AMEX JANIRA (o escribe para buscar en TIB)"
                    style={{
                      width: '100%',
                      height: '40px',
                      padding: '0 36px 0 12px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      fontSize: '13px',
                      color: '#111827',
                      outline: 'none'
                    }}
                  />

                  {isSearchingTib ? (
                    <div
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: '16px',
                        height: '16px',
                        border: '2px solid #ff5722',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }}
                    />
                  ) : (
                    <Search
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: '16px',
                        height: '16px',
                        color: '#9ca3af',
                        pointerEvents: 'none'
                      }}
                    />
                  )}

                  {/* Dropdown flotante con los 3,360 clientes de TIB */}
                  {isTibDropdownOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        left: 0,
                        right: 0,
                        zIndex: 60,
                        backgroundColor: '#ffffff',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 12px 28px -4px rgba(0,0,0,0.2), 0 4px 10px rgba(0,0,0,0.06)',
                        maxHeight: '240px',
                        overflowY: 'auto'
                      }}
                    >
                      <div
                        style={{
                          padding: '8px 12px',
                          backgroundColor: '#f9fafb',
                          borderBottom: '1px solid #f3f4f6',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                      >
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            color: '#4b5563',
                            textTransform: 'uppercase',
                            letterSpacing: '0.4px'
                          }}
                        >
                          Haz clic para agregar consignatario ({tibSearchResults.length} sugerencias)
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsTibDropdownOpen(false)}
                          style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '11px',
                            color: '#6b7280',
                            cursor: 'pointer',
                            padding: 0
                          }}
                        >
                          Cerrar ✕
                        </button>
                      </div>

                      {tibSearchResults.length === 0 ? (
                        <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>
                          No se encontraron consignatarios en TIB con ese término. Puedes seguir escribiendo manualmente.
                        </div>
                      ) : (
                        tibSearchResults.map((client) => (
                          <div
                            key={client.id}
                            onClick={() => handleAddTibKeyword(client)}
                            style={{
                              padding: '10px 12px',
                              cursor: 'pointer',
                              borderBottom: '1px solid #f3f4f6',
                              transition: 'background-color 0.15s ease',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '10px'
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fff7ed')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                          >
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div
                                style={{
                                  fontSize: '13px',
                                  fontWeight: 700,
                                  color: '#111827',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                              >
                                {client.nombre}
                              </div>
                              <div
                                style={{
                                  fontSize: '11px',
                                  color: '#6b7280',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  marginTop: '2px'
                                }}
                              >
                                <span>ID: #{client.iclient || 'S/ID'}</span>
                                <span>•</span>
                                <span style={{ color: client.recibidos > 0 ? '#ea580c' : '#6b7280' }}>
                                  {client.recibidos} en bodega
                                </span>
                                <span>•</span>
                                <span style={{ color: client.enviados > 0 ? '#2563eb' : '#6b7280' }}>
                                  {client.enviados} en vuelo
                                </span>
                              </div>
                            </div>
                            <span
                              style={{
                                backgroundColor: '#ffedd5',
                                color: '#c2410c',
                                padding: '3px 8px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: 800,
                                whiteSpace: 'nowrap'
                              }}
                            >
                              + Agregar ({client.total_paquetes} paq.)
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <span style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px', display: 'block' }}>
                  Si una caja llega con cualquiera de estas variaciones, se asignará a este correo.
                </span>
              </div>

              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddClientOpen(false)}
                  style={{ padding: '9px 18px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#ffffff', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreatingClient}
                  style={{
                    padding: '9px 22px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#ff5722',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: isCreatingClient ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 4px rgba(255,87,34,0.3)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {isCreatingClient ? (
                    <>
                      <div style={{ width: '14px', height: '14px', border: '2px solid #ffffff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                      <span>Creando cuenta...</span>
                    </>
                  ) : (
                    <span>Guardar y Vincular Paquetes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Cliente / Configurar Palabras Clave y Matching */}
      {editingClient && (
        <div 
          onClick={() => setEditingClient(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)', maxWidth: '580px', width: '100%', padding: '24px', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '14px', borderBottom: '1px solid #e5e7eb', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
                  <Settings style={{ width: '20px', height: '20px' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#111827', margin: 0 }}>
                    Configurar Palabras Clave y Matching
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b7280' }}>
                    Cliente: <strong>{editingClient.nombre_completo}</strong> ({editingClient.email})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingClient(null)}
                style={{ padding: '6px', borderRadius: '6px', border: 'none', backgroundColor: '#f3f4f6', color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            </div>

            {editClientSuccess && (
              <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 style={{ width: '18px', height: '18px', flexShrink: 0 }} />
                <span>{editClientSuccess}</span>
              </div>
            )}

            {editClientError && (
              <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle style={{ width: '18px', height: '18px', flexShrink: 0 }} />
                <span>{editClientError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateClientSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>
                  Consignatario / Nombre Completo
                </label>
                <input
                  type="text"
                  required
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', outline: 'none' }}
                />
              </div>

              {/* Sección Destacada de Palabras Clave */}
              <div style={{ backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <Tag style={{ width: '15px', height: '15px', color: '#0284c7' }} />
                  <label style={{ fontSize: '12.5px', fontWeight: 800, color: '#0369a1' }}>
                    Palabras Clave (Matching Oficial TIB)
                  </label>
                </div>
                <p style={{ margin: '0 0 8px', fontSize: '11.5px', color: '#0c4a6e', lineHeight: 1.4 }}>
                  Ingresa las variaciones exactas de nombre separadas por comas. Cada paquete cuyo consignatario en TIB coincida con una de estas frases se asignará a este usuario.
                </p>
                <textarea
                  rows={3}
                  value={editKeywords}
                  onChange={(e) => setEditKeywords(e.target.value)}
                  placeholder="Ej: MARTIN MALDONADO, AMEX KENNETH MALDONADO, KENNETH MALDONADO"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #7dd3fc', fontSize: '12.5px', outline: 'none', backgroundColor: '#ffffff', fontFamily: 'monospace' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>
                  Código Casillero
                </label>
                <input
                  type="text"
                  value={editCasillero}
                  onChange={(e) => setEditCasillero(e.target.value)}
                  placeholder="Ej: AMX-001 o 31888"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', paddingTop: '14px', borderTop: '1px solid #e5e7eb' }}>
                <button
                  type="button"
                  onClick={() => setEditingClient(null)}
                  style={{ padding: '9px 18px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#ffffff', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingClient}
                  style={{
                    padding: '9px 22px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: isUpdatingClient ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 4px rgba(2,132,199,0.3)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {isUpdatingClient ? (
                    <>
                      <div style={{ width: '14px', height: '14px', border: '2px solid #ffffff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                      <span>Actualizando y Re-sincronizando...</span>
                    </>
                  ) : (
                    <span>Guardar y Re-vincular TIB</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer minimalista */}
      <footer style={{ borderTop: '1px solid #e5e7eb', backgroundColor: '#ffffff', padding: '14px 24px', textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>
        © {new Date().getFullYear()} AMEX COURIER PERÚ — Todos los derechos reservados.
      </footer>
    </div>
  );
}
