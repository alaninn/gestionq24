// =============================================
// Aviso de facturas pendientes: ventas cuya facturación falló (típicamente
// porque AFIP estaba caído o en mantenimiento) y siguen sin CAE. El sistema las
// reintenta solo cada 30 minutos; acá el usuario ve cuántas quedan y puede
// reintentar en el momento. Si no hay pendientes, no se muestra nada.
// =============================================

import { useState, useEffect } from 'react';
import api from '../../api/axios';

export default function AvisoFacturasPendientes() {
    const [total, setTotal] = useState(0);
    const [reintentando, setReintentando] = useState(false);
    const [mensaje, setMensaje] = useState('');

    const cargar = async () => {
        try {
            const res = await api.get('/api/arca/pendientes');
            setTotal(res.data.total || 0);
        } catch (e) {
            // Facturación no habilitada o error: no mostramos el aviso.
            setTotal(0);
        }
    };

    useEffect(() => { cargar(); }, []);

    const reintentar = async () => {
        setReintentando(true);
        setMensaje('');
        try {
            const res = await api.post('/api/arca/reintentar');
            setMensaje(res.data.mensaje || 'Reintento realizado.');
            await cargar();
        } catch (e) {
            setMensaje(e.response?.data?.error || 'No se pudo reintentar.');
        } finally {
            setReintentando(false);
        }
    };

    if (!total) return null;

    return (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start gap-3">
                    <span className="text-2xl">🧾</span>
                    <div>
                        <p className="font-semibold text-amber-900">
                            Tenés {total} venta{total > 1 ? 's' : ''} sin facturar
                        </p>
                        <p className="text-sm text-amber-800">
                            Quedaron pendientes porque AFIP no estaba disponible. La venta ya se hizo
                            (como Factura X). El sistema las reintenta solo cada 30 minutos; también
                            podés reintentar ahora.
                        </p>
                        {mensaje && <p className="text-sm text-amber-900 mt-1 font-medium">{mensaje}</p>}
                    </div>
                </div>
                <button
                    onClick={reintentar}
                    disabled={reintentando}
                    className="shrink-0 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-medium px-4 py-2 rounded-lg text-sm whitespace-nowrap">
                    {reintentando ? 'Reintentando…' : 'Reintentar ahora'}
                </button>
            </div>
        </div>
    );
}
