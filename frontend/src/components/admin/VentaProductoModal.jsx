import React, { useState, useEffect } from 'react';

/**
 * Modal para vender productos por peso/cantidad variable
 * Permite ingresar cantidad o precio según la unidad del producto
 */
function VentaProductoModal({ producto, onClose, onAgregar }) {
  const [modo, setModo] = useState('cantidad'); // 'cantidad' o 'precio'
  const [valor, setValor] = useState('');
  const [error, setError] = useState('');
  const [precioUnitario, setPrecioUnitario] = useState(producto.precio_venta || 0);
  const [cantidad, setCantidad] = useState(1);

  // Resetear valores cuando cambia el producto
  useEffect(() => {
    setPrecioUnitario(producto.precio_venta || 0);
    setCantidad(1);
    setValor('');
    setError('');
  }, [producto]);

  // Calcular valores según el modo
  const calcularValores = () => {
    const precio = parseFloat(precioUnitario) || 0;
    const val = parseFloat(valor) || 0;
    
    if (modo === 'cantidad') {
      // Si ingreso cantidad, calculo el subtotal
      const cant = val;
      const subtotal = cant * precio;
      return { 
        cantidad: cant, 
        subtotal: Math.round(subtotal * 100) / 100, // Redondear a 2 decimales
        precioUnitario: precio 
      };
    } else {
      // Si ingreso precio, calculo la cantidad
      const cant = val / precio;
      const subtotal = val;
      return { 
        cantidad: Math.round(cant * 1000) / 1000, // Redondear a 3 decimales
        subtotal: subtotal, 
        precioUnitario: precio 
      };
    }
  };

  const manejarValorChange = (e) => {
    const val = e.target.value;
    setValor(val);
    setError('');
  };

  const validarYAgregar = () => {
    const val = parseFloat(valor);
    if (!val || val <= 0) {
      setError('Ingrese un valor válido mayor a 0');
      return;
    }

    const { cantidad, subtotal } = calcularValores();
    if (cantidad <= 0) {
      setError('La cantidad calculada debe ser mayor a 0');
      return;
    }

    // Validar stock si es necesario
    if (producto.stock && cantidad > producto.stock) {
      setError(`Stock insuficiente. Disponible: ${producto.stock} ${producto.unidad}`);
      return;
    }

    // Crear el item para el carrito
    const item = {
      producto_id: producto.id,
      nombre_producto: producto.nombre,
      precio_unitario: precioUnitario,
      cantidad: cantidad,
      subtotal: subtotal,
      esRapida: false,
    };

    onAgregar(item);
    onClose();
  };

  const obtenerPlaceholder = () => {
    if (modo === 'cantidad') {
      switch (producto.unidad) {
        case 'Kg': return 'Ej: 0.5 (kg) o 1.25 (kg)';
        case 'Lt': return 'Ej: 0.25 (litros) o 2 (litros)';
        case 'Mt': return 'Ej: 1.5 (metros) o 3 (metros)';
        default: return 'Ej: 1, 2, 0.5, 1.25';
      }
    } else {
      return 'Ej: 500, 1250, 2000';
    }
  };

  const obtenerUnidadMostrada = () => {
    switch (producto.unidad) {
      case 'Kg': return 'kg';
      case 'Lt': return 'litros';
      case 'Mt': return 'metros';
      default: return producto.unidad.toLowerCase();
    }
  };

  const calcularResultado = () => {
    const val = parseFloat(valor);
    if (!val || val <= 0) return null;

    if (modo === 'cantidad') {
      const cantidad = val;
      const subtotal = cantidad * precioUnitario;
      return {
        tipo: 'precio',
        valor: Math.round(subtotal * 100) / 100,
        unidad: 'pesos',
        descripcion: `${cantidad} ${obtenerUnidadMostrada()} × $${precioUnitario} = $${(Math.round(subtotal * 100) / 100).toFixed(2)}`
      };
    } else {
      const cantidad = val / precioUnitario;
      const subtotal = val;
      return {
        tipo: 'cantidad',
        valor: Math.round(cantidad * 1000) / 1000,
        unidad: obtenerUnidadMostrada(),
        descripcion: `$${val} ÷ $${precioUnitario} = ${(Math.round(cantidad * 1000) / 1000).toFixed(3)} ${obtenerUnidadMostrada()}`
      };
    }
  };

  const resultado = calcularResultado();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-600 to-blue-500 text-white">
          <div>
            <h3 className="text-xl font-bold">🛒 Vender {producto.nombre}</h3>
            <p className="text-blue-100 text-sm">Unidad: {producto.unidad} · Precio: ${precioUnitario}</p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-2xl">×</button>
        </div>

        <div className="p-6 space-y-4">
          {/* Selector de modo */}
          <div className="flex gap-2">
            <button
              onClick={() => setModo('cantidad')}
              className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
                modo === 'cantidad'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📏 Por Cantidad
            </button>
            <button
              onClick={() => setModo('precio')}
              className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
                modo === 'precio'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              💰 Por Precio
            </button>
          </div>

          {/* Input principal */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {modo === 'cantidad' ? 'Cantidad a vender' : 'Precio total deseado'}
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.001"
                value={valor}
                onChange={manejarValorChange}
                autoFocus
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder={obtenerPlaceholder()}
              />
              <div className="absolute right-3 top-3 text-sm text-gray-400">
                {modo === 'cantidad' ? obtenerUnidadMostrada() : '$'}
              </div>
            </div>
          </div>

          {/* Resultado calculado */}
          {resultado && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm text-blue-600 font-medium mb-1">Resultado:</p>
              <p className="text-lg font-bold text-blue-800">
                {modo === 'cantidad' ? 'Precio total:' : 'Cantidad:'}
              </p>
            <p className="text-2xl font-bold text-blue-900">
              {modo === 'cantidad' ? '$' : ''}{resultado.valor.toFixed(modo === 'cantidad' ? 2 : 3)} {resultado.unidad}
            </p>
              <p className="text-sm text-blue-600 mt-2">{resultado.descripcion}</p>
            </div>
          )}

          {/* Información del producto */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Precio unitario:</span>
                <p className="font-semibold text-gray-800">${precioUnitario}</p>
              </div>
              <div>
                <span className="text-gray-500">Stock disponible:</span>
                <p className="font-semibold text-gray-800">{producto.stock || 0} {producto.unidad}</p>
              </div>
            </div>
          </div>

          {/* Mensaje de error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={validarYAgregar}
              disabled={!valor || parseFloat(valor) <= 0}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ➕ Agregar al Carrito
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VentaProductoModal;
