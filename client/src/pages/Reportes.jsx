import { useState, useEffect } from 'react';
import { api } from '../api';

export default function Reportes() {
  const [guias, setGuias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ fecha_desde: '', fecha_hasta: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (params = {}) => {
    setLoading(true);
    try {
      const data = await api.getGuias(params);
      setGuias(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    loadData(filters);
  };

  const totalMonto = guias.reduce((sum, g) => sum + parseFloat(g.monto || 0), 0);
  const totalCantidad = guias.reduce((sum, g) => sum + parseFloat(g.cantidad || 0), 0);
  const totalPeso = guias.reduce((sum, g) => sum + parseFloat(g.peso || 0), 0);

  const porProveedor = {};
  guias.forEach((g) => {
    const key = g.proveedor_nombre || 'Sin proveedor';
    if (!porProveedor[key]) porProveedor[key] = { cantidad: 0, monto: 0, guias: 0 };
    porProveedor[key].cantidad += parseFloat(g.cantidad || 0);
    porProveedor[key].monto += parseFloat(g.monto || 0);
    porProveedor[key].guias++;
  });

  const porChofer = {};
  guias.forEach((g) => {
    if (!g.chofer_nombre) return;
    if (!porChofer[g.chofer_nombre]) porChofer[g.chofer_nombre] = { guias: 0, monto: 0 };
    porChofer[g.chofer_nombre].guias++;
    porChofer[g.chofer_nombre].monto += parseFloat(g.monto || 0);
  });

  const porEstado = { entregado: 0, pendiente: 0 };
  guias.forEach((g) => {
    if (g.fecha_entrega) porEstado.entregado++;
    else porEstado.pendiente++;
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Reportes</h1>

      <div className="flex gap-2 mb-6">
        <input type="date" value={filters.fecha_desde} onChange={(e) => setFilters({ ...filters, fecha_desde: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
        <input type="date" value={filters.fecha_hasta} onChange={(e) => setFilters({ ...filters, fecha_hasta: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
        <button onClick={handleFilter} className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm">Filtrar</button>
        <button onClick={() => { setFilters({ fecha_desde: '', fecha_hasta: '' }); loadData(); }} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm">Limpiar</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow p-5 text-center">
          <div className="text-2xl font-bold text-blue-600">{guias.length}</div>
          <div className="text-sm text-gray-500">Total Guias</div>
        </div>
        <div className="bg-white rounded-xl shadow p-5 text-center">
          <div className="text-2xl font-bold text-green-600">{totalCantidad.toLocaleString()}</div>
          <div className="text-sm text-gray-500">Total Unidades</div>
        </div>
        <div className="bg-white rounded-xl shadow p-5 text-center">
          <div className="text-2xl font-bold text-purple-600">{totalPeso.toLocaleString()}</div>
          <div className="text-sm text-gray-500">Total Peso</div>
        </div>
        <div className="bg-white rounded-xl shadow p-5 text-center">
          <div className="text-2xl font-bold text-amber-600">S/ {totalMonto.toLocaleString()}</div>
          <div className="text-sm text-gray-500">Monto Total</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="font-semibold text-gray-700 mb-4">Resumen por Proveedor</h2>
          {Object.keys(porProveedor).length === 0 ? (
            <p className="text-gray-400 text-sm">Sin datos</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-gray-500 text-xs">
                <tr>
                  <th className="text-left pb-2">Proveedor</th>
                  <th className="text-right pb-2">Guias</th>
                  <th className="text-right pb-2">Cantidad</th>
                  <th className="text-right pb-2">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {Object.entries(porProveedor).sort((a, b) => b[1].monto - a[1].monto).map(([name, data]) => (
                  <tr key={name}>
                    <td className="py-2 truncate max-w-[200px]">{name}</td>
                    <td className="py-2 text-right">{data.guias}</td>
                    <td className="py-2 text-right">{data.cantidad.toLocaleString()}</td>
                    <td className="py-2 text-right font-medium">S/ {data.monto.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="font-semibold text-gray-700 mb-4">Resumen por Chofer</h2>
          {Object.keys(porChofer).length === 0 ? (
            <p className="text-gray-400 text-sm">Sin datos</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-gray-500 text-xs">
                <tr>
                  <th className="text-left pb-2">Chofer</th>
                  <th className="text-right pb-2">Guias</th>
                  <th className="text-right pb-2">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {Object.entries(porChofer).sort((a, b) => b[1].monto - a[1].monto).map(([name, data]) => (
                  <tr key={name}>
                    <td className="py-2">{name}</td>
                    <td className="py-2 text-right">{data.guias}</td>
                    <td className="py-2 text-right font-medium">S/ {data.monto.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-5 mb-8">
        <h2 className="font-semibold text-gray-700 mb-4">Estado de Entregas</h2>
        <div className="flex gap-6">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 bg-green-500 rounded" />
            <span className="text-sm">Entregado: <strong>{porEstado.entregado}</strong></span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 bg-yellow-500 rounded" />
            <span className="text-sm">Pendiente: <strong>{porEstado.pendiente}</strong></span>
          </div>
          <div className="flex-1">
            <div className="h-4 bg-gray-100 rounded-full overflow-hidden flex">
              {guias.length > 0 && (
                <>
                  <div className="h-full bg-green-500" style={{ width: `${(porEstado.entregado / guias.length) * 100}%` }} />
                  <div className="h-full bg-yellow-500" style={{ width: `${(porEstado.pendiente / guias.length) * 100}%` }} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="p-5 border-b">
          <h2 className="font-semibold text-gray-700">Detalle de Guias</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">N Guia</th>
                <th className="text-left px-4 py-3 font-medium">Fecha</th>
                <th className="text-left px-4 py-3 font-medium">Proveedor</th>
                <th className="text-left px-4 py-3 font-medium">Destinatario</th>
                <th className="text-left px-4 py-3 font-medium">Cantidad</th>
                <th className="text-left px-4 py-3 font-medium">Chofer</th>
                <th className="text-left px-4 py-3 font-medium">Monto</th>
                <th className="text-left px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="8" className="text-center py-8 text-gray-400">Cargando...</td></tr>
              ) : guias.length === 0 ? (
                <tr><td colSpan="8" className="text-center py-8 text-gray-400">Sin datos</td></tr>
              ) : guias.map((g) => (
                <tr key={g.id_guia} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-xs font-bold">{g.numero_guia}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{g.fecha?.split('T')[0]}</td>
                  <td className="px-4 py-2 truncate max-w-[120px]">{g.proveedor_nombre}</td>
                  <td className="px-4 py-2 truncate max-w-[120px]">{g.destinatario_nombre}</td>
                  <td className="px-4 py-2">{g.cantidad} {g.unidad}</td>
                  <td className="px-4 py-2">{g.chofer_nombre || '-'}</td>
                  <td className="px-4 py-2">{g.monto ? `S/ ${parseFloat(g.monto).toLocaleString()}` : '-'}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${g.fecha_entrega ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {g.fecha_entrega ? 'Entregado' : 'Pendiente'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
