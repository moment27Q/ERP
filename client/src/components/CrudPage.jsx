import { useState, useEffect } from 'react';

export default function CrudPage({ title, fetchAll, create, update, remove, columns, formFields, searchPlaceholder, canDelete, confirmDelete }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const loadData = async (s) => {
    setLoading(true);
    try {
      const result = await fetchAll(s || undefined);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    loadData(search);
  };

  const openNew = () => {
    setEditing(null);
    const initial = {};
    formFields.forEach((f) => { initial[f.key] = f.default || ''; });
    setForm(initial);
    setShowForm(true);
    setError('');
  };

  const openEdit = (item) => {
    setEditing(item);
    const initial = {};
    formFields.forEach((f) => { initial[f.key] = item[f.key] ?? ''; });
    setForm(initial);
    setShowForm(true);
    setError('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await update(editing[columns[0].key], form);
      } else {
        await create(form);
      }
      setShowForm(false);
      loadData(search);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (deleting) return;
    const id = item[columns[0].key];
    if (confirmDelete) {
      setDeleting(true);
      try {
        await confirmDelete(id, item);
        loadData(search);
      } catch (err) {
        if (err && err.message !== 'cancelado') alert(err.message);
      } finally {
        setDeleting(false);
      }
      return;
    }
    if (canDelete && !canDelete(item)) {
      alert('No se puede eliminar este registro.');
      return;
    }
    if (!window.confirm(`Eliminar registro #${id}?`)) return;
    try {
      await remove(id);
      loadData(search);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
        <button onClick={openNew} className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          + Nuevo
        </button>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={searchPlaceholder || 'Buscar...'}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 max-w-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button type="submit" className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm">Buscar</button>
      </form>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="text-left px-4 py-3 font-medium">{col.label}</th>
              ))}
              <th className="text-left px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={columns.length + 1} className="text-center py-8 text-gray-400">Cargando...</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={columns.length + 1} className="text-center py-8 text-gray-400">Sin registros</td></tr>
            ) : data.map((item) => (
              <tr key={item[columns[0].key]} className="hover:bg-gray-50">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    {col.render ? col.render(item[col.key], item) : item[col.key]}
                  </td>
                ))}
                <td className="px-4 py-3">
                  <button onClick={() => openEdit(item)} className="text-primary-600 hover:text-primary-800 text-xs mr-3">Editar</button>
                  <button onClick={() => handleDelete(item)} className="text-red-500 hover:text-red-700 text-xs">Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">{editing ? 'Editar' : 'Nuevo'} Registro</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded border border-red-200">{error}</div>}
              {formFields.map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                  {field.type === 'select' ? (
                    <select
                      value={form[field.key] || ''}
                      onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required={field.required}
                    >
                      <option value="">Seleccionar...</option>
                      {(field.options || []).map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      value={form[field.key] || ''}
                      onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      rows={3}
                    />
                  ) : (
                    <input
                      type={field.type || 'text'}
                      value={form[field.key] || ''}
                      onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required={field.required}
                      placeholder={field.placeholder || ''}
                    />
                  )}
                </div>
              ))}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
