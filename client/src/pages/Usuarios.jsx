import { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Usuarios() {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [passForm, setPassForm] = useState({});

  const isAdmin = user?.rol === 'admin';

  const loadData = async () => {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([api.getUsuarios(), api.getRoles()]);
      setUsuarios(u);
      setRoles(r);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ nombre_completo: '', usuario_login: '', contrasena: '', id_rol: '', fono: '' });
    setShowForm(true);
    setError('');
  };

  const openEdit = (u) => {
    setEditing(u);
    setForm({ nombre_completo: u.nombre_completo, usuario_login: u.usuario_login, id_rol: u.id_rol, fono: u.fono || '', estado: u.estado });
    setShowForm(true);
    setError('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await api.updateUsuario(editing.id_usuario, form);
      } else {
        await api.createUsuario(form);
      }
      setShowForm(false);
      loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`Eliminar usuario ${u.usuario_login}?`)) return;
    try {
      await api.deleteUsuario(u.id_usuario);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const openPassword = (u) => {
    setEditing(u);
    setPassForm({ contrasena: '' });
    setShowPass(true);
  };

  const handlePassword = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.updatePassword(editing.id_usuario, passForm);
      setShowPass(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Usuarios</h1>
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">
          Solo los administradores pueden gestionar usuarios
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Usuarios</h1>
        <button onClick={openNew} className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Nuevo</button>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-4 py-3 font-medium">ID</th>
              <th className="text-left px-4 py-3 font-medium">Nombre</th>
              <th className="text-left px-4 py-3 font-medium">Login</th>
              <th className="text-left px-4 py-3 font-medium">Rol</th>
              <th className="text-left px-4 py-3 font-medium">Estado</th>
              <th className="text-left px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan="6" className="text-center py-8 text-gray-400">Cargando...</td></tr>
            ) : usuarios.map((u) => (
              <tr key={u.id_usuario} className="hover:bg-gray-50">
                <td className="px-4 py-3">{u.id_usuario}</td>
                <td className="px-4 py-3">{u.nombre_completo}</td>
                <td className="px-4 py-3 font-mono text-xs">{u.usuario_login}</td>
                <td className="px-4 py-3">
                  <span className="bg-primary-100 text-primary-700 text-xs px-2 py-0.5 rounded-full">{u.nombre_rol}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${u.estado === 'activo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {u.estado}
                  </span>
                </td>
                <td className="px-4 py-3 space-x-2">
                  <button onClick={() => openEdit(u)} className="text-primary-600 hover:text-primary-800 text-xs">Editar</button>
                  <button onClick={() => openPassword(u)} className="text-amber-600 hover:text-amber-800 text-xs">Pass</button>
                  <button onClick={() => handleDelete(u)} className="text-red-500 hover:text-red-700 text-xs">Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">{editing ? 'Editar' : 'Nuevo'} Usuario</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded border border-red-200">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
                <input type="text" value={form.nombre_completo || ''} onChange={(e) => setForm({ ...form, nombre_completo: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Usuario Login</label>
                <input type="text" value={form.usuario_login || ''} onChange={(e) => setForm({ ...form, usuario_login: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" required />
              </div>
              {!editing && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contrasena</label>
                  <input type="password" value={form.contrasena || ''} onChange={(e) => setForm({ ...form, contrasena: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" required />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                <select value={form.id_rol || ''} onChange={(e) => setForm({ ...form, id_rol: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" required>
                  <option value="">Seleccionar...</option>
                  {roles.map((r) => <option key={r.id_rol} value={r.id_rol}>{r.nombre_rol}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                <input type="text" value={form.fono || ''} onChange={(e) => setForm({ ...form, fono: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
              </div>
              {editing && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <select value={form.estado || ''} onChange={(e) => setForm({ ...form, estado: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none">
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPass && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">Cambiar Contrasena - {editing?.usuario_login}</h2>
              <button onClick={() => setShowPass(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <form onSubmit={handlePassword} className="p-5 space-y-4">
              {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded border border-red-200">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nueva Contrasena</label>
                <input type="password" value={passForm.contrasena || ''} onChange={(e) => setPassForm({ contrasena: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" required />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowPass(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
