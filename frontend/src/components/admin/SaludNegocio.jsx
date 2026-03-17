import { useState, useEffect } from 'react';
import api from '../../api/axios';

function SaludNegocio({ esAccesoSuperadmin }) {
  const [salud, setSalud] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    cargarSalud();
    // Recargar cada 5 minutos
    const interval = setInterval(cargarSalud, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const cargarSalud = async () => {
    try {
      const res = await api.get('/api/salud');
      setSalud(res.data);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setCargando(false);
    }
  };

  if (cargando || !salud) return null;

  const { estado, transacciones_hoy, usuarios_activos_hoy, negocio } = salud;

  return (
    <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5 shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <span className="text-2xl">❤️</span> Estado del Sistema
        </h3>
        <span className={`text-sm font-bold px-3 py-1 rounded-full ${
          estado === 'activo' ? 'bg-green-100 text-green-700' :
          estado === 'inactivo' ? 'bg-yellow-100 text-yellow-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {estado === 'activo' ? '✅ Operativo' : 
           estado === 'inactivo' ? '⚠️ Inactivo' :
           '❓ Sin actividad'}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-3 rounded-lg border border-green-100">
          <p className="text-xs text-gray-500">Transacciones Hoy</p>
          <p className="text-2xl font-bold text-gray-800">{transacciones_hoy}</p>
        </div>
        <div className="bg-white p-3 rounded-lg border border-blue-100">
          <p className="text-xs text-gray-500">Usuarios Activos</p>
          <p className="text-2xl font-bold text-gray-800">{usuarios_activos_hoy}</p>
        </div>
        <div className="bg-white p-3 rounded-lg border border-red-100">
          <p className="text-xs text-gray-500">Errores (24h)</p>
          <p className="text-2xl font-bold text-red-600">{negocio?.errores_24h || 0}</p>
        </div>
        <div className="bg-white p-3 rounded-lg border border-purple-100">
          <p className="text-xs text-gray-500">Última Actividad</p>
          <p className="text-sm font-bold text-gray-800">
            {negocio?.ultima_actividad ? 'Hoy' : 'Nunca'}
          </p>
        </div>
      </div>

      {negocio?.errores_24h > 0 && (
        <div className="mt-3 bg-red-100 border border-red-300 rounded-lg p-3">
          <p className="text-sm text-red-700 font-semibold">
            ⚠️ {negocio.errores_24h} errores detectados. Revisa los logs.
          </p>
        </div>
      )}

      {negocio?.dias_sin_actividad > 7 && (
        <div className="mt-3 bg-yellow-100 border border-yellow-300 rounded-lg p-3">
          <p className="text-sm text-yellow-700 font-semibold">
            💾 Sin actividad por {negocio.dias_sin_actividad} días
          </p>
        </div>
      )}

      {esAccesoSuperadmin && (
        <div className="mt-3 bg-purple-100 border border-purple-300 rounded-lg p-3">
          <p className="text-sm text-purple-700 font-semibold">
            👑 Acceso SuperAdmin para {negocio?.nombre}
          </p>
        </div>
      )}
    </div>
  );
}

export default SaludNegocio;
