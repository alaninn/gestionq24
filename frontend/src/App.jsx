import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useTema } from './context/TemaContext';
import Login from './pages/Login';
import POS from './pages/pos';
import Admin from './pages/admin';
import Superadmin from './pages/Superadmin';
import { TemaProvider } from './context/TemaContext';
import { ConectividadProvider } from './context/ConectividadContext';

// Función helper: un usuario puede entrar al panel admin si tiene
// al menos un permiso de módulo, o si es admin/superadmin
function puedeEntrarAdmin(usuario) {
  if (!usuario) return false;
  if (['superadmin', 'admin'].includes(usuario.rol)) return true;
  const permisos = typeof usuario.permisos === 'string'
    ? JSON.parse(usuario.permisos || '{}')
    : (usuario.permisos || {});
  return Object.values(permisos).some(lista => Array.isArray(lista) && lista.length > 0);
}

function redireccionInicio(usuario) {
  if (!usuario) return '/login';
  if (usuario.rol === 'superadmin') return '/superadmin';
  if (puedeEntrarAdmin(usuario)) return '/admin';
  return '/pos';
}

function RutaProtegida({ children, soloSuperadmin = false, requiereAdmin = false }) {
  const { usuario, cargando } = useAuth();
  const { cargado } = useTema();

  if (cargando || !cargado) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-white">Cargando...</p>
      </div>
    );
  }

  if (!usuario) return <Navigate to="/login" replace />;

  // Solo superadmin puede entrar a /superadmin
  if (soloSuperadmin && usuario.rol !== 'superadmin') {
    return <Navigate to={redireccionInicio(usuario)} replace />;
  }

  // Panel admin: requiere ser admin/superadmin O tener al menos un permiso
  if (requiereAdmin && !puedeEntrarAdmin(usuario)) {
    return <Navigate to="/pos" replace />;
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
          ? <Navigate to={redireccionInicio(usuario)} replace />
          : <Login />
      } />

      <Route path="/" element={
        usuario
          ? <Navigate to={redireccionInicio(usuario)} replace />
          : <Navigate to="/login" replace />
      } />

      <Route path="/superadmin" element={
        <RutaProtegida soloSuperadmin>
          <Superadmin />
        </RutaProtegida>
      } />

      <Route path="/pos" element={
        <RutaProtegida>
          <POS />
        </RutaProtegida>
      } />

      <Route path="/admin/*" element={
        <RutaProtegida requiereAdmin>
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
          <ConectividadProvider>
            <AppRoutes />
          </ConectividadProvider>
        </TemaProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;