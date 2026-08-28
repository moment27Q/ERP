import { useEffect, useState } from 'react';
import { api } from '../api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDashboard()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-8 text-gray-400">Cargando dashboard...</div>;
  if (!stats) return <div className="text-center py-8 text-gray-400">Error al cargar</div>;

  const cards = [
    { label: 'Guias Totales', value: stats.total_guias, color: 'bg-blue-500' },
    { label: 'Guias Hoy', value: stats.guias_hoy, color: 'bg-green-500' },
    { label: 'Guias del Mes', value: stats.guias_mes, color: 'bg-purple-500' },
    { label: 'Monto del Mes', value: `S/ ${stats.monto_mes.toLocaleString()}`, color: 'bg-amber-500' },
    { label: 'Clientes', value: stats.total_clientes, color: 'bg-cyan-500' },
    { label: 'Choferes', value: stats.total_choferes, color: 'bg-indigo-500' },
    { label: 'Estibadores', value: stats.total_estibadores, color: 'bg-pink-500' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl shadow p-5">
            <div className={`${card.color} w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg mb-3`}>
              {typeof card.value === 'string' ? '$' : '#'}
            </div>
            <div className="text-2xl font-bold text-gray-800">{card.value}</div>
            <div className="text-sm text-gray-500 mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="font-semibold text-gray-700 mb-4">Guias por Proveedor (Mes)</h2>
          {stats.guias_por_proveedor.length === 0 ? (
            <p className="text-gray-400 text-sm">Sin datos este mes</p>
          ) : (
            <div className="space-y-3">
              {stats.guias_por_proveedor.map((p) => (
                <div key={p.razon_social} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-700 truncate">{p.razon_social}</div>
                    <div className="mt-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 rounded-full"
                        style={{ width: `${Math.min((parseInt(p.total) / Math.max(...stats.guias_por_proveedor.map((x) => parseInt(x.total)))) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-bold text-gray-600">{p.total}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="font-semibold text-gray-700 mb-4">Guias por Mes</h2>
          {stats.guias_por_mes.length === 0 ? (
            <p className="text-gray-400 text-sm">Sin datos</p>
          ) : (
            <div className="space-y-2">
              {stats.guias_por_mes.map((m) => (
                <div key={m.mes} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-20">{m.mes}</span>
                  <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                    <div
                      className="h-full bg-primary-500 rounded flex items-center pl-2"
                      style={{ width: `${Math.min((parseInt(m.total) / Math.max(...stats.guias_por_mes.map((x) => parseInt(x.total)))) * 100, 100)}%` }}
                    >
                      <span className="text-xs text-white font-medium">{m.total}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
