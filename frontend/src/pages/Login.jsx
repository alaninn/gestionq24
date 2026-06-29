// =============================================
// ARCHIVO: src/pages/Login.jsx
// FUNCIÓN: Acceso en dos pasos
//   Paso 1 (Acceso del negocio): mail + contraseña → fija el negocio en esta PC.
//   Paso 2 (Login de usuarios): usuario corto + contraseña, scopeado a ese negocio.
// =============================================

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTema } from '../context/TemaContext';

// Inicial del nombre del negocio para el "avatar" de la pantalla 2
const inicial = (txt) => (txt || '?').trim().charAt(0).toUpperCase();

function Login() {
  const { negocioFijado, accederNegocio, login, salirNegocio } = useAuth();
  const { cargarTema } = useTema();
  const navigate = useNavigate();
  // Acceso del superadmin OCULTO (la gente no debe saber que existe):
  //  - tocar 5 veces seguidas la marca del pie, o
  //  - atajo de teclado Ctrl + Shift + Alt + S
  const [modoSuperadmin, setModoSuperadmin] = useState(false);
  const taps = useRef({ n: 0, t: 0 });

  const golpeMarca = () => {
    const now = Date.now();
    if (now - taps.current.t > 1500) taps.current.n = 0;
    taps.current.n += 1;
    taps.current.t = now;
    if (taps.current.n >= 5) { taps.current.n = 0; setModoSuperadmin(true); }
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey && e.shiftKey && e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        setModoSuperadmin(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden"
      style={{ background: 'radial-gradient(1200px 600px at 50% -10%, #1f2937 0%, #0b1120 55%, #060912 100%)' }}>

      {/* Atmósfera de fondo */}
      <div className="pointer-events-none absolute -top-40 -left-32 w-[36rem] h-[36rem] rounded-full blur-3xl opacity-25"
        style={{ background: 'radial-gradient(circle, #10b981 0%, transparent 70%)' }} />
      <div className="pointer-events-none absolute -bottom-40 -right-32 w-[34rem] h-[34rem] rounded-full blur-3xl opacity-20"
        style={{ background: `radial-gradient(circle, ${negocioFijado?.color_primario || '#3b82f6'} 0%, transparent 70%)` }} />

      <div className="relative w-full max-w-md">
        {modoSuperadmin
          ? <SuperadminLogin login={login} cargarTema={cargarTema} navigate={navigate} onVolver={() => setModoSuperadmin(false)} />
          : (negocioFijado
              ? <LoginUsuario negocio={negocioFijado} login={login} cargarTema={cargarTema} navigate={navigate} salirNegocio={salirNegocio} />
              : <AccesoNegocio accederNegocio={accederNegocio} />)}

        {/* Marca del pie = disparador oculto del acceso superadmin (5 toques) */}
        <p onClick={golpeMarca}
          className="text-center text-gray-500 text-xs mt-6 tracking-wide select-none cursor-default">
          gestion<span className="text-gray-400 font-semibold">Q24</span> · sistema de gestión
        </p>
      </div>
    </div>
  );
}

// ---- PASO 1: Acceso del negocio (mail + contraseña) ----
function AccesoNegocio({ accederNegocio }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verPass, setVerPass] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setError(''); setCargando(true);
    try {
      await accederNegocio(email.trim(), password);
      // Al fijar el negocio, el componente padre re-renderiza a la pantalla 2.
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo acceder. Revisá el mail y la contraseña.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-2xl ring-1 ring-black/5 overflow-hidden animate-aparecer">
      <div className="px-8 pt-8 pb-6 text-center border-b border-gray-100">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
          <span className="text-2xl">🏪</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900">Acceso del negocio</h1>
        <p className="text-sm text-gray-500 mt-1">Habilitá este equipo con el mail y la contraseña del negocio.</p>
      </div>

      <form onSubmit={enviar} className="p-8 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl text-sm">{error}</div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Mail del negocio</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">✉️</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus
              autoComplete="username"
              className="w-full border border-gray-300 rounded-xl pl-10 pr-3 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="negocio@mail.com" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Contraseña</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔒</span>
            <input type={verPass ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required
              autoComplete="current-password"
              className="w-full border border-gray-300 rounded-xl pl-10 pr-12 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="••••••••" />
            <button type="button" onClick={() => setVerPass(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm">
              {verPass ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        <button type="submit" disabled={cargando}
          className="w-full bg-gradient-to-br from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white py-3.5 rounded-xl font-bold transition-all shadow-lg shadow-emerald-600/20 active:scale-[0.99]">
          {cargando ? 'Verificando…' : 'Habilitar este equipo'}
        </button>

        <p className="text-[11px] text-gray-400 text-center leading-relaxed pt-1">
          Esto queda guardado en esta computadora. Después, cada usuario entra con su nombre de usuario.
        </p>
      </form>
    </div>
  );
}

// ---- Acceso del superadmin (usuario, sin mail) ----
function SuperadminLogin({ login, cargarTema, navigate, onVolver }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [verPass, setVerPass] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setError(''); setCargando(true);
    try {
      const usuario = await login(username.trim(), password);
      if (usuario.rol !== 'superadmin') {
        setError('Este acceso es solo para el administrador del sistema.');
        setCargando(false);
        return;
      }
      await cargarTema();
      navigate('/superadmin');
    } catch (err) {
      setError(err.response?.data?.error || 'Usuario o contraseña incorrectos');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="bg-gray-900 rounded-3xl shadow-2xl ring-1 ring-white/10 overflow-hidden animate-aparecer">
      <div className="px-8 pt-8 pb-6 text-center border-b border-white/10">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center shadow-lg">
          <span className="text-2xl">👑</span>
        </div>
        <h1 className="text-xl font-bold text-white">Acceso superadmin</h1>
        <p className="text-sm text-gray-400 mt-1">Administración del sistema. Ingresá con tu usuario.</p>
      </div>

      <form onSubmit={enviar} className="p-8 space-y-4">
        {error && (
          <div className="bg-red-500/15 border border-red-500/40 text-red-300 px-4 py-2.5 rounded-xl text-sm">{error}</div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Usuario</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">👤</span>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus
              autoComplete="off"
              className="w-full bg-gray-800 border border-white/10 rounded-xl pl-10 pr-3 py-3 text-white focus:outline-none focus:ring-2 focus:ring-slate-400"
              placeholder="Nombre de usuario" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Contraseña</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔒</span>
            <input type={verPass ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required
              autoComplete="current-password"
              className="w-full bg-gray-800 border border-white/10 rounded-xl pl-10 pr-12 py-3 text-white focus:outline-none focus:ring-2 focus:ring-slate-400"
              placeholder="••••••••" />
            <button type="button" onClick={() => setVerPass(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-sm">
              {verPass ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        <button type="submit" disabled={cargando}
          className="w-full bg-white text-gray-900 hover:bg-gray-100 disabled:opacity-50 py-3.5 rounded-xl font-bold transition-all active:scale-[0.99]">
          {cargando ? 'Ingresando…' : 'Ingresar'}
        </button>

        <div className="pt-1 text-center">
          <button type="button" onClick={onVolver}
            className="text-xs text-gray-500 hover:text-gray-300 underline underline-offset-2">
            ← Volver al acceso del negocio
          </button>
        </div>
      </form>
    </div>
  );
}

// ---- PASO 2: Login de usuarios (usuario + contraseña), atado al negocio ----
function LoginUsuario({ negocio, login, cargarTema, navigate, salirNegocio }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [verPass, setVerPass] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const color = negocio?.color_primario || '#16a34a';

  const enviar = async (e) => {
    e.preventDefault();
    setError(''); setCargando(true);
    try {
      const usuario = await login(username.trim(), password);
      await cargarTema();
      if (usuario.rol === 'superadmin') {
        navigate('/superadmin');
      } else {
        const permisos = typeof usuario.permisos === 'string'
          ? JSON.parse(usuario.permisos || '{}')
          : (usuario.permisos || {});
        const tienePermisoAdmin = ['admin'].includes(usuario.rol) ||
          Object.values(permisos).some(lista => Array.isArray(lista) && lista.length > 0);
        navigate(tienePermisoAdmin ? '/admin' : '/pos');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Usuario o contraseña incorrectos');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-2xl ring-1 ring-black/5 overflow-hidden animate-aparecer">
      {/* Cabecera con la marca del negocio */}
      <div className="px-8 py-7 text-white relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)` }}>
        <div className="absolute -right-8 -top-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-xl font-black flex-shrink-0">
            {inicial(negocio?.nombre)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white/80 text-[11px] uppercase tracking-wider font-semibold">Estás en</p>
            <h1 className="text-lg font-bold leading-tight truncate">{negocio?.nombre || 'Tu negocio'}</h1>
          </div>
          <button type="button" onClick={salirNegocio} title="Salir del negocio"
            className="flex-shrink-0 flex items-center gap-1 bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors whitespace-nowrap">
            ⎋ Salir del negocio
          </button>
        </div>
      </div>

      <form onSubmit={enviar} className="p-8 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl text-sm">{error}</div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Usuario</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">👤</span>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus
              autoComplete="off"
              className="w-full border border-gray-300 rounded-xl pl-10 pr-3 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': color }}
              placeholder="Nombre de usuario" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Contraseña</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔒</span>
            <input type={verPass ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required
              autoComplete="current-password"
              className="w-full border border-gray-300 rounded-xl pl-10 pr-12 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': color }}
              placeholder="••••••••" />
            <button type="button" onClick={() => setVerPass(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm">
              {verPass ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        <button type="submit" disabled={cargando}
          className="w-full text-white py-3.5 rounded-xl font-bold transition-all shadow-lg active:scale-[0.99] disabled:opacity-50"
          style={{ background: color, boxShadow: `0 10px 25px -5px ${color}55` }}>
          {cargando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}

export default Login;
