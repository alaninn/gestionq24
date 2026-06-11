// =============================================
// ARCHIVO: src/components/admin/Stock.jsx
// Pantalla de inventario pensada para usarse CAMINANDO por el local con el
// celular: secciones propias (góndolas, heladeras, depósito...) que reflejan
// el orden físico de las estanterías, productos arrastrables para ordenarlos
// igual que en la góndola, y botones grandes +/− para contar rápido.
// =============================================

import { useState, useEffect, useRef, useMemo } from 'react';
import api from '../../api/axios';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SIN_UBICACION = 'sin';

// ---- Control de stock con botones grandes (para usar con el pulgar) ----
function ControlStock({ producto, onCambiar }) {
  const [valor, setValor] = useState(String(producto.stock ?? 0));

  useEffect(() => { setValor(String(producto.stock ?? 0)); }, [producto.stock]);

  const aplicar = (nuevo) => {
    const n = Math.max(0, parseInt(nuevo, 10) || 0);
    setValor(String(n));
    onCambiar(producto, n);
  };

  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <button onClick={() => aplicar((parseInt(valor) || 0) - 1)}
        className="w-9 h-9 rounded-xl bg-red-100 hover:bg-red-200 active:scale-95 text-red-700 font-bold text-lg transition-all">−</button>
      <input
        type="number" inputMode="numeric" value={valor}
        onChange={(e) => setValor(e.target.value)}
        onBlur={() => aplicar(valor)}
        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
        className="w-14 h-9 text-center font-bold text-gray-800 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
      />
      <button onClick={() => aplicar((parseInt(valor) || 0) + 1)}
        className="w-9 h-9 rounded-xl bg-green-100 hover:bg-green-200 active:scale-95 text-green-700 font-bold text-lg transition-all">+</button>
    </div>
  );
}

// ---- Fila de producto (arrastrable en modo organizar) ----
function FilaProducto({ producto, organizar, secciones, onMover, onCambiarStock, onHistorial }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: producto.id, disabled: !organizar });

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const stockBajo = Number(producto.stock) <= Number(producto.stock_minimo ?? 0);

  return (
    <div ref={setNodeRef} style={style}
      className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 ${stockBajo ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'} ${isDragging ? 'shadow-lg z-10' : ''}`}>

      {organizar && (
        <button {...attributes} {...listeners} style={{ touchAction: 'none' }}
          title="Arrastrá para ordenar"
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 px-1.5 py-2 text-lg leading-none flex-shrink-0 select-none">
          ☰
        </button>
      )}

      <button onClick={() => onHistorial(producto)} className="flex-1 min-w-0 text-left">
        <p className="text-sm font-medium text-gray-800 truncate leading-tight">{producto.nombre}</p>
        <p className="text-[11px] text-gray-400">
          {stockBajo && <span className="text-red-500 font-semibold">⚠ bajo · </span>}
          mín: {producto.stock_minimo ?? 0}{producto.unidad ? ` · ${producto.unidad}` : ''}
        </p>
      </button>

      {organizar ? (
        <select
          value={producto.stock_categoria_id ?? ''}
          onChange={(e) => onMover(producto, e.target.value === '' ? null : parseInt(e.target.value))}
          className="text-xs border border-gray-300 rounded-lg px-1.5 py-2 max-w-[120px] bg-white flex-shrink-0">
          <option value="">📦 Sin ubicación</option>
          {secciones.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
      ) : (
        <ControlStock producto={producto} onCambiar={onCambiarStock} />
      )}
    </div>
  );
}

function Stock() {
  const [productos, setProductos] = useState([]);
  const [secciones, setSecciones] = useState([]);
  const [buscar, setBuscar] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [organizar, setOrganizar] = useState(false);
  const [abiertas, setAbiertas] = useState({});      // qué secciones están desplegadas
  const [visibles, setVisibles] = useState({});      // cuántos productos se muestran por sección
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [productoHistorial, setProductoHistorial] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const timersStock = useRef({}); // debounce de guardado por producto

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const cargarTodo = async () => {
    try {
      setCargando(true);
      const [resSec, resProd] = await Promise.all([
        api.get('/api/stock-categorias'),
        api.get('/api/productos'), // sin paginación: lista completa con stock_categoria_id y stock_orden
      ]);
      setSecciones(resSec.data || []);
      setProductos(Array.isArray(resProd.data) ? resProd.data : (resProd.data.productos || []));
    } catch (e) {
      console.error(e);
      setError('Error al cargar el inventario');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargarTodo(); }, []);

  const avisoOk = (msg) => { setExito(msg); setTimeout(() => setExito(''), 2500); };
  const avisoError = (msg) => { setError(msg); setTimeout(() => setError(''), 4000); };

  // ---- Agrupar productos por sección, ordenados por stock_orden ----
  const grupos = useMemo(() => {
    const mapa = {};
    for (const p of productos) {
      const clave = p.stock_categoria_id ?? SIN_UBICACION;
      if (!mapa[clave]) mapa[clave] = [];
      mapa[clave].push(p);
    }
    for (const clave of Object.keys(mapa)) {
      mapa[clave].sort((a, b) => (a.stock_orden || 0) - (b.stock_orden || 0) || String(a.nombre).localeCompare(String(b.nombre), 'es'));
    }
    return mapa;
  }, [productos]);

  // Búsqueda: lista plana (sirve para encontrar algo puntual sin recorrer secciones)
  const resultadosBusqueda = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    if (!q) return null;
    return productos.filter(p =>
      String(p.nombre || '').toLowerCase().includes(q) ||
      String(p.codigo || '').toLowerCase().includes(q)
    ).slice(0, 80);
  }, [buscar, productos]);

  // ---- Guardar stock con debounce (no spamea el servidor al apretar +++) ----
  const cambiarStock = (producto, nuevo) => {
    setProductos(prev => prev.map(p => p.id === producto.id ? { ...p, stock: nuevo } : p));
    if (timersStock.current[producto.id]) clearTimeout(timersStock.current[producto.id]);
    timersStock.current[producto.id] = setTimeout(async () => {
      try {
        setGuardando(true);
        await api.put(`/api/productos/${producto.id}/stock`, { stock: nuevo });
      } catch (e) {
        avisoError(`No se pudo guardar el stock de ${producto.nombre}`);
      } finally {
        setGuardando(false);
      }
    }, 600);
  };

  // ---- Mover producto a otra sección ----
  const moverProducto = async (producto, catId) => {
    try {
      await api.put('/api/productos/stock-organizar', { producto_id: producto.id, stock_categoria_id: catId });
      const maxOrden = Math.max(0, ...productos.filter(p => (p.stock_categoria_id ?? null) === catId).map(p => p.stock_orden || 0));
      setProductos(prev => prev.map(p => p.id === producto.id ? { ...p, stock_categoria_id: catId, stock_orden: maxOrden + 1 } : p));
      // Asegurar que la sección destino esté abierta para verlo
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

    // Optimista: aplicar stock_orden según nueva posición
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
    if (!window.confirm(`¿Eliminar la sección "${sec.nombre}"?${cant > 0 ? `\n\nSus ${cant} producto(s) pasan a "Sin ubicación" (no se borran).` : ''}`)) return;
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

  // ---- Historial ----
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

  // ---- Render de una sección ----
  const renderSeccion = (sec) => {
    const clave = sec ? sec.id : SIN_UBICACION;
    const lista = grupos[clave] || [];
    const abierta = !!abiertas[clave];
    const lim = visibles[clave] || 30;
    const bajos = lista.filter(p => Number(p.stock) <= Number(p.stock_minimo ?? 0)).length;

    return (
      <div key={clave} className="bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden">
        {/* Encabezado de la sección */}
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

        {/* Productos */}
        {abierta && (
          <div className="p-2 space-y-1.5">
            {lista.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">
                {organizar ? 'Arrastrá productos acá usando el selector 📦 de cada producto' : 'Sin productos en esta sección'}
              </p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => onDragEnd(clave, e)}>
                <SortableContext items={lista.slice(0, lim).map(p => p.id)} strategy={verticalListSortingStrategy}>
                  {lista.slice(0, lim).map(p => (
                    <FilaProducto key={p.id} producto={p} organizar={organizar} secciones={secciones}
                      onMover={moverProducto} onCambiarStock={cambiarStock} onHistorial={abrirHistorial} />
                  ))}
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
          usá el selector para moverlos de sección, y ↑↓ para ordenar las secciones.
        </div>
      )}

      {/* Buscador */}
      <div className="relative">
        <span className="absolute left-3 top-2.5 text-gray-400 text-sm">🔍</span>
        <input value={buscar} onChange={(e) => setBuscar(e.target.value)}
          className="w-full border border-gray-300 rounded-xl pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="Buscar producto por nombre o código..." />
        {buscar && (
          <button onClick={() => setBuscar('')} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">✕</button>
        )}
      </div>

      {error && <div className="bg-red-100 border border-red-300 text-red-700 px-3 py-2 rounded-xl text-sm">❌ {error}</div>}
      {exito && <div className="bg-green-100 border border-green-300 text-green-700 px-3 py-2 rounded-xl text-sm">✅ {exito}</div>}
      {guardando && <div className="fixed bottom-4 right-4 bg-gray-800 text-white text-xs px-3 py-1.5 rounded-full shadow-lg z-40">💾 Guardando...</div>}

      {cargando ? (
        <p className="text-center text-gray-400 py-10">Cargando inventario...</p>
      ) : resultadosBusqueda ? (
        /* ---- Resultados de búsqueda (lista plana) ---- */
        <div className="space-y-1.5">
          <p className="text-xs text-gray-400">{resultadosBusqueda.length} resultado(s)</p>
          {resultadosBusqueda.map(p => (
            <FilaProducto key={p.id} producto={p} organizar={organizar} secciones={secciones}
              onMover={moverProducto} onCambiarStock={cambiarStock} onHistorial={abrirHistorial} />
          ))}
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
