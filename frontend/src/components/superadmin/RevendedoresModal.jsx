// =============================================
// Modal del panel maestro: gestión de la capa de REVENDEDORES.
// Incluye el interruptor global (encender/apagar la capa), los defaults de
// tokens, y el CRUD de revendedores con carga manual de tokens.
// Autocontenido: usa la instancia api compartida (token de superadmin).
// =============================================

import { useState, useEffect } from 'react';
import api from '../../api/axios';

const inputCls = "w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-orange-500";

export default function RevendedoresModal({ onCerrar }) {
    const [cfg, setCfg] = useState(null);
    const [lista, setLista] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');
    const [exito, setExito] = useState('');
    const [modalRev, setModalRev] = useState(null); // 'nuevo' | {tipo:'editar'|'tokens'|'movs', rev}
    const [guardando, setGuardando] = useState(false);

    const cargar = async () => {
        setCargando(true);
        try {
            const [c, l] = await Promise.all([
                api.get('/api/superadmin/config-sistema'),
                api.get('/api/superadmin/revendedores'),
            ]);
            setCfg(c.data);
            setLista(l.data);
        } catch (e) {
            setError('No se pudo cargar la información de revendedores.');
        } finally { setCargando(false); }
    };
    useEffect(() => { cargar(); }, []);

    const guardarConfig = async (cambios) => {
        setGuardando(true); setError(''); setExito('');
        try {
            const res = await api.put('/api/superadmin/config-sistema', cambios);
            setCfg(res.data);
            setExito('Configuración guardada.');
        } catch (e) {
            setError('No se pudo guardar la configuración.');
        } finally { setGuardando(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-3 z-50" onClick={onCerrar}>
            <div className="w-full max-w-4xl bg-gray-900 border border-gray-800 rounded-2xl max-h-[92vh] overflow-auto"
                onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
                    <h3 className="text-lg font-bold text-white">🏷️ Revendedores (marca blanca)</h3>
                    <button onClick={onCerrar} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
                </div>

                <div className="p-5 space-y-5">
                    {error && <div className="px-4 py-2 rounded-lg bg-red-900/40 border border-red-800 text-red-200 text-sm">{error}</div>}
                    {exito && <div className="px-4 py-2 rounded-lg bg-green-900/40 border border-green-800 text-green-200 text-sm">{exito}</div>}

                    {/* Interruptor global + defaults */}
                    {cfg && (
                        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-white font-medium">Capa de revendedores</p>
                                    <p className="text-gray-400 text-sm">
                                        {cfg.revendedores_habilitado
                                            ? 'Activada: los revendedores pueden ingresar y operar.'
                                            : 'Apagada: nada de la capa está disponible (modo seguro).'}
                                    </p>
                                </div>
                                <button
                                    onClick={() => guardarConfig({ revendedores_habilitado: !cfg.revendedores_habilitado })}
                                    disabled={guardando}
                                    className={`px-4 py-2 rounded-lg font-semibold text-sm ${cfg.revendedores_habilitado ? 'bg-green-600 hover:bg-green-500' : 'bg-gray-700 hover:bg-gray-600'} text-white`}>
                                    {cfg.revendedores_habilitado ? '● Activada' : '○ Apagada'}
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-3 mt-4">
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Precio por token (ARS)</label>
                                    <input type="number" className={inputCls} defaultValue={cfg.precio_token}
                                        onBlur={(e) => { const v = parseInt(e.target.value); if (v !== cfg.precio_token) guardarConfig({ precio_token: v }); }} />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Días por token (vencimiento)</label>
                                    <input type="number" className={inputCls} defaultValue={cfg.dias_por_token}
                                        onBlur={(e) => { const v = parseInt(e.target.value); if (v !== cfg.dias_por_token) guardarConfig({ dias_por_token: v }); }} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Lista de revendedores */}
                    <div className="flex items-center justify-between">
                        <h4 className="text-white font-medium">Revendedores</h4>
                        <button onClick={() => setModalRev('nuevo')}
                            className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium">
                            + Nuevo revendedor
                        </button>
                    </div>

                    {cargando ? <p className="text-gray-400">Cargando…</p> : (
                        <div className="bg-gray-800/40 border border-gray-700 rounded-xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-800 text-gray-400 text-left">
                                        <tr>
                                            <th className="px-4 py-2">Revendedor</th>
                                            <th className="px-4 py-2">Tokens</th>
                                            <th className="px-4 py-2">Negocios</th>
                                            <th className="px-4 py-2">Estado</th>
                                            <th className="px-4 py-2 text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-800">
                                        {lista.length === 0 && (
                                            <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No hay revendedores todavía.</td></tr>
                                        )}
                                        {lista.map((r) => (
                                            <tr key={r.id}>
                                                <td className="px-4 py-2">
                                                    <p className="text-white">{r.nombre}</p>
                                                    <p className="text-gray-500 text-xs">{r.email}{r.slug ? ` · /r/${r.slug}` : ''}</p>
                                                </td>
                                                <td className="px-4 py-2 text-orange-400 font-semibold">{r.tokens}</td>
                                                <td className="px-4 py-2 text-gray-300">{r.negocios_activos}/{r.total_negocios}</td>
                                                <td className="px-4 py-2">
                                                    <span className={`px-2 py-0.5 rounded text-xs ${r.activo ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
                                                        {r.activo ? 'Activo' : 'Bloqueado'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <div className="flex gap-1.5 justify-end flex-wrap">
                                                        <button onClick={() => setModalRev({ tipo: 'tokens', rev: r })}
                                                            className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-xs">Tokens</button>
                                                        <button onClick={() => setModalRev({ tipo: 'editar', rev: r })}
                                                            className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-xs">Editar</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {modalRev === 'nuevo' && (
                <FormRevendedor onCerrar={() => setModalRev(null)} onOk={async (msg) => { setModalRev(null); setExito(msg); await cargar(); }} />
            )}
            {modalRev?.tipo === 'editar' && (
                <FormRevendedor rev={modalRev.rev} onCerrar={() => setModalRev(null)} onOk={async (msg) => { setModalRev(null); setExito(msg); await cargar(); }} />
            )}
            {modalRev?.tipo === 'tokens' && (
                <FormTokens rev={modalRev.rev} onCerrar={() => setModalRev(null)} onOk={async (msg) => { setModalRev(null); setExito(msg); await cargar(); }} />
            )}
        </div>
    );
}

// ---------- Alta / edición de revendedor ----------
function FormRevendedor({ rev, onCerrar, onOk }) {
    const edicion = !!rev;
    const [f, setF] = useState({
        nombre: rev?.nombre || '', email: rev?.email || '', password: '',
        tokens: 0, slug: rev?.slug || '', marca_nombre: rev?.marca_nombre || '',
        marca_color: rev?.marca_color || '#f97316', activo: rev?.activo ?? true,
    });
    const [error, setError] = useState('');
    const [cargando, setCargando] = useState(false);
    const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

    const enviar = async (e) => {
        e.preventDefault();
        setError(''); setCargando(true);
        try {
            if (edicion) {
                const body = { nombre: f.nombre, email: f.email, slug: f.slug, marca_nombre: f.marca_nombre, marca_color: f.marca_color, activo: f.activo };
                if (f.password) body.password = f.password;
                await api.put(`/api/superadmin/revendedores/${rev.id}`, body);
                onOk('Revendedor actualizado.');
            } else {
                await api.post('/api/superadmin/revendedores', { ...f, tokens: parseInt(f.tokens) || 0 });
                onOk('Revendedor creado.');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'No se pudo guardar.');
        } finally { setCargando(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-3 z-[60]" onClick={onCerrar}>
            <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-5 max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">{edicion ? 'Editar revendedor' : 'Nuevo revendedor'}</h3>
                    <button onClick={onCerrar} className="text-gray-400 hover:text-white text-xl">×</button>
                </div>
                <form onSubmit={enviar} className="space-y-3">
                    <input className={inputCls} placeholder="Nombre" value={f.nombre} onChange={set('nombre')} required />
                    <input className={inputCls} type="email" placeholder="Email (login del revendedor)" value={f.email} onChange={set('email')} required />
                    <input className={inputCls} type="text" placeholder={edicion ? 'Nueva contraseña (dejar vacío = no cambiar)' : 'Contraseña'} value={f.password} onChange={set('password')} required={!edicion} />
                    {!edicion && (
                        <input className={inputCls} type="number" placeholder="Tokens iniciales" value={f.tokens} onChange={set('tokens')} />
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        <input className={inputCls} placeholder="Enlace (slug)" value={f.slug} onChange={set('slug')} />
                        <div className="flex items-center gap-2">
                            <input type="color" value={f.marca_color} onChange={set('marca_color')} className="h-9 w-12 rounded bg-gray-800 border border-gray-700" />
                            <input className={inputCls} placeholder="Color" value={f.marca_color} onChange={set('marca_color')} />
                        </div>
                    </div>
                    <input className={inputCls} placeholder="Nombre de la marca" value={f.marca_nombre} onChange={set('marca_nombre')} />
                    {edicion && (
                        <label className="flex items-center gap-2 text-sm text-gray-300">
                            <input type="checkbox" checked={f.activo} onChange={(e) => setF({ ...f, activo: e.target.checked })} />
                            Revendedor activo
                        </label>
                    )}
                    {error && <p className="text-red-400 text-sm">{error}</p>}
                    <div className="flex gap-2 justify-end pt-1">
                        <button type="button" onClick={onCerrar} className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm">Cancelar</button>
                        <button type="submit" disabled={cargando} className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm disabled:opacity-60">
                            {cargando ? 'Guardando…' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ---------- Carga manual de tokens + libro ----------
function FormTokens({ rev, onCerrar, onOk }) {
    const [cantidad, setCantidad] = useState('');
    const [obs, setObs] = useState('');
    const [movs, setMovs] = useState([]);
    const [error, setError] = useState('');
    const [cargando, setCargando] = useState(false);

    useEffect(() => {
        api.get(`/api/superadmin/revendedores/${rev.id}/movimientos`).then((r) => setMovs(r.data)).catch(() => {});
    }, [rev.id]);

    const cargar = async (e) => {
        e.preventDefault();
        setError(''); setCargando(true);
        try {
            await api.post(`/api/superadmin/revendedores/${rev.id}/tokens`, { cantidad: parseInt(cantidad), observaciones: obs || null });
            onOk('Tokens actualizados.');
        } catch (err) {
            setError(err.response?.data?.error || 'No se pudo cargar.');
        } finally { setCargando(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-3 z-[60]" onClick={onCerrar}>
            <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-5 max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-1">
                    <h3 className="text-lg font-semibold text-white">Tokens de {rev.nombre}</h3>
                    <button onClick={onCerrar} className="text-gray-400 hover:text-white text-xl">×</button>
                </div>
                <p className="text-gray-400 text-sm mb-4">Saldo actual: <span className="text-orange-400 font-semibold">{rev.tokens}</span></p>
                <form onSubmit={cargar} className="space-y-3">
                    <input className={inputCls} type="number" placeholder="Cantidad (+ carga / - quita)" value={cantidad} onChange={(e) => setCantidad(e.target.value)} required />
                    <input className={inputCls} placeholder="Observaciones (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} />
                    {error && <p className="text-red-400 text-sm">{error}</p>}
                    <div className="flex gap-2 justify-end">
                        <button type="button" onClick={onCerrar} className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm">Cerrar</button>
                        <button type="submit" disabled={cargando} className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm disabled:opacity-60">
                            {cargando ? 'Guardando…' : 'Aplicar'}
                        </button>
                    </div>
                </form>
                <div className="mt-4">
                    <p className="text-gray-400 text-xs mb-2 uppercase tracking-wide">Últimos movimientos</p>
                    <div className="space-y-1 max-h-48 overflow-auto">
                        {movs.length === 0 && <p className="text-gray-600 text-sm">Sin movimientos.</p>}
                        {movs.map((m) => (
                            <div key={m.id} className="flex items-center justify-between text-xs text-gray-400 border-b border-gray-800 pb-1">
                                <span>{new Date(m.fecha).toLocaleDateString('es-AR')} · {m.tipo}</span>
                                <span className={m.cantidad >= 0 ? 'text-green-400' : 'text-red-400'}>{m.cantidad >= 0 ? '+' : ''}{m.cantidad} → {m.saldo_resultante}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
