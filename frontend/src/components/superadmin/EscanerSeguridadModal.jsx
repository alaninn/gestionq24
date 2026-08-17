// =============================================
// Modal "Pruebas de seguridad" (menú hacker) del panel Superadmin.
// Permite escanear un sistema propio (por URL) y ver el informe de
// vulnerabilidades en pantalla. Estética terminal.
// =============================================

import { useState } from 'react';
import api from '../../api/axios';

const COLORES = {
    CRITICA: { chip: 'bg-red-600', text: 'text-red-300', bd: 'border-red-700/60' },
    ALTA: { chip: 'bg-orange-600', text: 'text-orange-300', bd: 'border-orange-700/60' },
    MEDIA: { chip: 'bg-yellow-600', text: 'text-yellow-300', bd: 'border-yellow-700/60' },
    BAJA: { chip: 'bg-blue-600', text: 'text-blue-300', bd: 'border-blue-700/60' },
    INFO: { chip: 'bg-gray-600', text: 'text-gray-300', bd: 'border-gray-700/60' },
    OK: { chip: 'bg-green-600', text: 'text-green-300', bd: 'border-green-800/60' },
};
const ORDEN = ['CRITICA', 'ALTA', 'MEDIA', 'BAJA', 'INFO', 'OK'];

export default function EscanerSeguridadModal({ onCerrar }) {
    const [url, setUrl] = useState(window.location.origin);
    const [fuerzaBruta, setFuerzaBruta] = useState(true);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState('');
    const [res, setRes] = useState(null);

    const escanear = async (e) => {
        e?.preventDefault();
        setError(''); setRes(null); setCargando(true);
        try {
            const r = await api.post('/api/superadmin/escaner', { url, fuerzaBruta }, { timeout: 90000 });
            setRes(r.data);
        } catch (err) {
            setError(err.response?.data?.error || 'No se pudo completar el escaneo.');
        } finally { setCargando(false); }
    };

    const problemas = res ? res.hallazgos.filter(h => h.sev !== 'OK').length : 0;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-3 z-50" onClick={onCerrar}>
            <div className="w-full max-w-3xl bg-[#0b0f0b] border border-green-900/70 rounded-2xl max-h-[92vh] overflow-auto shadow-2xl"
                onClick={(e) => e.stopPropagation()} style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                {/* Barra superior estilo terminal */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-green-900/70 bg-[#0d130d] sticky top-0">
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
                        <span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" />
                        <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
                        <span className="text-green-400 text-sm ml-2">🕵️ pruebas-de-seguridad — escáner</span>
                    </div>
                    <button onClick={onCerrar} className="text-green-500 hover:text-green-300 text-xl leading-none">×</button>
                </div>

                <div className="p-4 space-y-4 text-green-200 text-sm">
                    <p className="text-green-500/80">
                        Escaneá un sistema <b>tuyo</b> y detectá vulnerabilidades. Pruebas no destructivas.
                        <br />Consejo: probá <code className="text-green-300">{window.location.origin}</code> u otro sistema en <code className="text-green-300">http://localhost:PUERTO</code>.
                    </p>

                    <form onSubmit={escanear} className="space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="text-green-500">$</span>
                            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://localhost:3001"
                                className="flex-1 bg-black/60 border border-green-900/70 rounded-lg px-3 py-2 text-green-200 focus:outline-none focus:border-green-500" />
                        </div>
                        <label className="flex items-center gap-2 text-green-400/90 text-xs">
                            <input type="checkbox" checked={fuerzaBruta} onChange={(e) => setFuerzaBruta(e.target.checked)} />
                            Incluir prueba de fuerza bruta (más lenta; puede bloquear usuarios de prueba ~15 min)
                        </label>
                        <button type="submit" disabled={cargando}
                            className="w-full py-2.5 rounded-lg bg-green-700 hover:bg-green-600 text-black font-bold disabled:opacity-60">
                            {cargando ? '⏳ Escaneando… (puede tardar ~30s)' : '▶ Iniciar escaneo'}
                        </button>
                    </form>

                    {error && <div className="px-3 py-2 rounded-lg bg-red-950 border border-red-800 text-red-300">⚠ {error}</div>}

                    {res && (
                        <div className="space-y-3">
                            <div className="border-t border-green-900/70 pt-3">
                                <p className="text-green-400">Objetivo: <span className="text-green-200">{res.objetivo}</span></p>
                                <p className={problemas === 0 ? 'text-green-300' : 'text-orange-300'}>
                                    {problemas === 0 ? '✅ Sin vulnerabilidades detectadas en las pruebas.' : `Se detectaron ${problemas} punto(s) a revisar.`}
                                </p>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {ORDEN.filter(s => res.resumen[s]).map(s => (
                                        <span key={s} className={`text-xs text-white px-2 py-0.5 rounded ${COLORES[s].chip}`}>{s}: {res.resumen[s]}</span>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                {res.hallazgos.map((h, i) => (
                                    <div key={i} className={`rounded-lg border ${COLORES[h.sev].bd} bg-black/40 p-3`}>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] text-white px-1.5 py-0.5 rounded ${COLORES[h.sev].chip}`}>{h.sev}</span>
                                            <span className={`font-semibold ${COLORES[h.sev].text}`}>{h.titulo}</span>
                                        </div>
                                        {h.detalle && <p className="text-green-200/80 text-xs mt-1">{h.detalle}</p>}
                                        {h.recomendacion && <p className="text-green-400/70 text-xs mt-1">→ {h.recomendacion}</p>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
