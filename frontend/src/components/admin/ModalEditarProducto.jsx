import { useState, useEffect, useRef } from 'react';
import api from '../../api/axios';
import useCerrarConAtras from '../../hooks/useCerrarConAtras';

// =============================================
// Modal COMPLETO de alta/edición de producto, compartido por Productos y Stock.
// Maneja: info básica, categoría (con creación rápida), precios/rentabilidad
// (recalculo automático), stock, combos (SelectorCombo) y códigos alternativos.
// Props:
//   producto      → objeto a editar (null = nuevo)
//   initialForm   → valores iniciales del formulario para "nuevo" (ej: duplicar)
//   categorias    → lista de categorías
//   onClose       → cerrar el modal
//   onGuardado    → (mensaje) al guardar OK (el padre recarga)
//   onCategoriasActualizadas → refrescar categorías del padre tras crear una
// =============================================

const FORM_VACIO = {
  codigo: '', nombre: '', categoria_id: '',
  precio_costo: '', margen_ganancia: '', alicuota_iva: '21',
  precio_venta: '', precio_mayorista: '', margen_mayorista: '',
  stock: '0', stock_minimo: '0', unidad: 'Uni',
  es_combinado: false, componentes: [],
};

const desdeProducto = (p) => ({
  codigo: p.codigo || '', nombre: p.nombre, categoria_id: p.categoria_id || '',
  precio_costo: p.precio_costo, margen_ganancia: p.margen_ganancia || '',
  alicuota_iva: p.alicuota_iva || '21', precio_venta: p.precio_venta,
  precio_mayorista: p.precio_mayorista || '', margen_mayorista: '',
  stock: p.stock, stock_minimo: p.stock_minimo, unidad: p.unidad,
  es_combinado: !!p.es_combinado, componentes: [],
});

export default function ModalEditarProducto({ producto, initialForm, categorias = [], onClose, onGuardado, onCategoriasActualizadas }) {
  const editando = producto?.id || null;
  const [formulario, setFormulario] = useState(() => producto ? desdeProducto(producto) : (initialForm || FORM_VACIO));
  const [error, setError] = useState('');
  const [codigos, setCodigos] = useState([]);
  const [nuevoCodigo, setNuevoCodigo] = useState('');
  const [cargandoCodigos, setCargandoCodigos] = useState(false);
  const [nuevaCategoria, setNuevaCategoria] = useState('');
  const [creandoCategoria, setCreandoCategoria] = useState(false);
  const [guardando, setGuardando] = useState(false);
  // Stock al abrir: sirve para mandar el ajuste de stock solo si el usuario lo cambió.
  const stockOriginalRef = useRef(producto?.stock ?? null);

  useCerrarConAtras(true, onClose);

  // Al abrir en modo edición: traer códigos alternativos y, si es combo, componentes.
  useEffect(() => {
    if (!editando) return;
    setCargandoCodigos(true);
    api.get(`/api/productos/${editando}/codigos`)
      .then(res => setCodigos(res.data))
      .catch(() => {})
      .finally(() => setCargandoCodigos(false));
    if (producto.es_combinado) {
      api.get(`/api/productos/${editando}`)
        .then(res => {
          const comps = (res.data.componentes || []).map(c => ({
            producto_id: c.producto_id, cantidad: c.cantidad, nombre: c.nombre, precio_costo: c.precio_costo,
          }));
          setFormulario(prev => ({ ...prev, componentes: comps }));
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editando]);

  // En un combo el costo es la suma de componentes; si hay margen, recalcula venta.
  useEffect(() => {
    if (!formulario.es_combinado) return;
    const costo = formulario.componentes.reduce((s, c) => s + (Number(c.precio_costo) || 0) * (Number(c.cantidad) || 0), 0);
    setFormulario(prev => {
      const costoStr = costo > 0 ? String(costo) : '';
      const margen = parseFloat(prev.margen_ganancia) || 0;
      const iva = parseFloat(prev.alicuota_iva) || 0;
      const ventaCalc = (costo > 0 && margen > 0)
        ? Math.round(costo * (1 + margen / 100) * (1 + iva / 100)).toString()
        : prev.precio_venta;
      if (prev.precio_costo === costoStr && prev.precio_venta === ventaCalc) return prev;
      return { ...prev, precio_costo: costoStr, precio_venta: ventaCalc };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formulario.es_combinado, formulario.componentes]);

  const manejarCambio = (e) => {
    const { name, value } = e.target;
    setFormulario(prev => {
      const next = { ...prev, [name]: value };
      if (['precio_costo', 'margen_ganancia', 'alicuota_iva'].includes(name)) {
        const costo = parseFloat(next.precio_costo) || 0;
        const margen = parseFloat(next.margen_ganancia) || 0;
        const iva = parseFloat(next.alicuota_iva) || 0;
        if (costo > 0) next.precio_venta = Math.round(costo * (1 + margen / 100) * (1 + iva / 100)).toString();
        const margenMay = parseFloat(next.margen_mayorista) || 0;
        if (costo > 0 && margenMay > 0) next.precio_mayorista = Math.round(costo * (1 + margenMay / 100) * (1 + iva / 100)).toString();
      }
      if (name === 'margen_mayorista') {
        const costo = parseFloat(next.precio_costo) || 0;
        const margenMay = parseFloat(value) || 0;
        const iva = parseFloat(next.alicuota_iva) || 0;
        if (costo > 0 && margenMay > 0) next.precio_mayorista = Math.round(costo * (1 + margenMay / 100) * (1 + iva / 100)).toString();
      }
      return next;
    });
  };

  const crearCategoriaRapida = async () => {
    if (!nuevaCategoria.trim()) return;
    try {
      const res = await api.post('/api/categorias', { nombre: nuevaCategoria.trim() });
      await onCategoriasActualizadas?.();
      setFormulario(prev => ({ ...prev, categoria_id: res.data.id }));
      setNuevaCategoria('');
      setCreandoCategoria(false);
    } catch (err) {
      alert(err.response?.data?.error || 'Error al crear categoría');
    }
  };

  const agregarCodigo = async () => {
    if (!nuevoCodigo.trim() || !editando) return;
    try {
      const res = await api.post(`/api/productos/${editando}/codigos`, { codigo: nuevoCodigo.trim() });
      setCodigos(prev => [...prev, res.data]);
      setNuevoCodigo('');
    } catch (err) { setError(err.response?.data?.error || 'Error al agregar código'); }
  };

  const eliminarCodigo = async (codigoId) => {
    try {
      await api.delete(`/api/productos/codigos/${codigoId}`);
      setCodigos(prev => prev.filter(c => c.id !== codigoId));
    } catch (err) { setError('Error al eliminar código'); }
  };

  const guardarProducto = async (e) => {
    e.preventDefault();
    setError('');
    if (formulario.es_combinado && formulario.componentes.length === 0) {
      setError('Un producto combinado necesita al menos un componente.');
      return;
    }
    try {
      setGuardando(true);
      const datos = {
        codigo: formulario.codigo, nombre: formulario.nombre, categoria_id: formulario.categoria_id,
        precio_costo: formulario.precio_costo, precio_venta: formulario.precio_venta,
        precio_mayorista: formulario.precio_mayorista || null,
        stock_minimo: formulario.stock_minimo, unidad: formulario.unidad,
        alicuota_iva: formulario.alicuota_iva, margen_ganancia: formulario.margen_ganancia || 0,
        es_combinado: formulario.es_combinado,
        componentes: formulario.es_combinado
          ? formulario.componentes.map(c => ({ producto_id: c.producto_id, cantidad: c.cantidad }))
          : [],
      };
      // El stock se manda solo al crear o cuando el usuario realmente lo cambió,
      // así editar precio/nombre no pisa el stock que bajó por ventas.
      if (!formulario.es_combinado) {
        const stockCambiado = String(formulario.stock ?? '').trim() !== String(stockOriginalRef.current ?? '').trim();
        if (!editando || stockCambiado) datos.stock = formulario.stock;
      }
      if (editando) {
        await api.put(`/api/productos/${editando}`, datos);
        onGuardado?.('Producto actualizado correctamente');
      } else {
        await api.post('/api/productos', datos);
        onGuardado?.('Producto creado correctamente');
      }
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar el producto');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
          <h3 className="text-xl font-bold text-gray-800">{editando ? '✏️ Editar Producto' : '➕ Nuevo Producto'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">×</button>
        </div>

        <form onSubmit={guardarProducto} className="p-6 space-y-6">
          {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">❌ {error}</div>}

          {/* Tipo de producto */}
          <div className="flex gap-2">
            <button type="button" onClick={() => setFormulario(prev => ({ ...prev, es_combinado: false }))}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${!formulario.es_combinado ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
              📦 Producto normal
            </button>
            <button type="button" onClick={() => setFormulario(prev => ({ ...prev, es_combinado: true }))}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${formulario.es_combinado ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
              🧩 Producto combinado
            </button>
          </div>

          {formulario.es_combinado && (
            <SelectorCombo componentes={formulario.componentes} excludeId={editando}
              onChange={(comps) => setFormulario(prev => ({ ...prev, componentes: comps }))} />
          )}

          {/* Info básica */}
          <div>
            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">📋 Información Básica</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del producto *</label>
                <input type="text" name="nombre" value={formulario.nombre} onChange={manejarCambio} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Ej: Coca Cola 500ml" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código de barras</label>
                  <input type="text" name="codigo" value={formulario.codigo} onChange={manejarCambio}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Dejar vacío para generar automáticamente" />
                  {!formulario.codigo && <p className="text-xs text-blue-500 mt-1">🔄 Se generará un código interno automáticamente</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoría *</label>
                  <div className="flex gap-2">
                    <select name="categoria_id" value={formulario.categoria_id} onChange={manejarCambio} required
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500">
                      <option value="">{categorias.length === 0 ? '— Sin categorías —' : 'Seleccionar...'}</option>
                      {categorias.map(cat => <option key={cat.id} value={cat.id}>{cat.nombre}</option>)}
                    </select>
                    <button type="button" onClick={() => setCreandoCategoria(!creandoCategoria)} title="Crear nueva categoría"
                      className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-bold transition-colors">+</button>
                  </div>
                  {creandoCategoria && (
                    <div className="flex gap-2 mt-2">
                      <input type="text" value={nuevaCategoria} onChange={(e) => setNuevaCategoria(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); crearCategoriaRapida(); } }}
                        placeholder="Nombre de la nueva categoría..." autoFocus
                        className="flex-1 border border-blue-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <button type="button" onClick={crearCategoriaRapida}
                        className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-bold transition-colors">✓</button>
                      <button type="button" onClick={() => { setCreandoCategoria(false); setNuevaCategoria(''); }}
                        className="px-3 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded-lg text-sm font-bold transition-colors">✕</button>
                    </div>
                  )}
                  {categorias.length === 0 && !creandoCategoria && (
                    <p className="text-xs text-amber-600 mt-1">⚠️ No hay categorías. Hacé clic en <strong>+</strong> para crear una antes de guardar.</p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unidad de medida</label>
                <select name="unidad" value={formulario.unidad} onChange={manejarCambio}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500">
                  <option value="Uni">Unidad</option>
                  <option value="Kg">Kilogramo</option>
                  <option value="Lt">Litro</option>
                  <option value="Mt">Metro</option>
                </select>
              </div>
            </div>
          </div>

          {/* Precios */}
          <div>
            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">💰 Precios y Rentabilidad</h4>
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio Costo</label>
                  {formulario.es_combinado ? (
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-500">$</span>
                      <input type="number" readOnly
                        value={formulario.componentes.reduce((s, c) => s + (Number(c.precio_costo) || 0) * (Number(c.cantidad) || 0), 0).toFixed(2)}
                        className="w-full border border-gray-200 bg-gray-100 rounded-lg pl-7 pr-3 py-2 text-gray-600" />
                      <p className="text-xs text-indigo-500 mt-1">Suma del costo de los componentes</p>
                    </div>
                  ) : (
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-500">$</span>
                      <input type="number" name="precio_costo" value={formulario.precio_costo} onChange={manejarCambio}
                        onWheel={(e) => e.currentTarget.blur()} min="0" step="0.01"
                        className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="0.00" />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Margen de Ganancia %</label>
                  <div className="relative">
                    <input type="number" name="margen_ganancia" value={formulario.margen_ganancia} onChange={manejarCambio}
                      onWheel={(e) => e.currentTarget.blur()} min="0" step="0.1"
                      className="w-full border border-gray-300 rounded-lg px-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Ej: 50" />
                    <span className="absolute right-3 top-2 text-gray-500">%</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Alícuota IVA %</label>
                  <div className="relative">
                    <input type="number" name="alicuota_iva" value={formulario.alicuota_iva} onChange={manejarCambio}
                      onWheel={(e) => e.currentTarget.blur()} min="0" max="100" step="0.5"
                      className="w-full border border-gray-300 rounded-lg px-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" />
                    <span className="absolute right-3 top-2 text-gray-500">%</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">21% General · 10.5% Alimentos · 0% Exento</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio de Venta Final *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">$</span>
                    <input type="number" name="precio_venta" value={formulario.precio_venta} onChange={manejarCambio}
                      onWheel={(e) => e.currentTarget.blur()} required min="0"
                      className="w-full border border-green-400 bg-green-50 rounded-lg pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 font-semibold text-green-800" />
                  </div>
                  {formulario.precio_costo > 0 && (
                    <p className="text-xs text-gray-400 mt-1">${formulario.precio_costo} × (1+{formulario.margen_ganancia || 0}%) × (1+{formulario.alicuota_iva}%)</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Stock */}
          <div>
            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">📦 Stock</h4>
            {formulario.es_combinado ? (
              <p className="text-sm text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
                El stock del combinado se calcula solo: es lo que alcanza del componente más escaso.
                Al venderlo se descuenta el stock de cada componente.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad actual</label>
                  <input type="number" name="stock" value={formulario.stock} onChange={manejarCambio}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock mínimo (alerta)</label>
                  <input type="number" name="stock_minimo" value={formulario.stock_minimo} onChange={manejarCambio}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>
            )}
          </div>

          {/* Códigos alternativos */}
          {editando ? (
            <div>
              <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">🔖 Códigos de Barras Alternativos</h4>
              <p className="text-xs text-gray-400 mb-2">Agregá todos los códigos que identifican a este producto</p>
              {cargandoCodigos ? (
                <p className="text-sm text-gray-400">Cargando códigos...</p>
              ) : (
                <div className="space-y-2 mb-3">
                  {codigos.map(c => (
                    <div key={c.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                      <span className="font-mono text-sm text-gray-700">{c.codigo}</span>
                      <button type="button" onClick={() => eliminarCodigo(c.id)} className="text-red-400 hover:text-red-600 text-sm transition-colors">✕</button>
                    </div>
                  ))}
                  {codigos.length === 0 && <p className="text-sm text-gray-400 italic">Sin códigos alternativos</p>}
                </div>
              )}
              <div className="flex gap-2">
                <input type="text" value={nuevoCodigo} onChange={(e) => setNuevoCodigo(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), agregarCodigo())}
                  placeholder="Escribí el código y presioná Enter"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                <button type="button" onClick={agregarCodigo}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">+ Agregar</button>
              </div>
              <p className="text-xs text-gray-400 mt-1">💡 También podés escanear el código directamente en el campo</p>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm text-blue-700 font-medium">🔖 Códigos de Barras Alternativos</p>
              <p className="text-xs text-blue-500 mt-1">Podés agregar códigos alternativos después de crear el producto, desde el botón Editar.</p>
            </div>
          )}

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">Cancelar</button>
            <button type="submit" disabled={guardando}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-lg font-medium transition-colors">
              {editando ? '💾 Guardar Cambios' : '✅ Crear Producto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Buscador de componentes de un combo.
function SelectorCombo({ componentes, excludeId, onChange }) {
  const [buscar, setBuscar] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    const q = buscar.trim();
    if (!q) { setResultados([]); return; }
    let activo = true;
    setBuscando(true);
    const t = setTimeout(() => {
      api.get(`/api/productos?buscar=${encodeURIComponent(q)}&rapida=1`)
        .then(res => {
          if (!activo) return;
          const lista = Array.isArray(res.data) ? res.data : (res.data.productos || []);
          setResultados(lista.filter(p => !p.es_combinado && p.id !== excludeId));
        })
        .catch(() => activo && setResultados([]))
        .finally(() => activo && setBuscando(false));
    }, 250);
    return () => { activo = false; clearTimeout(t); };
  }, [buscar, excludeId]);

  const yaAgregado = (id) => componentes.some(c => c.producto_id === id);
  const agregar = (p) => {
    if (yaAgregado(p.id)) return;
    onChange([...componentes, { producto_id: p.id, nombre: p.nombre, precio_costo: p.precio_costo, cantidad: 1 }]);
    setBuscar('');
    setResultados([]);
  };
  const quitar = (id) => onChange(componentes.filter(c => c.producto_id !== id));
  const setCant = (id, v) => onChange(componentes.map(c => c.producto_id === id ? { ...c, cantidad: v } : c));

  const costoTotal = componentes.reduce((s, c) => s + (Number(c.precio_costo) || 0) * (Number(c.cantidad) || 0), 0);
  const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n || 0);

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
      <h4 className="text-sm font-semibold text-indigo-700 uppercase tracking-wide">🧩 Productos del combo</h4>
      <div className="relative">
        <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar producto para agregar…"
          className="w-full border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        {buscar && (
          <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
            {buscando ? (
              <p className="text-sm text-gray-400 px-3 py-2">Buscando…</p>
            ) : resultados.length === 0 ? (
              <p className="text-sm text-gray-400 px-3 py-2">Sin resultados</p>
            ) : resultados.slice(0, 30).map(p => (
              <button key={p.id} type="button" onClick={() => agregar(p)} disabled={yaAgregado(p.id)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 flex items-center justify-between disabled:opacity-40 disabled:cursor-not-allowed">
                <span className="truncate">{p.nombre}</span>
                <span className="text-xs text-gray-500 flex-shrink-0 ml-2">costo {fmt(p.precio_costo)} · stock {p.stock ?? 0}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {componentes.length === 0 ? (
        <p className="text-sm text-gray-500">Agregá los productos que se venden juntos en este combo.</p>
      ) : (
        <div className="space-y-2">
          {componentes.map(c => (
            <div key={c.producto_id} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{c.nombre}</p>
                <p className="text-[11px] text-gray-400">costo unitario {fmt(c.precio_costo)}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-gray-400 text-sm">×</span>
                <input type="number" min="0.001" step="0.001" value={c.cantidad}
                  onWheel={(e) => e.currentTarget.blur()} onChange={(e) => setCant(c.producto_id, e.target.value)}
                  className="w-16 border border-gray-300 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <span className="text-sm font-semibold text-gray-700 w-20 text-right flex-shrink-0">
                {fmt((Number(c.precio_costo) || 0) * (Number(c.cantidad) || 0))}
              </span>
              <button type="button" onClick={() => quitar(c.producto_id)} className="text-red-400 hover:text-red-600 text-lg flex-shrink-0">✕</button>
            </div>
          ))}
          <div className="flex justify-between items-center pt-1 border-t border-indigo-200">
            <span className="text-sm font-semibold text-indigo-700">Costo total del combo</span>
            <span className="text-base font-bold text-indigo-700">{fmt(costoTotal)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export { SelectorCombo };
