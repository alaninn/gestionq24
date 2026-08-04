import { useAuth } from '../../context/AuthContext';
import { ReportesMovimientos } from './MisNegocios';

// Pantalla de "Movimiento de mercadería" para el usuario común: ver el historial,
// recibir y (desde el POS) enviar. NO muestra la info sensible de los negocios
// (vencimientos, acceder, vincular) — eso queda en "Mis negocios" (solo dueño).
export default function MovimientosMercaderia() {
  const { puedeUsarFuncion } = useAuth();

  if (!puedeUsarFuncion('multinegocio')) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <p className="text-5xl mb-3">🔁</p>
        <h2 className="text-xl font-bold text-gray-700">Función Premium</h2>
        <p className="text-gray-500 mt-2">Los movimientos de mercadería se habilitan desde tu plan.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent">
          🔁 Movimiento de mercadería
        </h2>
        <p className="text-gray-500 text-sm">Enviá, recibí y seguí la mercadería que se mueve entre tus negocios.</p>
      </div>
      <ReportesMovimientos />
    </div>
  );
}
