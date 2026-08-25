import { useState, useEffect } from 'react';
import api from '../../api/axios';

// =============================================
// Configuración de la página de venta (landing) desde el superadmin.
// Permite cambiar el WhatsApp de contacto, los precios y los textos del hero
// sin tocar el código. Los cambios se aplican al instante en la web.
// =============================================
export default function ModalLanding({ onCerrar }) {
    const [cfg, setCfg] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [msg, setMsg] = useState('');

    useEffect(() => {
        api.get('/api/superadmin/landing')
            .then(r => setCfg(r.data))
            .catch(() => setMsg('No se pudo cargar la configuración'))
            .finally(() => setCargando(false));
    }, []);

    const set = (k, v) => setCfg(c => ({ ...c, [k]: v }));

    const guardar = async () => {
        setGuardando(true); setMsg('');
        try {
            await api.put('/api/superadmin/landing', cfg);
            setMsg('✅ Guardado. Los cambios ya se ven en la página.');
            setTimeout(() => setMsg(''), 3500);
        } catch (e) {
            setMsg(e.response?.data?.error || 'Error al guardar');
        } finally { setGuardando(false); }
    };

    const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={onCerrar}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-white">🛒 Página de venta</h3>
                        <p className="text-purple-200 text-xs mt-0.5">Cambiá el WhatsApp, los precios y los textos principales. Se aplican al instante.</p>
                    </div>
                    <button onClick={onCerrar} className="text-white/80 hover:text-white text-2xl leading-none">×</button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {cargando || !cfg ? (
                        <p className="text-center text-gray-400 py-10">Cargando…</p>
                    ) : (
                        <>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">📱 WhatsApp de contacto / ventas</label>
                                <input value={cfg.whatsapp || ''} onChange={e => set('whatsapp', e.target.value)} placeholder="5491162684353" className={inp} />
                                <p className="text-[11px] text-gray-400 mt-1">Con código de país y área, sin “+” ni espacios (ej: 5491162684353). Es el número de todos los botones de WhatsApp de la página.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">💲 Precio Estándar / mes</label>
                                    <input type="number" min="0" step="500" value={cfg.precio_estandar ?? 0} onChange={e => set('precio_estandar', e.target.value)} className={inp} />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">⭐ Precio Premium / mes</label>
                                    <input type="number" min="0" step="500" value={cfg.precio_premium ?? 0} onChange={e => set('precio_premium', e.target.value)} className={inp} />
                                </div>
                            </div>
                            <p className="text-[11px] text-gray-400 -mt-2">Son los mismos precios que en “Planes”. Cambiarlos acá los actualiza en toda la web.</p>

                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Título principal (opcional)</label>
                                <input value={cfg.hero_titulo || ''} onChange={e => set('hero_titulo', e.target.value)} placeholder="Dejalo vacío para usar el título de diseño" className={inp} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Subtítulo (opcional)</label>
                                <textarea rows={2} value={cfg.hero_subtitulo || ''} onChange={e => set('hero_subtitulo', e.target.value)} placeholder="Dejalo vacío para usar el subtítulo de diseño" className={inp} />
                            </div>

                            {msg && <p className="text-sm font-medium text-green-600">{msg}</p>}

                            <div className="flex items-center gap-2 pt-1">
                                <button onClick={guardar} disabled={guardando}
                                    className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-semibold text-sm transition-all shadow disabled:opacity-50">
                                    {guardando ? '⏳ Guardando…' : '💾 Guardar cambios'}
                                </button>
                                <a href="/" target="_blank" rel="noreferrer"
                                    className="py-2.5 px-4 border border-gray-300 rounded-xl font-semibold text-sm text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap">
                                    👁 Ver la página
                                </a>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
