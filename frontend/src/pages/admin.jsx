import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import Dashboard from '../components/admin/Dashboard';
import Productos from '../components/admin/Productos';
import Categorias from '../components/admin/Categorias';
import Gastos from '../components/admin/Gastos';
import Configuracion from '../components/admin/Configuracion';
import Reportes from '../components/admin/Reportes';
import CuentasCorrientes from '../components/admin/cuentascorrientes';
import ControlCaja from '../components/admin/controlcaja';
import { useAuth } from '../context/AuthContext';
import { useTema } from '../context/TemaContext';
import { useState, useEffect } from 'react';
import api from '../api/axios';
import Usuarios from '../components/admin/Usuarios';

function NombreNegocio() {
  const [nombre, setNombre] = useState('Mi Negocio');
  useEffect(() => {
    api.get('/api/configuracion')
      .then(res => { if (res.data?.nombre_negocio) setNombre(res.data.nombre_negocio); })
      .catch(() => {});
  }, []);
  return <span className="font-bold text-white text-lg">{nombre}</span>;
}

function NavLink({ to, icon, label, exact = false }) {
  const location = useLocation();
  const activo = exact ? location.pathname === to : location.pathname.startsWith(to);
  return (
    <Link to={to}
      style={activo ? { backgroundColor: 'var(--color-primario)' } : {}}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
        activo ? 'text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
      }`}>
      <span className="text-lg">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

function Admin() {
  const navigate = useNavigate();
  const { usuario, logout, tienePermiso } = useAuth();
  const { colorPrimario } = useTema();
  const [menuAbierto, setMenuAbierto] = useState(false);

  return (
    <div className="flex min-h-screen bg-gray-50">

      {menuAbierto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setMenuAbierto(false)} />
      )}

      <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-gray-900 flex flex-col transition-transform duration-300 ${
        menuAbierto ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>

        <div className="p-5 border-b border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
              style={{ backgroundColor: 'var(--color-primario)' }}>
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">SistemasQ24</p>
              <NombreNegocio />
            </div>
          </div>
          <div className="flex items-center gap-2 bg-gray-800 rounded-xl px-3 py-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: 'var(--color-primario)' }}>
              {usuario?.nombre?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-medium truncate">{usuario?.nombre}</p>
              <p className="text-gray-500 text-xs capitalize">{usuario?.rol}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <button onClick={() => { navigate('/pos'); setMenuAbierto(false); }}
            style={{ backgroundColor: 'var(--color-primario)' }}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all duration-200 mb-3">
            <span className="text-lg">🛒</span>
            <span>Punto de Venta</span>
          </button>

          <NavLink to="/admin" icon="📊" label="Dashboard" exact />

          {tienePermiso('productos', 'ver') && (
            <>
              <p className="text-xs text-gray-600 uppercase font-semibold px-4 pt-4 pb-1 tracking-wider">Inventario</p>
              <NavLink to="/admin/productos" icon="📦" label="Productos" />
              <NavLink to="/admin/categorias" icon="🏷️" label="Categorías" />
            </>
          )}

          <p className="text-xs text-gray-600 uppercase font-semibold px-4 pt-4 pb-1 tracking-wider">Finanzas</p>
          <NavLink to="/admin/caja" icon="🏦" label="Control de Caja" />
          {tienePermiso('clientes', 'ver') && (
            <NavLink to="/admin/cuentas-corrientes" icon="👥" label="Cuentas Corrientes" />
          )}

          <p className="text-xs text-gray-600 uppercase font-semibold px-4 pt-4 pb-1 tracking-wider">General</p>
          {tienePermiso('reportes', 'ver') && (
            <NavLink to="/admin/reportes" icon="📈" label="Reportes" />
          )}
          {tienePermiso('gastos', 'ver') && (
            <NavLink to="/admin/gastos" icon="💸" label="Gastos" />
          )}
          {(usuario?.rol === 'admin' || usuario?.rol === 'superadmin') && (
            <>
              <NavLink to="/admin/usuarios" icon="👤" label="Usuarios" />
              <NavLink to="/admin/configuracion" icon="⚙️" label="Configuración" />
            </>
          )}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <button onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-red-400 transition-all duration-200">
            <span className="text-lg">🚪</span>
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">

        <div className="lg:hidden bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <button onClick={() => setMenuAbierto(!menuAbierto)}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <div className="w-5 h-0.5 bg-gray-700 mb-1"></div>
            <div className="w-5 h-0.5 bg-gray-700 mb-1"></div>
            <div className="w-5 h-0.5 bg-gray-700"></div>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--color-primario)' }}>
              <span className="text-white font-bold text-xs">S</span>
            </div>
            <span className="font-bold text-gray-800 text-sm">SistemasQ24</span>
          </div>
          <button onClick={() => navigate('/pos')}
            style={{ backgroundColor: 'var(--color-primario)' }}
            className="text-white px-3 py-1.5 rounded-lg text-xs font-medium">
            POS
          </button>
        </div>

        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/productos" element={<Productos />} />
            <Route path="/categorias" element={<Categorias />} />
            <Route path="/gastos" element={<Gastos />} />
            <Route path="/reportes" element={<Reportes />} />
            <Route path="/configuracion" element={<Configuracion />} />
            <Route path="/cuentas-corrientes" element={<CuentasCorrientes />} />
            <Route path="/caja" element={<ControlCaja />} />
            <Route path="/usuarios" element={<Usuarios />} />
          </Routes>
        </main>
      </div>

    </div>
  );
}

export default Admin;