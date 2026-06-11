// =============================================
// ARCHIVO: src/components/admin/Stock.jsx
// Pantalla de inventario pensada para usarse CAMINANDO por el local con el
// celular: secciones propias (góndolas, heladeras, depósito...) que reflejan
// el orden físico de las estanterías. El usuario recorre el local y toca
// "Ajustar" en cada producto para escribir la cantidad contada.
// =============================================

import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SIN_UBICACION = 'sin';

// ---- Fila de producto ----
// Modo normal: stock visible + botones Ajustar / Historial / Modificar / Eliminar
// Modo organizar: handle de arrastre + selector de sección
function FilaProducto({ producto, organizar, secciones, onMover, onAjustar, onHistorial, onModificar, onEliminar }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: producto.id, disabled: !organizar });

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const stockBajo = Number(producto.stock) <= Number(producto.stock_minimo ?? 0);

  return (
    <div ref={setNodeRef} style={style}
      className={`rounded-xl border px-3 py-2 ${stockBajo ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'} ${isDragging ? 'shadow-lg z-10' : ''}`}>

      <div className="flex items-center gap-2">
        {organizar && (
          <button {...attributes} {...listeners} style={{ touchAction: 'none' }}
            title="Arrastrá para ordenar"
            className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 px-1 py-2 text-lg leading-none flex-shrink-0 select-none">
            ☰
          </button>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate leading-tight">{producto.nombre}</p>
          <p className="text-[11px] text-gray-400 truncate">
            {producto.categoria_nombre || 'Sin categoría'} · mín: {producto.stock_minimo ?? 0}
          </p>
        </div>

        {/* Stock actual, siempre visible */}
        <span className={`flex-shrink-0 text-sm font-bold px-2.5 py-1 rounded-lg ${stockBajo ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
          {producto.stock ?? 0}{producto.unidad ? ` ${producto.unidad}` : ''}
        </span>

        {organizar && (
          <select
            value={producto.stock_categoria_id ?? ''}
            onChange={(e) => onMover(producto, e.target.value === '' ? null : parseInt(e.target.value))}
            className="text-xs border border-gray-300 rounded-lg px-1.5 py-2 max-w-[110px] bg-white flex-shrink-0">
            <option value="">📦 Sin ubicación</option>
            {secciones.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        )}
      </div>

      {/* Botones de acción (solo en modo normal) */}
      {!organizar && (
        <div className="flex gap-1.5 mt-2">
          <button onClick={() => onAjustar(producto)}
            className="flex-1 py-1.5 bg-yellow-400 hover:bg-yellow-500 active:scale-95 text-yellow-900 rounded-lg text-sm font-bold transition-all">
            Ajustar
          </button>
          <button onClick={() => onHistorial(producto)} title="Historial de stock"
            className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-sm transition-colors">
            🕒
          </button>
          <button onClick={() => onModificar(producto)} title="Modificar producto"
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition-colors">
            ✏️
          </button>
          <button onClick={() => onEliminar(producto)} title="Eliminar producto"
            className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg text-sm transition-colors">
            🗑️
          </button>
        </div>
      )}
    </div>
  );
}

function Stock() {
  const navigate = useNavigate();
  const [productos, setProductos] = useState([]);
  const [secciones, setSecciones] = useState([]);
  const [categorias, setCategorias] = useState([]);           // categorías REALES de productos
  const [categoriaFiltro, setCategoriaFiltro] = useState(''); // filtro por categoría real
  const [buscar, setBuscar] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [organizar, setOrganizar] = useState(false);
  const [abiertas, setAbiertas] = useState({});
  const [visibles, setVisibles] = useState({});

  // Modal Ajustar (flujo principal del inventario: tocar Ajustar y escribir la cantidad)
  const [mostrarAjustar, setMostrarAjustar] = useState(false);
  const [productoAjustar, setProductoAjustar] = useState(null);
  const [nuevoStock, setNuevoStock] = useState('');
  const inputAjustarRef = useRef(null);

  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [productoHistorial, setProductoHistorial] = useState(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const cargarTodo = async () => {
    try {
      setCargando(true);
      const [resSec, resProd, resCat] = await Promise.all([
        api.get('/api/stock-categorias'),
        api.get('/api/productos'), // sin paginación: lista completa con stock_categoria_id y stock_orden
        api.get('/api/categorias'),
      ]);
      setSecciones(resSec.data || []);
      setProductos(Array.isArray(resProd.data) ? resProd.data : (resProd.data.productos || []));
      setCategorias(resCat.data || []);
    } catch (e) {
      console.error(e);
      setError('Error al cargar el inventario');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargarTodo(); }, []);

  // Autofoco + selección del número al abrir el modal Ajustar (tipeo directo)
  useEffect(() => {
    if (mostrarAjustar && inputAjustarRef.current) {
      inputAjustarRef.current.focus();
      inputAjustarRef.current.select();
    }
  }, [mostrarAjustar]);

  const avisoOk = (msg) => { setExito(msg); setTimeout(() => setExito(''), 2500); };
  const avisoError = (msg) => { setError(msg); setTimeout(() => setError(''), 4000); };

  // ---- Filtro por categoría real + agrupado por sección ----
  const productosFiltrados = useMemo(() => {
    if (!categoriaFiltro) return productos;
    return productos.filter(p => String(p.categoria_id) === String(categoriaFiltro));
  }, [productos, categoriaFiltro]);

  const grupos = useMemo(() => {
    const mapa = {};
    for (const p of productosFiltrados) {
      const clave = p.stock_categoria_id ?? SIN_UBICACION;
      if (!mapa[clave]) mapa[clave] = [];
      mapa[clave].push(p);
    }
    for (const clave of Object.keys(mapa)) {
      mapa[clave].sort((a, b) => (a.stock_orden || 0) - (b.stock_orden || 0) || String(a.nombre).localeCompare(String(b.nombre), 'es'));
    }
    return mapa;
  }, [productosFiltrados]);

  // Búsqueda: lista plana
  const resultadosBusqueda = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    if (!q) return null;
    return productosFiltrados.filter(p =>
      String(p.nombre || '').toLowerCase().includes(q) ||
      String(p.codigo || '').toLowerCase().includes(q)
    ).slice(0, 80);
  }, [buscar, productosFiltrados]);

  // ---- AJUSTAR STOCK (flujo principal: escribir la cantidad contada) ----
  const abrirAjustar = (producto) => {
    setProductoAjustar(producto);
    setNuevoStock(String(producto.stock ?? 0));
    setMostrarAjustar(true);
  };

  const guardarAjuste = async () => {
    const parsed = parseInt(nuevoStock, 10);
    if (isNaN(parsed) || parsed < 0) {
      avisoError('Ingresá una cantidad válida (0 o más)');
      return;
    }
    try {
      await api.put(`/api/productos/${productoAjustar.id}/stock`, { stock: parsed });
      setProductos(prev => prev.map(p => p.id === productoAjustar.id ? { ...p, stock: parsed } : p));
      setMostrarAjustar(false);
      setProductoAjustar(null);
      avisoOk(`✅ ${productoAjustar.nombre}: ${parsed}`);
    } catch (e) {
      avisoError('Error al actualizar el stock');
    }
  };

  // ---- Acciones por producto ----
  const eliminarProducto = async (producto) => {
    if (!window.confirm(`¿Desactivar "${producto.nombre}"?\n\nDeja de aparecer en el inventario y el punto de venta.`)) return;
    try {
      await api.delete(`/api/productos/${producto.id}`);
      setProductos(prev => prev.filter(p => p.id !== producto.id));
      avisoOk('Producto desactivado');
    } catch (e) {
      avisoError('Error al desactivar el producto');
    }
  };

  const modificarProducto = () => navigate('/admin/productos');

  const abrirHistorial = async (producto) => {
    try {
      const res = await api.get(`/api/productos/${producto.id}/historial-stock`);
      setHistorial(res.data || []);
      setProductoHistorial(producto);
      setMostrarHistorial(true);
    } catch (e) {
      avisoError('Error al cargar historial');
    }
  };

  // ---- Mover producto a otra sección ----
  const moverProducto = async (producto, catId) => {
    try {
      await api.put('/api/productos/stock-organizar', { producto_id: producto.id, stock_categoria_id: catId });
      const maxOrden = Math.max(0, ...productos.filter(p => (p.stock_categoria_id ?? null) === catId).map(p => p.stock_orden || 0));
      setProductos(prev => prev.map(p => p.id === producto.id ? { ...p, stock_categoria_id: catId, stock_orden: maxOrden + 1 } : p));
      setAbiertas(prev => ({ ...prev, [catId ?? SIN_UBICACION]: true }));
    } catch (e) {
      avisoError('No se pudo mover el producto');
    }
  };

  // ---- Drag & drop dentro de una sección ----
  const onDragEnd = async (claveSeccion, event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const lista = grupos[claveSeccion] || [];
    const ids = lista.map(p => p.id);
    const desde = ids.indexOf(active.id);
    const hasta = ids.indexOf(over.id);
    if (desde === -1 || hasta === -1) return;

    const nuevoOrden = arrayMove(ids, desde, hasta);

    setProductos(prev => prev.map(p => {
      const idx = nuevoOrden.indexOf(p.id);
      return idx === -1 ? p : { ...p, stock_orden: idx + 1 };
    }));

    try {
      await api.put('/api/productos/stock-reordenar', { ids: nuevoOrden });
    } catch (e) {
      avisoError('No se pudo guardar el orden');
      cargarTodo();
    }
  };

  // ---- Secciones ----
  const crearSeccion = async () => {
    const nombre = window.prompt('Nombre de la nueva sección\n(ej: Góndola 1, Heladera, Depósito)');
    if (!nombre || !nombre.trim()) return;
    try {
      const res = await api.post('/api/stock-categorias', { nombre: nombre.trim() });
      setSecciones(prev => [...prev, res.data]);
      setAbiertas(prev => ({ ...prev, [res.data.id]: true }));
      avisoOk(`Sección "${res.data.nombre}" creada`);
    } catch (e) {
      avisoError(e.response?.data?.error || 'Error al crear la sección');
    }
  };

  const renombrarSeccion = async (sec) => {
    const nombre = window.prompt('Nuevo nombre de la sección', sec.nombre);
    if (!nombre || !nombre.trim() || nombre.trim() === sec.nombre) return;
    try {
      await api.put(`/api/stock-categorias/${sec.id}`, { nombre: nombre.trim() });
      setSecciones(prev => prev.map(s => s.id === sec.id ? { ...s, nombre: nombre.trim() } : s));
    } catch (e) {
      avisoError('Error al renombrar');
    }
  };

  const eliminarSeccion = async (sec) => {
    const cant = (grupos[sec.id] || []).length;
    if (!window.confirm(`¿Eliminar la sección "${sec.nombre}"?${cant > 0 ? `\n\nSus producto(s) pasan a "Sin ubicación" (no se borran).` : ''}`)) return;
    try {
      await api.delete(`/api/stock-categorias/${sec.id}`);
      setSecciones(prev => prev.filter(s => s.id !== sec.id));
      setProductos(prev => prev.map(p => p.stock_categoria_id === sec.id ? { ...p, stock_categoria_id: null } : p));
    } catch (e) {
      avisoError('Error al eliminar la sección');
    }
  };

  const moverSeccion = async (sec, direccion) => {
    const idx = secciones.findIndex(s => s.id === sec.id);
    const destino = direccion === 'arriba' ? idx - 1 : idx + 1;
    if (destino < 0 || destino >= secciones.length) return;
    const nuevas = arrayMove(secciones, idx, destino);
    setSecciones(nuevas);
    try {
      await api.put('/api/stock-categorias/reordenar', { ids: nuevas.map(s => s.id) });
    } catch (e) {
      avisoError('No se pudo guardar el orden de secciones');
    }
  };

  const propsFila = {
    organizar, secciones,
    onMover: moverProducto,
    onAjustar: abrirAjustar,
    onHistorial: abrirHistorial,
    onModificar: modificarProducto,
    onEliminar: eliminarProducto,
  };

  // ---- Render de una sección ----
  const renderSeccion = (sec) => {
    const clave = sec ? sec.id : SIN_UBICACION;
    const lista = grupos[clave] || [];
    const abierta = !!abiertas[clave];
    const lim = visibles[clave] || 30;
    const bajos = lista.filter(p => Number(p.stock) <= Number(p.stock_minimo ?? 0)).length;

    // Con filtro de categoría activo, ocultar secciones vacías (menos ruido)
    if (categoriaFiltro && lista.length === 0) return null;

    return (
      <div key={clave} className="bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2.5 bg-white border-b border-gray-100">
          <button onClick={() => setAbiertas(prev => ({ ...prev, [clave]: !abierta }))}
            className="flex-1 flex items-center gap-2 text-left min-w-0">
            <span className={`text-gray-400 transition-transform ${abierta ? 'rotate-90' : ''}`}>▶</span>
            <span className="font-semibold text-gray-800 text-sm truncate">{sec ? sec.nombre : '📦 Sin ubicación'}</span>
            <span className="text-xs text-gray-400 flex-shrink-0">({lista.length})</span>
            {bajos > 0 && <span className="text-[11px] bg-red-100 text-red-600 font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0">⚠ {bajos}</span>}
          </button>

          {organizar && sec && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={() => moverSeccion(sec, 'arriba')} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 text-xs">↑</button>
              <button onClick={() => moverSeccion(sec, 'abajo')} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 text-xs">↓</button>
              <button onClick={() => renombrarSeccion(sec)} className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs">✏️</button>
              <button onClick={() => eliminarSeccion(sec)} className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 text-xs">🗑️</button>
            </div>
          )}
        </div>

        {abierta && (
          <div className="p-2 space-y-1.5">
            {lista.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">
                {organizar ? 'Mové productos acá usando el selector 📦 de cada producto' : 'Sin productos en esta sección'}
              </p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => onDragEnd(clave, e)}>
                <SortableContext items={lista.slice(0, lim).map(p => p.id)} strategy={verticalListSortingStrategy}>
                  {lista.slice(0, lim).map(p => <FilaProducto key={p.id} producto={p} {...propsFila} />)}
                </SortableContext>
              </DndContext>
            )}
            {lista.length > lim && (
              <button onClick={() => setVisibles(prev => ({ ...prev, [clave]: lim + 50 }))}
                className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 bg-white rounded-xl border border-dashed border-gray-300">
                Mostrar 50 más ({lista.length - lim} restantes)
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3 pb-20">

      {/* Encabezado */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800">📦 Stock</h2>
          <p className="text-xs sm:text-sm text-gray-500">Organizá las secciones igual que tus estanterías y contá más rápido</p>
        </div>
        <div className="flex gap-2">
          {organizar && (
            <button onClick={crearSeccion}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-sm font-semibold transition-colors">
              ➕ Sección
            </button>
          )}
          <button onClick={() => setOrganizar(v => !v)}
            className={`px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${organizar ? 'bg-orange-500 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
            {organizar ? '✅ Listo' : '✋ Organizar'}
          </button>
        </div>
      </div>

      {organizar && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 text-xs text-orange-800">
          Modo organizar: arrastrá con ☰ para ordenar los productos como están en la góndola,
          usá el selector 📦 para moverlos de sección, y filtrá por categoría para encontrarlos más fácil.
        </div>
      )}

      {/* Buscador + filtro por categoría real */}
      <div className="flex gap-2 flex-col sm:flex-row">
        <div className="relative flex-1">
          <span className="absolute left-3 top-2.5 text-gray-400 text-sm">🔍</span>
          <input value={buscar} onChange={(e) => setBuscar(e.target.value)}
            className="w-full border border-gray-300 rounded-xl pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Buscar producto por nombre o código..." />
          {buscar && (
            <button onClick={() => setBuscar('')} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">✕</button>
          )}
        </div>
        <select value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)}
          className={`border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 sm:max-w-[200px] ${categoriaFiltro ? 'border-green-500 bg-green-50 font-medium' : 'border-gray-300'}`}>
          <option value="">🏷️ Todas las categorías</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>

      {error && <div className="bg-red-100 border border-red-300 text-red-700 px-3 py-2 rounded-xl text-sm">❌ {error}</div>}
      {exito && <div className="bg-green-100 border border-green-300 text-green-700 px-3 py-2 rounded-xl text-sm">{exito}</div>}

      {cargando ? (
        <p className="text-center text-gray-400 py-10">Cargando inventario...</p>
      ) : resultadosBusqueda ? (
        /* ---- Resultados de búsqueda (lista plana) ---- */
        <div className="space-y-1.5">
          <p className="text-xs text-gray-400">{resultadosBusqueda.length} resultado(s)</p>
          {resultadosBusqueda.map(p => <FilaProducto key={p.id} producto={p} {...propsFila} />)}
        </div>
      ) : (
        /* ---- Secciones en el orden del local ---- */
        <div className="space-y-2">
          {secciones.map(sec => renderSeccion(sec))}
          {renderSeccion(null)}
          {secciones.length === 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
              <p className="text-sm text-blue-800 font-medium mb-1">💡 Organizá tu inventario como tu local</p>
              <p className="text-xs text-blue-600 mb-3">
                Creá secciones (Góndola 1, Heladera, Depósito...) y ordená los productos igual que en las estanterías.
                Así hacés el stock recorriendo el local sin buscar nada.
              </p>
              <button onClick={() => { setOrganizar(true); crearSeccion(); }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold">
                ➕ Crear mi primera sección
              </button>
            </div>
          )}
        </div>
      )}

      {/* ---- Modal AJUSTAR (flujo principal del inventario) ---- */}
      {mostrarAjustar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b bg-yellow-50">
              <h3 className="font-bold text-gray-800">📋 Ajustar stock</h3>
              <p className="text-sm text-gray-600 truncate">{productoAjustar?.nombre}</p>
              <p className="text-xs text-gray-400 mt-0.5">Stock actual: {productoAjustar?.stock ?? 0}</p>
            </div>
            <div className="p-4 space-y-3">
              <label className="block text-sm font-medium text-gray-700">Cantidad contada</label>
              <div className="flex items-center gap-2">
                <button onClick={() => setNuevoStock(String(Math.max(0, (parseInt(nuevoStock) || 0) - 1)))}
                  className="w-12 h-12 rounded-xl bg-red-100 hover:bg-red-200 active:scale-95 text-red-700 font-bold text-xl transition-all">−</button>
                <input
                  ref={inputAjustarRef}
                  type="number" inputMode="numeric" min="0"
                  value={nuevoStock}
                  onChange={(e) => setNuevoStock(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') guardarAjuste(); }}
                  className="flex-1 h-12 text-center text-2xl font-bold border-2 border-gray-300 rounded-xl focus:outline-none focus:border-yellow-400"
                />
                <button onClick={() => setNuevoStock(String((parseInt(nuevoStock) || 0) + 1))}
                  className="w-12 h-12 rounded-xl bg-green-100 hover:bg-green-200 active:scale-95 text-green-700 font-bold text-xl transition-all">+</button>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => { setMostrarAjustar(false); setProductoAjustar(null); }}
                  className="flex-1 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button onClick={guardarAjuste}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-colors">
                  ✅ Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal historial */}
      {mostrarHistorial && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <div>
                <h3 className="font-bold text-gray-800">🕒 Historial de stock</h3>
                <p className="text-xs text-gray-500">{productoHistorial?.nombre}</p>
              </div>
              <button onClick={() => setMostrarHistorial(false)} className="text-2xl text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {historial.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-6">Sin movimientos registrados</p>
              ) : historial.map(h => (
                <div key={h.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2 text-sm">
                  <span className="text-gray-500 text-xs">{new Date(h.fecha).toLocaleString('es-AR')}</span>
                  <span className="font-medium text-gray-700">
                    {h.stock_anterior} → <span className={h.stock_nuevo >= h.stock_anterior ? 'text-green-600' : 'text-red-500'}>{h.stock_nuevo}</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="p-3 border-t">
              <button onClick={() => setMostrarHistorial(false)}
                className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Stock;
