import { useState, useEffect } from 'react';
import apiRevendedor from '../api/apiRevendedor';

// =============================================
// Panel del REVENDEDOR (marca blanca). Autocontenido: maneja su propio login y
// su propio token (token_revendedor), sin tocar la sesión de negocios/superadmin.
// Si la capa de revendedores está apagada, el backend responde 404 y se muestra
// la pantalla de login igual (no expone nada).
// =============================================

function formatoFecha(f) {
    if (!f) return '—';
    try { return new Date(f).toLocaleDateString('es-AR'); } catch { return '—'; }
}

function diasRestantes(f) {
    if (!f) return null;
    const ms = new Date(f).getTime() - Date.now();
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

// ---------- Login del revendedor ----------
function LoginRevendedor({ onLogin }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [cargando, setCargando] = useState(false);

    const enviar = async (e) => {
        e.preventDefault();
        setError(''); setCargando(true);
        try {
            const res = await apiRevendedor.post('/api/auth/login-revendedor', { email, password });
            localStorage.setItem('token_revendedor', res.data.token);
            localStorage.setItem('revendedor_datos', JSON.stringify(res.data.revendedor));
            onLogin();
        } catch (err) {
            setError(err.response?.data?.error || 'No se pudo iniciar sesión');
        } finally { setCargando(false); }
    };

    return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
                <h1 className="text-2xl font-bold text-white text-center">Panel de Revendedor</h1>
                <p className="text-gray-400 text-center mt-1 mb-6 text-sm">Ingresá con tu cuenta de revendedor</p>
                <form onSubmit={enviar} className="space-y-4">
                    <div>
                        <label className="block text-sm text-gray-300 mb-1">Email</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                            className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-orange-500" />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-300 mb-1">Contraseña</label>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                            className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-orange-500" />
                    </div>
                    {error && <p className="text-red-400 text-sm">{error}</p>}
                    <button type="submit" disabled={cargando}
                        className="w-full py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-semibold disabled:opacity-60">
                        {cargando ? 'Ingresando…' : 'Ingresar'}
                    </button>
                </form>
            </div>
        </div>
    );
}

// ---------- Tarjeta de métrica ----------
function Tarjeta({ titulo, valor, color = 'text-white', sub }) {
    return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-gray-400 text-sm">{titulo}</p>
            <p className={`text-3xl font-bold mt-1 ${color}`}>{valor}</p>
            {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
        </div>
    );
}

// ---------- Modal genérico ----------
function Modal({ titulo, children, onCerrar }) {
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={onCerrar}>
            <div className="w-full max-w-lg bg-gray-900 border border-gray-800 rounded-2xl p-6 max-h-[90vh] overflow-auto"
                onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">{titulo}</h3>
                    <button onClick={onCerrar} className="text-gray-400 hover:text-white text-xl leading-none">×</button>
                </div>
                {children}
            </div>
        </div>
    );
}

const inputCls = "w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-orange-500";

// ---------- Panel principal ----------
export default function Revendedor() {
    const [autenticado, setAutenticado] = useState(() => !!localStorage.getItem('token_revendedor'));
    const [rev, setRev] = useState(null);
    const [stats, setStats] = useState(null);
    const [negocios, setNegocios] = useState([]);
    const [tokensInfo, setTokensInfo] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [tab, setTab] = useState('negocios');
    const [modal, setModal] = useState(null); // 'crear' | 'marca' | {tipo:'editar', negocio}
    const [aviso, setAviso] = useState('');

    const cargar = async () => {
        setCargando(true);
        try {
            const [meRes, negRes, tokRes] = await Promise.all([
                apiRevendedor.get('/api/revendedor/me'),
                apiRevendedor.get('/api/revendedor/negocios'),
                apiRevendedor.get('/api/revendedor/tokens'),
            ]);
            setRev(meRes.data.revendedor);
            setStats(meRes.data.stats);
            setNegocios(negRes.data);
            setTokensInfo(tokRes.data);
        } catch (err) {
            if (err.response?.status === 401) {
                cerrarSesion();
            } else if (err.response?.status === 404) {
                setAviso('La capa de revendedores no está disponible por ahora.');
            }
        } finally { setCargando(false); }
    };

    useEffect(() => { if (autenticado) cargar(); }, [autenticado]);

    const cerrarSesion = () => {
        localStorage.removeItem('token_revendedor');
        localStorage.removeItem('revendedor_datos');
        setAutenticado(false);
        setRev(null);
    };

    // Impersonar un negocio: reutiliza el panel admin con el token del revendedor.
    const acceder = (negocio) => {
        const tk = localStorage.getItem('token_revendedor');
        localStorage.setItem('token', tk);
        localStorage.setItem('acceso_superadmin_negocio', String(negocio.id));
        localStorage.setItem('impersonacion_revendedor', '1');
        window.location.href = '/admin';
    };

    const comprarTokens = async (cantidad) => {
        try {
            const res = await apiRevendedor.post('/api/revendedor/tokens/comprar', { cantidad });
            if (res.data.init_point) {
                window.location.href = res.data.init_point;
            }
        } catch (err) {
            setAviso(err.response?.data?.error || 'No se pudo iniciar la compra.');
        }
    };

    const renovar = async (negocio) => {
        setAviso('');
        try {
            await apiRevendedor.post(`/api/revendedor/negocios/${negocio.id}/renovar`);
            await cargar();
            setAviso(`"${negocio.nombre}" renovado.`);
        } catch (err) {
            setAviso(err.response?.data?.error || 'No se pudo renovar.');
        }
    };

    if (!autenticado) return <LoginRevendedor onLogin={() => setAutenticado(true)} />;

    const acento = rev?.marca_color || '#f97316';

    return (
        <div className="min-h-screen bg-gray-950 text-gray-100">
            {/* Header */}
            <header className="border-b border-gray-800 bg-gray-900/60 backdrop-blur">
                <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {rev?.marca_logo
                            ? <img src={rev.marca_logo} alt="" className="h-8 w-8 rounded object-cover" />
                            : <div className="h-8 w-8 rounded" style={{ background: acento }} />}
                        <div>
                            <p className="font-semibold leading-tight">{rev?.marca_nombre || rev?.nombre || 'Mi panel'}</p>
                            <p className="text-xs text-gray-400 leading-tight">{rev?.email}</p>
                        </div>
                    </div>
                    <button onClick={cerrarSesion} className="text-sm text-gray-300 hover:text-white">Salir</button>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 py-6">
                {aviso && (
                    <div className="mb-4 px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm flex justify-between">
                        <span>{aviso}</span>
                        <button onClick={() => setAviso('')} className="text-gray-400">×</button>
                    </div>
                )}

                {/* Métricas */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <Tarjeta titulo="Tokens disponibles" valor={rev?.tokens ?? '—'} color="text-orange-400"
                        sub={rev ? `≈ $${((rev.tokens || 0) * (rev.precio_token_efectivo || 0)).toLocaleString('es-AR')}` : ''} />
                    <Tarjeta titulo="Mis negocios" valor={stats?.total_negocios ?? '—'} />
                    <Tarjeta titulo="Activos" valor={stats?.activos ?? '—'} color="text-green-400" />
                    <Tarjeta titulo="Vencidos / bloqueados" valor={stats?.vencidos ?? '—'} color="text-red-400" />
                </div>

                {/* Acciones */}
                <div className="flex flex-wrap gap-2 mb-4">
                    <button onClick={() => setModal('crear')}
                        className="px-4 py-2 rounded-lg text-white font-medium" style={{ background: acento }}>
                        + Crear negocio (1 token)
                    </button>
                    <button onClick={() => comprarTokens(1)}
                        className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 hover:bg-gray-700 text-white font-medium">
                        Comprar tokens
                    </button>
                    <button onClick={() => setModal('marca')}
                        className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 hover:bg-gray-700 text-white font-medium">
                        Mi marca
                    </button>
                    <div className="ml-auto flex gap-2 text-sm">
                        <button onClick={() => setTab('negocios')}
                            className={`px-3 py-2 rounded-lg ${tab === 'negocios' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}>Negocios</button>
                        <button onClick={() => setTab('tokens')}
                            className={`px-3 py-2 rounded-lg ${tab === 'tokens' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}>Movimientos</button>
                    </div>
                </div>

                {cargando && <p className="text-gray-400">Cargando…</p>}

                {/* Tabla de negocios */}
                {!cargando && tab === 'negocios' && (
                    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-800/50 text-gray-400 text-left">
                                    <tr>
                                        <th className="px-4 py-3">Negocio</th>
                                        <th className="px-4 py-3">Estado</th>
                                        <th className="px-4 py-3">Vence</th>
                                        <th className="px-4 py-3">Ventas</th>
                                        <th className="px-4 py-3 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    {negocios.length === 0 && (
                                        <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                            Todavía no creaste ningún negocio.
                                        </td></tr>
                                    )}
                                    {negocios.map((n) => {
                                        const dr = diasRestantes(n.fecha_vencimiento);
                                        const vencido = n.estado === 'vencido' || n.estado === 'bloqueado' || (dr != null && dr < 0);
                                        return (
                                            <tr key={n.id}>
                                                <td className="px-4 py-3">
                                                    <p className="text-white font-medium">{n.nombre}</p>
                                                    <p className="text-gray-500 text-xs">{n.admin_email || n.email}</p>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-0.5 rounded text-xs ${vencido ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'}`}>
                                                        {vencido ? (n.estado === 'bloqueado' ? 'Bloqueado' : 'Vencido') : 'Activo'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-gray-300">
                                                    {formatoFecha(n.fecha_vencimiento)}
                                                    {dr != null && !vencido && <span className="text-gray-500 text-xs"> ({dr}d)</span>}
                                                </td>
                                                <td className="px-4 py-3 text-gray-300">{n.total_ventas}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex gap-2 justify-end">
                                                        <button onClick={() => renovar(n)}
                                                            className="px-2.5 py-1 rounded bg-gray-800 border border-gray-700 hover:bg-gray-700 text-xs">
                                                            Renovar (1 token)
                                                        </button>
                                                        <button onClick={() => setModal({ tipo: 'editar', negocio: n })}
                                                            className="px-2.5 py-1 rounded bg-gray-800 border border-gray-700 hover:bg-gray-700 text-xs">
                                                            Editar
                                                        </button>
                                                        <button onClick={() => acceder(n)}
                                                            className="px-2.5 py-1 rounded text-white text-xs" style={{ background: acento }}>
                                                            Acceder
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Movimientos de tokens */}
                {!cargando && tab === 'tokens' && (
                    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-800/50 text-gray-400 text-left">
                                    <tr>
                                        <th className="px-4 py-3">Fecha</th>
                                        <th className="px-4 py-3">Tipo</th>
                                        <th className="px-4 py-3">Cantidad</th>
                                        <th className="px-4 py-3">Saldo</th>
                                        <th className="px-4 py-3">Detalle</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    {(tokensInfo?.movimientos || []).length === 0 && (
                                        <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Sin movimientos.</td></tr>
                                    )}
                                    {(tokensInfo?.movimientos || []).map((m) => (
                                        <tr key={m.id}>
                                            <td className="px-4 py-3 text-gray-300">{formatoFecha(m.fecha)}</td>
                                            <td className="px-4 py-3 text-gray-300">{m.tipo}</td>
                                            <td className={`px-4 py-3 font-medium ${m.cantidad >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {m.cantidad >= 0 ? '+' : ''}{m.cantidad}
                                            </td>
                                            <td className="px-4 py-3 text-gray-300">{m.saldo_resultante}</td>
                                            <td className="px-4 py-3 text-gray-500">{m.observaciones || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>

            {/* Modales */}
            {modal === 'crear' && (
                <ModalCrearNegocio onCerrar={() => setModal(null)} onCreado={async (msg) => { setModal(null); await cargar(); setAviso(msg); }} setAviso={setAviso} />
            )}
            {modal === 'marca' && rev && (
                <ModalMarca rev={rev} onCerrar={() => setModal(null)} onGuardado={async (msg) => { setModal(null); await cargar(); setAviso(msg); }} />
            )}
            {modal?.tipo === 'editar' && (
                <ModalEditarNegocio negocio={modal.negocio} onCerrar={() => setModal(null)} onGuardado={async (msg) => { setModal(null); await cargar(); setAviso(msg); }} />
            )}
        </div>
    );
}

// ---------- Modal crear negocio ----------
function ModalCrearNegocio({ onCerrar, onCreado, setAviso }) {
    const [f, setF] = useState({ nombre: '', email: '', telefono: '', direccion: '', plan: 'estandar', username_admin: '', password_admin: '' });
    const [error, setError] = useState('');
    const [cargando, setCargando] = useState(false);
    const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

    const crear = async (e) => {
        e.preventDefault();
        setError(''); setCargando(true);
        try {
            await apiRevendedor.post('/api/revendedor/negocios', f);
            onCreado(`Negocio "${f.nombre}" creado. Se descontó 1 token.`);
        } catch (err) {
            setError(err.response?.data?.error || 'No se pudo crear el negocio.');
        } finally { setCargando(false); }
    };

    return (
        <Modal titulo="Crear negocio (usa 1 token)" onCerrar={onCerrar}>
            <form onSubmit={crear} className="space-y-3">
                <input className={inputCls} placeholder="Nombre del negocio" value={f.nombre} onChange={set('nombre')} required />
                <input className={inputCls} type="email" placeholder="Email del negocio (login del dueño)" value={f.email} onChange={set('email')} required />
                <div className="grid grid-cols-2 gap-3">
                    <input className={inputCls} placeholder="Teléfono (opcional)" value={f.telefono} onChange={set('telefono')} />
                    <select className={inputCls} value={f.plan} onChange={set('plan')}>
                        <option value="estandar">Plan estándar</option>
                        <option value="premium">Plan premium</option>
                    </select>
                </div>
                <input className={inputCls} placeholder="Dirección (opcional)" value={f.direccion} onChange={set('direccion')} />
                <div className="grid grid-cols-2 gap-3">
                    <input className={inputCls} placeholder="Usuario admin" value={f.username_admin} onChange={set('username_admin')} required />
                    <input className={inputCls} type="text" placeholder="Contraseña admin" value={f.password_admin} onChange={set('password_admin')} required />
                </div>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <div className="flex gap-2 justify-end pt-2">
                    <button type="button" onClick={onCerrar} className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm">Cancelar</button>
                    <button type="submit" disabled={cargando} className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm disabled:opacity-60">
                        {cargando ? 'Creando…' : 'Crear negocio'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

// ---------- Modal editar negocio ----------
function ModalEditarNegocio({ negocio, onCerrar, onGuardado }) {
    const [f, setF] = useState({ nombre: negocio.nombre || '', telefono: negocio.telefono || '', direccion: negocio.direccion || '', plan: negocio.plan || 'estandar', estado: negocio.estado || 'activo' });
    const [error, setError] = useState('');
    const [cargando, setCargando] = useState(false);
    const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

    const guardar = async (e) => {
        e.preventDefault();
        setError(''); setCargando(true);
        try {
            await apiRevendedor.put(`/api/revendedor/negocios/${negocio.id}`, f);
            onGuardado('Negocio actualizado.');
        } catch (err) {
            setError(err.response?.data?.error || 'No se pudo guardar.');
        } finally { setCargando(false); }
    };

    return (
        <Modal titulo={`Editar: ${negocio.nombre}`} onCerrar={onCerrar}>
            <form onSubmit={guardar} className="space-y-3">
                <input className={inputCls} placeholder="Nombre" value={f.nombre} onChange={set('nombre')} required />
                <div className="grid grid-cols-2 gap-3">
                    <input className={inputCls} placeholder="Teléfono" value={f.telefono} onChange={set('telefono')} />
                    <select className={inputCls} value={f.plan} onChange={set('plan')}>
                        <option value="estandar">Plan estándar</option>
                        <option value="premium">Plan premium</option>
                    </select>
                </div>
                <input className={inputCls} placeholder="Dirección" value={f.direccion} onChange={set('direccion')} />
                <select className={inputCls} value={f.estado} onChange={set('estado')}>
                    <option value="activo">Activo</option>
                    <option value="bloqueado">Bloqueado</option>
                </select>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <div className="flex gap-2 justify-end pt-2">
                    <button type="button" onClick={onCerrar} className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm">Cancelar</button>
                    <button type="submit" disabled={cargando} className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm disabled:opacity-60">
                        {cargando ? 'Guardando…' : 'Guardar'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

// ---------- Modal mi marca ----------
function ModalMarca({ rev, onCerrar, onGuardado }) {
    const [f, setF] = useState({ marca_nombre: rev.marca_nombre || '', marca_color: rev.marca_color || '#f97316', slug: rev.slug || '', marca_logo: rev.marca_logo || '' });
    const [error, setError] = useState('');
    const [cargando, setCargando] = useState(false);
    const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

    const subirLogo = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setF((prev) => ({ ...prev, marca_logo: reader.result }));
        reader.readAsDataURL(file);
    };

    const guardar = async (e) => {
        e.preventDefault();
        setError(''); setCargando(true);
        try {
            await apiRevendedor.put('/api/revendedor/marca', f);
            onGuardado('Marca actualizada.');
        } catch (err) {
            setError(err.response?.data?.error || 'No se pudo guardar la marca.');
        } finally { setCargando(false); }
    };

    return (
        <Modal titulo="Mi marca" onCerrar={onCerrar}>
            <form onSubmit={guardar} className="space-y-3">
                <div>
                    <label className="block text-sm text-gray-300 mb-1">Nombre de tu marca</label>
                    <input className={inputCls} value={f.marca_nombre} onChange={set('marca_nombre')} />
                </div>
                <div>
                    <label className="block text-sm text-gray-300 mb-1">Color principal</label>
                    <div className="flex items-center gap-3">
                        <input type="color" value={f.marca_color} onChange={set('marca_color')} className="h-10 w-14 rounded bg-gray-800 border border-gray-700" />
                        <input className={inputCls} value={f.marca_color} onChange={set('marca_color')} />
                    </div>
                </div>
                <div>
                    <label className="block text-sm text-gray-300 mb-1">Enlace de acceso (slug)</label>
                    <input className={inputCls} value={f.slug} onChange={set('slug')} placeholder="mi-marca" />
                    {f.slug && <p className="text-xs text-gray-500 mt-1">Tus clientes entran por: {window.location.origin}/r/{f.slug}</p>}
                </div>
                <div>
                    <label className="block text-sm text-gray-300 mb-1">Logo</label>
                    <div className="flex items-center gap-3">
                        {f.marca_logo && <img src={f.marca_logo} alt="" className="h-10 w-10 rounded object-cover" />}
                        <input type="file" accept="image/*" onChange={subirLogo} className="text-sm text-gray-400" />
                    </div>
                </div>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <div className="flex gap-2 justify-end pt-2">
                    <button type="button" onClick={onCerrar} className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm">Cancelar</button>
                    <button type="submit" disabled={cargando} className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm disabled:opacity-60">
                        {cargando ? 'Guardando…' : 'Guardar'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
