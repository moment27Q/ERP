import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/guias', label: 'Guias de Remision Transportista' },
  { to: '/guias-remitente', label: 'Guias de Remision Remitente' },
  { to: '/documentos-cobro', label: 'Documentos de Cobro' },
  { to: '/choferes', label: 'Choferes' },
  { to: '/estibadores', label: 'Estibadores' },
  { to: '/clientes', label: 'Clientes' },
  { to: '/usuarios', label: 'Usuarios' },
  { to: '/reportes', label: 'Reportes' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-5 border-b border-slate-700">
          <h1 className="text-xl font-bold tracking-wide">ERP Logistica</h1>
          <p className="text-xs text-slate-400 mt-1">Sistema de Gestion</p>
        </div>
        <nav className="flex-1 py-4 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                  isActive ? 'bg-primary-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-700">
          <div className="text-sm text-slate-300 mb-2">{user?.nombre_completo}</div>
          <div className="text-xs text-slate-500 mb-3">{user?.rol}</div>
          <button
            onClick={handleLogout}
            className="w-full bg-red-600 hover:bg-red-700 text-white text-sm py-2 rounded transition-colors"
          >
            Cerrar Sesion
          </button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b px-6 py-3 flex items-center justify-between">
          <div />
          <div className="text-sm text-gray-500">{user?.rol?.toUpperCase()}</div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
