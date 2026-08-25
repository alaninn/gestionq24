import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import apiTienda from '../api/apiTienda';

// =============================================
// Storefront público de la tienda online (cliente final, sin login).
// Tematizado por negocio. Mobile-first. Flujo: catálogo -> carrito -> entrega
// (takeaway/delivery) -> datos+pago -> confirmación (+ aviso por WhatsApp).
// =============================================

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n || 0);

function tinte(hex, a) {
    try {
        const h = (hex || '#f97316').replace('#', '');
        const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
        return `rgba(${r},${g},${b},${a})`;
    } catch { return `rgba(249,115,22,${a})`; }
}

function Placeholder({ nombre, brand }) {
    const letra = (nombre || '?').trim().charAt(0).toUpperCase();
    return (
        <div className="w-full h-full flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${tinte(brand, 0.12)}, ${tinte(brand, 0.26)})` }}>
            <span className="text-4xl font-black" style={{ color: tinte(brand, 0.5) }}>{letra}</span>
        </div>
    );
}

export default function Tienda() {
    const { slug } = useParams();
    const [estado, setEstado] = useState('cargando');
    const [data, setData] = useState(null);
    const [carrito, setCarrito] = useState({});
    const [drawer, setDrawer] = useState(false);
    const [paso, setPaso] = useState('carrito'); // carrito | entrega | datos
    const [form, setForm] = useState({ tipo_entrega: '', cliente_nombre: '', cliente_apellido: '', direccion: '', whatsapp: '', metodo_pago: 'efectivo', notas: '' });
    const [enviando, setEnviando] = useState(false);
    const [errorPedido, setErrorPedido] = useState('');
    const [resultado, setResultado] = useState(null);

    useEffect(() => {
        let vivo = true;
        apiTienda.get(`/api/publico/tienda/${slug}`)
            .then((r) => { if (vivo) { setData(r.data); setEstado('ok'); document.title = r.data?.tienda?.titulo || 'Tienda'; } })
            .catch((e) => { if (vivo) setEstado(e.response?.status === 404 ? 'nodisp' : 'error'); });
        return () => { vivo = false; };
    }, [slug]);

    const t = data?.tienda;
    const brand = t?.color_primario || '#f97316';
    const fondo = t?.color_fondo || '#0b0f1a';
    const texto = t?.color_texto || '#1f2937';

    const items = useMemo(() => Object.values(carrito), [carrito]);
    const totalItems = items.reduce((s, i) => s + i.cantidad, 0);
    const total = items.reduce((s, i) => s + i.prod.precio * i.cantidad, 0);

    const agregar = (prod) => setCarrito((c) => ({ ...c, [prod.id]: { prod, cantidad: (c[prod.id]?.cantidad || 0) + 1 } }));
    const quitar = (id) => setCarrito((c) => {
        const cant = (c[id]?.cantidad || 0) - 1; const n = { ...c };
        if (cant <= 0) delete n[id]; else n[id] = { ...n[id], cantidad: cant };
        return n;
    });

    const abrirDrawer = () => { setPaso('carrito'); setDrawer(true); };

    // Mensaje de WhatsApp con el resumen del pedido (para el aviso al cliente/negocio).
    const armarWhatsapp = (r) => {
        const lineas = items.length ? items.map(i => `• ${i.cantidad}x ${i.prod.nombre} — ${fmt(i.prod.precio * i.cantidad)}`) : [];
        const entrega = form.tipo_entrega === 'takeaway' ? 'Retiro en el local' : `Delivery a: ${form.direccion}`;
        const pago = form.metodo_pago === 'transferencia' ? 'Transferencia' : 'Efectivo';
        const txt = [
            `¡Hola ${t.titulo}! Te hago un pedido 🛒`,
            `Pedido #${r?.pedido_id || ''}`,
            '', ...lineas, '',
            `Total: ${fmt(r?.total ?? total)}`,
            `Entrega: ${entrega}`,
            `Pago: ${pago}`,
            `Cliente: ${form.cliente_nombre} ${form.cliente_apellido}`,
            form.notas ? `Nota: ${form.notas}` : '',
        ].filter(x => x !== null && x !== undefined).join('\n');
        return encodeURIComponent(txt);
    };

    const enviarPedido = async (e) => {
        e.preventDefault();
        setErrorPedido(''); setEnviando(true);
        try {
            const r = await apiTienda.post(`/api/publico/tienda/${slug}/pedido`, {
                ...form,
                items: items.map((i) => ({ producto_id: i.prod.id, cantidad: i.cantidad })),
            });
            // Aviso por WhatsApp: abrimos el chat con el negocio y el pedido listo.
            if (t.whatsapp) {
                const url = `https://wa.me/${String(t.whatsapp).replace(/\D/g, '')}?text=${armarWhatsapp(r.data)}`;
                try { window.open(url, '_blank'); } catch (err) { /* si se bloquea, queda el botón */ }
            }
            setResultado(r.data);
            setCarrito({}); setDrawer(false);
        } catch (err) {
            setErrorPedido(err.response?.data?.error || 'No se pudo enviar el pedido. Probá de nuevo.');
        } finally { setEnviando(false); }
    };

    // ---- Pantallas de estado ----
    if (estado === 'cargando') return <div className="min-h-screen flex items-center justify-center" style={{ background: '#f6f2ec' }}><div className="animate-pulse text-gray-400 text-sm">Cargando tienda…</div></div>;
    if (estado === 'nodisp' || estado === 'error') return (
        <div className="min-h-screen flex flex-col items-center justify-center text-center px-6" style={{ background: '#f6f2ec' }}>
            <div className="text-6xl mb-3">🛍️</div>
            <h1 className="text-xl font-bold text-gray-800">Tienda no disponible</h1>
            <p className="text-gray-500 mt-2 max-w-sm text-sm">Este enlace no está activo o la tienda está cerrada por el momento.</p>
        </div>
    );

    // ---- Éxito ----
    if (resultado) {
        const waUrl = t.whatsapp ? `https://wa.me/${String(t.whatsapp).replace(/\D/g, '')}?text=${armarWhatsapp(resultado)}` : null;
        return (
            <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f6f2ec' }}>
                <div className="w-full max-w-md">
                    <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                        <div className="px-6 py-9 text-center text-white" style={{ background: `linear-gradient(135deg, ${brand}, ${tinte(brand, 0.7)})` }}>
                            <div className="text-6xl mb-2">🎉</div>
                            <h1 className="text-2xl font-black">¡Pedido enviado!</h1>
                            <p className="opacity-90 text-sm mt-1">Pedido #{resultado.pedido_id} · {fmt(resultado.total)}</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-gray-700 text-center text-sm">
                                {resultado.tipo_entrega === 'takeaway' ? 'Retirás tu pedido en el local.' : 'Te avisamos el costo del envío al confirmar tu pedido.'}
                                {' '}El negocio ya lo recibió y se contacta con vos.
                            </p>
                            {resultado.metodo_pago === 'transferencia' && resultado.alias && (
                                <div className="rounded-2xl p-4" style={{ background: tinte(brand, 0.07), border: `1px solid ${tinte(brand, 0.22)}` }}>
                                    <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-1">Para transferir</p>
                                    <p className="text-gray-800">Alias: <b>{resultado.alias}</b></p>
                                    {resultado.titular_cuenta && <p className="text-gray-800">Titular: <b>{resultado.titular_cuenta}</b></p>}
                                </div>
                            )}
                            {waUrl && (
                                <a href={waUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 text-white font-bold py-3.5 rounded-2xl" style={{ background: '#25D366' }}>
                                    <span>💬</span> Enviar mi pedido por WhatsApp
                                </a>
                            )}
                            <button onClick={() => { setResultado(null); setForm(f => ({ ...f, tipo_entrega: '' })); }} className="w-full py-3 rounded-2xl font-semibold text-white" style={{ background: brand }}>Volver a la tienda</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Estilos de fondo de la página (imagen opcional o degradado suave).
    const bgPagina = t.fondo_imagen
        ? { backgroundImage: `linear-gradient(${tinte('#f6f2ec', 0.86)}, ${tinte('#f6f2ec', 0.94)}), url(${t.fondo_imagen})`, backgroundSize: 'cover', backgroundAttachment: 'fixed', backgroundPosition: 'center' }
        : { background: 'radial-gradient(1200px 500px at 50% -10%, ' + tinte(brand, 0.10) + ', transparent), #f6f2ec' };

    const deliveryDisponible = t.mostrar_delivery && t.delivery_abierto;

    return (
        <div className="min-h-screen pb-28" style={{ ...bgPagina, color: texto, fontFamily: "'Hanken Grotesk', system-ui, sans-serif" }}>
            {/* HERO */}
            <header className="relative overflow-hidden text-white"
                style={t.banner
                    ? { backgroundImage: `linear-gradient(180deg, ${tinte(fondo, 0.30)}, ${tinte(fondo, 0.88)}), url(${t.banner})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                    : { background: `linear-gradient(135deg, ${brand}, ${fondo})` }}>
                <div className="max-w-3xl mx-auto px-5 pt-9 pb-11">
                    <div className="flex items-center gap-4">
                        {t.logo
                            ? <img src={t.logo} alt="" className="w-20 h-20 rounded-2xl object-cover border-2 border-white/40 shadow-xl" />
                            : <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center text-3xl font-black border-2 border-white/40">{(t.titulo || 'T').charAt(0)}</div>}
                        <div className="min-w-0">
                            <h1 className="text-2xl sm:text-4xl font-black leading-tight drop-shadow-lg">{t.titulo}</h1>
                            <span className={`inline-block mt-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${t.abierta ? 'bg-green-500/90' : 'bg-red-500/90'}`}>
                                {t.abierta ? '● Abierto ahora' : '● Cerrado'}
                            </span>
                        </div>
                    </div>
                    {t.descripcion && <p className="mt-4 text-white/90 text-sm sm:text-base max-w-xl leading-relaxed">{t.descripcion}</p>}
                </div>
                <div className="h-3 -mb-px" style={{ background: '#f6f2ec', borderTopLeftRadius: '1.5rem', borderTopRightRadius: '1.5rem' }} />
            </header>

            {!t.abierta && (
                <div className="max-w-3xl mx-auto px-5 pt-4">
                    <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-2xl px-4 py-3 text-sm text-center shadow-sm">
                        La tienda está <b>cerrada</b> ahora. Podés mirar el catálogo, pero no se pueden hacer pedidos.
                    </div>
                </div>
            )}

            {/* CATÁLOGO */}
            <main className="max-w-3xl mx-auto px-4 sm:px-5 pt-6">
                {data.catalogo.length === 0 ? (
                    <p className="text-center text-gray-400 py-16">Todavía no hay productos cargados.</p>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                        {data.catalogo.map((p, idx) => {
                            const enCarrito = carrito[p.id]?.cantidad || 0;
                            const bloqueado = !p.comprable || !t.abierta;
                            return (
                                <div key={p.id}
                                    className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow border border-black/5 flex flex-col animate-[aparecer_.4s_ease_both]"
                                    style={{ animationDelay: `${Math.min(idx * 35, 350)}ms` }}>
                                    <div className="aspect-square w-full overflow-hidden bg-gray-50 relative">
                                        {p.foto ? <img src={p.foto} alt={p.nombre} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                            : <Placeholder nombre={p.nombre} brand={brand} />}
                                        {p.sin_stock && <div className="absolute top-2 left-2">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.comprable ? 'bg-amber-500 text-white' : 'bg-gray-800 text-white'}`}>{p.comprable ? 'A pedido' : 'Sin stock'}</span>
                                        </div>}
                                    </div>
                                    <div className="p-3 flex flex-col flex-1">
                                        <h3 className="font-bold text-gray-800 text-sm leading-tight line-clamp-2">{p.nombre}</h3>
                                        {p.descripcion && <p className="text-gray-400 text-xs mt-0.5 line-clamp-2">{p.descripcion}</p>}
                                        <p className="mt-2 font-black text-lg" style={{ color: brand }}>{fmt(p.precio)}</p>
                                        <div className="mt-auto pt-2">
                                            {enCarrito > 0 ? (
                                                <div className="flex items-center justify-between rounded-xl" style={{ background: tinte(brand, 0.1) }}>
                                                    <button onClick={() => quitar(p.id)} className="px-3.5 py-2 text-lg font-black" style={{ color: brand }}>−</button>
                                                    <span className="font-black text-gray-800">{enCarrito}</span>
                                                    <button onClick={() => agregar(p)} disabled={bloqueado} className="px-3.5 py-2 text-lg font-black disabled:opacity-40" style={{ color: brand }}>+</button>
                                                </div>
                                            ) : (
                                                <button onClick={() => agregar(p)} disabled={bloqueado}
                                                    className="w-full py-2 rounded-xl text-white text-sm font-bold disabled:opacity-40 transition-transform active:scale-95"
                                                    style={{ background: brand }}>
                                                    {p.comprable ? 'Agregar' : 'Sin stock'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                <p className="text-center text-gray-400/70 text-xs mt-10 mb-4">🛒 {data.negocio?.nombre} · Tienda online</p>
            </main>

            {/* BARRA CARRITO */}
            {totalItems > 0 && !drawer && (
                <div className="fixed bottom-0 inset-x-0 p-3 sm:p-4 z-30">
                    <button onClick={abrirDrawer}
                        className="max-w-3xl mx-auto w-full flex items-center justify-between text-white px-5 py-4 rounded-2xl shadow-2xl active:scale-[.99] transition-transform"
                        style={{ background: brand, boxShadow: `0 12px 30px ${tinte(brand, 0.45)}` }}>
                        <span className="flex items-center gap-2 font-bold">
                            <span className="bg-white/25 rounded-full w-7 h-7 flex items-center justify-center text-sm">{totalItems}</span>
                            Ver mi pedido
                        </span>
                        <span className="font-black text-lg">{fmt(total)}</span>
                    </button>
                </div>
            )}

            {/* DRAWER */}
            {drawer && (
                <div className="fixed inset-0 z-40 flex items-end sm:items-center sm:justify-center" onClick={() => !enviando && setDrawer(false)}>
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
                    <div className="relative bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[93vh] overflow-auto animate-[subir_.3s_ease]" onClick={(e) => e.stopPropagation()}>
                        <div className="sticky top-0 bg-white/95 backdrop-blur px-5 py-4 border-b flex items-center justify-between z-10">
                            <div className="flex items-center gap-2">
                                {paso !== 'carrito' && <button onClick={() => setPaso(paso === 'datos' ? 'entrega' : 'carrito')} className="text-gray-400 text-xl">‹</button>}
                                <h2 className="font-black text-gray-800 text-lg">{paso === 'carrito' ? 'Tu pedido' : paso === 'entrega' ? '¿Cómo lo querés?' : 'Tus datos'}</h2>
                            </div>
                            <button onClick={() => setDrawer(false)} className="text-gray-400 text-2xl leading-none">×</button>
                        </div>

                        {/* PASO 1: carrito */}
                        {paso === 'carrito' && (
                            <div className="p-5 space-y-3">
                                {items.length === 0 && <p className="text-center text-gray-400 py-6">Tu carrito está vacío.</p>}
                                {items.map((i) => (
                                    <div key={i.prod.id} className="flex items-center gap-3">
                                        <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-50 flex-shrink-0">
                                            {i.prod.foto ? <img src={i.prod.foto} alt="" className="w-full h-full object-cover" /> : <Placeholder nombre={i.prod.nombre} brand={brand} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-gray-800 text-sm truncate">{i.prod.nombre}</p>
                                            <p className="text-gray-400 text-xs">{fmt(i.prod.precio)} c/u</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => quitar(i.prod.id)} className="w-7 h-7 rounded-full border font-bold" style={{ color: brand, borderColor: tinte(brand, 0.4) }}>−</button>
                                            <span className="w-5 text-center font-bold">{i.cantidad}</span>
                                            <button onClick={() => agregar(i.prod)} className="w-7 h-7 rounded-full border font-bold" style={{ color: brand, borderColor: tinte(brand, 0.4) }}>+</button>
                                        </div>
                                    </div>
                                ))}
                                {items.length > 0 && <>
                                    <div className="flex items-center justify-between pt-3 border-t mt-3">
                                        <span className="text-gray-500">Total</span><span className="font-black text-xl" style={{ color: brand }}>{fmt(total)}</span>
                                    </div>
                                    <button onClick={() => setPaso('entrega')} disabled={!t.abierta} className="w-full py-3.5 rounded-2xl text-white font-bold mt-1 disabled:opacity-50" style={{ background: brand }}>
                                        {t.abierta ? 'Continuar' : 'Tienda cerrada'}
                                    </button>
                                </>}
                            </div>
                        )}

                        {/* PASO 2: entrega */}
                        {paso === 'entrega' && (
                            <div className="p-5 space-y-3">
                                <button onClick={() => { setForm({ ...form, tipo_entrega: 'delivery' }); setPaso('datos'); }} disabled={!deliveryDisponible}
                                    className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-left disabled:opacity-50"
                                    style={{ borderColor: tinte(brand, 0.3) }}>
                                    <span className="text-3xl">🛵</span>
                                    <div className="flex-1">
                                        <p className="font-bold text-gray-800">Delivery</p>
                                        <p className="text-xs text-gray-500">{deliveryDisponible ? 'Te lo llevamos a tu dirección' : 'No disponible en este horario'}</p>
                                    </div>
                                    <span style={{ color: brand }}>›</span>
                                </button>
                                {t.mostrar_takeaway && (
                                    <button onClick={() => { setForm({ ...form, tipo_entrega: 'takeaway' }); setPaso('datos'); }}
                                        className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-left" style={{ borderColor: tinte(brand, 0.3) }}>
                                        <span className="text-3xl">🏪</span>
                                        <div className="flex-1">
                                            <p className="font-bold text-gray-800">Retiro en el local</p>
                                            <p className="text-xs text-gray-500">Pasás a buscarlo</p>
                                        </div>
                                        <span style={{ color: brand }}>›</span>
                                    </button>
                                )}
                                {!deliveryDisponible && !t.mostrar_takeaway && <p className="text-center text-sm text-gray-500 py-4">No hay opciones de entrega disponibles ahora.</p>}
                            </div>
                        )}

                        {/* PASO 3: datos + pago */}
                        {paso === 'datos' && (
                            <form onSubmit={enviarPedido} className="p-5 space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <input required placeholder="Nombre" value={form.cliente_nombre} onChange={(e) => setForm({ ...form, cliente_nombre: e.target.value })} className="input-t" />
                                    <input placeholder="Apellido" value={form.cliente_apellido} onChange={(e) => setForm({ ...form, cliente_apellido: e.target.value })} className="input-t" />
                                </div>
                                <input required placeholder="WhatsApp (para coordinar)" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className="input-t w-full" />
                                {form.tipo_entrega === 'delivery' ? (
                                    <>
                                        <input required placeholder="Dirección de entrega" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} className="input-t w-full" />
                                        <div className="text-xs rounded-xl px-3 py-2" style={{ background: tinte(brand, 0.08), color: '#92400e' }}>
                                            ℹ️ Se te informará el valor del envío al confirmarte el pedido.
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-xs rounded-xl px-3 py-2 bg-gray-50 text-gray-500">🏪 Retirás tu pedido en el local.</div>
                                )}
                                <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">¿Cómo pagás?</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {t.mostrar_efectivo && (
                                            <button type="button" onClick={() => setForm({ ...form, metodo_pago: 'efectivo' })} className="py-3 rounded-xl border-2 font-semibold text-sm" style={form.metodo_pago === 'efectivo' ? { borderColor: brand, background: tinte(brand, 0.08), color: brand } : { borderColor: '#e5e7eb', color: '#6b7280' }}>💵 Efectivo</button>
                                        )}
                                        {t.mostrar_transferencia && (
                                            <button type="button" onClick={() => setForm({ ...form, metodo_pago: 'transferencia' })} className="py-3 rounded-xl border-2 font-semibold text-sm" style={form.metodo_pago === 'transferencia' ? { borderColor: brand, background: tinte(brand, 0.08), color: brand } : { borderColor: '#e5e7eb', color: '#6b7280' }}>🏦 Transferencia</button>
                                        )}
                                    </div>
                                    {form.metodo_pago === 'transferencia' && t.alias_transferencia && <p className="text-xs text-gray-500 mt-2">Alias: <b>{t.alias_transferencia}</b>{t.titular_cuenta ? ` (${t.titular_cuenta})` : ''}. Te lo repetimos al confirmar.</p>}
                                    {form.metodo_pago === 'efectivo' && <p className="text-xs text-gray-500 mt-2">Pagás en efectivo al recibir.</p>}
                                </div>
                                <textarea placeholder="Notas (opcional)" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} className="input-t w-full" rows={2} />
                                {errorPedido && <p className="text-red-500 text-sm">{errorPedido}</p>}
                                <div className="flex items-center justify-between pt-1"><span className="text-gray-500 text-sm">Total</span><span className="font-black text-lg" style={{ color: brand }}>{fmt(total)}</span></div>
                                <button type="submit" disabled={enviando} className="w-full py-3.5 rounded-2xl text-white font-bold disabled:opacity-60" style={{ background: brand }}>
                                    {enviando ? 'Enviando…' : 'Confirmar pedido'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}

            <style>{`
                .input-t { padding: 0.7rem 0.9rem; border-radius: 0.9rem; border: 1px solid #e5e7eb; font-size: 0.95rem; outline: none; background: #fff; width: 100%; }
                .input-t:focus { border-color: ${brand}; box-shadow: 0 0 0 3px ${tinte(brand, 0.15)}; }
                @keyframes aparecer { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
                @keyframes subir { from { transform: translateY(24px); opacity: .6; } to { transform: none; opacity: 1; } }
                .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
            `}</style>
        </div>
    );
}
