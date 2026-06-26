// =============================================
// ARCHIVO: src/components/admin/Configuracion.jsx
// FUNCIÓN: Configuración completa del sistema
// =============================================

import { useState, useEffect } from 'react';
import api from '../../api/axios';

import { useTema } from '../../context/TemaContext';
import { useAuth } from '../../context/AuthContext';
import { VERSION_ACTUAL, CHANGELOG } from '../../changelog';
import FacturacionElectronica from './FacturacionElectronica';

// ---- COMPONENTE TOGGLE ----
// Reutilizable para todos los switches de la pantalla
const Toggle = ({ activo, onChange, disabled = false }) => (

  
  <div
  
    onClick={() => !disabled && onChange(!activo)}
    className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${
      disabled ? 'opacity-50 cursor-not-allowed' :
      activo ? 'bg-green-500 cursor-pointer' : 'bg-gray-300 cursor-pointer'
    }`}
  >
    <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
      activo ? 'translate-x-6' : 'translate-x-0'
    }`} />
  </div>
);

// ---- COMPONENTE FILA DE TOGGLE ----
// Para mostrar una opción con título, descripción y toggle
const FilaToggle = ({ titulo, descripcion, valor, onChange, disabled }) => (
  
  <div className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
    valor ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
  }`}>
    <div>
      <p className="font-medium text-gray-700">{titulo}</p>
      {descripcion && <p className="text-sm text-gray-500 mt-0.5">{descripcion}</p>}
    </div>
    <Toggle activo={valor} onChange={onChange} disabled={disabled} />
  </div>
);

function Configuracion() {

  const [config, setConfig] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [exito, setExito] = useState('');
  const [error, setError] = useState('');
  const [pestanaActiva, setPestanaActiva] = useState('negocio');
  const [mostrarPin, setMostrarPin] = useState(false);
  const [mostrarReinicioDatos, setMostrarReinicioDatos] = useState(false);
  const { cambiarColor } = useTema();
  const { usuario, esPremium } = useAuth();

  useEffect(() => {
    cargarConfig();
  }, []);

  const cargarConfig = async () => {
    try {
      const res = await api.get('/api/configuracion');
      const cfg = res.data || {};
      setConfig({
  ...cfg,
  tamanio_ticket: cfg.tamanio_ticket || '80',
  tamanio_ticket_personalizado: cfg.tamanio_ticket_personalizado || 80,
  impresion_tickets: cfg.impresion_tickets ?? true,
  impresion_tickets_automatica: cfg.impresion_tickets_automatica ?? true,
  facturacion_electronica_activa: cfg.facturacion_electronica_activa === true || cfg.facturacion_electronica_activa === 'true',
  metodos_pago_activos: typeof cfg.metodos_pago_activos === 'string'
    ? JSON.parse(cfg.metodos_pago_activos)
    : (cfg.metodos_pago_activos || ['efectivo']),
});
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setCargando(false);
    }
  };

  // Actualiza cualquier campo del config
  const set = (campo, valor) => {
    setConfig(prev => ({ ...prev, [campo]: valor }));
  };

  const guardar = async (e) => {
    e.preventDefault();
    setError('');
    setGuardando(true);
    try {
      await api.put('/api/configuracion', config);
      setExito('✅ Configuración guardada correctamente');
      setTimeout(() => setExito(''), 3000);
    } catch (err) {
      setError('❌ Error al guardar la configuración');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">Cargando configuración...</p>
      </div>
    );
  }

  // La facturación electrónica es un módulo Premium: el plan estándar no lo ve.
  const pestanas = [
    { id: 'negocio', label: '🏪 Negocio' },
    { id: 'configuraciones', label: '⚙️ Configuraciones' },
    { id: 'sistema', label: '🖥️ Sistema' },
    ...(esPremium() ? [{ id: 'facturacion', label: '🧾 Facturación' }] : []),
  ];

  return (
    <div className="space-y-4">

      {/* Título */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Configuración</h2>
        <p className="text-gray-500">Personalizá el comportamiento del sistema</p>
      </div>

      {/* Mensajes */}
      {exito && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg">{exito}</div>}
      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">{error}</div>}

      <div>
        <div className="bg-white rounded-xl shadow overflow-hidden">

          {/* Pestañas */}
          <div className="flex border-b">
            {pestanas.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPestanaActiva(p.id)}
                className={`flex-1 px-4 py-4 text-sm font-medium transition-colors ${
                  pestanaActiva === p.id
                    ? 'border-b-2 border-green-600 text-green-600 bg-green-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* ==============================
              PESTAÑA: NEGOCIO
          ============================== */}
          {pestanaActiva === 'negocio' && (
            <div className="p-6 space-y-4 max-w-2xl">

              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                📋 Información del Negocio
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del negocio
                </label>
                <input
                  type="text"
                  value={config?.nombre_negocio || ''}
                  onChange={(e) => set('nombre_negocio', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Ej: Almacén Q24"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CUIT</label>
                  <input
                    type="text"
                    value={config?.cuit || ''}
                    onChange={(e) => set('cuit', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="XX-XXXXXXXX-X"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={config?.telefono || ''}
                    onChange={(e) => set('telefono', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Ej: 1162684353"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={config?.email || ''}
                  onChange={(e) => set('email', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="correo@ejemplo.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                <input
                  type="text"
                  value={config?.direccion || ''}
                  onChange={(e) => set('direccion', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Ej: Velez Sarsfield 398"
                />
              </div>

            {/* Color del sistema */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🎨 Color principal del sistema
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="color"
                    value={config.color_primario || '#f97316'}
                    onChange={(e) => {
                      setConfig(p => ({ ...p, color_primario: e.target.value }));
                      cambiarColor(e.target.value);
                    }}
                    className="w-12 h-12 rounded-lg cursor-pointer border border-gray-300"
                  />
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { color: '#f97316', nombre: 'Naranja' },
                      { color: '#10b981', nombre: 'Verde' },
                      { color: '#3b82f6', nombre: 'Azul' },
                      { color: '#8b5cf6', nombre: 'Violeta' },
                      { color: '#ef4444', nombre: 'Rojo' },
                      { color: '#ec4899', nombre: 'Rosa' },
                      { color: '#14b8a6', nombre: 'Teal' },
                      { color: '#f59e0b', nombre: 'Amarillo' },
                    ].map(c => (
                      <button
                        key={c.color}
                        type="button"
                        onClick={() => {
                          setConfig(p => ({ ...p, color_primario: c.color }));
                          cambiarColor(c.color);
                        }}
                        title={c.nombre}
                        className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                          config.color_primario === c.color ? 'border-gray-800 scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c.color }}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Color actual: <span className="font-mono">{config.color_primario || '#f97316'}</span>
                </p>
              </div>


              {/* Modo oscuro POS */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div>
                  <p className="font-medium text-gray-700">🌙 Modo oscuro en el POS</p>
                  <p className="text-sm text-gray-500 mt-0.5">Fondo oscuro con efecto glass en el punto de venta</p>
                </div>
                <button type="button"
                  onClick={() => set('modo_oscuro', !config.modo_oscuro)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    config.modo_oscuro ? 'bg-gray-800' : 'bg-gray-300'
                  }`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config.modo_oscuro ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>


            </div>

            
          )}
         {/* Botón guardar — Negocio */}
          {pestanaActiva === 'negocio' && (
            <div className="px-6 py-4 bg-gray-50 border-t flex justify-end">
              <button
                onClick={guardar}
                disabled={guardando}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : '💾 Guardar'}
              </button>
            </div>
          )}

          {/* ==============================
              PESTAÑA: CONFIGURACIONES
          ============================== */}
          {pestanaActiva === 'configuraciones' && (
            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* COLUMNA IZQUIERDA */}
              <div className="space-y-6">

                {/* Módulos de Gestión */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    📦 Módulos de Gestión
                  </h3>
                  <div className="space-y-2">
                    <FilaToggle
                      titulo="Stock Negativo"
                      descripcion="Permitir vender aunque no haya stock suficiente"
                      valor={config?.permite_stock_negativo}
                      onChange={(v) => set('permite_stock_negativo', v)}
                    />
                    <FilaToggle
                      titulo="Venta Rápida"
                      descripcion="Vender productos sin inventario (caramelos, bolsas)"
                      valor={config?.permite_venta_rapida}
                      onChange={(v) => set('permite_venta_rapida', v)}
                    />
                    <FilaToggle
                      titulo="Precio Mayorista"
                      descripcion="Habilitar precio mayorista en el punto de venta"
                      valor={config?.permite_precio_mayorista}
                      onChange={(v) => set('permite_precio_mayorista', v)}
                    />
                    <FilaToggle
                      titulo="Validar Monto en Efectivo"
                      descripcion="Exigir que el monto entregado sea igual o mayor al total"
                      valor={config?.validar_monto_efectivo}
                      onChange={(v) => set('validar_monto_efectivo', v)}
                    />
                  </div>
                </div>

                {/* Cierre de Caja */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    🔒 Cierre de Caja
                  </h3>
                  <div className="space-y-3">
                    <FilaToggle
                      titulo="Proteger información del cierre"
                      descripcion="Oculta los datos esperados hasta ingresar el PIN"
                      valor={!!config?.pin_cierre}
                      onChange={(v) => set('pin_cierre', v ? '0000' : '')}
                    />
                    {!!config?.pin_cierre && (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          PIN de verificación
                        </label>
                        <div className="relative w-48">
                          <input
                            type={mostrarPin ? 'text' : 'password'}
                            value={config?.pin_cierre || ''}
                            onChange={(e) => set('pin_cierre', e.target.value)}
                            maxLength={6}
                            className="w-full border border-gray-300 rounded-lg px-3 pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 tracking-widest text-lg"
                            placeholder="••••"
                          />
                          <button
                            type="button"
                            onClick={() => setMostrarPin(!mostrarPin)}
                            className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                          >
                            {mostrarPin ? '🙈' : '👁️'}
                          </button>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Mínimo 4 dígitos, máximo 6</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Hardware */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    🖨️ Hardware y Tickets
                  </h3>
                  <div className="space-y-2">
                    {/* Modo de impresión - Selector de opciones */}
                    <div className="p-4 rounded-lg border bg-gray-50 border-gray-200">
                      <p className="font-medium text-gray-700 mb-1">🖨️ Modo de impresión de tickets</p>
                      <p className="text-sm text-gray-500 mb-3">Elegí cómo se comporta el sistema al finalizar una venta</p>
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => {
                            set('impresion_tickets_automatica', true);
                            set('impresion_tickets', false);
                          }}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                            config?.impresion_tickets_automatica
                              ? 'border-green-500 bg-green-50'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                            config?.impresion_tickets_automatica ? 'border-green-500' : 'border-gray-300'
                          }`}>
                            {config?.impresion_tickets_automatica && <div className="w-2.5 h-2.5 rounded-full bg-green-500" />}
                          </div>
                          <div>
                            <p className="font-medium text-gray-700 text-sm">⚡ Imprimir automáticamente</p>
                            <p className="text-xs text-gray-500">Envía el ticket directo a la impresora al confirmar</p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            set('impresion_tickets', true);
                            set('impresion_tickets_automatica', false);
                          }}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                            config?.impresion_tickets
                              ? 'border-green-500 bg-green-50'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                            config?.impresion_tickets ? 'border-green-500' : 'border-gray-300'
                          }`}>
                            {config?.impresion_tickets && <div className="w-2.5 h-2.5 rounded-full bg-green-500" />}
                          </div>
                          <div>
                            <p className="font-medium text-gray-700 text-sm">👁️ Mostrar vista previa</p>
                            <p className="text-xs text-gray-500">Abre una ventana con el ticket para revisar antes de imprimir</p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            set('impresion_tickets_automatica', false);
                            set('impresion_tickets', false);
                          }}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                            !config?.impresion_tickets_automatica && !config?.impresion_tickets
                              ? 'border-green-500 bg-green-50'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                            !config?.impresion_tickets_automatica && !config?.impresion_tickets ? 'border-green-500' : 'border-gray-300'
                          }`}>
                            {!config?.impresion_tickets_automatica && !config?.impresion_tickets && <div className="w-2.5 h-2.5 rounded-full bg-green-500" />}
                          </div>
                          <div>
                            <p className="font-medium text-gray-700 text-sm">🚫 No imprimir</p>
                            <p className="text-xs text-gray-500">Solo registrar la venta, sin generar ticket</p>
                          </div>
                        </button>
                      </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <p className="font-medium text-gray-800 mb-2">Tamaño de papel</p>
                      <div className="flex gap-2 flex-wrap">
                        {[
                          { value: '58', label: '58 mm' },
                          { value: '80', label: '80 mm' },
                          { value: 'personalizado', label: 'Personalizado' },
                        ].map(option => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => set('tamanio_ticket', option.value)}
                            className={`py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                              config?.tamanio_ticket === option.value
                                ? 'bg-green-500 text-white border-green-500'
                                : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>

                      {config?.tamanio_ticket === 'personalizado' && (
                        <div className="mt-3">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Ancho personalizado (mm)
                          </label>
                          <input
                            type="number"
                            min="40"
                            max="200"
                            value={config?.tamanio_ticket_personalizado || ''}
                            onChange={(e) => set('tamanio_ticket_personalizado', parseInt(e.target.value, 10) || 0)}
                            className="w-40 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                            placeholder="80"
                          />
                        </div>
                      )}

                      <p className="text-xs text-gray-400 mt-2">
                        Define el ancho del ticket impreso (en milímetros).
                      </p>
                    </div>
                  </div>
                </div>


                {/* POS - Opciones de visualización */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    🛒 Punto de Venta
                  </h3>
                  <div className="space-y-2">
                    <FilaToggle
                      titulo="Mostrar stock en POS"
                      descripcion="Ver la cantidad disponible en cada producto"
                      valor={config?.mostrar_stock_pos}
                      onChange={(v) => set('mostrar_stock_pos', v)}
                    />
                    {config?.permite_precio_mayorista && (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Cantidad mínima para precio mayorista
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={config?.cantidad_minima_mayorista || 5}
                            onChange={(e) => set('cantidad_minima_mayorista', e.target.value)}
                            min="1"
                            className="w-24 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                          <span className="text-sm text-gray-500">unidades</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          A partir de esta cantidad se aplica precio mayorista
                        </p>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* COLUMNA DERECHA */}
              <div className="space-y-6">

                {/* Recargo en Tarjeta */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    💳 Recargo en Tarjeta
                  </h3>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">

                    {/* Modo de aplicación */}
                    <div>
                      <p className="text-sm text-gray-600 font-medium mb-2">Modo de aplicación</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => set('recargo_modo', 'editable')}
                          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                            config?.recargo_modo === 'editable'
                              ? 'bg-white border-green-500 text-green-600 shadow-sm'
                              : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          ✏️ Editable
                        </button>
                        <button
                          type="button"
                          onClick={() => set('recargo_modo', 'fijo')}
                          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                            config?.recargo_modo === 'fijo'
                              ? 'bg-orange-500 border-orange-500 text-white shadow-sm'
                              : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          ⚡ Fijo (directo)
                        </button>
                      </div>
                    </div>

                    {/* Porcentaje */}
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Porcentaje fijo</label>
                      <div className="relative w-32">
                        <input
                          type="number"
                          value={config?.recargo_tarjeta || 0}
                          onChange={(e) => set('recargo_tarjeta', e.target.value)}
                          min="0" max="100" step="0.5"
                          className="w-full border border-gray-300 rounded-lg px-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                        />
                        <span className="absolute right-3 top-2 text-gray-500">%</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Se aplica automáticamente sin abrir modal
                      </p>
                    </div>

                    {/* Preview */}
                    <div className="bg-white rounded-lg p-3 border border-gray-200 text-sm">
                      <p className="text-gray-500">Ejemplo: venta $10.000</p>
                      <p className="font-bold text-gray-800 text-lg">
                        ${(10000 * (1 + (config?.recargo_tarjeta || 0) / 100)).toLocaleString('es-AR')}
                      </p>
                      <p className="text-gray-400 text-xs">con {config?.recargo_tarjeta || 0}% de recargo</p>
                    </div>

                  </div>
                </div>

                {/* Aviso por monto virtual alto (anti-error de tipeo) */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    ⚠️ Aviso por monto virtual alto
                  </h3>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Pedir confirmación si el cobro virtual supera</label>
                      <div className="relative w-40">
                        <span className="absolute left-3 top-2 text-gray-500">$</span>
                        <input
                          type="number"
                          value={config?.limite_aviso_pago_virtual ?? 100000}
                          onChange={(e) => set('limite_aviso_pago_virtual', e.target.value)}
                          min="0" step="1000"
                          className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Al cobrar por transferencia, Mercado Pago o tarjeta (o la parte virtual de un pago dividido) por encima de este monto, el POS pide confirmar para evitar errores de tipeo.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Recargo general (botón manual en el carrito del POS) */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    ➕ Recargo general
                  </h3>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Porcentaje de recargo</label>
                      <div className="relative w-32">
                        <input
                          type="number"
                          value={config?.recargo_general || 0}
                          onChange={(e) => set('recargo_general', e.target.value)}
                          min="0" max="100" step="0.5"
                          className="w-full border border-gray-300 rounded-lg px-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                        />
                        <span className="absolute right-3 top-2 text-gray-500">%</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Se aplica con el botón "Recargo" desde el carrito del Punto de Venta
                      </p>
                    </div>

                    {/* Preview */}
                    <div className="bg-white rounded-lg p-3 border border-gray-200 text-sm">
                      <p className="text-gray-500">Ejemplo: venta $10.000</p>
                      <p className="font-bold text-gray-800 text-lg">
                        ${(10000 * (1 + (config?.recargo_general || 0) / 100)).toLocaleString('es-AR')}
                      </p>
                      <p className="text-gray-400 text-xs">con {config?.recargo_general || 0}% de recargo</p>
                    </div>
                  </div>
                </div>

                {/* Descuentos */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    🏷️ Descuentos Manuales
                  </h3>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">

                    {/* Modo */}
                    <div>
                      <p className="text-sm text-gray-600 font-medium mb-2">Modo de aplicación</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => set('descuento_modo', 'editable')}
                          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                            config?.descuento_modo === 'editable'
                              ? 'bg-white border-green-500 text-green-600 shadow-sm'
                              : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          ✏️ Editable
                        </button>
                        <button
                          type="button"
                          onClick={() => set('descuento_modo', 'fijo')}
                          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                            config?.descuento_modo === 'fijo'
                              ? 'bg-orange-500 border-orange-500 text-white shadow-sm'
                              : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          ⚡ Fijo (directo)
                        </button>
                      </div>
                    </div>

                    {/* Máximo */}
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        {config?.descuento_modo === 'fijo' ? 'Valor fijo' : 'Descuento máximo'}
                      </label>
                      <div className="relative w-32">
                        <input
                          type="number"
                          value={config?.descuento_maximo || 0}
                          onChange={(e) => set('descuento_maximo', e.target.value)}
                          min="0" max="100" step="0.5"
                          className="w-full border border-gray-300 rounded-lg px-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                        />
                        <span className="absolute right-3 top-2 text-gray-500">%</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {config?.descuento_modo === 'fijo'
                          ? 'Se aplica automáticamente sin abrir modal'
                          : 'Nadie podrá aplicar un descuento mayor a este %'
                        }
                      </p>
                    </div>

                  </div>
                </div>

                {/* Redondeo de Venta */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    〰️ Redondeo de Venta
                  </h3>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-700">Activar redondeo</p>
                        <p className="text-xs text-gray-400">Muestra botones ↑↓ en el POS para ajustar el total final</p>
                      </div>
                      <button type="button"
                        onClick={() => set('redondeo_precios', config?.redondeo_precios > 0 ? 0 : 10)}
                        className={`relative w-11 h-6 rounded-full transition-colors ${config?.redondeo_precios > 0 ? 'bg-green-500' : 'bg-gray-300'}`}>
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${config?.redondeo_precios > 0 ? 'translate-x-5' : ''}`} />
                      </button>
                    </div>
                    {config?.redondeo_precios > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-2">Múltiplo de redondeo</p>
                        <div className="flex gap-2 flex-wrap">
                          {[10, 50, 100, 500].map(v => (
                            <button key={v} type="button"
                              onClick={() => set('redondeo_precios', v)}
                              className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-all ${parseInt(config?.redondeo_precios) === v ? 'text-white border-transparent' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}
                              style={parseInt(config?.redondeo_precios) === v ? { backgroundColor: 'var(--color-primario)' } : {}}>
                              ${v}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Métodos de Pago */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    💳 Métodos de Pago Activos
                  </h3>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
                    <p className="text-xs text-gray-500 mb-3">
                      Seleccioná los métodos que van a aparecer en el POS
                    </p>
                    {[
                      { id: 'efectivo', label: '💵 Efectivo' },
                      { id: 'tarjeta', label: '💳 Tarjeta' },
                      { id: 'mercadopago', label: '📱 Mercado Pago' },
                      { id: 'transferencia', label: '🏦 Transferencia' },
                    ].map(metodo => {
                      // Parseamos el JSON si viene como string
                      const activos = typeof config?.metodos_pago_activos === 'string'
                        ? JSON.parse(config.metodos_pago_activos)
                        : (config?.metodos_pago_activos || []);
                      const estaActivo = activos.includes(metodo.id);

                      return (
                        <div
                          key={metodo.id}
                          className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                            estaActivo ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                          }`}
                          onClick={() => {
                            const actuales = typeof config?.metodos_pago_activos === 'string'
                              ? JSON.parse(config.metodos_pago_activos)
                              : (config?.metodos_pago_activos || []);

                            // Efectivo siempre obligatorio
                            if (metodo.id === 'efectivo') return;

                            const nuevo = actuales.includes(metodo.id)
                              ? actuales.filter(m => m !== metodo.id)
                              : [...actuales, metodo.id];

                            set('metodos_pago_activos', nuevo);
                          }}
                        >
                          <span className="text-sm font-medium text-gray-700">{metodo.label}</span>
                          <div className="flex items-center gap-2">
                            {metodo.id === 'efectivo' && (
                              <span className="text-xs text-gray-400">Siempre activo</span>
                            )}
                            <Toggle
                              activo={estaActivo}
                              onChange={() => {}}
                              disabled={metodo.id === 'efectivo'}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ==============================
              PESTAÑA: FACTURACIÓN ELECTRÓNICA
          ============================== */}

        
          {pestanaActiva === 'facturacion' && (
            <div className="p-6">
              <FacturacionElectronica config={config} setConfig={setConfig} />
            </div>
          )}


         

         
{/* Botón guardar — Configuraciones */}
          {pestanaActiva === 'configuraciones' && (
            <div className="px-6 py-4 bg-gray-50 border-t flex justify-end">
              <button
                onClick={guardar}
                disabled={guardando}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : '💾 Guardar'}
              </button>
            </div>
          )}
          {/* ==============================
              PESTAÑA: SISTEMA
          ============================== */}
          {pestanaActiva === 'sistema' && (
            <div className="p-6 space-y-6 max-w-2xl">

              {/* Info del sistema */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  ℹ️ Información del Sistema
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-200">
                    <span className="text-gray-600">Versión del sistema</span>
                    <span className="font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded text-sm">v{VERSION_ACTUAL}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-200">
                    <span className="text-gray-600">Última actualización</span>
                    <span className="font-medium text-gray-800 text-sm text-right">
                      {CHANGELOG[0]?.fecha}
                      <span className="block text-xs text-gray-400 font-normal">{CHANGELOG[0]?.titulo}</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-200">
                    <span className="text-gray-600">Negocio configurado</span>
                    <span className="font-medium text-gray-800">{config?.nombre_negocio || '-'}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-600">Plan actual</span>
                    <span className={`font-medium px-2 py-0.5 rounded text-sm ${
                      usuario?.plan === 'premium' ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-700'
                    }`}>
                      {usuario?.rol === 'superadmin' ? '👑 SuperAdmin' : usuario?.plan === 'premium' ? '✨ Premium' : '📦 Estándar'}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  💡 Tocá la versión (v{VERSION_ACTUAL}) abajo del menú para ver el historial completo de novedades.
                </p>
              </div>

              {/* Zona de peligro */}
              <div>
                <h3 className="text-sm font-semibold text-red-500 uppercase tracking-wide mb-3">
                  ⚠️ Zona de Peligro
                </h3>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-700 font-medium">Reiniciar configuración</p>
                  <p className="text-xs text-red-500 mt-1 mb-3">
                    Vuelve todos los ajustes a los valores por defecto. No borra productos ni ventas.
                    Después tenés que tocar 💾 Guardar para aplicarlos.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('¿Estás seguro? Se perderán todos los ajustes actuales.')) {
                        set('recargo_tarjeta', 10);
                        set('descuento_maximo', 10);
                        set('recargo_general', 0);
                        set('redondeo_precios', 0);
                        set('permite_stock_negativo', true);
                        set('recargo_modo', 'fijo');
                        set('descuento_modo', 'editable');
                        set('pin_cierre', '');
                        set('impresion_tickets', true);
                        set('impresion_tickets_automatica', true);
                      }
                    }}
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Reiniciar ajustes
                  </button>
                </div>

                {(usuario?.rol === 'admin' || usuario?.rol === 'superadmin') && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-3">
                    <p className="text-sm text-red-700 font-medium">🗑️ Reiniciar datos del negocio</p>
                    <p className="text-xs text-red-500 mt-1 mb-3">
                      Deja en cero las estadísticas, ventas, gastos, compras, caja y fiados (podés
                      elegir qué borrar). Opcionalmente también productos y facturas AFIP.
                      <strong> Es irreversible.</strong> No toca categorías ni secciones.
                    </p>
                    <button
                      type="button"
                      onClick={() => setMostrarReinicioDatos(true)}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                    >
                      Reiniciar datos…
                    </button>
                  </div>
                )}
              </div>


              {/* Ticket de venta */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  🧾 Ticket de Venta
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mensaje al pie del ticket
                    </label>
                    <input
                      type="text"
                      value={config?.nombre_ticket || ''}
                      onChange={(e) => set('nombre_ticket', e.target.value)}
                      maxLength={60}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Ej: ¡Gracias por su compra!"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Aparece al final del ticket impreso
                    </p>
                  </div>


                </div>
              </div>

            </div>
          )}

          {/* Botón guardar — Sistema */}
          {pestanaActiva === 'sistema' && (
            <div className="px-6 py-4 bg-gray-50 border-t flex justify-end">
              <button
                onClick={guardar}
                disabled={guardando}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : '💾 Guardar'}
              </button>
            </div>
          )}
           

          

       </div>
      </div>

      {mostrarReinicioDatos && (
        <ModalReinicioDatos onClose={() => setMostrarReinicioDatos(false)} />
      )}

    </div>
  );
}

// =============================================
// MODAL: REINICIAR DATOS DEL NEGOCIO
// Borrado selectivo e irreversible. Checkboxes por categoría, dependencias
// auto-tildadas, opciones sensibles en rojo, y hay que escribir ELIMINAR.
// =============================================
const CATEGORIAS_REINICIO = [
  { clave: 'ventas', titulo: 'Ventas y estadísticas', detalle: 'Todas las ventas, sus ítems y el historial de movimientos de stock. No cambia el stock actual.' },
  { clave: 'gastos', titulo: 'Gastos y compras', detalle: 'Todos los gastos y compras. Pone en cero los saldos de proveedores.' },
  { clave: 'caja', titulo: 'Caja, turnos y retiros', detalle: 'Cierres de caja / turnos y retiros de dinero.' },
  { clave: 'fiados', titulo: 'Fiados / cuentas corrientes', detalle: 'Pagos de deuda y pone en cero el saldo de cada cliente fiado.' },
];
const CATEGORIAS_SENSIBLES = [
  { clave: 'comprobantes', titulo: 'Comprobantes AFIP (facturas con CAE)', detalle: 'Borra las facturas electrónicas emitidas. Son registros fiscales.' },
  { clave: 'productos', titulo: 'Borrado TOTAL de productos', detalle: 'Borra todos los productos y sus códigos. Deja categorías y secciones. Obliga a borrar también las ventas.' },
];

function ModalReinicioDatos({ onClose }) {
  const [sel, setSel] = useState({});
  const [confirmacion, setConfirmacion] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null);

  // Dependencias por claves foráneas: productos o caja obligan a borrar ventas.
  const efectivo = {
    ...sel,
    ventas: !!sel.ventas || !!sel.productos || !!sel.caja,
  };
  const algoElegido = Object.values(efectivo).some(Boolean);
  const habilitado = algoElegido && confirmacion.trim().toUpperCase() === 'ELIMINAR' && !procesando;

  const toggle = (clave) => setSel(prev => ({ ...prev, [clave]: !prev[clave] }));

  const ejecutar = async () => {
    setError('');
    setProcesando(true);
    try {
      const res = await api.post('/api/configuracion/reiniciar-datos', {
        confirmacion: 'ELIMINAR',
        borrar: efectivo,
      });
      setResultado(res.data.borrado || {});
    } catch (e) {
      setError(e.response?.data?.error || 'Error al reiniciar los datos');
    } finally {
      setProcesando(false);
    }
  };

  const Item = ({ cat, sensible }) => {
    const forzado = cat.clave === 'ventas' && (sel.productos || sel.caja);
    const tildado = !!efectivo[cat.clave];
    return (
      <label className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer ${
        tildado ? (sensible ? 'border-red-400 bg-red-50' : 'border-gray-400 bg-gray-50') : 'border-gray-200 bg-white'
      } ${forzado ? 'opacity-90' : ''}`}>
        <input type="checkbox" checked={tildado} disabled={forzado}
          onChange={() => toggle(cat.clave)}
          className={`w-5 h-5 mt-0.5 flex-shrink-0 ${sensible ? 'accent-red-600' : 'accent-gray-700'}`} />
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${sensible ? 'text-red-700' : 'text-gray-800'}`}>{cat.titulo}</p>
          <p className="text-xs text-gray-500 mt-0.5">{cat.detalle}</p>
          {forzado && <p className="text-[11px] text-amber-600 mt-1">Se borra obligatoriamente junto con productos/caja.</p>}
        </div>
      </label>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white w-full sm:max-w-lg h-[100dvh] sm:h-auto sm:max-h-[92vh] sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b bg-red-600 text-white flex-shrink-0">
          <div className="min-w-0">
            <h3 className="text-lg font-bold">🗑️ Reiniciar datos del negocio</h3>
            <p className="text-red-100 text-xs">Acción irreversible. Elegí qué borrar.</p>
          </div>
          <button onClick={onClose} className="text-red-100 hover:text-white text-3xl leading-none w-10 h-10 flex items-center justify-center flex-shrink-0">×</button>
        </div>

        {resultado ? (
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            <p className="text-green-700 font-semibold">✅ Datos reiniciados correctamente.</p>
            <div className="bg-gray-50 border rounded-xl p-3 text-sm text-gray-700 space-y-1">
              {Object.keys(resultado).length === 0 ? (
                <p className="text-gray-400">Nada que borrar.</p>
              ) : Object.entries(resultado).map(([k, v]) => (
                <div key={k} className="flex justify-between"><span className="text-gray-500">{k}</span><strong>{v}</strong></div>
              ))}
            </div>
            <p className="text-xs text-gray-500">Conviene recargar la página para ver todo en cero.</p>
            <button onClick={() => window.location.reload()}
              className="w-full py-3 bg-gray-800 hover:bg-gray-900 text-white rounded-xl font-bold">
              Recargar
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <p className="text-xs text-gray-500 mb-1">Estadísticas e historiales</p>
              {CATEGORIAS_REINICIO.map(cat => <Item key={cat.clave} cat={cat} />)}
              <p className="text-xs text-red-500 font-semibold mt-3 mb-1">⚠️ Opciones sensibles</p>
              {CATEGORIAS_SENSIBLES.map(cat => <Item key={cat.clave} cat={cat} sensible />)}

              {error && <div className="bg-red-100 border border-red-300 text-red-700 px-3 py-2 rounded-xl text-sm mt-2">❌ {error}</div>}
            </div>

            <div className="border-t p-4 space-y-3 flex-shrink-0 bg-gray-50">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Para confirmar, escribí <strong>ELIMINAR</strong>:</label>
                <input value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)}
                  placeholder="ELIMINAR"
                  className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
              </div>
              <div className="flex gap-2">
                <button onClick={onClose}
                  className="px-4 py-3 border border-gray-300 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-100">
                  Cancelar
                </button>
                <button onClick={ejecutar} disabled={!habilitado}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed">
                  {procesando ? 'Borrando…' : 'Borrar lo seleccionado'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Configuracion;