import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import POS from './pages/pos';
import Admin from './pages/admin';
import Superadmin from './pages/Superadmin';
import { TemaProvider } from './context/TemaContext';


function RutaProtegida({ children, roles }) {
  const { usuario, cargando } = useAuth();

  if (cargando) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-white">Cargando...</p>
      </div>
    );
  }

  if (!usuario) return <Navigate to="/login" replace />;

  if (roles && !roles.includes(usuario.rol)) {
    // Si es cajero o encargado, mandamos al POS directamente
    if (['cajero', 'encargado'].includes(usuario.rol)) {
      return <Navigate to="/pos" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AppRoutes() {
  const { usuario, cargando } = useAuth();

  if (cargando) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-white text-lg">Cargando...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={
        usuario
          ? <Navigate to={usuario.rol === 'superadmin' ? '/superadmin' : '/admin'} replace />
          : <Login />
      } />

      <Route path="/" element={
        usuario
          ? <Navigate to={usuario.rol === 'superadmin' ? '/superadmin' : '/admin'} replace />
          : <Navigate to="/login" replace />
      } />

      <Route path="/superadmin" element={
        <RutaProtegida roles={['superadmin']}>
          <Superadmin />
        </RutaProtegida>
      } />

      <Route path="/pos" element={
        <RutaProtegida roles={['superadmin', 'admin', 'encargado', 'cajero']}>
          <POS />
        </RutaProtegida>
      } />

      <Route path="/admin/*" element={
        <RutaProtegida roles={['superadmin', 'admin', 'encargado']}>
          <Admin />
        </RutaProtegida>
      } />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TemaProvider>
          <AppRoutes />
        </TemaProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;