import { useState, useEffect, useRef } from 'react';
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
    const [tab, setTab] = useState('pedidos');
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

            {/* Tabs — Pedidos es la pantalla principal; Configuración queda al final (se usa una vez). */}
            <div className="flex gap-2 mb-4 flex-wrap items-center">
                {[['pedidos', '🧾 Pedidos'], ['catalogo', '📦 Catálogo'], ['integraciones', '🔗 Integraciones']].map(([id, label]) => (
                    <button key={id} onClick={() => setTab(id)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === id ? 'text-white' : 'bg-white text-gray-600 border'}`}
                        style={tab === id ? { background: 'var(--color-primario)' } : {}}>{label}</button>
                ))}
                <button onClick={() => setTab('config')} title="Configuración de la tienda"
                    className={`ml-auto px-3 py-2 rounded-lg text-sm font-medium border ${tab === 'config' ? 'text-white border-transparent' : 'bg-white text-gray-400 hover:text-gray-600'}`}
                    style={tab === 'config' ? { background: 'var(--color-primario)' } : {}}>⚙️ <span className="hidden sm:inline">Configuración</span></button>
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
const ESTADO_META = {
    pendiente: { label: 'Pendiente', chip: 'bg-amber-100 text-amber-700' },
    confirmado: { label: 'Confirmado', chip: 'bg-blue-100 text-blue-700' },
    en_camino: { label: 'En camino', chip: 'bg-indigo-100 text-indigo-700' },
    entregado: { label: 'Entregado', chip: 'bg-green-100 text-green-700' },
    cancelado: { label: 'Cancelado', chip: 'bg-gray-100 text-gray-500' },
};
// El estado "en_camino" se muestra distinto según el tipo de entrega.
function estadoLabel(estado, tipoEntrega) {
    if (estado === 'en_camino') return tipoEntrega === 'takeaway' ? 'Listo para retirar' : 'En camino';
    return ESTADO_META[estado]?.label || estado;
}
function tiempoRelativo(iso) {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return 'recién';
    if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
    if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
    const d = Math.floor(s / 86400);
    return d === 1 ? 'ayer' : `hace ${d} días`;
}
function esHoy(iso) { return new Date(iso).toDateString() === new Date().toDateString(); }
const soloDigitos = (t) => String(t || '').replace(/\D/g, '');

// Imprime una comanda (ticket) del pedido para la cocina / preparación.
function imprimirComanda(p, subtotal) {
    const items = Array.isArray(p.items_json) ? p.items_json : [];
    const esDelivery = p.tipo_entrega !== 'takeaway';
    const envio = parseFloat(p.costo_envio) || 0;
    const total = esDelivery ? subtotal + envio : subtotal;
    const filas = items.map(it => `<tr><td>${it.cantidad}x</td><td>${it.nombre}</td><td class="r">${fmt(it.subtotal)}</td></tr>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Pedido #${p.id}</title>
      <style>*{font-family:monospace;color:#000}body{width:280px;margin:0 auto;padding:8px}h2{margin:4px 0;text-align:center}table{width:100%;border-collapse:collapse;font-size:12px}td{padding:2px 0}.r{text-align:right}hr{border:none;border-top:1px dashed #000}.tot{font-weight:bold;font-size:14px}.h{font-size:12px}.c{text-align:center}</style></head>
      <body>
        <h2>PEDIDO #${p.id}</h2>
        <div class="h c">${new Date(p.created_at).toLocaleString('es-AR')}</div>
        <hr>
        <div class="h"><b>${p.cliente_nombre || ''} ${p.cliente_apellido || ''}</b></div>
        <div class="h"><b>${esDelivery ? 'DELIVERY' : 'RETIRO EN LOCAL'}</b></div>
        ${esDelivery && p.direccion ? `<div class="h">Dir: ${p.direccion}</div>` : ''}
        <div class="h">Tel: ${p.whatsapp || ''}</div>
        <div class="h">Pago: ${p.metodo_pago === 'transferencia' ? 'Transferencia' : 'Efectivo'}</div>
        ${p.notas ? `<div class="h">Nota: ${p.notas}</div>` : ''}
        <hr>
        <table>${filas}</table>
        <hr>
        <table>
          <tr><td>Subtotal</td><td></td><td class="r">${fmt(subtotal)}</td></tr>
          ${esDelivery && envio > 0 ? `<tr><td>Envio</td><td></td><td class="r">${fmt(envio)}</td></tr>` : ''}
          <tr class="tot"><td>TOTAL</td><td></td><td class="r">${fmt(total)}</td></tr>
        </table>
        <hr>
        <div class="h c">Gracias por tu compra!</div>
        <script>window.onload=function(){window.print();setTimeout(function(){window.close()},300)}</script>
      </body></html>`;
    const w = window.open('', '_blank', 'width=340,height=620');
    if (w) { w.document.write(html); w.document.close(); }
}

const TONOS_STAT = {
    slate: { ic: 'bg-slate-100 text-slate-600', val: 'text-slate-800', ring: 'ring-slate-200/70', glow: 'from-slate-100/60' },
    amber: { ic: 'bg-amber-100 text-amber-600', val: 'text-amber-700', ring: 'ring-amber-200', glow: 'from-amber-100/70' },
    blue: { ic: 'bg-blue-100 text-blue-600', val: 'text-blue-700', ring: 'ring-blue-200/70', glow: 'from-blue-100/60' },
    green: { ic: 'bg-emerald-100 text-emerald-600', val: 'text-emerald-700', ring: 'ring-emerald-200/70', glow: 'from-emerald-100/60' },
};
function MiniStat({ label, valor, icon, tono = 'slate', pulso }) {
    const t = TONOS_STAT[tono] || TONOS_STAT.slate;
    return (
        <div className={`relative rounded-2xl bg-white p-3.5 ring-1 ${t.ring} shadow-sm overflow-hidden`}>
            <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full bg-gradient-to-br ${t.glow} to-transparent blur-xl pointer-events-none`} />
            <div className="relative flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl grid place-items-center text-lg flex-shrink-0 ${t.ic}`}>{icon}</div>
                <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold truncate">{label}</p>
                    <p className={`text-xl font-extrabold leading-tight ${t.val}`}>{valor}</p>
                </div>
                {pulso && <span className="ml-auto w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />}
            </div>
        </div>
    );
}

function Pedidos() {
    const [pedidos, setPedidos] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [filtro, setFiltro] = useState('activos');
    const [sel, setSel] = useState(null); // { pedido, confirmar? }
    const sonido = useRef({ tipo: 'campana', veces: 2 });
    const maxId = useRef(0);
    const primera = useRef(true);

    const cargar = async (silencioso = false) => {
        if (!silencioso) setCargando(true);
        try {
            const r = await api.get('/api/tienda/pedidos');
            const data = r.data || [];
            // Si entró un pedido nuevo mientras miramos la recepción, suena el aviso.
            const top = data.reduce((m, p) => Math.max(m, p.id), 0);
            if (!primera.current && top > maxId.current) reproducirSonido(sonido.current.tipo, sonido.current.veces);
            maxId.current = top;
            primera.current = false;
            setPedidos(data);
            await api.put('/api/tienda/pedidos/marcar-leidos').catch(() => {});
        } finally { if (!silencioso) setCargando(false); }
    };

    useEffect(() => {
        api.get('/api/tienda/pedidos/nuevos')
            .then(r => { sonido.current = { tipo: r.data?.sonido_tipo || 'campana', veces: r.data?.sonido_repeticiones ?? 2 }; })
            .catch(() => {});
        cargar();
        const t = setInterval(() => cargar(true), 18000);
        return () => clearInterval(t);
    }, []);

    const cambiar = async (id, estado, extra = {}) => {
        await api.put(`/api/tienda/pedidos/${id}/estado`, { estado, ...extra });
        setSel(null);
        await cargar(true);
    };

    const pendientes = pedidos.filter(p => p.estado === 'pendiente');
    const enCurso = pedidos.filter(p => p.estado === 'confirmado' || p.estado === 'en_camino');
    const hoy = pedidos.filter(p => esHoy(p.created_at) && p.estado !== 'cancelado');
    const facturadoHoy = pedidos.filter(p => esHoy(p.created_at) && p.estado === 'entregado').reduce((a, p) => a + (parseFloat(p.total) || 0), 0);

    const FILTROS = [
        ['activos', 'Activos', pendientes.length + enCurso.length],
        ['pendiente', 'Nuevos', pendientes.length],
        ['entregado', 'Entregados', pedidos.filter(p => p.estado === 'entregado').length],
        ['cancelado', 'Cancelados', pedidos.filter(p => p.estado === 'cancelado').length],
        ['todos', 'Todos', pedidos.length],
    ];
    const visibles = pedidos.filter(p => {
        if (filtro === 'todos') return true;
        if (filtro === 'activos') return p.estado === 'pendiente' || p.estado === 'confirmado' || p.estado === 'en_camino';
        return p.estado === filtro;
    });

    if (cargando) return <div className="text-gray-500">Cargando…</div>;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MiniStat label="Pedidos hoy" valor={hoy.length} icon="📦" tono="blue" />
                <MiniStat label="Sin atender" valor={pendientes.length} icon="🔔" tono="amber" pulso={pendientes.length > 0} />
                <MiniStat label="En curso" valor={enCurso.length} icon="⏱️" tono="slate" />
                <MiniStat label="Facturado hoy" valor={fmt(facturadoHoy)} icon="💰" tono="green" />
            </div>

            <div className="flex gap-2 flex-wrap">
                {FILTROS.map(([id, label, n]) => (
                    <button key={id} onClick={() => setFiltro(id)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${filtro === id ? 'text-white border-transparent' : 'bg-white text-gray-600'}`}
                        style={filtro === id ? { background: 'var(--color-primario)' } : {}}>
                        {label}{n > 0 && <span className={filtro === id ? 'opacity-90' : 'text-gray-400'}> ({n})</span>}
                    </button>
                ))}
            </div>

            {visibles.length === 0
                ? <p className="text-gray-400 text-center py-10 bg-white rounded-xl border">No hay pedidos en esta vista.</p>
                : <div className="space-y-3">
                    {visibles.map(p => (
                        <PedidoCard key={p.id} p={p}
                            onVer={() => setSel({ pedido: p })}
                            onEstado={cambiar}
                            onConfirmar={() => (p.tipo_entrega !== 'takeaway' ? setSel({ pedido: p, confirmar: true }) : cambiar(p.id, 'confirmado'))} />
                    ))}
                </div>}

            {sel && <ModalPedido sel={sel} onCerrar={() => setSel(null)} onEstado={cambiar} />}
        </div>
    );
}

function PedidoCard({ p, onVer, onEstado, onConfirmar }) {
    const items = Array.isArray(p.items_json) ? p.items_json : [];
    const nItems = items.reduce((a, it) => a + (parseInt(it.cantidad) || 0), 0);
    const meta = ESTADO_META[p.estado] || ESTADO_META.pendiente;
    const esDelivery = p.tipo_entrega !== 'takeaway';
    const nuevo = p.estado === 'pendiente';
    const wa = soloDigitos(p.whatsapp);
    return (
        <div className={`bg-white rounded-xl border p-4 ${nuevo ? 'ring-2 ring-amber-300' : ''}`}>
            <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-800">#{p.id} · {p.cliente_nombre} {p.cliente_apellido}</span>
                        {nuevo && <span className="text-[10px] font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded animate-pulse">NUEVO</span>}
                    </div>
                    <p className="text-xs text-gray-500">{tiempoRelativo(p.created_at)} · {new Date(p.created_at).toLocaleString('es-AR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded whitespace-nowrap ${meta.chip}`}>{estadoLabel(p.estado, p.tipo_entrega)}</span>
            </div>

            <div className="flex items-center gap-2 mt-2 text-sm flex-wrap">
                <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${esDelivery ? 'bg-indigo-50 text-indigo-700' : 'bg-teal-50 text-teal-700'}`}>{esDelivery ? '🛵 Delivery' : '🏪 Retiro'}</span>
                <span className="text-gray-500">{nItems} art.</span>
                <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-600">{p.metodo_pago === 'transferencia' ? '🏦 Transferencia' : '💵 Efectivo'}</span>
                <span className="ml-auto font-bold text-gray-800">{fmt(p.total)}</span>
            </div>

            {esDelivery && p.direccion && <p className="text-sm text-gray-600 mt-1 truncate">📍 {p.direccion}</p>}

            <div className="flex gap-2 mt-3 flex-wrap items-center">
                <button onClick={onVer} className="px-3 py-1.5 rounded-lg text-xs font-medium border text-gray-700">Ver detalle</button>
                {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg text-white text-xs font-medium" style={{ background: '#25D366' }}>💬 Chat</a>}
                {p.estado === 'pendiente' && <button onClick={onConfirmar} className="px-3 py-1.5 rounded-lg text-white text-xs font-medium bg-blue-600">Confirmar</button>}
                {p.estado === 'confirmado' && <button onClick={() => onEstado(p.id, 'en_camino')} className="px-3 py-1.5 rounded-lg text-white text-xs font-medium bg-indigo-600">{esDelivery ? 'En camino' : 'Listo'}</button>}
                {(p.estado === 'confirmado' || p.estado === 'en_camino') && <button onClick={() => onEstado(p.id, 'entregado')} className="px-3 py-1.5 rounded-lg text-white text-xs font-medium bg-green-600">Entregado</button>}
                {p.estado !== 'cancelado' && p.estado !== 'entregado' && <button onClick={() => { if (confirm('¿Cancelar el pedido? Se devuelve el stock.')) onEstado(p.id, 'cancelado'); }} className="px-3 py-1.5 rounded-lg text-xs font-medium border text-red-500 ml-auto">Cancelar</button>}
            </div>
        </div>
    );
}

function ModalPedido({ sel, onCerrar, onEstado }) {
    const p = sel.pedido;
    const items = Array.isArray(p.items_json) ? p.items_json : [];
    const esDelivery = p.tipo_entrega !== 'takeaway';
    const subtotal = items.reduce((a, it) => a + (parseFloat(it.subtotal) || 0), 0);
    const [envio, setEnvio] = useState(parseFloat(p.costo_envio) > 0 ? String(p.costo_envio) : '');
    const wa = soloDigitos(p.whatsapp);
    const totalConEnvio = subtotal + (parseFloat(envio) || 0);
    const editable = p.estado !== 'entregado' && p.estado !== 'cancelado';
    const confirmar = () => onEstado(p.id, 'confirmado', esDelivery ? { costo_envio: envio === '' ? 0 : envio } : {});

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onCerrar}>
            <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
                <div className="sticky top-0 bg-white p-4 border-b flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-gray-800">Pedido #{p.id}</h3>
                        <p className="text-xs text-gray-500">{new Date(p.created_at).toLocaleString('es-AR')} · {tiempoRelativo(p.created_at)}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${(ESTADO_META[p.estado] || ESTADO_META.pendiente).chip}`}>{estadoLabel(p.estado, p.tipo_entrega)}</span>
                </div>
                <div className="p-4 space-y-3">
                    <div className="rounded-lg border p-3">
                        <p className="font-semibold text-gray-800">{p.cliente_nombre} {p.cliente_apellido}</p>
                        <p className="text-sm mt-1 font-medium">{esDelivery ? '🛵 Delivery' : '🏪 Retiro en el local'}</p>
                        {esDelivery && p.direccion && <p className="text-sm text-gray-600 mt-1">📍 {p.direccion} · <a className="text-blue-600 underline" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.direccion)}`} target="_blank" rel="noreferrer">Ver mapa</a></p>}
                        {wa && <p className="text-sm mt-1">📱 <a className="text-green-600 font-medium" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">{p.whatsapp}</a></p>}
                        <p className="text-sm mt-1">💳 {p.metodo_pago === 'transferencia' ? 'Transferencia' : 'Efectivo (al recibir)'}</p>
                        {p.notas && <p className="text-sm text-gray-600 mt-1">📝 {p.notas}</p>}
                    </div>

                    <div className="rounded-lg border p-3 text-sm">
                        {items.map((it, i) => (
                            <div key={i} className="flex justify-between py-0.5">
                                <span>{it.cantidad}× {it.nombre}</span>
                                <span className="text-gray-500">{fmt(it.subtotal)}</span>
                            </div>
                        ))}
                        <div className="flex justify-between border-t mt-1 pt-1"><span className="text-gray-500">Subtotal</span><span>{fmt(subtotal)}</span></div>
                        {esDelivery && (parseFloat(envio) > 0) && <div className="flex justify-between"><span className="text-gray-500">Envío</span><span>{fmt(parseFloat(envio))}</span></div>}
                        <div className="flex justify-between font-bold text-base mt-1"><span>Total</span><span>{fmt(esDelivery ? totalConEnvio : subtotal)}</span></div>
                    </div>

                    {esDelivery && editable && (
                        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                            <label className="block text-xs font-semibold text-indigo-800 mb-1">Costo del envío</label>
                            <div className="flex items-center gap-2">
                                <span className="text-gray-500">$</span>
                                <input type="number" min="0" className="inp3 flex-1" placeholder="0" value={envio} onChange={(e) => setEnvio(e.target.value)} />
                            </div>
                            <p className="text-[11px] text-indigo-700 mt-1">Se lo informamos al cliente por WhatsApp al confirmar el pedido.</p>
                        </div>
                    )}

                    <div className="flex gap-2 flex-wrap items-center">
                        {p.estado === 'pendiente' && <button onClick={confirmar} className="px-4 py-2 rounded-lg text-white text-sm font-semibold bg-blue-600">Confirmar{esDelivery ? ' con envío' : ''}</button>}
                        {p.estado === 'confirmado' && esDelivery && <button onClick={confirmar} className="px-3 py-2 rounded-lg text-sm font-medium border">Actualizar envío</button>}
                        {p.estado === 'confirmado' && <button onClick={() => onEstado(p.id, 'en_camino')} className="px-4 py-2 rounded-lg text-white text-sm font-semibold bg-indigo-600">{esDelivery ? 'En camino' : 'Marcar listo'}</button>}
                        {(p.estado === 'confirmado' || p.estado === 'en_camino') && <button onClick={() => onEstado(p.id, 'entregado')} className="px-4 py-2 rounded-lg text-white text-sm font-semibold bg-green-600">Entregado</button>}
                        <button onClick={() => imprimirComanda(p, subtotal)} className="px-3 py-2 rounded-lg text-sm font-medium border">🖨️ Imprimir</button>
                        {editable && <button onClick={() => { if (confirm('¿Cancelar el pedido? Se devuelve el stock.')) onEstado(p.id, 'cancelado'); }} className="px-3 py-2 rounded-lg text-sm font-medium border text-red-500 ml-auto">Cancelar</button>}
                    </div>
                </div>
                <style>{`.inp3{padding:0.4rem 0.5rem;border:1px solid #e5e7eb;border-radius:0.4rem;font-size:0.9rem;outline:none;width:100%}`}</style>
            </div>
        </div>
    );
}
