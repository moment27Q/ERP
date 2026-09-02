import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Choferes from './pages/Choferes';
import Estibadores from './pages/Estibadores';
import Clientes from './pages/Clientes';
import Usuarios from './pages/Usuarios';
import Guias from './pages/Guias';
import GuiasRemitente from './pages/GuiasRemitente';
import DocumentosCobro from './pages/DocumentosCobro';
import Reportes from './pages/Reportes';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-500">Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="guias" element={<Guias />} />
        <Route path="guias-remitente" element={<GuiasRemitente />} />
        <Route path="documentos-cobro" element={<DocumentosCobro />} />
        <Route path="choferes" element={<Choferes />} />
        <Route path="estibadores" element={<Estibadores />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="usuarios" element={<Usuarios />} />
        <Route path="reportes" element={<Reportes />} />
      </Route>
    </Routes>
  );
}
