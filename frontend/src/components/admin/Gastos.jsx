// =============================================
// ARCHIVO: src/components/admin/Gastos.jsx
// FUNCIÓN: Registrar y consultar gastos
// =============================================

import { useState, useEffect } from 'react';
import api from '../../api/axios';

// =============================================
// COMPONENTE MODAL DE GASTO
// Se exporta para poder usarlo también en el POS
// =============================================
export function ModalGasto({ onCerrar, onGuardado }) {

  const [formulario, setFormulario] = useState({
    descripcion: '',
    monto: '',
    categoria: '',
    tipo: 'variable',
    metodo_pago: 'efectivo',
  });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const categorias = [
    'Insumos',
    'Servicios',
    'Limpieza',
    'Sueldos',
    'Alquiler',
    'Mantenimiento',
    'Transporte',
    'Impuestos',
    'Otro',
  ];

  const guardar = async (e) => {
    e.preventDefault();
    setError('');
    setGuardando(true);

    try {
      await api.post('/api/gastos', formulario);
      // Avisamos al componente padre que se guardó
      if (onGuardado) onGuardado();
      onCerrar();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar el gasto');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">

        {/* Encabezado */}
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="text-lg font-bold text-gray-800">💸 Registrar Gasto</h3>
          <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">×</button>
        </div>

        <form onSubmit={guardar} className="p-5 space-y-4">

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg text-sm">
              ❌ {error}
            </div>
          )}

          {/* Monto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monto *</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="number"
                value={formulario.monto}
                onChange={(e) => setFormulario(p => ({ ...p, monto: e.target.value }))}
                required min="0" step="0.01"
                autoFocus
                className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Categoría y Método de pago */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
              <select
                value={formulario.categoria}
                onChange={(e) => setFormulario(p => ({ ...p, categoria: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400"
              >
                <option value="">Seleccionar...</option>
                {categorias.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pago</label>
              <select
                value={formulario.metodo_pago}
                onChange={(e) => setFormulario(p => ({ ...p, metodo_pago: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400"
              >
                <option value="efectivo">💵 Efectivo</option>
                <option value="tarjeta">💳 Tarjeta</option>
                <option value="transferencia">🏦 Transferencia</option>
              </select>
            </div>
          </div>

          {/* Toggle: ¿Es gasto fijo? */}
          <div
            className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
              formulario.tipo === 'fijo'
                ? 'bg-blue-50 border-blue-300'
                : 'bg-gray-50 border-gray-200'
            }`}
            onClick={() => setFormulario(p => ({
              ...p,
              tipo: p.tipo === 'fijo' ? 'variable' : 'fijo'
            }))}
          >
            <div>
              <p className="text-sm font-medium text-gray-700">¿Es un gasto fijo?</p>
              <p className="text-xs text-gray-500">Se repite mensualmente (ej: alquiler, servicios)</p>
            </div>
            {/* Toggle visual */}
            <div className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${
              formulario.tipo === 'fijo' ? 'bg-blue-500' : 'bg-gray-300'
            }`}>
              <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                formulario.tipo === 'fijo' ? 'translate-x-6' : 'translate-x-0'
              }`} />
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción (opcional)
            </label>
            <textarea
              value={formulario.descripcion}
              onChange={(e) => setFormulario(p => ({ ...p, descripcion: e.target.value }))}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
              placeholder="Detalles del gasto..."
            />
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onCerrar}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={guardando}
              className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50">
              {guardando ? 'Guardando...' : '✅ Guardar'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

// =============================================
// COMPONENTE PRINCIPAL DE GASTOS
// =============================================
function Gastos() {

  const [gastos, setGastos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [exito, setExito] = useState('');

  // ---- FILTROS ----
  // periodoFiltro: 'hoy', 'mes', 'personalizado'
  const [periodoFiltro, setPeriodoFiltro] = useState('hoy');
  const [tipoFiltro, setTipoFiltro] = useState('todos');
  const [mesSeleccionado, setMesSeleccionado] = useState(() => {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  });

  // Calculamos las fechas según el período seleccionado
  const calcularFechas = () => {
    const hoy = new Date();
    const offset = hoy.getTimezoneOffset() * 60000;
      const local = new Date(hoy - offset);
      const hoyStr = local.toISOString().split('T')[0];

    if (periodoFiltro === 'hoy') {
      // Solo el día de hoy
      return { desde: hoyStr, hasta: hoyStr };
    }

    if (periodoFiltro === 'mes') {
      // Mes actual completo
      const primerDia = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
      return { desde: primerDia, hasta: hoyStr };
    }

    if (periodoFiltro === 'personalizado') {
      // Mes elegido por el usuario
      const [anio, mes] = mesSeleccionado.split('-');
      const primerDia = `${anio}-${mes}-01`;
      const ultimoDia = new Date(anio, mes, 0).getDate();
      const ultimoDiaStr = `${anio}-${mes}-${ultimoDia}`;
      return { desde: primerDia, hasta: ultimoDiaStr };
    }
  };

  useEffect(() => {
    cargarGastos();
  }, [periodoFiltro, tipoFiltro, mesSeleccionado]);

  const cargarGastos = async () => {
    try {
      setCargando(true);
      const { desde, hasta } = calcularFechas();
      const res = await api.get(
        `/api/gastos?fecha_desde=${desde}&fecha_hasta=${hasta}&tipo=${tipoFiltro}`
      );
      setGastos(res.data);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setCargando(false);
    }
  };

  const eliminarGasto = async (id, descripcion) => {
    if (!window.confirm(`¿Eliminar este gasto?`)) return;
    try {
      await api.delete(`/api/gastos/${id}`);
      setExito('Gasto eliminado');
      cargarGastos();
      setTimeout(() => setExito(''), 2000);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  // ---- CÁLCULOS ----
  const totalGastos = gastos.reduce((acc, g) => acc + parseFloat(g.monto), 0);
  const totalFijos = gastos.filter(g => g.tipo === 'fijo').reduce((acc, g) => acc + parseFloat(g.monto), 0);
  const totalVariables = gastos.filter(g => g.tipo === 'variable').reduce((acc, g) => acc + parseFloat(g.monto), 0);
  const cantidadFijos = gastos.filter(g => g.tipo === 'fijo').length;
  const cantidadVariables = gastos.filter(g => g.tipo === 'variable').length;

  const formatearPeso = (n) => new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', minimumFractionDigits: 0
  }).format(n);

  const formatearFecha = (fecha) => new Date(fecha).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  const iconoMetodo = (metodo) => {
    if (metodo === 'tarjeta') return '💳';
    if (metodo === 'transferencia') return '🏦';
    return '💵';
  };

  return (
    <div className="space-y-4">

      {/* Título y botón */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Gastos Operativos</h2>
          <p className="text-gray-500">Control de gastos del negocio</p>
        </div>
        <button
          onClick={() => setMostrarModal(true)}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          + Nuevo Gasto
        </button>
      </div>

      {exito && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg">✅ {exito}</div>}

      {/* ---- TARJETAS DE RESUMEN ---- */}
      <div className="grid grid-cols-3 gap-4">

        {/* Total */}
        <div className="bg-red-500 text-white rounded-xl p-5 shadow">
          <p className="text-red-100 text-sm font-medium uppercase">TOTAL</p>
          <p className="text-3xl font-bold mt-1">{formatearPeso(totalGastos)}</p>
          <p className="text-red-100 text-sm mt-1">{gastos.length} gastos</p>
        </div>

        {/* Fijos */}
        <div className="bg-white rounded-xl p-5 shadow border-l-4 border-blue-500">
          <p className="text-gray-500 text-sm font-medium uppercase">FIJOS</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{formatearPeso(totalFijos)}</p>
          <p className="text-gray-400 text-sm mt-1">{cantidadFijos} gastos</p>
        </div>

        {/* Variables */}
        <div className="bg-white rounded-xl p-5 shadow border-l-4 border-orange-500">
          <p className="text-gray-500 text-sm font-medium uppercase">VARIABLES</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">{formatearPeso(totalVariables)}</p>
          <p className="text-gray-400 text-sm mt-1">{cantidadVariables} gastos</p>
        </div>

      </div>

      {/* ---- FILTROS ---- */}
      <div className="bg-white rounded-xl p-4 shadow flex gap-3 flex-wrap items-center">

        {/* Filtros de período */}
        <div className="flex gap-2">
          {/* Botón HOY */}
          <button
            onClick={() => setPeriodoFiltro('hoy')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              periodoFiltro === 'hoy'
                ? 'bg-red-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Hoy
          </button>

          {/* Botón ESTE MES */}
          <button
            onClick={() => setPeriodoFiltro('mes')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              periodoFiltro === 'mes'
                ? 'bg-red-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Este mes
          </button>

          {/* Botón PERSONALIZADO */}
          <button
            onClick={() => setPeriodoFiltro('personalizado')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              periodoFiltro === 'personalizado'
                ? 'bg-red-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Otro mes
          </button>
        </div>

        {/* Selector de mes (solo visible cuando eligió personalizado) */}
        {periodoFiltro === 'personalizado' && (
          <input
            type="month"
            value={mesSeleccionado}
            onChange={(e) => setMesSeleccionado(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400"
          />
        )}

        {/* Separador */}
        <div className="w-px h-8 bg-gray-200 mx-1" />

        {/* Filtro por tipo */}
        <div className="flex gap-2">
          {['todos', 'fijo', 'variable'].map(tipo => (
            <button
              key={tipo}
              onClick={() => setTipoFiltro(tipo)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                tipoFiltro === tipo
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tipo === 'todos' ? 'Todos' : tipo === 'fijo' ? 'Fijos' : 'Variables'}
            </button>
          ))}
        </div>

      </div>

      {/* ---- TABLA DE GASTOS ---- */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full">
<thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Fecha</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Categoría</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Tipo</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Método</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Usuario</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Descripción</th>
              <th className="text-right px-4 py-3 text-gray-600 font-medium">Monto</th>
              <th className="text-center px-4 py-3 text-gray-600 font-medium">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cargando ? (
              <tr><td colSpan="8" className="text-center py-8 text-gray-400">Cargando gastos...</td></tr>
            ) : gastos.length === 0 ? (
              <tr>
                <td colSpan="8" className="text-center py-12 text-gray-400">
                  <p className="text-4xl mb-2">💸</p>
                  <p>No hay gastos en este período</p>
                </td>
              </tr>
            ) : (
gastos.map(gasto => (
                <tr key={gasto.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 text-sm whitespace-nowrap">
                    {formatearFecha(gasto.fecha)}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {gasto.categoria || <span className="text-gray-400">-</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      gasto.tipo === 'fijo'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}>
                      {gasto.tipo === 'fijo' ? 'Fijo' : 'Variable'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-sm">
                    {iconoMetodo(gasto.metodo_pago)} {gasto.metodo_pago}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {(gasto.usuario_nombre || 'A').charAt(0).toUpperCase()}
                      </div>
                      <span className="text-gray-600 text-sm">{gasto.usuario_nombre || 'Admin'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-sm">
                    {gasto.descripcion || <span className="text-gray-400">-</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-red-600">
                    {formatearPeso(gasto.monto)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => eliminarGasto(gasto.id)}
                      className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded text-sm transition-colors">
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {mostrarModal && (
        <ModalGasto
          onCerrar={() => setMostrarModal(false)}
          onGuardado={() => {
            cargarGastos();
            setExito('Gasto registrado correctamente');
            setTimeout(() => setExito(''), 3000);
          }}
        />
      )}

    </div>
  );
}

export default Gastos;