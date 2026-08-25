import { useState, useEffect } from 'react';
import api from '../api/axios';
import { SONIDOS, reproducirSonido } from '../utils/sonidoTienda';
import { comprimirImagen, PRESETS } from '../utils/imagen';

// =============================================
// Panel de administración de la TIENDA / VENTA ONLINE (admin, premium).
// 3 pestañas: Configuración · Catálogo · Pedidos.
// =============================================

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n || 0);
const DIAS = [['lun', 'Lunes'], ['mar', 'Martes'], ['mie', 'Miércoles'], ['jue', 'Jueves'], ['vie', 'Viernes'], ['sab', 'Sábado'], ['dom', 'Domingo']];

// Comprime la imagen (redimensiona + WebP) según el tipo y devuelve el resultado.
// Así las fotos pesan poquísimo pero se ven bien; no llena el disco ni la RAM.
async function procesarImagen(file, preset, cb) {
    if (!file) return;
    if (file.size > 15_000_000) { alert('La imagen es enorme (más de 15MB). Probá con otra.'); return; }
    const b = await comprimirImagen(file, PRESETS[preset]);
    if (b) cb(b);
}

export default function TiendaAdmin() {
    const [tab, setTab] = useState('config');
    const [cfg, setCfg] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [msg, setMsg] = useState('');

    const cargarCfg = async () => {
        try { const r = await api.get('/api/tienda/config'); setCfg(r.data); }
        catch (e) { setMsg('No se pudo cargar la configuración'); }
        finally { setCargando(false); }
    };
    useEffect(() => { cargarCfg(); }, []);

    const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }));
    const setHorarioCampo = (field, dia, campo, val) => setCfg((c) => {
        const h = { ...(c[field] || {}) };
        h[dia] = { ...(h[dia] || {}), [campo]: val };
        return { ...c, [field]: h };
    });
    const setHorario = (dia, campo, val) => setHorarioCampo('horarios', dia, campo, val);

    const guardar = async () => {
        setGuardando(true); setMsg('');
        try {
            const r = await api.put('/api/tienda/config', cfg);
            setCfg(r.data);
            setMsg('✅ Guardado');
            setTimeout(() => setMsg(''), 2500);
        } catch (err) {
            setMsg(err.response?.data?.error || 'Error al guardar');
        } finally { setGuardando(false); }
    };

    if (cargando) return <div className="p-8 text-gray-500">Cargando…</div>;
    if (!cfg) return <div className="p-8 text-red-500">{msg || 'Error'}</div>;

    const linkPublico = cfg.slug ? `${window.location.origin}/${cfg.slug}` : null;

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-1">
                <h1 className="text-2xl font-bold text-gray-800">🛍️ Tienda Online</h1>
                {msg && <span className="text-sm font-medium text-green-600">{msg}</span>}
            </div>
            <p className="text-gray-500 mb-4">Tu página de ventas para compartir con tus clientes.</p>

            {/* Estado + link */}
            <div className="bg-white rounded-xl border p-4 mb-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded-lg text-sm font-semibold ${cfg.habilitada ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {cfg.habilitada ? '● Tienda activa' : '○ Tienda apagada'}
                    </span>
                    {linkPublico && cfg.habilitada && (
                        <button onClick={() => { navigator.clipboard?.writeText(linkPublico); setMsg('Link copiado'); setTimeout(() => setMsg(''), 2000); }}
                            className="text-sm text-orange-600 hover:underline truncate max-w-[220px]" title={linkPublico}>{linkPublico} 📋</button>
                    )}
                </div>
                <button onClick={() => set('habilitada', !cfg.habilitada)} className={`px-4 py-2 rounded-lg text-sm font-semibold text-white ${cfg.habilitada ? 'bg-gray-500' : 'bg-green-600'}`}>
                    {cfg.habilitada ? 'Apagar' : 'Activar tienda'}
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-4">
                {[['config', '⚙️ Configuración'], ['catalogo', '📦 Catálogo'], ['pedidos', '🧾 Pedidos'], ['integraciones', '🔗 Integraciones']].map(([id, label]) => (
                    <button key={id} onClick={() => setTab(id)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === id ? 'text-white' : 'bg-white text-gray-600 border'}`}
                        style={tab === id ? { background: 'var(--color-primario)' } : {}}>{label}</button>
                ))}
            </div>

            {tab === 'config' && (
                <div className="space-y-4">
                    <Seccion titulo="Datos de la tienda">
                        <Campo label="Enlace público (slug)">
                            <input className="inp" value={cfg.slug || ''} onChange={(e) => set('slug', e.target.value)} placeholder="mi-almacen" />
                            <p className="text-xs text-gray-400 mt-1">Tus clientes entran por: {window.location.origin}/<b>{(cfg.slug || 'mi-almacen')}</b></p>
                        </Campo>
                        <Campo label="Título"><input className="inp" value={cfg.titulo || ''} onChange={(e) => set('titulo', e.target.value)} placeholder="Almacén Don José" /></Campo>
                        <Campo label="Descripción"><textarea className="inp" rows={2} value={cfg.descripcion || ''} onChange={(e) => set('descripcion', e.target.value)} placeholder="Envíos a domicilio de 9 a 21hs" /></Campo>
                        <div className="grid grid-cols-2 gap-3">
                            <Campo label="Logo">
                                <div className="flex items-center gap-2">
                                    {cfg.logo && <img src={cfg.logo} alt="" className="w-12 h-12 rounded-lg object-cover" />}
                                    <input type="file" accept="image/*" onChange={(e) => procesarImagen(e.target.files[0], 'logo', (b) => set('logo', b))} className="text-sm" />
                                </div>
                            </Campo>
                            <Campo label="Banner (fondo del encabezado)">
                                <div className="flex items-center gap-2">
                                    {cfg.banner && <img src={cfg.banner} alt="" className="w-16 h-10 rounded object-cover" />}
                                    <input type="file" accept="image/*" onChange={(e) => procesarImagen(e.target.files[0], 'banner', (b) => set('banner', b))} className="text-sm" />
                                </div>
                            </Campo>
                        </div>
                        <Campo label="Imagen de fondo de la página (opcional)">
                            <div className="flex items-center gap-2">
                                {cfg.fondo_imagen && <img src={cfg.fondo_imagen} alt="" className="w-16 h-10 rounded object-cover" />}
                                <input type="file" accept="image/*" onChange={(e) => procesarImagen(e.target.files[0], 'fondo', (b) => set('fondo_imagen', b))} className="text-sm" />
                                {cfg.fondo_imagen && <button onClick={() => set('fondo_imagen', '')} className="text-xs text-red-500">quitar</button>}
                            </div>
                        </Campo>
                        <div className="grid grid-cols-2 gap-3">
                            <Campo label="Color principal"><input type="color" className="h-10 w-full rounded" value={cfg.color_primario || '#f97316'} onChange={(e) => set('color_primario', e.target.value)} /></Campo>
                            <Campo label="Color de fondo del encabezado"><input type="color" className="h-10 w-full rounded" value={cfg.color_fondo || '#0b0f1a'} onChange={(e) => set('color_fondo', e.target.value)} /></Campo>
                        </div>
                    </Seccion>

                    <Seccion titulo="Horarios">
                        <label className="flex items-center gap-2 text-sm mb-2">
                            <input type="checkbox" checked={cfg.abierta_siempre !== false} onChange={(e) => set('abierta_siempre', e.target.checked)} />
                            Abierta siempre (24hs)
                        </label>
                        {cfg.abierta_siempre === false && (
                            <div className="space-y-1">
                                {DIAS.map(([k, label]) => {
                                    const d = (cfg.horarios || {})[k] || {};
                                    return (
                                        <div key={k} className="flex items-center gap-2 text-sm">
                                            <span className="w-24 text-gray-600">{label}</span>
                                            <label className="flex items-center gap-1 text-gray-500"><input type="checkbox" checked={!!d.cerrado} onChange={(e) => setHorario(k, 'cerrado', e.target.checked)} /> Cerrado</label>
                                            {!d.cerrado && <>
                                                <input type="time" className="inp !py-1 !w-28" value={d.abre || '09:00'} onChange={(e) => setHorario(k, 'abre', e.target.value)} />
                                                <span className="text-gray-400">a</span>
                                                <input type="time" className="inp !py-1 !w-28" value={d.cierra || '21:00'} onChange={(e) => setHorario(k, 'cierra', e.target.value)} />
                                            </>}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Seccion>

                    <Seccion titulo="Entrega">
                        <div className="grid grid-cols-2 gap-3">
                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cfg.mostrar_takeaway !== false} onChange={(e) => set('mostrar_takeaway', e.target.checked)} /> Retiro en el local (takeaway)</label>
                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cfg.mostrar_delivery !== false} onChange={(e) => set('mostrar_delivery', e.target.checked)} /> Delivery (envío a domicilio)</label>
                        </div>
                        {cfg.mostrar_delivery !== false && (
                            <div className="mt-1 border-t pt-2">
                                <label className="flex items-center gap-2 text-sm mb-2">
                                    <input type="checkbox" checked={cfg.delivery_abierto_siempre !== false} onChange={(e) => set('delivery_abierto_siempre', e.target.checked)} />
                                    Delivery disponible en el mismo horario que la tienda
                                </label>
                                {cfg.delivery_abierto_siempre === false && (
                                    <div className="space-y-1">
                                        <p className="text-xs text-gray-400 mb-1">Horario del delivery (el botón se activa/desactiva solo según esto):</p>
                                        {DIAS.map(([k, label]) => {
                                            const d = (cfg.delivery_horarios || {})[k] || {};
                                            return (
                                                <div key={k} className="flex items-center gap-2 text-sm">
                                                    <span className="w-24 text-gray-600">{label}</span>
                                                    <label className="flex items-center gap-1 text-gray-500"><input type="checkbox" checked={!!d.cerrado} onChange={(e) => setHorarioCampo('delivery_horarios', k, 'cerrado', e.target.checked)} /> Sin delivery</label>
                                                    {!d.cerrado && <>
                                                        <input type="time" className="inp !py-1 !w-28" value={d.abre || '10:00'} onChange={(e) => setHorarioCampo('delivery_horarios', k, 'abre', e.target.value)} />
                                                        <span className="text-gray-400">a</span>
                                                        <input type="time" className="inp !py-1 !w-28" value={d.cierra || '23:00'} onChange={(e) => setHorarioCampo('delivery_horarios', k, 'cierra', e.target.value)} />
                                                    </>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </Seccion>

                    <Seccion titulo="Aviso en el POS (sonido)">
                        <p className="text-xs text-gray-400">Cuando llega una venta online, suena en el POS. Elegí el sonido y cuántas veces se repite.</p>
                        <div className="grid grid-cols-2 gap-3 items-end">
                            <Campo label="Sonido">
                                <select className="inp" value={cfg.sonido_tipo || 'campana'} onChange={(e) => set('sonido_tipo', e.target.value)}>
                                    {SONIDOS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                </select>
                            </Campo>
                            <Campo label="Veces que suena">
                                <input type="number" min="1" max="8" className="inp" value={cfg.sonido_repeticiones ?? 2} onChange={(e) => set('sonido_repeticiones', e.target.value)} />
                            </Campo>
                        </div>
                        <button type="button" onClick={() => reproducirSonido(cfg.sonido_tipo || 'campana', cfg.sonido_repeticiones ?? 2)} className="text-sm px-3 py-1.5 rounded-lg border font-medium">▶ Probar sonido</button>
                    </Seccion>

                    <Seccion titulo="Pago y contacto">
                        <div className="grid grid-cols-2 gap-3">
                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cfg.mostrar_efectivo !== false} onChange={(e) => set('mostrar_efectivo', e.target.checked)} /> Aceptar efectivo (paga al recibir)</label>
                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cfg.mostrar_transferencia !== false} onChange={(e) => set('mostrar_transferencia', e.target.checked)} /> Aceptar transferencia</label>
                        </div>
                        {cfg.mostrar_transferencia !== false && (
                            <div className="grid grid-cols-2 gap-3">
                                <Campo label="Alias para transferencias"><input className="inp" value={cfg.alias_transferencia || ''} onChange={(e) => set('alias_transferencia', e.target.value)} placeholder="mi.alias.mp" /></Campo>
                                <Campo label="Titular de la cuenta"><input className="inp" value={cfg.titular_cuenta || ''} onChange={(e) => set('titular_cuenta', e.target.value)} placeholder="Juan Pérez" /></Campo>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                            <Campo label="WhatsApp del negocio"><input className="inp" value={cfg.whatsapp || ''} onChange={(e) => set('whatsapp', e.target.value)} placeholder="3815550000" /></Campo>
                            <Campo label="Recargo online % (opcional)"><input type="number" className="inp" value={cfg.recargo_pct ?? 0} onChange={(e) => set('recargo_pct', e.target.value)} /></Campo>
                        </div>
                        <p className="text-xs text-gray-400">El recargo se suma al precio de venta de todos los productos online (dejalo en 0 para usar el mismo precio del local).</p>
                    </Seccion>

                    <button onClick={guardar} disabled={guardando} className="px-6 py-3 rounded-xl text-white font-semibold disabled:opacity-60" style={{ background: 'var(--color-primario)' }}>
                        {guardando ? 'Guardando…' : 'Guardar configuración'}
                    </button>
                </div>
            )}

            {tab === 'catalogo' && <Catalogo />}
            {tab === 'pedidos' && <Pedidos />}
            {tab === 'integraciones' && <Integraciones />}

            <style>{`.inp{width:100%;padding:0.5rem 0.75rem;border:1px solid #e5e7eb;border-radius:0.5rem;font-size:0.9rem;outline:none}.inp:focus{border-color:var(--color-primario)}`}</style>
        </div>
    );
}

function Seccion({ titulo, children }) {
    return <div className="bg-white rounded-xl border p-4"><h3 className="font-semibold text-gray-700 mb-3">{titulo}</h3><div className="space-y-3">{children}</div></div>;
}
function Campo({ label, children }) {
    return <div><label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>{children}</div>;
}

// ---------------- CATÁLOGO ----------------
function Catalogo() {
    const [cat, setCat] = useState([]);
    const [disp, setDisp] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [agregar, setAgregar] = useState(false);
    const [busca, setBusca] = useState('');

    const cargar = async () => {
        setCargando(true);
        try {
            const [c, d] = await Promise.all([api.get('/api/tienda/catalogo'), api.get('/api/tienda/productos-disponibles')]);
            setCat(c.data); setDisp(d.data);
        } finally { setCargando(false); }
    };
    useEffect(() => { cargar(); }, []);

    const agregarProd = async (p) => { await api.post('/api/tienda/catalogo', { producto_id: p.id }); await cargar(); };
    const quitar = async (id) => { if (confirm('¿Quitar del catálogo online?')) { await api.delete(`/api/tienda/catalogo/${id}`); await cargar(); } };
    const editar = async (id, campos) => { await api.put(`/api/tienda/catalogo/${id}`, campos); await cargar(); };

    if (cargando) return <div className="text-gray-500">Cargando…</div>;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <p className="text-gray-500 text-sm">{cat.length} producto(s) en la tienda</p>
                <button onClick={() => setAgregar(true)} className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: 'var(--color-primario)' }}>+ Agregar productos</button>
            </div>

            {cat.length === 0 && <p className="text-gray-400 text-center py-8 bg-white rounded-xl border">Todavía no agregaste productos. Tocá "Agregar productos" para elegir del stock.</p>}
            <div className="space-y-2">
                {cat.map((c) => <ItemCatalogo key={c.id} c={c} onEditar={editar} onQuitar={quitar} />)}
            </div>

            {agregar && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setAgregar(false)}>
                    <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="sticky top-0 bg-white p-4 border-b flex justify-between items-center">
                            <h3 className="font-bold">Agregar del stock</h3>
                            <button onClick={() => setAgregar(false)} className="text-2xl text-gray-400">×</button>
                        </div>
                        <div className="p-4">
                            <input className="inp w-full mb-3" placeholder="Buscar producto…" value={busca} onChange={(e) => setBusca(e.target.value)} />
                            <div className="space-y-1">
                                {disp.filter(p => p.nombre.toLowerCase().includes(busca.toLowerCase())).map((p) => (
                                    <div key={p.id} className="flex items-center justify-between py-2 border-b">
                                        <div><p className="text-sm font-medium">{p.nombre}</p><p className="text-xs text-gray-400">{fmt(p.precio_venta)} · stock {p.stock}</p></div>
                                        {p.en_catalogo
                                            ? <span className="text-xs text-green-600 font-medium">✓ ya está</span>
                                            : <button onClick={() => agregarProd(p)} className="px-3 py-1 rounded-lg text-white text-xs" style={{ background: 'var(--color-primario)' }}>Agregar</button>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <style>{`.inp{width:100%;padding:0.5rem 0.75rem;border:1px solid #e5e7eb;border-radius:0.5rem;font-size:0.9rem;outline:none}`}</style>
        </div>
    );
}

function ItemCatalogo({ c, onEditar, onQuitar }) {
    const [precio, setPrecio] = useState(c.precio_online ?? '');
    const [desc, setDesc] = useState(c.descripcion ?? '');
    const [foto, setFoto] = useState(c.foto || null);
    const [tocado, setTocado] = useState(false);

    return (
        <div className="bg-white rounded-xl border p-3 flex gap-3 items-start">
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                {foto ? <img src={foto} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300 text-xl">📷</div>}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                    <div><p className="font-semibold text-gray-800 text-sm">{c.nombre}</p><p className="text-xs text-gray-400">Precio local {fmt(c.precio_venta)} · stock {c.stock}</p></div>
                    <div className="flex flex-col items-end gap-1">
                        <label className="flex items-center gap-1 text-xs text-gray-500">
                            <input type="checkbox" checked={c.activo} onChange={(e) => onEditar(c.id, { activo: e.target.checked })} /> Visible
                        </label>
                        <label className="flex items-center gap-1 text-xs text-gray-500" title="Se puede pedir aunque no tengas stock">
                            <input type="checkbox" checked={!!c.permitir_sin_stock} onChange={(e) => onEditar(c.id, { permitir_sin_stock: e.target.checked })} /> Vender sin stock
                        </label>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                    <input className="inp2" type="number" placeholder={`Precio online (${fmt(c.precio_venta)})`} value={precio} onChange={(e) => { setPrecio(e.target.value); setTocado(true); }} />
                    <input type="file" accept="image/*" className="text-xs" onChange={(e) => procesarImagen(e.target.files[0], 'producto', (b) => { setFoto(b); onEditar(c.id, { foto: b }); })} />
                </div>
                <input className="inp2 w-full mt-2" placeholder="Descripción corta" value={desc} onChange={(e) => { setDesc(e.target.value); setTocado(true); }} />
                <div className="flex justify-between mt-2">
                    <button onClick={() => onQuitar(c.id)} className="text-red-500 text-xs">Quitar</button>
                    {tocado && <button onClick={() => { onEditar(c.id, { precio_online: precio === '' ? null : precio, descripcion: desc }); setTocado(false); }} className="text-xs px-3 py-1 rounded text-white" style={{ background: 'var(--color-primario)' }}>Guardar cambios</button>}
                </div>
            </div>
            <style>{`.inp2{padding:0.35rem 0.5rem;border:1px solid #e5e7eb;border-radius:0.4rem;font-size:0.8rem;outline:none}`}</style>
        </div>
    );
}

// ---------------- INTEGRACIONES (WhatsApp) ----------------
function Integraciones() {
    const [st, setSt] = useState(null);
    const [qr, setQr] = useState(null);
    const [vinculando, setVinculando] = useState(false);
    const [msg, setMsg] = useState('');

    const cargar = async () => {
        try { const r = await api.get('/api/whatsapp/status'); setSt(r.data); return r.data; }
        catch { setSt({ status: 'no_disponible' }); }
    };
    useEffect(() => { cargar(); }, []);

    // Mientras vincula: refresca el estado cada 3s y el QR cada 20s hasta conectar.
    useEffect(() => {
        if (!vinculando) return;
        let vivo = true;
        const poll = setInterval(async () => { const s = await cargar(); if (s?.ready) { setVinculando(false); setQr(null); setMsg('✅ WhatsApp vinculado'); } }, 3000);
        const refrescarQr = async () => {
            try { const r = await api.get('/api/whatsapp/qr'); if (vivo) setQr(r.data.qr); }
            catch (e) { if (vivo) setMsg(e.response?.data?.error || 'No se pudo generar el QR'); }
        };
        refrescarQr();
        const qrInt = setInterval(refrescarQr, 20000);
        return () => { vivo = false; clearInterval(poll); clearInterval(qrInt); };
    }, [vinculando]);

    const desconectar = async () => {
        if (!confirm('¿Desvincular WhatsApp?')) return;
        await api.post('/api/whatsapp/disconnect'); setQr(null); setVinculando(false); cargar();
    };
    const toggleNotif = async (v) => { await api.put('/api/whatsapp/config', { notificar_pedidos: v }); setSt(s => ({ ...s, notificar_pedidos: v })); };

    if (!st) return <div className="text-gray-500">Cargando…</div>;
    const conectado = st.ready || st.status === 'connected';

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-xl border p-5">
                <div className="flex items-center gap-3">
                    <span className="text-3xl">💬</span>
                    <div className="flex-1">
                        <h3 className="font-bold text-gray-800">WhatsApp</h3>
                        <p className="text-sm text-gray-500">Avisá a tus clientes automáticamente cuando hacen un pedido o cambia su estado.</p>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${conectado ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {conectado ? '● Vinculado' : st.status === 'no_disponible' ? 'No disponible' : '○ No vinculado'}
                    </span>
                </div>

                {msg && <p className="text-sm text-green-600 mt-3">{msg}</p>}

                {conectado ? (
                    <div className="mt-4 space-y-3">
                        <p className="text-sm text-gray-700">Número vinculado: <b>{st.numero || '—'}</b></p>
                        <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={st.notificar_pedidos !== false} onChange={(e) => toggleNotif(e.target.checked)} />
                            Enviar avisos automáticos a los clientes de la tienda
                        </label>
                        <button onClick={desconectar} className="px-4 py-2 rounded-lg text-sm font-medium border text-red-500">Desvincular</button>
                    </div>
                ) : (
                    <div className="mt-4">
                        {!vinculando ? (
                            <button onClick={() => { setMsg(''); setVinculando(true); }} disabled={st.status === 'no_disponible'}
                                className="px-5 py-2.5 rounded-lg text-white font-semibold disabled:opacity-50" style={{ background: '#25D366' }}>
                                Vincular WhatsApp
                            </button>
                        ) : (
                            <div className="text-center">
                                <p className="text-sm text-gray-600 mb-3">Abrí WhatsApp en tu celular → <b>Dispositivos vinculados</b> → <b>Vincular dispositivo</b> y escaneá este código:</p>
                                {qr
                                    ? <img src={qr} alt="QR WhatsApp" className="mx-auto w-56 h-56 border rounded-xl p-2" />
                                    : <div className="mx-auto w-56 h-56 flex items-center justify-center text-gray-400 border rounded-xl">Generando QR…</div>}
                                <button onClick={() => { setVinculando(false); setQr(null); }} className="mt-3 text-sm text-gray-500">Cancelar</button>
                            </div>
                        )}
                    </div>
                )}
            </div>
            <p className="text-xs text-gray-400">El WhatsApp se conecta como un dispositivo vinculado (igual que WhatsApp Web). Podés desvincularlo cuando quieras desde acá o desde tu teléfono.</p>
        </div>
    );
}

// ---------------- PEDIDOS ----------------
const ESTADOS = { pendiente: ['bg-amber-100 text-amber-700', 'Pendiente'], confirmado: ['bg-blue-100 text-blue-700', 'Confirmado'], entregado: ['bg-green-100 text-green-700', 'Entregado'], cancelado: ['bg-gray-100 text-gray-500', 'Cancelado'] };

function Pedidos() {
    const [pedidos, setPedidos] = useState([]);
    const [cargando, setCargando] = useState(true);

    const cargar = async () => {
        setCargando(true);
        try { const r = await api.get('/api/tienda/pedidos'); setPedidos(r.data); await api.put('/api/tienda/pedidos/marcar-leidos'); }
        finally { setCargando(false); }
    };
    useEffect(() => { cargar(); }, []);

    const cambiar = async (id, estado) => { await api.put(`/api/tienda/pedidos/${id}/estado`, { estado }); await cargar(); };

    if (cargando) return <div className="text-gray-500">Cargando…</div>;
    if (pedidos.length === 0) return <p className="text-gray-400 text-center py-10 bg-white rounded-xl border">Todavía no hay pedidos online.</p>;

    return (
        <div className="space-y-3">
            {pedidos.map((p) => {
                const items = Array.isArray(p.items_json) ? p.items_json : [];
                const [chip, label] = ESTADOS[p.estado] || ESTADOS.pendiente;
                return (
                    <div key={p.id} className="bg-white rounded-xl border p-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="font-bold text-gray-800">{p.cliente_nombre} {p.cliente_apellido}</p>
                                <p className="text-xs text-gray-500">{new Date(p.created_at).toLocaleString('es-AR')} · Pedido #{p.id}</p>
                            </div>
                            <span className={`text-xs font-semibold px-2 py-1 rounded ${chip}`}>{label}</span>
                        </div>
                        <div className="text-sm text-gray-600 mt-2 space-y-0.5">
                            <p className="font-medium">{p.tipo_entrega === 'takeaway' ? '🏪 Retiro en el local' : '🛵 Delivery'}</p>
                            {p.tipo_entrega !== 'takeaway' && p.direccion && <p>📍 {p.direccion}</p>}
                            <p>📱 <a className="text-orange-600" href={`https://wa.me/${String(p.whatsapp).replace(/\D/g, '')}`} target="_blank" rel="noreferrer">{p.whatsapp}</a></p>
                            <p>💳 {p.metodo_pago === 'transferencia' ? 'Transferencia' : 'Efectivo (al recibir)'}</p>
                            {p.notas && <p>📝 {p.notas}</p>}
                        </div>
                        <div className="mt-2 bg-gray-50 rounded-lg p-2 text-sm">
                            {items.map((it, i) => <div key={i} className="flex justify-between"><span>{it.cantidad}× {it.nombre}</span><span className="text-gray-500">{fmt(it.subtotal)}</span></div>)}
                            <div className="flex justify-between font-bold border-t mt-1 pt-1"><span>Total</span><span>{fmt(p.total)}</span></div>
                        </div>
                        <div className="flex gap-2 mt-3 flex-wrap items-center">
                            {p.estado !== 'cancelado' && (
                                <a href={`https://wa.me/${String(p.whatsapp).replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${p.cliente_nombre}! Tu pedido #${p.id} está confirmado ✅. Total: ${fmt(p.total)}. ${p.tipo_entrega === 'takeaway' ? 'Podés pasar a retirarlo.' : 'Te lo enviamos a domicilio.'} ¡Gracias!`)}`}
                                    target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg text-white text-xs font-medium" style={{ background: '#25D366' }}>💬 Avisar al cliente</a>
                            )}
                            {p.estado !== 'cancelado' && p.estado !== 'entregado' && <>
                                {p.estado === 'pendiente' && <button onClick={() => cambiar(p.id, 'confirmado')} className="px-3 py-1.5 rounded-lg text-white text-xs font-medium bg-blue-600">Confirmar</button>}
                                <button onClick={() => cambiar(p.id, 'entregado')} className="px-3 py-1.5 rounded-lg text-white text-xs font-medium bg-green-600">Marcar entregado</button>
                                <button onClick={() => { if (confirm('¿Cancelar el pedido? Se devuelve el stock.')) cambiar(p.id, 'cancelado'); }} className="px-3 py-1.5 rounded-lg text-xs font-medium border text-red-500">Cancelar</button>
                            </>}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
