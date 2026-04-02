import React, { useState } from 'react';
import { ModalGasto } from './Gastos';

const fmt = (n) => new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', minimumFractionDigits: 0
}).format(n || 0);

function ModalDetalleVenta({ venta, onClose, onReimprimir, onEliminar }) {
  const [actualizando, setActualizando] = useState(false);

  const handleReimprimir = async () => {
    if (onReimprimir) {
      setActualizando(true);
      try {
        await onReimprimir(venta);
      } finally {
        setActualizando(false);
      }
    }
  };

  const handleEliminar = async () => {
    if (onEliminar) {
      if (!window.confirm(`¿Eliminar esta venta de ${fmt(venta.total)}?`)) return;
      setActualizando(true);
      try {
        await onEliminar(venta.id, venta.total);
      } finally {
        setActualizando(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Encabezado */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-gray-800 to-gray-900 text-white">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                <span className="text-2xl">📋</span>
              </div>
              <div>
                <h3 className="text-xl font-bold">Detalles de la Venta</h3>
                <p className="text-gray-200 text-sm">ID: #{venta.id}</p>
              </div>
            </div>
            <p className="text-gray-300 text-sm">
              {new Date(venta.fecha).toLocaleString('es-AR', { 
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
              })}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-white text-2xl transition-colors">×</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
            
            {/* Información General */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
                <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                  Información General
                </h4>
                
                <div className="space-y-3">
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">Método de pago</p>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {venta.metodo_pago === 'efectivo' ? '💵' : 
                         venta.metodo_pago === 'tarjeta' ? '💳' : 
                         venta.metodo_pago === 'mercadopago' ? '📱' : 
                         venta.metodo_pago === 'transferencia' ? '🏦' : '❓'}
                      </span>
                      <span className="font-medium text-gray-800 capitalize">
                        {venta.metodo_pago}
                      </span>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">Cliente</p>
                    <p className="font-medium text-gray-800">
                      {venta.cliente_nombre || 'Consumidor Final'}
                    </p>
                  </div>

                  {venta.es_fiado && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                        <span className="font-medium text-orange-700">Venta Fiada</span>
                      </div>
                      <p className="text-xs text-orange-600 mt-1">Cargada a cuenta corriente del cliente</p>
                    </div>
                  )}
                </div>
              </div>

            {/* Tipo de Comprobante */}
            <div className={`rounded-xl p-4 border-2 ${
              venta.tipo_facturacion === 'electronica' || venta.comprobante_electronico_id
                ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200' 
                : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200'
            }`}>
              <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  venta.tipo_facturacion === 'electronica' || venta.comprobante_electronico_id
                    ? 'bg-green-500' 
                    : 'bg-gray-400'
                }`}></span>
                Tipo de Comprobante
              </h4>
              
              <div className={`rounded-lg p-4 text-center ${
                venta.tipo_facturacion === 'electronica' || venta.comprobante_electronico_id
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg' 
                  : 'bg-gradient-to-r from-gray-400 to-gray-500 text-white'
              }`}>
                <div className="text-3xl mb-2">
                  {venta.tipo_facturacion === 'electronica' || venta.comprobante_electronico_id ? '🧾' : '📄'}
                </div>
                <p className="font-bold text-lg">
                  {venta.tipo_facturacion === 'electronica' || venta.comprobante_electronico_id
                    ? 'Facturación Electrónica' 
                    : 'Factura X'}
                </p>
                <p className="text-sm opacity-90 mt-1">
                  {venta.tipo_facturacion === 'electronica' || venta.comprobante_electronico_id
                    ? 'Comprobante válido ante ARCA' 
                    : 'Sin valor fiscal'}
                </p>
              </div>
            </div>

            {/* Totales */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
              <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                Resumen de Totales
              </h4>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center bg-white rounded-lg p-3">
                  <span className="text-sm text-gray-600">Subtotal</span>
                  <span className="font-medium text-gray-800">{fmt(venta.subtotal_items || 0)}</span>
                </div>
                
                {(venta.descuento || 0) > 0 && (
                  <div className="flex justify-between items-center bg-white rounded-lg p-3">
                    <span className="text-sm text-gray-600">Descuento</span>
                    <span className="font-medium text-red-600">-{fmt(venta.descuento || 0)}</span>
                  </div>
                )}
                
                {(venta.recargo || 0) > 0 && (
                  <div className="flex justify-between items-center bg-white rounded-lg p-3">
                    <span className="text-sm text-gray-600">Recargo</span>
                    <span className="font-medium text-blue-600">+{fmt(venta.recargo || 0)}</span>
                  </div>
                )}
                
                <div className={`flex justify-between items-center rounded-lg p-3 border ${
                  venta.tipo_facturacion === 'electronica' || venta.comprobante_electronico_id
                    ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-100' 
                    : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100'
                }`}>
                  <span className="font-semibold text-gray-800">Total Final</span>
                  <span className={`text-2xl font-bold ${
                    venta.tipo_facturacion === 'electronica' || venta.comprobante_electronico_id
                      ? 'text-green-700' 
                      : 'text-gray-900'
                  }`}>{fmt(venta.total)}</span>
                </div>
              </div>
            </div>
            </div>

            {/* Productos Vendidos */}
            <div className="lg:col-span-2">
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
                <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Productos Vendidos ({venta.items?.length || 0})
                </h4>
                
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {venta.items && venta.items.length > 0 ? (
                    venta.items.map((item, index) => (
                      <div key={index} className="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-gray-200 to-gray-300 rounded-xl flex items-center justify-center">
                              <span className="text-xl font-bold text-gray-600">
                                {item.nombre_producto.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <h5 className="font-medium text-gray-800">{item.nombre_producto}</h5>
                              <p className="text-sm text-gray-600">
                                Cantidad: {item.cantidad} × {fmt(item.precio_unitario)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-gray-800">{fmt(item.subtotal)}</p>
                            <p className="text-xs text-gray-500">Subtotal</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-400 bg-white rounded-lg">
                      <p className="text-4xl mb-2">📦</p>
                      <p className="font-medium">No hay productos en esta venta</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="p-6 bg-gray-50 border-t">
          <div className="flex flex-col sm:flex-row gap-3 justify-end">
            <button onClick={handleReimprimir} disabled={actualizando}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg">
              <span className="text-lg">🖨️</span>
              Reimprimir Ticket
            </button>
            <button onClick={handleEliminar} disabled={actualizando}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-semibold hover:from-red-700 hover:to-red-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg">
              <span className="text-lg">🗑️</span>
              Eliminar Venta
            </button>
          </div>
          
          {actualizando && (
            <div className="mt-3 text-center">
              <p className="text-sm text-gray-500">Procesando...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ModalDetalleVenta;
