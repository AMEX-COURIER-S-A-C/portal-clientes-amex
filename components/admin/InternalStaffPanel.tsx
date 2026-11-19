'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  X,
  UserPlus,
  KeyRound,
  Pencil,
  Trash2,
  Ban,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  Copy,
  Check,
  FileSpreadsheet,
  Shield,
  Users,
} from 'lucide-react';
import { authFetch } from '@/lib/portal/authFetch';
import { normalizeSearchText } from '@/lib/portal/keywords';
import { isValidInternalUsername, normalizeInternalUsername } from '@/lib/portal/roles';
import { formatDateTimeTIB, UsuarioInternoItem } from '@/lib/portal/types';
import { ConfigTableSkeletonRows } from '@/components/ui/PortalSkeletons';

export interface InternalStaffPanelProps {
  staffList: UsuarioInternoItem[];
  isLoadingStaff: boolean;
  onStaffChanged: () => void | Promise<void>;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

function generateSecurePassword(length = 12): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%*';
  const all = upper + lower + digits + symbols;

  const pick = (chars: string) => {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return chars[arr[0] % chars.length];
  };

  const result = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  while (result.length < length) {
    result.push(pick(all));
  }

  for (let i = result.length - 1; i > 0; i--) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    const j = arr[0] % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result.join('');
}

export default function InternalStaffPanel({
  staffList,
  isLoadingStaff,
  onStaffChanged,
  showToast,
}: InternalStaffPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Modal Crear
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createNombre, setCreateNombre] = useState('');
  const [createUsername, setCreateUsername] = useState('');
  const [createCargo, setCreateCargo] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [showCreatePwd, setShowCreatePwd] = useState(true);
  const [createCanExcel, setCreateCanExcel] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdCreds, setCreatedCreds] = useState<{ username: string; password: string; nombre: string } | null>(null);
  const [copiedCreds, setCopiedCreds] = useState(false);

  // Modal Editar
  const [editingStaff, setEditingStaff] = useState<UsuarioInternoItem | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editCargo, setEditCargo] = useState('');
  const [editCanExcel, setEditCanExcel] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Modal Cambiar Contraseña
  const [pwdStaff, setPwdStaff] = useState<UsuarioInternoItem | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPwd, setShowNewPwd] = useState(true);
  const [isSavingPwd, setIsSavingPwd] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [updatedPwdCreds, setUpdatedPwdCreds] = useState<{ username: string; password: string } | null>(null);

  // Confirmar Desactivar / Eliminar
  const [staffToDeactivate, setStaffToDeactivate] = useState<UsuarioInternoItem | null>(null);
  const [staffToDelete, setStaffToDelete] = useState<UsuarioInternoItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Escape para cerrar modales internos si no están ocupados
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (staffToDelete && busyId !== staffToDelete.id) {
        setStaffToDelete(null);
      } else if (staffToDeactivate && busyId !== staffToDeactivate.id) {
        setStaffToDeactivate(null);
      } else if (pwdStaff && !isSavingPwd) {
        setPwdStaff(null);
      } else if (editingStaff && !isUpdating) {
        setEditingStaff(null);
      } else if (isCreateOpen && !isCreating) {
        setIsCreateOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [staffToDelete, staffToDeactivate, pwdStaff, editingStaff, isCreateOpen, busyId, isSavingPwd, isUpdating, isCreating]);

  const filteredStaff = useMemo(() => {
    const normalized = normalizeSearchText(searchQuery);
    if (!normalized) return staffList;
    const terms = normalized.split(' ').filter(Boolean);
    return staffList.filter((u) => {
      const hay = normalizeSearchText([u.nombre_completo, u.username, u.cargo || ''].join(' '));
      return terms.every((t) => hay.includes(t));
    });
  }, [staffList, searchQuery]);

  const cleanUsernamePreview = normalizeInternalUsername(createUsername);
  const isUsernamePreviewValid = !cleanUsernamePreview || isValidInternalUsername(cleanUsernamePreview);

  const openCreateModal = () => {
    setCreateNombre('');
    setCreateUsername('');
    setCreateCargo('');
    setCreatePassword(generateSecurePassword(10));
    setShowCreatePwd(true);
    setCreateCanExcel(false);
    setCreateError(null);
    setCreatedCreds(null);
    setCopiedCreds(false);
    setIsCreateOpen(true);
  };

  const handleCopyCredentials = async (username: string, password: string) => {
    const text = `Acceso Portal AMEX Courier\nURL: ${typeof window !== 'undefined' ? `${window.location.origin}/login` : '/login'}\nUsuario: ${username}\nContraseña: ${password}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCreds(true);
      showToast('success', 'Credenciales copiadas al portapapeles.');
      setTimeout(() => setCopiedCreds(false), 3000);
    } catch {
      showToast('info', `Usuario: ${username} | Contraseña: ${password}`);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreating) return;
    setCreateError(null);

    const normalizedUser = normalizeInternalUsername(createUsername);
    if (!isValidInternalUsername(normalizedUser)) {
      setCreateError('El usuario debe tener entre 3 y 32 caracteres (solo letras minúsculas, números, ".", "-" o "_").');
      return;
    }
    if (createPassword.length < 8) {
      setCreateError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setIsCreating(true);
    try {
      const res = await authFetch('/api/usuarios-internos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_completo: createNombre.trim(),
          username: normalizedUser,
          cargo: createCargo.trim() || null,
          password: createPassword,
          puede_exportar_excel: createCanExcel,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al crear usuario interno');
      }

      setCreatedCreds({
        username: normalizedUser,
        password: createPassword,
        nombre: data.usuario?.nombre_completo || createNombre.trim().toUpperCase(),
      });
      setCopiedCreds(false);
      showToast('success', data.mensaje || `Usuario interno @${normalizedUser} creado con éxito.`);
      await onStaffChanged();
    } catch (err: any) {
      setCreateError(err.message || 'Error al crear usuario interno');
    } finally {
      setIsCreating(false);
    }
  };

  const openEditModal = (u: UsuarioInternoItem) => {
    setEditingStaff(u);
    setEditNombre(u.nombre_completo);
    setEditCargo(u.cargo || '');
    setEditCanExcel(Boolean(u.puede_exportar_excel));
    setEditError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff || isUpdating) return;
    setIsUpdating(true);
    setEditError(null);
    try {
      const res = await authFetch('/api/usuarios-internos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingStaff.id,
          nombre_completo: editNombre.trim(),
          cargo: editCargo.trim() || null,
          puede_exportar_excel: editCanExcel,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al actualizar usuario interno');
      showToast('success', data.mensaje || 'Usuario interno actualizado.');
      setEditingStaff(null);
      await onStaffChanged();
    } catch (err: any) {
      setEditError(err.message || 'Error al actualizar usuario interno');
    } finally {
      setIsUpdating(false);
    }
  };

  const openPasswordModal = (u: UsuarioInternoItem) => {
    setPwdStaff(u);
    setNewPassword(generateSecurePassword(10));
    setShowNewPwd(true);
    setPwdError(null);
    setUpdatedPwdCreds(null);
    setCopiedCreds(false);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwdStaff || isSavingPwd) return;
    if (newPassword.length < 8) {
      setPwdError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    setIsSavingPwd(true);
    setPwdError(null);
    try {
      const res = await authFetch('/api/usuarios-internos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: pwdStaff.id,
          new_password: newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cambiar la contraseña');
      setUpdatedPwdCreds({ username: pwdStaff.username, password: newPassword });
      showToast('success', data.mensaje || 'Contraseña actualizada correctamente.');
    } catch (err: any) {
      setPwdError(err.message || 'Error al cambiar la contraseña');
    } finally {
      setIsSavingPwd(false);
    }
  };

  const handleToggleActive = async (u: UsuarioInternoItem, targetActive: boolean) => {
    setBusyId(u.id);
    try {
      const res = await authFetch('/api/usuarios-internos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: u.id, activo: targetActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo cambiar el estado');
      showToast('success', data.mensaje || `Cuenta @${u.username} ${targetActive ? 'activada' : 'desactivada'}.`);
      setStaffToDeactivate(null);
      await onStaffChanged();
    } catch (err: any) {
      showToast('error', err.message || 'Error al cambiar el estado');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteStaff = async (u: UsuarioInternoItem) => {
    setBusyId(u.id);
    try {
      const res = await authFetch(`/api/usuarios-internos?id=${encodeURIComponent(u.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo eliminar el usuario interno');
      showToast('success', data.mensaje || `Usuario @${u.username} eliminado.`);
      setStaffToDelete(null);
      await onStaffChanged();
    } catch (err: any) {
      showToast('error', err.message || 'Error al eliminar usuario interno');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      {/* Banda informativa + barra de búsqueda y botón Agregar */}
      <div
        style={{
          marginBottom: '14px',
          padding: '12px 14px',
          borderRadius: '8px',
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          color: '#1e3a8a',
          fontSize: '12.5px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 320px' }}>
          <Shield style={{ width: '17px', height: '17px', color: '#2563eb', flexShrink: 0 }} aria-hidden="true" />
          <span>
            <strong>Acceso de Equipo Interno:</strong> Inician sesión en <code>/login</code> con <strong>usuario y contraseña</strong> (sin correo). Ven todo el listado Warehouse actualizado, sin acceso a Configuración ni Analíticas.
          </span>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="amex-focus-ring"
          style={{
            backgroundColor: '#1d4ed8',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 16px',
            fontSize: '12.5px',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(29, 78, 216, 0.25)',
            whiteSpace: 'nowrap',
          }}
        >
          <UserPlus style={{ width: '15px', height: '15px' }} aria-hidden="true" />
          <span>Agregar Trabajador</span>
        </button>
      </div>

      {/* Buscador y contador */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
        <div style={{ position: 'relative', width: '340px', maxWidth: '100%' }}>
          <Search
            style={{ width: '14px', height: '14px', color: '#9ca3af', position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar trabajador, @usuario o cargo..."
            className="amex-input"
            style={{
              width: '100%',
              height: '38px',
              paddingLeft: '32px',
              paddingRight: searchQuery ? '32px' : '10px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              fontSize: '12.5px',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Limpiar búsqueda de equipo interno"
              className="amex-focus-ring"
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                padding: '2px',
                color: '#9ca3af',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                borderRadius: '4px',
              }}
            >
              <X style={{ width: '14px', height: '14px' }} aria-hidden="true" />
            </button>
          )}
        </div>
        <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>
          {searchQuery.trim()
            ? `Mostrando ${filteredStaff.length} de ${staffList.length} trabajadores`
            : `${staffList.length} ${staffList.length === 1 ? 'trabajador interno' : 'trabajadores internos'}`}
        </span>
      </div>

      {/* Tabla */}
      <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563' }}>Trabajador / Cargo</th>
              <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563' }}>Usuario (Login)</th>
              <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563' }}>Exportar Excel</th>
              <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563' }}>Estado</th>
              <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563' }}>Último Acceso</th>
              <th style={{ padding: '12px 14px', fontWeight: 700, color: '#4b5563', textAlign: 'center', minWidth: '330px' }}>Acciones</th>
            </tr>
          </thead>
          <tbody style={{ opacity: isLoadingStaff && staffList.length > 0 ? 0.55 : 1, transition: 'opacity 0.2s ease' }}>
            {isLoadingStaff && staffList.length === 0 ? (
              <ConfigTableSkeletonRows rows={5} variant="usuarios" />
            ) : filteredStaff.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                  <Users style={{ width: '36px', height: '36px', color: '#d1d5db', margin: '0 auto 8px' }} />
                  <p style={{ fontWeight: 700, color: '#374151', margin: 0 }}>
                    {searchQuery.trim()
                      ? `No hay trabajadores que coincidan con "${searchQuery.trim()}"`
                      : 'Aún no hay usuarios internos creados'}
                  </p>
                  {searchQuery.trim() ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      style={{
                        marginTop: '10px',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid #d1d5db',
                        backgroundColor: '#ffffff',
                        color: '#374151',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Limpiar filtro
                    </button>
                  ) : (
                    <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                      Usa el botón &quot;Agregar Trabajador&quot; para crear el primer acceso de consulta global.
                    </p>
                  )}
                </td>
              </tr>
            ) : (
              filteredStaff.map((u, idx) => {
                const lastLogin = u.ultimo_acceso ? formatDateTimeTIB(u.ultimo_acceso) : null;
                const isBusy = busyId === u.id;
                return (
                  <tr
                    key={u.id}
                    style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafbfc' }}
                  >
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#111827' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span>{u.nombre_completo}</span>
                        <span
                          style={{
                            backgroundColor: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                          }}
                        >
                          Staff
                        </span>
                      </div>
                      {u.cargo && (
                        <div style={{ fontSize: '11px', fontWeight: 500, color: '#6b7280', marginTop: '2px' }}>
                          {u.cargo}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <code
                        style={{
                          backgroundColor: '#f1f5f9',
                          color: '#0f172a',
                          border: '1px solid #e2e8f0',
                          padding: '3px 8px',
                          borderRadius: '5px',
                          fontSize: '12px',
                          fontWeight: 700,
                        }}
                      >
                        @{u.username}
                      </code>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {u.puede_exportar_excel ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundColor: '#ecfdf5',
                            color: '#047857',
                            border: '1px solid #a7f3d0',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 700,
                          }}
                        >
                          <FileSpreadsheet style={{ width: '11px', height: '11px' }} />
                          <span>Permitido</span>
                        </span>
                      ) : (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundColor: '#f3f4f6',
                            color: '#4b5563',
                            border: '1px solid #e5e7eb',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 600,
                          }}
                        >
                          <span>Solo consulta</span>
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {u.activo ? (
                        <span
                          style={{
                            backgroundColor: '#ecfdf5',
                            color: '#065f46',
                            border: '1px solid #a7f3d0',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <CheckCircle2 style={{ width: '11px', height: '11px', color: '#16a34a' }} />
                          <span>Activo</span>
                        </span>
                      ) : (
                        <span
                          style={{
                            backgroundColor: '#fef2f2',
                            color: '#991b1b',
                            border: '1px solid #fecaca',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Ban style={{ width: '11px', height: '11px', color: '#dc2626' }} />
                          <span>Desactivado</span>
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#6b7280', fontSize: '11.5px' }}>
                      {lastLogin ? (
                        <div>
                          <div style={{ fontWeight: 600, color: '#374151' }}>{lastLogin.date}</div>
                          <div style={{ fontSize: '10.5px', color: '#9ca3af' }}>{lastLogin.time}</div>
                        </div>
                      ) : (
                        <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Sin ingresos</span>
                      )}
                    </td>
                    <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center', flexWrap: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => openEditModal(u)}
                          disabled={isBusy}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 9px',
                            backgroundColor: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            borderRadius: '6px',
                            color: '#1d4ed8',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <Pencil style={{ width: '11px', height: '11px' }} />
                          <span>Editar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openPasswordModal(u)}
                          disabled={isBusy}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 9px',
                            backgroundColor: '#fff7ed',
                            border: '1px solid #fed7aa',
                            borderRadius: '6px',
                            color: '#c2410c',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <KeyRound style={{ width: '11px', height: '11px' }} />
                          <span>Clave</span>
                        </button>

                        {u.activo ? (
                          <button
                            type="button"
                            onClick={() => setStaffToDeactivate(u)}
                            disabled={isBusy}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '6px 9px',
                              backgroundColor: '#fef2f2',
                              border: '1px solid #fecaca',
                              borderRadius: '6px',
                              color: '#b91c1c',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <Ban style={{ width: '11px', height: '11px' }} />
                            <span>Desactivar</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleActive(u, true)}
                            disabled={isBusy}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '6px 9px',
                              backgroundColor: '#f0fdf4',
                              border: '1px solid #bbf7d0',
                              borderRadius: '6px',
                              color: '#15803d',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <UserCheck style={{ width: '11px', height: '11px' }} />
                            <span>Activar</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setStaffToDelete(u)}
                          disabled={isBusy}
                          title="Eliminar cuenta interna (conserva historial en auditoría)"
                          aria-label={`Eliminar usuario interno @${u.username}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '6px 8px',
                            backgroundColor: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '6px',
                            color: '#dc2626',
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 style={{ width: '12px', height: '12px' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ==================== MODAL CREAR USUARIO INTERNO ==================== */}
      {isCreateOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-staff-title"
          onClick={() => {
            if (!isCreating && createdCreds) setIsCreateOpen(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 110,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            backgroundColor: 'rgba(15, 23, 42, 0.72)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              maxWidth: '520px',
              width: '100%',
              maxHeight: '90dvh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#1d4ed8', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <UserPlus style={{ width: '19px', height: '19px' }} />
                </div>
                <div>
                  <h3 id="create-staff-title" style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#111827' }}>
                    Crear Usuario Interno AMEX
                  </h3>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>
                    Acceso global de consulta en Warehouse con usuario y contraseña.
                  </span>
                </div>
              </div>
              <button
                type="button"
                disabled={isCreating}
                onClick={() => setIsCreateOpen(false)}
                aria-label="Cerrar modal"
                style={{ width: '34px', height: '34px', borderRadius: '6px', border: 'none', backgroundColor: '#f3f4f6', color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X style={{ width: '17px', height: '17px' }} />
              </button>
            </div>

            {createdCreds ? (
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, fontSize: '14px', marginBottom: '6px' }}>
                    <CheckCircle2 style={{ width: '18px', height: '18px', color: '#10b981' }} />
                    <span>Trabajador creado y listo para ingresar</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12.5px', lineHeight: 1.45 }}>
                    Entrega estas credenciales a <strong>{createdCreds.nombre}</strong>. Por seguridad, la contraseña no vuelve a mostrarse en texto plano.
                  </p>
                </div>

                <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                  <div>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>Usuario para /login: </span>
                    <strong style={{ fontFamily: 'monospace', color: '#0f172a', fontSize: '14px' }}>{createdCreds.username}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>Contraseña: </span>
                    <strong style={{ fontFamily: 'monospace', color: '#0f172a', fontSize: '14px' }}>{createdCreds.password}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => handleCopyCredentials(createdCreds.username, createdCreds.password)}
                    style={{
                      padding: '9px 16px',
                      borderRadius: '6px',
                      border: '1px solid #bfdbfe',
                      backgroundColor: '#eff6ff',
                      color: '#1d4ed8',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    {copiedCreds ? <Check style={{ width: '15px', height: '15px' }} /> : <Copy style={{ width: '15px', height: '15px' }} />}
                    <span>{copiedCreds ? '¡Copiado!' : 'Copiar credenciales'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    style={{
                      padding: '9px 18px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: '#1e2229',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Listo
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {createError && (
                    <div role="alert" style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '12.5px', fontWeight: 600, display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0, marginTop: '1px' }} />
                      <span>{createError}</span>
                    </div>
                  )}

                  <div>
                    <label htmlFor="staff-nombre" style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
                      Nombre Completo del Trabajador *
                    </label>
                    <input
                      id="staff-nombre"
                      type="text"
                      required
                      value={createNombre}
                      onChange={(e) => setCreateNombre(e.target.value)}
                      placeholder="Ej: CARLOS MENDOZA"
                      className="amex-input"
                      style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                    />
                  </div>

                  <div>
                    <label htmlFor="staff-username" style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
                      Nombre de Usuario (para iniciar sesión) *
                    </label>
                    <input
                      id="staff-username"
                      type="text"
                      required
                      value={createUsername}
                      onChange={(e) => setCreateUsername(e.target.value)}
                      placeholder="Ej: carlos.mendoza o operaciones1"
                      className="amex-input"
                      style={{
                        width: '100%',
                        height: '40px',
                        padding: '0 12px',
                        borderRadius: '6px',
                        border: isUsernamePreviewValid ? '1px solid #d1d5db' : '1px solid #ef4444',
                        fontSize: '13px',
                        fontFamily: 'monospace',
                      }}
                    />
                    <span style={{ fontSize: '11px', color: isUsernamePreviewValid ? '#6b7280' : '#dc2626', marginTop: '3px', display: 'block' }}>
                      {cleanUsernamePreview
                        ? isUsernamePreviewValid
                          ? `Ingresará en /login escribiendo: ${cleanUsernamePreview}`
                          : 'Usa 3-32 caracteres: solo letras minúsculas, números, ".", "-" o "_".'
                        : 'Sin espacios ni "@". No interfiere si el trabajador también tiene cuenta personal como cliente.'}
                    </span>
                  </div>

                  <div>
                    <label htmlFor="staff-cargo" style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
                      Cargo o Área (Opcional)
                    </label>
                    <input
                      id="staff-cargo"
                      type="text"
                      value={createCargo}
                      onChange={(e) => setCreateCargo(e.target.value)}
                      placeholder="Ej: Operaciones Lima, Atención al Cliente, Almacén"
                      className="amex-input"
                      style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                    />
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <label htmlFor="staff-password" style={{ fontSize: '12px', fontWeight: 700, color: '#374151' }}>
                        Contraseña Inicial (mín. 8 caracteres) *
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setCreatePassword(generateSecurePassword(10));
                          setShowCreatePwd(true);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#1d4ed8',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: 0,
                        }}
                      >
                        <Sparkles style={{ width: '12px', height: '12px' }} />
                        <span>Generar segura</span>
                      </button>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input
                        id="staff-password"
                        type={showCreatePwd ? 'text' : 'password'}
                        required
                        minLength={8}
                        value={createPassword}
                        onChange={(e) => setCreatePassword(e.target.value)}
                        className="amex-input"
                        style={{
                          width: '100%',
                          height: '40px',
                          paddingLeft: '12px',
                          paddingRight: '40px',
                          borderRadius: '6px',
                          border: '1px solid #d1d5db',
                          fontSize: '13px',
                          fontFamily: 'monospace',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCreatePwd((v) => !v)}
                        aria-label="Mostrar u ocultar contraseña"
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: '#6b7280',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'inline-flex',
                        }}
                      >
                        {showCreatePwd ? <EyeOff style={{ width: '16px', height: '16px' }} /> : <Eye style={{ width: '16px', height: '16px' }} />}
                      </button>
                    </div>
                  </div>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '12px',
                      borderRadius: '8px',
                      backgroundColor: createCanExcel ? '#ecfdf5' : '#f8fafc',
                      border: `1px solid ${createCanExcel ? '#a7f3d0' : '#e2e8f0'}`,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={createCanExcel}
                      onChange={(e) => setCreateCanExcel(e.target.checked)}
                      style={{ marginTop: '2px', width: '16px', height: '16px', accentColor: '#059669', cursor: 'pointer' }}
                    />
                    <div style={{ fontSize: '12px', color: '#334155', lineHeight: 1.45 }}>
                      <strong style={{ color: '#0f172a', display: 'block' }}>Permitir exportar listado a Excel</strong>
                      <span>Si está desmarcado, el trabajador podrá buscar, filtrar y ver fotos/PDFs de todos los WR, pero no descargar archivos Excel.</span>
                    </div>
                  </label>
                </div>

                <div style={{ flexShrink: 0, padding: '14px 20px', borderTop: '1px solid #e5e7eb', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    disabled={isCreating}
                    onClick={() => setIsCreateOpen(false)}
                    style={{ minHeight: '40px', padding: '8px 16px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#ffffff', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    style={{
                      minHeight: '40px',
                      padding: '8px 20px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: '#1d4ed8',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: isCreating ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    {isCreating ? (
                      <>
                        <div style={{ width: '14px', height: '14px', border: '2px solid #ffffff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        <span>Creando...</span>
                      </>
                    ) : (
                      <span>Crear Trabajador</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ==================== MODAL EDITAR USUARIO INTERNO ==================== */}
      {editingStaff && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => { if (!isUpdating) setEditingStaff(null); }}
          style={{ position: 'fixed', inset: 0, zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backgroundColor: 'rgba(15, 23, 42, 0.72)', backdropFilter: 'blur(4px)' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: '#ffffff', borderRadius: '14px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)', maxWidth: '480px', width: '100%', overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#111827' }}>Editar Trabajador</h3>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>Usuario: <strong>@{editingStaff.username}</strong></span>
              </div>
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => setEditingStaff(null)}
                style={{ width: '34px', height: '34px', borderRadius: '6px', border: 'none', backgroundColor: '#f3f4f6', color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X style={{ width: '17px', height: '17px' }} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {editError && (
                  <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '12.5px', fontWeight: 600 }}>
                    {editError}
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={editNombre}
                    onChange={(e) => setEditNombre(e.target.value)}
                    className="amex-input"
                    style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
                    Cargo / Área
                  </label>
                  <input
                    type="text"
                    value={editCargo}
                    onChange={(e) => setEditCargo(e.target.value)}
                    placeholder="Ej: Operaciones Lima"
                    className="amex-input"
                    style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                  />
                </div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: editCanExcel ? '#ecfdf5' : '#f8fafc',
                    border: `1px solid ${editCanExcel ? '#a7f3d0' : '#e2e8f0'}`,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={editCanExcel}
                    onChange={(e) => setEditCanExcel(e.target.checked)}
                    style={{ marginTop: '2px', width: '16px', height: '16px', accentColor: '#059669' }}
                  />
                  <div style={{ fontSize: '12px', color: '#334155' }}>
                    <strong style={{ color: '#0f172a', display: 'block' }}>Permitir exportar listado a Excel</strong>
                    <span>Habilita o revoca el botón y permiso de descarga Excel en tiempo real.</span>
                  </div>
                </label>
              </div>
              <div style={{ padding: '14px 20px', borderTop: '1px solid #e5e7eb', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" disabled={isUpdating} onClick={() => setEditingStaff(null)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#ffffff', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={isUpdating} style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', backgroundColor: '#1d4ed8', color: '#ffffff', fontSize: '13px', fontWeight: 700, cursor: isUpdating ? 'not-allowed' : 'pointer' }}>
                  {isUpdating ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL CAMBIAR CONTRASEÑA ==================== */}
      {pwdStaff && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => { if (!isSavingPwd) setPwdStaff(null); }}
          style={{ position: 'fixed', inset: 0, zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backgroundColor: 'rgba(15, 23, 42, 0.72)', backdropFilter: 'blur(4px)' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: '#ffffff', borderRadius: '14px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)', maxWidth: '460px', width: '100%', overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#111827' }}>Cambiar Contraseña</h3>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>{pwdStaff.nombre_completo} (<strong>@{pwdStaff.username}</strong>)</span>
              </div>
              <button
                type="button"
                disabled={isSavingPwd}
                onClick={() => setPwdStaff(null)}
                style={{ width: '34px', height: '34px', borderRadius: '6px', border: 'none', backgroundColor: '#f3f4f6', color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X style={{ width: '17px', height: '17px' }} />
              </button>
            </div>

            {updatedPwdCreds ? (
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', fontSize: '12.5px', fontWeight: 600 }}>
                  Contraseña actualizada con éxito para <strong>@{updatedPwdCreds.username}</strong>.
                </div>
                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '13px' }}>
                  Nueva contraseña: <strong style={{ fontFamily: 'monospace' }}>{updatedPwdCreds.password}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => handleCopyCredentials(updatedPwdCreds.username, updatedPwdCreds.password)}
                    style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #bfdbfe', backgroundColor: '#eff6ff', color: '#1d4ed8', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    {copiedCreds ? <Check style={{ width: '14px', height: '14px' }} /> : <Copy style={{ width: '14px', height: '14px' }} />}
                    <span>{copiedCreds ? '¡Copiado!' : 'Copiar credenciales'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPwdStaff(null)}
                    style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#1e2229', color: '#ffffff', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handlePasswordSubmit}>
                <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {pwdError && (
                    <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '12.5px', fontWeight: 600 }}>
                      {pwdError}
                    </div>
                  )}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151' }}>Nueva Contraseña *</label>
                      <button
                        type="button"
                        onClick={() => { setNewPassword(generateSecurePassword(10)); setShowNewPwd(true); }}
                        style={{ background: 'none', border: 'none', color: '#1d4ed8', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: 0 }}
                      >
                        <Sparkles style={{ width: '12px', height: '12px' }} />
                        <span>Generar</span>
                      </button>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showNewPwd ? 'text' : 'password'}
                        required
                        minLength={8}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="amex-input"
                        style={{ width: '100%', height: '40px', paddingLeft: '12px', paddingRight: '40px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', fontFamily: 'monospace' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPwd((v) => !v)}
                        style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '4px', display: 'inline-flex' }}
                      >
                        {showNewPwd ? <EyeOff style={{ width: '16px', height: '16px' }} /> : <Eye style={{ width: '16px', height: '16px' }} />}
                      </button>
                    </div>
                  </div>
                </div>
                <div style={{ padding: '14px 20px', borderTop: '1px solid #e5e7eb', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button type="button" disabled={isSavingPwd} onClick={() => setPwdStaff(null)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#ffffff', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                    Cancelar
                  </button>
                  <button type="submit" disabled={isSavingPwd} style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', backgroundColor: '#ff5722', color: '#ffffff', fontSize: '13px', fontWeight: 700, cursor: isSavingPwd ? 'not-allowed' : 'pointer' }}>
                    {isSavingPwd ? 'Actualizando...' : 'Actualizar Contraseña'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ==================== MODAL CONFIRMAR DESACTIVACIÓN ==================== */}
      {staffToDeactivate && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => { if (busyId !== staffToDeactivate.id) setStaffToDeactivate(null); }}
          style={{ position: 'fixed', inset: 0, zIndex: 115, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backgroundColor: 'rgba(15, 23, 42, 0.72)', backdropFilter: 'blur(4px)' }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: '#ffffff', borderRadius: '14px', maxWidth: '440px', width: '100%', padding: '22px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 800, color: '#111827' }}>Desactivar Trabajador</h3>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#4b5563', lineHeight: 1.5 }}>
              ¿Deseas bloquear el acceso inmediato de <strong>{staffToDeactivate.nombre_completo}</strong> (<code>@{staffToDeactivate.username}</code>)? Sus sesiones activas dejarán de funcionar al instante y podrás reactivarlo luego.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" disabled={busyId === staffToDeactivate.id} onClick={() => setStaffToDeactivate(null)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#ffffff', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button type="button" disabled={busyId === staffToDeactivate.id} onClick={() => handleToggleActive(staffToDeactivate, false)} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#dc2626', color: '#ffffff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                {busyId === staffToDeactivate.id ? 'Desactivando...' : 'Confirmar Desactivación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL CONFIRMAR ELIMINACIÓN ==================== */}
      {staffToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => { if (busyId !== staffToDelete.id) setStaffToDelete(null); }}
          style={{ position: 'fixed', inset: 0, zIndex: 115, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backgroundColor: 'rgba(15, 23, 42, 0.72)', backdropFilter: 'blur(4px)' }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: '#ffffff', borderRadius: '14px', maxWidth: '450px', width: '100%', padding: '22px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 800, color: '#991b1b' }}>Eliminar Usuario Interno</h3>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#4b5563', lineHeight: 1.5 }}>
              Se eliminará permanentemente la cuenta de acceso de <strong>{staffToDelete.nombre_completo}</strong> (<code>@{staffToDelete.username}</code>). Su historial de actividad en <strong>Auditoría Equipo Interno</strong> se conservará intacto.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" disabled={busyId === staffToDelete.id} onClick={() => setStaffToDelete(null)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#ffffff', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button type="button" disabled={busyId === staffToDelete.id} onClick={() => handleDeleteStaff(staffToDelete)} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#dc2626', color: '#ffffff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                {busyId === staffToDelete.id ? 'Eliminando...' : 'Eliminar Permanentemente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
