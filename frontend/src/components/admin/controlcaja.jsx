// =============================================
// ARCHIVO: src/components/admin/ControlCaja.jsx
// =============================================

import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { hoyArgentina, fechaArgentina } from '../../utils/fecha';

const fmt = (n) => new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', minimumFractionDigits: 0
}).format(n || 0);

const fmtFecha = (f) => new Date(f).toLocaleDateString('es-AR', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit'
});

// =============================================
// MODAL: DETALLE DE CIERRE
// =============================================
function ModalDetalleCierre({ turno, onCerrar }) {
  const [pestana, setPestana] = useState('resumen');
  const [gastos, setGastos] = useState([]);
  const [ventas, setVentas] = useState(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      const desde = turno.fecha_apertura.split('T')[0];
      const hasta = turno.fecha_cierre
        ? turno.fecha_cierre.split('T')[0]
        : hoyArgentina();

      const [resVentas, resGastos] = await Promise.all([
        api.get(`/api/reportes/historial?fecha_desde=${desde}&fecha_hasta=${hasta}`),
        api.get(`/api/gastos?fecha_desde=${desde}&fecha_hasta=${hasta}`),
      ]);

      setVentas(resVentas.data);
      // Filtramos gastos del turno específico
      setGastos(resGastos.data.filter(g => g.turno_id === turno.id));
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const totalGastos = gastos.reduce((a, g) => a + parseFloat(g.monto), 0);
  const totalVirtual = parseFloat(turno.ventas_tarjeta || 0)
    + parseFloat(turno.ventas_mp || 0)
    + parseFloat(turno.ventas_transferencia || 0);
  const totalEfectivo = parseFloat(turno.ventas_efectivo || 0);
  const totalFacturado = parseFloat(turno.total_facturado || 0);

  // Arqueo: efectivo esperado
  const efectivoEsperado = parseFloat(turno.inicio_caja || 0)
    + totalEfectivo
    - totalGastos;

  // Total declarado al cierre
  const totalDeclarado = parseFloat(turno.efectivo_retirado || 0)
    + parseFloat(turno.dinero_siguiente || 0);

  const diferencia = totalDeclarado - efectivoEsperado;

  const pestanas = [
    { id: 'resumen', label: '📋 Resumen' },
    { id: 'arqueo', label: '🏦 Arqueo de Caja' },
    { id: 'gastos', label: '💸 Gastos' },
  ];

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-black via-gray-900 to-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col transform transition-all duration-500 hover:scale-105">

        {/* Encabezado */}
        <div className="bg-gradient-to-r from-green-600 via-green-500 to-emerald-600 text-white p-6 flex items-center justify-between flex-shrink-0 shadow-lg">
          <div>
            <h3 className="text-xl font-bold">🏦 Detalle de Cierre</h3>
            <div className="flex items-center gap-3 text-green-100 text-sm mt-2">
              <span>Apertura: {fmtFecha(turno.fecha_apertura)}</span>
              {turno.fecha_cierre && (
                <>
                  <span>•</span>
                  <span>Cierre: {fmtFecha(turno.fecha_cierre)}</span>
                </>
              )}
              <span>•</span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                turno.estado === 'abierto'
                  ? 'bg-green-400 text-white'
                  : 'bg-white text-green-700'
              }`}>
                {turno.estado}
              </span>
            </div>
          </div>
          <button onClick={onCerrar} className="text-green-200 hover:text-white text-3xl transition-all duration-200 hover:scale-110">×</button>
        </div>

        {/* Pestañas */}
        <div className="flex border-b flex-shrink-0 bg-gradient-to-r from-green-50 to-emerald-50">
          {pestanas.map(p => (
            <button key={p.id} onClick={() => setPestana(p.id)}
              className={`flex-1 py-4 px-6 text-sm font-semibold transition-all duration-300 ${
                pestana === p.id
                  ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 rounded-full shadow-md transform scale-105'
                  : 'text-gray-600 hover:text-green-600 hover:bg-white hover:rounded-full hover:shadow-sm'
              }`}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ---- PESTAÑA RESUMEN ---- */}
          {pestana === 'resumen' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 font-medium">Total Ventas</p>
                      <p className="text-3xl font-bold text-green-700 mt-1">{fmt(totalFacturado)}</p>
                      <p className="text-xs text-gray-500 mt-1">{turno.total_ventas} operaciones</p>
                    </div>
                    <div className="text-4xl opacity-20">💰</div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-red-50 to-pink-50 border border-red-200 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 font-medium">Total Gastos</p>
                      <p className="text-3xl font-bold text-red-600 mt-1">{fmt(totalGastos)}</p>
                      <p className="text-xs text-gray-500 mt-1">{gastos.length} gastos</p>
                    </div>
                    <div className="text-4xl opacity-20">💸</div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 font-medium">Ganancia Neta</p>
                      <p className="text-3xl font-bold text-blue-700 mt-1">{fmt(totalFacturado - totalGastos)}</p>
                    </div>
                    <div className="text-4xl opacity-20">📈</div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-gray-50 to-slate-50 border border-gray-200 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 font-medium">Inicio de Caja</p>
                      <p className="text-3xl font-bold text-gray-700 mt-1">{fmt(turno.inicio_caja)}</p>
                    </div>
                    <div className="text-4xl opacity-20">🏦</div>
                  </div>
                </div>
              </div>

              {/* Desglose por método */}
              <div className="bg-gradient-to-r from-white to-gray-50 border border-gray-200 rounded-2xl p-6 shadow-lg">
                <h4 className="font-semibold text-gray-700 mb-4 text-lg flex items-center gap-2">
                  📊 Ventas por Método de Pago
                </h4>
                <div className="space-y-3">
                  {[
                    { label: '💵 Efectivo', valor: turno.ventas_efectivo, color: 'text-green-600' },
                    { label: '💳 Tarjeta', valor: turno.ventas_tarjeta, color: 'text-blue-600' },
                    { label: '📱 Mercado Pago', valor: turno.ventas_mp, color: 'text-purple-600' },
                    { label: '🏦 Transferencia', valor: turno.ventas_transferencia, color: 'text-orange-600' },
                  ].map(m => (
                    parseFloat(m.valor) > 0 && (
                      <div key={m.label} className="flex justify-between items-center py-3 px-4 bg-white rounded-xl border border-gray-100 hover:shadow-md transition-all duration-200">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{m.label.split(' ')[0]}</span>
                          <span className="text-sm text-gray-600 font-medium">{m.label.split(' ')[1]}</span>
                        </div>
                        <span className={`font-bold text-lg ${m.color}`}>{fmt(m.valor)}</span>
                      </div>
                    )
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ---- PESTAÑA ARQUEO ---- */}
          {pestana === 'arqueo' && (
            <div className="space-y-6">

              {/* Total del turno */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-6 shadow-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Total Ventas del Turno</p>
                    <p className="text-3xl font-bold text-gray-800 mt-1">{fmt(totalFacturado)}</p>
                  </div>
                  <div className="text-right">
                    <div className="space-y-1">
                      <p className="text-sm text-gray-600">Efectivo: <span className="font-medium text-green-600">{fmt(totalEfectivo)}</span></p>
                      <p className="text-sm text-gray-600">Virtual: <span className="font-medium text-blue-600">{fmt(totalVirtual)}</span></p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Flujo de efectivo */}
              <div className="grid grid-cols-2 gap-6">

                {/* Cálculo del sistema */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                  <h4 className="font-semibold text-gray-700 mb-4 flex items-center gap-3 text-lg">
                    🖥️ Cálculo del Sistema
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 px-3 bg-white rounded-lg border border-green-100">
                      <span className="text-gray-600 font-medium">Efectivo Inicial</span>
                      <span className="font-bold text-green-700">{fmt(turno.inicio_caja)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 px-3 bg-white rounded-lg border border-green-100">
                      <span className="text-gray-600 font-medium">Ventas en Efectivo</span>
                      <span className="font-bold text-green-700">+{fmt(totalEfectivo)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 px-3 bg-white rounded-lg border border-green-100">
                      <span className="text-gray-600 font-medium">Gastos Efectivo</span>
                      <span className="font-bold text-red-600">-{fmt(totalGastos)}</span>
                    </div>
                    <div className="flex justify-between items-center py-3 px-3 bg-gradient-to-r from-green-100 to-emerald-100 rounded-lg border border-green-200 font-bold text-lg">
                      <span>Total Esperado</span>
                      <span className="text-green-800">{fmt(efectivoEsperado)}</span>
                    </div>
                  </div>
                </div>

                {/* Declarado por usuario */}
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                  <h4 className="font-semibold text-gray-700 mb-4 flex items-center gap-3 text-lg">
                    👤 Declarado al Cierre
                  </h4>
                  {turno.estado === 'abierto' ? (
                    <div className="text-center py-6">
                      <p className="text-gray-400 text-sm">Caja abierta, sin datos de cierre</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 px-3 bg-white rounded-lg border border-blue-100">
                        <span className="text-gray-600 font-medium">Efectivo Retirado</span>
                        <span className="font-bold text-blue-700">{fmt(turno.efectivo_retirado)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 px-3 bg-white rounded-lg border border-blue-100">
                        <span className="text-gray-600 font-medium">Para Siguiente Turno</span>
                        <span className="font-bold text-blue-700">+{fmt(turno.dinero_siguiente)}</span>
                      </div>
                      <div className="flex justify-between items-center py-3 px-3 bg-gradient-to-r from-blue-100 to-cyan-100 rounded-lg border border-blue-200 font-bold text-lg">
                        <span>Total Contado</span>
                        <span className="text-blue-800">{fmt(totalDeclarado)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Diferencia */}
              {turno.estado === 'cerrado' && (
                <div className={`bg-gradient-to-r from-white to-gray-50 rounded-2xl p-6 shadow-lg border-2 ${
                  Math.abs(diferencia) < 1
                    ? 'border-green-200 bg-green-50'
                    : diferencia > 0
                    ? 'border-blue-200 bg-blue-50'
                    : 'border-red-200 bg-red-50'
                }`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold text-gray-700 text-lg">DIFERENCIA EN EFECTIVO</p>
                      <p className="text-sm text-gray-500 mt-1">Diferencia entre sistema y conteo manual</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-4xl font-extrabold ${
                        Math.abs(diferencia) < 1 ? 'text-green-600' :
                        diferencia > 0 ? 'text-blue-600' : 'text-red-600'
                      }`}>
                        {diferencia > 0 ? '+' : ''}{fmt(diferencia)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Medios virtuales declarados */}
              {turno.estado === 'cerrado' && (
                <div className="bg-gradient-to-r from-white to-gray-50 border border-gray-200 rounded-2xl p-6 shadow-lg">
                  <h4 className="font-semibold text-gray-700 mb-4 text-lg flex items-center gap-2">
                    📋 Validación Medios Virtuales
                  </h4>
                  <div className="overflow-hidden rounded-xl">
                    <table className="w-full">
                      <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                        <tr>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Medio</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Sistema</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Declarado</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Diferencia</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {[
                          { label: '💳 Tarjetas', sistema: turno.ventas_tarjeta, declarado: turno.total_tarjetas },
                          { label: '📱 Mercado Pago', sistema: turno.ventas_mp, declarado: turno.total_mercadopago },
                          { label: '🏦 Transferencias', sistema: turno.ventas_transferencia, declarado: turno.total_transferencias },
                        ].map(m => {
                          const diff = parseFloat(m.declarado || 0) - parseFloat(m.sistema || 0);
                          return (
                            <tr key={m.label} className="hover:bg-gray-50 transition-colors">
                              <td className="py-3 px-4 text-gray-700 font-medium">{m.label}</td>
                              <td className="py-3 px-4 text-right font-semibold text-gray-800">{fmt(m.sistema)}</td>
                              <td className="py-3 px-4 text-right font-semibold text-gray-800">{fmt(m.declarado)}</td>
                              <td className={`py-3 px-4 text-right font-bold ${
                                Math.abs(diff) < 1 ? 'text-green-600' :
                                diff > 0 ? 'text-blue-600' : 'text-red-600'
                              }`}>
                                {diff > 0 ? '+' : ''}{fmt(diff)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Comentarios del cierre */}
              {turno.comentarios && (
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-2xl p-6 shadow-lg">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">📝</div>
                    <div>
                      <p className="font-semibold text-yellow-800 text-lg">Comentarios del cierre</p>
                      <p className="text-gray-600 mt-2">{turno.comentarios}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ---- PESTAÑA GASTOS ---- */}
          {pestana === 'gastos' && (
            <div className="space-y-6">
              {gastos.length === 0 ? (
                <div className="text-center py-16 bg-gradient-to-r from-red-50 to-pink-50 rounded-2xl shadow-lg">
                  <p className="text-6xl mb-4">✅</p>
                  <p className="text-xl font-semibold text-gray-700">No hubo gastos en este turno</p>
                </div>
              ) : (
                <>
                  <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-2xl p-6 shadow-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-bold text-gray-700 text-lg">Total gastos del turno</p>
                        <p className="text-sm text-gray-500 mt-1">Resumen de todos los gastos registrados</p>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-extrabold text-red-600">{fmt(totalGastos)}</p>
                        <p className="text-sm text-gray-500">{gastos.length} gastos registrados</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {gastos.map(g => (
                      <div key={g.id} className="bg-gradient-to-r from-white to-gray-50 border border-gray-200 rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                              <p className="font-semibold text-gray-800 text-lg">{g.descripcion || 'Sin descripción'}</p>
                            </div>
                            <div className="flex gap-2 mb-3 flex-wrap">
                              {g.categoria && (
                                <span className="text-sm bg-gray-100 text-gray-600 px-3 py-1 rounded-full font-medium">
                                  {g.categoria}
                                </span>
                              )}
                              <span className={`text-sm px-3 py-1 rounded-full font-medium ${
                                g.tipo === 'fijo' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                              }`}>
                                {g.tipo}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500">{fmtFecha(g.fecha)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-red-600">{fmt(g.monto)}</p>
                            <p className="text-xs text-gray-400 mt-1">Gasto registrado</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// =============================================
// COMPONENTE PRINCIPAL
// =============================================
function ControlCaja() {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [turnoSeleccionado, setTurnoSeleccionado] = useState(null);
  const [mesSeleccionado, setMesSeleccionado] = useState(() => {
    const h = new Date();
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    cargarDatos();
  }, [mesSeleccionado]);

  const cargarDatos = async () => {
    try {
      setCargando(true);
      const [anio, mes] = mesSeleccionado.split('-');
      const desde = `${anio}-${mes}-01`;
      const ultimo = new Date(anio, mes, 0).getDate();
      const hasta = `${anio}-${mes}-${ultimo}`;
      const res = await api.get(`/api/reportes/control-caja?fecha_desde=${desde}&fecha_hasta=${hasta}`);
      setDatos(res.data);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setCargando(false);
    }
  };

  const fmt = (n) => new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', minimumFractionDigits: 0
  }).format(n || 0);

  return (
    <div className="space-y-4">

      {/* Título */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Control de Caja</h2>
          <p className="text-gray-500">Historial completo de cierres de caja por turno</p>
        </div>
        <input type="month" value={mesSeleccionado}
          onChange={(e) => setMesSeleccionado(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>

      {cargando ? (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      ) : datos && (
        <>
          {/* Tarjetas resumen */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-500 text-white rounded-xl p-5 shadow">
              <p className="text-green-100 text-sm">VENTAS DEL MES</p>
              <p className="text-3xl font-bold mt-1">{fmt(datos.totales.total_facturado)}</p>
              <p className="text-green-100 text-sm mt-1">{datos.totales.total_ventas} ventas · {datos.turnos.length} turnos</p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow border-l-4 border-red-400">
              <p className="text-gray-500 text-sm">GASTOS DEL MES</p>
              <p className="text-3xl font-bold text-red-500 mt-1">{fmt(datos.totales.total_gastos)}</p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow border-l-4 border-blue-400">
              <p className="text-gray-500 text-sm">GANANCIA NETA</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">
                {fmt(datos.totales.total_facturado - datos.totales.total_gastos)}
              </p>
            </div>
          </div>

          {/* Tabla de turnos */}
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-700">
                Historial de Cierres — {datos.turnos.length} turnos
              </h3>
            </div>
            {datos.turnos.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-4xl mb-2">📭</p>
                <p>No hay cierres de caja en este período</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">Apertura</th>
                      <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">Cierre</th>
                      <th className="text-center px-4 py-3 text-gray-600 font-medium text-sm">Ventas</th>
                      <th className="text-right px-4 py-3 text-gray-600 font-medium text-sm">Total</th>
                      <th className="text-right px-4 py-3 text-gray-600 font-medium text-sm">Efectivo</th>
                      <th className="text-right px-4 py-3 text-gray-600 font-medium text-sm">Virtual</th>
                      <th className="text-right px-4 py-3 text-gray-600 font-medium text-sm">Gastos</th>
                      <th className="text-center px-4 py-3 text-gray-600 font-medium text-sm">Estado</th>
                      <th className="text-center px-4 py-3 text-gray-600 font-medium text-sm">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {datos.turnos.map(turno => (
                      <tr key={turno.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-600">{fmtFecha(turno.fecha_apertura)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {turno.fecha_cierre ? fmtFecha(turno.fecha_cierre) : '-'}
                        </td>
                        <td className="px-4 py-3 text-center font-medium text-gray-700">{turno.total_ventas}</td>
                        <td className="px-4 py-3 text-right font-bold text-green-600">{fmt(turno.total_facturado)}</td>
                        <td className="px-4 py-3 text-right text-gray-600 text-sm">{fmt(turno.ventas_efectivo)}</td>
                        <td className="px-4 py-3 text-right text-gray-600 text-sm">
                          {fmt(
                            parseFloat(turno.ventas_tarjeta || 0) +
                            parseFloat(turno.ventas_mp || 0) +
                            parseFloat(turno.ventas_transferencia || 0)
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-red-500 text-sm">{fmt(turno.total_gastos)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            turno.estado === 'abierto'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {turno.estado}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setTurnoSeleccionado(turno)}
                            className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded-lg text-sm font-medium transition-colors"
                          >
                            Ver Detalles
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal detalle */}
      {turnoSeleccionado && (
        <ModalDetalleCierre
          turno={turnoSeleccionado}
          onCerrar={() => setTurnoSeleccionado(null)}
        />
      )}

    </div>
  );
}

export default ControlCaja;