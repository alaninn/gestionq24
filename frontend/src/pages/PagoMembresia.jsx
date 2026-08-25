import { useState, useEffect } from 'react';
import api from '../api/axios';

// =============================================
// Pantalla de retorno del checkout de Mercado Pago (autopago de la membresía).
// Lee los datos que devuelve Mercado Pago en la URL, confirma el pago contra el
// servidor (que verifica el pago real y reactiva el negocio) y muestra el
// resultado. Ruta pública: sirve tanto para el flujo logueado como el bloqueado.
// =============================================

export default function PagoMembresia() {
  const [estado, setEstado] = useState('verificando'); // verificando | ok | pendiente | error

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const paymentId = q.get('payment_id') || q.get('collection_id');
    const status = q.get('status') || q.get('collection_status') || q.get('estado');

    if (['pending', 'in_process', 'pendiente'].includes(status)) { setEstado('pendiente'); return; }
    if (!paymentId) { setEstado(['ok', 'approved'].includes(status) ? 'pendiente' : 'error'); return; }
    if (status && !['approved', 'ok'].includes(status)) { setEstado('error'); return; }

    api.post('/api/pagos/membresia/confirmar', { payment_id: paymentId })
      .then(r => {
        if (r.data?.ok) setEstado('ok');
        else if (['pending', 'in_process'].includes(r.data?.estado)) setEstado('pendiente');
        else setEstado('error');
      })
      .catch(() => setEstado('error'));
  }, []);

  const V = {
    verificando: { icon: '⏳', color: '#3b82f6', titulo: 'Verificando tu pago…', texto: 'Un segundo, estamos confirmando la operación con Mercado Pago.' },
    ok: { icon: '✅', color: '#16a34a', titulo: '¡Pago acreditado!', texto: 'Tu servicio quedó reactivado. Ya podés ingresar al sistema.' },
    pendiente: { icon: '⌛', color: '#f59e0b', titulo: 'Pago pendiente', texto: 'Tu pago está en proceso. En cuanto Mercado Pago lo apruebe, tu cuenta se reactiva sola (puede tardar unos minutos).' },
    error: { icon: '⚠️', color: '#dc2626', titulo: 'No se pudo confirmar el pago', texto: 'El pago no se completó o fue rechazado. Podés volver a intentarlo desde el aviso de vencimiento.' },
  }[estado];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl ring-1 ring-black/5 max-w-md w-full p-8 text-center animate-aparecer">
        <div className="w-20 h-20 mx-auto rounded-2xl flex items-center justify-center text-4xl" style={{ background: `${V.color}18` }}>
          <span className={estado === 'verificando' ? 'animate-pulse' : ''}>{V.icon}</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mt-5">{V.titulo}</h1>
        <p className="text-gray-500 mt-2 leading-relaxed">{V.texto}</p>
        {estado !== 'verificando' && (
          <button onClick={() => { window.location.href = '/login'; }}
            className="mt-7 w-full text-white font-semibold rounded-xl px-4 py-3 transition-transform hover:scale-[1.02]"
            style={{ background: estado === 'ok' ? '#16a34a' : '#334155' }}>
            {estado === 'ok' ? 'Ingresar al sistema' : 'Volver'}
          </button>
        )}
      </div>
    </div>
  );
}
