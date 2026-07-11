// =============================================
// ARCHIVO: src/components/admin/Stock.jsx
// Pantalla de inventario pensada para usarse CAMINANDO por el local con el
// celular: secciones propias (góndolas, heladeras, depósito...) que reflejan
// el orden físico de las estanterías. El usuario recorre el local y toca
// "Ajustar" en cada producto para escribir la cantidad contada.
// =============================================

import { useState, useEffect, useRef, useMemo } from 'react';
import api from '../../api/axios';
import useCerrarConAtras from '../../hooks/useCerrarConAtras';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const SIN_UBICACION = 'sin';

// Detecta cuánto espacio tapa el teclado del celular (Visual Viewport API).
// Sirve para posicionar el panel de conteo PEGADO ENCIMA del teclado,
// con los botones siempre visibles sin tener que cerrarlo.
function useAlturaTeclado() {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const medir = () => {
      setOffset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    };
    vv.addEventListener('resize', medir);
    vv.addEventListener('scroll', medir);
    medir();
    return () => {
      vv.removeEventListener('resize', medir);
      vv.removeEventListener('scroll', medir);
    };
  }, []);
  return offset;
}

// Evita que tocar un botón le quite el foco al input (cerraría el teclado).
// Así el flujo "tipear → Guardar y seguir → tipear" no se interrumpe nunca.
const mantenerTeclado = (e) => e.preventDefault();

// ---- Fila de producto ----
// Modo normal: stock visible + botones Ajustar / Historial / Modificar / Eliminar
// Modo organizar: handle de arrastre + selector de sección
function FilaProducto({ producto, organizar, secciones, onMover, onAjustar, onHistorial, onModificar, onEliminar }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: producto.id, disabled: !organizar });

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const stockBajo = Number(producto.stock) <= Number(producto.stock_minimo ?? 0);

  // ---- MODO ORGANIZAR: fila minimalista ----
  // Solo importa LEER el nombre y mover: handle ☰ + nombre a ancho completo
  // + ícono 📍 que abre el selector de sección (sin stock ni categoría).
  if (organizar) {
    return (
      <div ref={setNodeRef} style={style}
        className={`flex items-center gap-1.5 rounded-xl border bg-white border-gray-200 px-2 py-1.5 ${isDragging ? 'shadow-lg z-10' : ''}`}>

        <button {...attributes} {...listeners} style={{ touchAction: 'none' }}
          title="Arrastrá para ordenar"
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 px-1.5 py-2.5 text-lg leading-none flex-shrink-0 select-none">
          ☰
        </button>

        <p className="flex-1 min-w-0 text-sm font-medium text-gray-800 leading-snug break-words"
          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {producto.nombre}
        </p>

        {/* Mover de sección: solo un ícono; al tocarlo se abre el selector nativo */}
        <div className="relative w-10 h-10 flex-shrink-0" title="Mover a otra sección">
          <span className="absolute inset-0 flex items-center justify-center bg-blue-50 hover:bg-blue-100 rounded-xl text-lg">📍</span>
          <select
            value={producto.stock_categoria_id ?? ''}
            onChange={(e) => onMover(producto, e.target.value === '' ? null : parseInt(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer">
            <option value="">📦 Sin ubicación</option>
            {secciones.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
      </div>
    );
  }

  // ---- MODO NORMAL: stock visible + botones de acción ----
  return (
    <div ref={setNodeRef} style={style}
      className={`rounded-xl border px-3 py-2 shadow-sm ${stockBajo ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>

      <div className="flex items-center gap-2">
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
      </div>

      {/* Botones de acción */}
      <div className="flex gap-1.5 mt-2">
        <button onClick={() => onAjustar(producto)}
          className="px-5 py-1.5 bg-amber-100 hover:bg-amber-200 active:scale-95 text-amber-700 border border-amber-200 rounded-lg text-sm font-semibold transition-all">
          Ajustar
        </button>
        <span className="flex-1" />
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
    </div>
  );
}

function Stock() {
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

  // Modal Agregar stock (recepción de mercadería: suma existencias al stock actual)
  const [mostrarAgregarStock, setMostrarAgregarStock] = useState(false);

  // Menú de exportación (Excel / PDF) del inventario filtrado
  const [mostrarExportar, setMostrarExportar] = useState(false);

  // Modal Ajustar (flujo principal del inventario: tocar Ajustar y escribir la cantidad)
  const [mostrarAjustar, setMostrarAjustar] = useState(false);
  const [productoAjustar, setProductoAjustar] = useState(null);
  const [nuevoStock, setNuevoStock] = useState('');
  const inputAjustarRef = useRef(null);

  // Modo conteo secuencial: recorre una sección producto por producto sin volver a la lista
  const [conteo, setConteo] = useState(null); // { ids: [], idx, titulo }
  const [soloBajos, setSoloBajos] = useState(false);

  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [productoHistorial, setProductoHistorial] = useState(null);

  // Modal de edición rápida del producto (sin salir del inventario)
  const [mostrarEditar, setMostrarEditar] = useState(false);
  const [productoEditar, setProductoEditar] = useState(null);
  const [formEditar, setFormEditar] = useState({});
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const alturaTeclado = useAlturaTeclado();

  // El botón "atrás" del celular cierra el modal abierto (no sale de la página)
  useCerrarConAtras(mostrarAjustar, () => cerrarAjustar());
  useCerrarConAtras(mostrarEditar, () => setMostrarEditar(false));
  useCerrarConAtras(mostrarHistorial, () => setMostrarHistorial(false));

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

  // Autofoco + selección del número al abrir el modal Ajustar o avanzar de producto
  // (en el modo conteo, el teclado queda abierto y el número seleccionado: tipeo directo)
  useEffect(() => {
    if (mostrarAjustar && inputAjustarRef.current) {
      inputAjustarRef.current.focus();
      inputAjustarRef.current.select();
    }
  }, [mostrarAjustar, productoAjustar?.id]);

  const avisoOk = (msg) => { setExito(msg); setTimeout(() => setExito(''), 2500); };
  const avisoError = (msg) => { setError(msg); setTimeout(() => setError(''), 4000); };

  // ---- Filtros (categoría real + solo stock bajo) ----
  const totalBajos = useMemo(
    () => productos.filter(p => Number(p.stock) <= Number(p.stock_minimo ?? 0)).length,
    [productos]
  );

  const productosFiltrados = useMemo(() => {
    let lista = productos;
    if (categoriaFiltro) lista = lista.filter(p => String(p.categoria_id) === String(categoriaFiltro));
    if (soloBajos) lista = lista.filter(p => Number(p.stock) <= Number(p.stock_minimo ?? 0));
    return lista;
  }, [productos, categoriaFiltro, soloBajos]);

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
    setConteo(null); // ajuste individual, sin secuencia
    setProductoAjustar(producto);
    setNuevoStock(String(producto.stock ?? 0));
    setMostrarAjustar(true);
  };

  const cerrarAjustar = () => {
    setMostrarAjustar(false);
    setProductoAjustar(null);
    setConteo(null);
  };

  // ---- MODO CONTEO: recorre la sección producto por producto ----
  const iniciarConteo = (sec, lista) => {
    if (!lista || lista.length === 0) return;
    const primero = lista[0];
    setConteo({ ids: lista.map(p => p.id), idx: 0, titulo: sec ? sec.nombre : 'Sin ubicación' });
    setProductoAjustar(primero);
    setNuevoStock(String(primero.stock ?? 0));
    setMostrarAjustar(true);
  };

  // Avanza al siguiente producto de la secuencia (o termina)
  const avanzarConteo = (estadoConteo) => {
    const siguienteIdx = estadoConteo.idx + 1;
    if (siguienteIdx >= estadoConteo.ids.length) {
      cerrarAjustar();
      avisoOk(`🎉 "${estadoConteo.titulo}" contada completa (${estadoConteo.ids.length} productos)`);
      return;
    }
    const siguiente = productos.find(p => p.id === estadoConteo.ids[siguienteIdx]);
    if (!siguiente) { cerrarAjustar(); return; }
    setConteo({ ...estadoConteo, idx: siguienteIdx });
    setProductoAjustar(siguiente);
    setNuevoStock(String(siguiente.stock ?? 0));
  };

  const omitirProducto = () => {
    if (conteo) avanzarConteo(conteo);
  };

  const guardarAjuste = async () => {
    const parsed = parseInt(nuevoStock, 10);
    if (isNaN(parsed) || parsed < 0) {
      avisoError('Ingresá una cantidad válida (0 o más)');
      return;
    }
    const producto = productoAjustar;
    try {
      await api.put(`/api/productos/${producto.id}/stock`, { stock: parsed });
      setProductos(prev => prev.map(p => p.id === producto.id ? { ...p, stock: parsed } : p));
      if (conteo) {
        // En modo conteo, guardar avanza directo al siguiente (sin cerrar el teclado)
        avanzarConteo(conteo);
      } else {
        cerrarAjustar();
        avisoOk(`✅ ${producto.nombre}: ${parsed}`);
      }
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

  // ---- Edición rápida en el lugar (sin ir a la pantalla de Productos) ----
  const modificarProducto = (producto) => {
    setProductoEditar(producto);
    setFormEditar({
      nombre: producto.nombre || '',
      codigo: producto.codigo || '',
      categoria_id: producto.categoria_id || '',
      precio_costo: producto.precio_costo ?? '',
      precio_venta: producto.precio_venta ?? '',
      stock_minimo: producto.stock_minimo ?? 0,
      unidad: producto.unidad || 'Uni',
    });
    setMostrarEditar(true);
  };

  const guardarEdicion = async (e) => {
    e.preventDefault();
    if (!formEditar.nombre.trim() || !formEditar.precio_venta) {
      avisoError('Nombre y precio de venta son obligatorios');
      return;
    }
    try {
      setGuardandoEdicion(true);
      // Se envían TODOS los campos del producto: los editados desde el form
      // y el resto tal como estaban (el PUT del backend actualiza todo).
      const datos = {
        codigo: formEditar.codigo,
        nombre: formEditar.nombre,
        categoria_id: formEditar.categoria_id || null,
        precio_costo: formEditar.precio_costo || 0,
        precio_venta: formEditar.precio_venta,
        precio_mayorista: productoEditar.precio_mayorista || null,
        stock: productoEditar.stock ?? 0,
        stock_minimo: formEditar.stock_minimo || 0,
        unidad: formEditar.unidad,
        alicuota_iva: productoEditar.alicuota_iva ?? 0,
        margen_ganancia: productoEditar.margen_ganancia || 0,
      };
      const res = await api.put(`/api/productos/${productoEditar.id}`, datos);
      const catNombre = categorias.find(c => String(c.id) === String(formEditar.categoria_id))?.nombre || null;
      setProductos(prev => prev.map(p => p.id === productoEditar.id
        ? { ...p, ...res.data, categoria_nombre: catNombre }
        : p));
      setMostrarEditar(false);
      setProductoEditar(null);
      avisoOk(`✅ ${formEditar.nombre} actualizado`);
    } catch (err) {
      avisoError(err.response?.data?.error || 'Error al guardar el producto');
    } finally {
      setGuardandoEdicion(false);
    }
  };

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
      <div key={clave}
        className={`rounded-2xl border overflow-hidden transition-shadow ${abierta ? 'bg-gray-50 border-gray-200 shadow-sm' : 'bg-white border-gray-200'}`}
        style={abierta ? { borderLeft: '3px solid var(--color-primario)' } : {}}>
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

          {/* Conteo secuencial: recorre la sección sin volver a la lista */}
          {!organizar && lista.length > 0 && (
            <button onClick={() => iniciarConteo(sec, lista)}
              title="Contar esta sección producto por producto"
              style={{ backgroundColor: 'var(--color-primario)' }}
              className="flex-shrink-0 flex items-center gap-1 hover:opacity-90 active:scale-95 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm">
              ▶ Contar
            </button>
          )}
        </div>

        {abierta && (
          <div className="p-2 space-y-1.5 animate-aparecer">
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
          {!organizar && (
            <button onClick={() => setMostrarAgregarStock(true)}
              title="Sumar existencias al stock (recepción de mercadería / compra)"
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-xl text-sm font-semibold transition-colors">
              📥 Agregar stock
            </button>
          )}
          {!organizar && (
            <button onClick={() => setMostrarExportar(true)}
              title="Exportar el inventario (nombre y cantidad) a Excel o PDF"
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-xl text-sm font-semibold transition-colors">
              📤 Exportar
            </button>
          )}
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

      {/* Buscador + filtros — fijos arriba al hacer scroll, con efecto vidrio */}
      <div className="sticky top-0 z-20 bg-gray-50/85 backdrop-blur-md -mx-4 px-4 lg:-mx-6 lg:px-6 py-2 space-y-2 border-b border-gray-200/70">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-2.5 text-gray-400 text-sm">🔍</span>
            <input value={buscar} onChange={(e) => setBuscar(e.target.value)}
              className="w-full border border-gray-300 bg-white rounded-xl pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Buscar por nombre o código..." />
            {buscar && (
              <button onClick={() => setBuscar('')} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">✕</button>
            )}
          </div>
          <select value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)}
            className={`border rounded-xl px-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 max-w-[150px] sm:max-w-[200px] ${categoriaFiltro ? 'border-green-500 bg-green-50 font-medium' : 'border-gray-300 bg-white'}`}>
            <option value="">🏷️ Categorías</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>

        {/* Chips de estado */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-400">{productosFiltrados.length} productos</span>
          {totalBajos > 0 && (
            <button onClick={() => setSoloBajos(v => !v)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold transition-colors ${
                soloBajos ? 'bg-red-500 text-white' : 'bg-red-100 text-red-600 hover:bg-red-200'
              }`}>
              ⚠ {totalBajos} con stock bajo {soloBajos && '✕'}
            </button>
          )}
          {(categoriaFiltro || soloBajos) && (
            <button onClick={() => { setCategoriaFiltro(''); setSoloBajos(false); }}
              className="text-gray-400 hover:text-gray-600 underline">
              limpiar filtros
            </button>
          )}
        </div>
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

      {/* ---- Panel AJUSTAR / CONTEO ----
           Compacto y SIEMPRE pegado encima del teclado del celular:
           se ve el producto, el número y los botones sin cerrar el teclado. */}
      {mostrarAjustar && (
        <div className="fixed inset-0 bg-black/50 z-50 animate-velo" onClick={cerrarAjustar}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="fixed left-0 right-0 mx-auto w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-b-2xl shadow-2xl transition-[bottom] duration-150 animate-subir-panel"
            style={{ bottom: alturaTeclado }}>

            {/* Encabezado compacto: 1 línea + progreso */}
            <div className={`px-3 pt-2 pb-1.5 ${conteo ? 'bg-green-50' : 'bg-yellow-50'} rounded-t-2xl`}>
              <div className="flex items-center gap-2">
                {conteo && (
                  <span className="text-[11px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
                    {conteo.idx + 1}/{conteo.ids.length}
                  </span>
                )}
                <p className="flex-1 text-sm font-bold text-gray-800 truncate leading-tight">
                  {productoAjustar?.nombre}
                </p>
                <span className="text-[11px] text-gray-400 flex-shrink-0">actual: {productoAjustar?.stock ?? 0}</span>
                <button onClick={cerrarAjustar} onPointerDown={mantenerTeclado}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1 flex-shrink-0">×</button>
              </div>
              {conteo && (
                <div className="w-full bg-green-100 rounded-full h-1 mt-1.5">
                  <div className="bg-green-500 h-1 rounded-full transition-all duration-300"
                    style={{ width: `${((conteo.idx + 1) / conteo.ids.length) * 100}%` }} />
                </div>
              )}
            </div>

            {/* Todo en UNA fila: −, número, +, acción principal */}
            <div className="p-2.5 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <button onPointerDown={mantenerTeclado}
                  onClick={() => setNuevoStock(String(Math.max(0, (parseInt(nuevoStock) || 0) - 1)))}
                  className="w-11 h-12 rounded-xl bg-red-100 hover:bg-red-200 active:scale-95 text-red-700 font-bold text-xl transition-all flex-shrink-0">−</button>
                <input
                  ref={inputAjustarRef}
                  type="number" inputMode="numeric" min="0"
                  value={nuevoStock}
                  onChange={(e) => setNuevoStock(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                  onKeyDown={(e) => { if (e.key === 'Enter') guardarAjuste(); }}
                  className={`w-20 h-12 text-center text-2xl font-bold border-2 rounded-xl focus:outline-none flex-shrink-0 ${conteo ? 'border-green-300 focus:border-green-500' : 'border-gray-300 focus:border-yellow-400'}`}
                />
                <button onPointerDown={mantenerTeclado}
                  onClick={() => setNuevoStock(String((parseInt(nuevoStock) || 0) + 1))}
                  className="w-11 h-12 rounded-xl bg-green-100 hover:bg-green-200 active:scale-95 text-green-700 font-bold text-xl transition-all flex-shrink-0">+</button>

                <button onPointerDown={mantenerTeclado} onClick={guardarAjuste}
                  className="flex-1 h-12 bg-green-600 hover:bg-green-700 active:scale-[0.98] text-white rounded-xl font-bold text-base transition-all shadow-md leading-tight">
                  {conteo
                    ? (conteo.idx + 1 >= conteo.ids.length ? '✅ Terminar' : 'Guardar ➞')
                    : '✅ Guardar'}
                </button>
              </div>

              {/* Fila secundaria mínima */}
              <div className="flex items-center justify-between px-0.5">
                {conteo ? (
                  <button onPointerDown={mantenerTeclado} onClick={omitirProducto}
                    className="text-sm text-gray-500 hover:text-gray-700 font-medium py-1 px-2 -ml-2">
                    Omitir este producto ↷
                  </button>
                ) : (
                  <button onClick={cerrarAjustar} className="text-sm text-gray-500 hover:text-gray-700 font-medium py-1 px-2 -ml-2">
                    Cancelar
                  </button>
                )}
                {conteo && (
                  <span className="text-[11px] text-gray-400 truncate max-w-[50%]">▶ {conteo.titulo}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal edición rápida del producto */}
      {mostrarEditar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white">
              <h3 className="font-bold text-gray-800">✏️ Editar producto</h3>
              <button onClick={() => setMostrarEditar(false)} className="text-2xl text-gray-400 hover:text-gray-600">×</button>
            </div>

            <form onSubmit={guardarEdicion} className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input type="text" value={formEditar.nombre} required
                  onChange={(e) => setFormEditar(p => ({ ...p, nombre: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
                  <input type="text" value={formEditar.codigo}
                    onChange={(e) => setFormEditar(p => ({ ...p, codigo: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                  <select value={formEditar.categoria_id || ''}
                    onChange={(e) => setFormEditar(p => ({ ...p, categoria_id: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                    <option value="">Sin categoría</option>
                    {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio costo</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-400 text-sm">$</span>
                    <input type="number" min="0" step="0.01" value={formEditar.precio_costo}
                      onChange={(e) => setFormEditar(p => ({ ...p, precio_costo: e.target.value }))}
                      className="w-full border border-gray-300 rounded-xl pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio venta *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-400 text-sm">$</span>
                    <input type="number" min="0" step="0.01" required value={formEditar.precio_venta}
                      onChange={(e) => setFormEditar(p => ({ ...p, precio_venta: e.target.value }))}
                      className="w-full border-2 border-green-300 bg-green-50 rounded-xl pl-7 pr-3 py-2.5 text-sm font-semibold focus:outline-none focus:border-green-500" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock mínimo (alerta)</label>
                  <input type="number" min="0" value={formEditar.stock_minimo}
                    onChange={(e) => setFormEditar(p => ({ ...p, stock_minimo: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unidad</label>
                  <select value={formEditar.unidad}
                    onChange={(e) => setFormEditar(p => ({ ...p, unidad: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                    <option value="Uni">Unidad</option>
                    <option value="Kg">Kilogramo</option>
                    <option value="Lt">Litro</option>
                    <option value="Mt">Metro</option>
                  </select>
                </div>
              </div>

              <p className="text-xs text-gray-400">
                Para márgenes, IVA, mayorista o códigos alternativos, usá la pantalla Productos.
              </p>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setMostrarEditar(false)}
                  className="flex-1 py-2.5 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={guardandoEdicion}
                  className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50">
                  {guardandoEdicion ? 'Guardando...' : '💾 Guardar'}
                </button>
              </div>
            </form>
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
                  <div className="min-w-0">
                    <span className="text-gray-500 text-xs block">{new Date(h.fecha).toLocaleString('es-AR')}</span>
                    {(h.usuario_nombre || h.usuario_username) && (
                      <span className="text-gray-400 text-[11px] block truncate">por {h.usuario_nombre || h.usuario_username}</span>
                    )}
                  </div>
                  <span className="font-medium text-gray-700 flex-shrink-0 ml-2">
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

      {mostrarAgregarStock && (
        <ModalAgregarStock
          productos={productos}
          categorias={categorias}
          onClose={() => setMostrarAgregarStock(false)}
          onGuardado={(cant) => { setMostrarAgregarStock(false); avisoOk(`✅ Stock sumado a ${cant} producto(s)`); cargarTodo(); }}
        />
      )}

      {mostrarExportar && (
        <ModalExportarStock
          productos={productos}
          secciones={secciones}
          onClose={() => setMostrarExportar(false)}
          onExportado={(cant, formato) => { setMostrarExportar(false); avisoOk(`✅ ${cant} producto(s) exportados a ${formato}`); }}
        />
      )}
    </div>
  );
}

// =============================================
// MODAL: AGREGAR STOCK (recepción de mercadería)
// Busca por nombre o categoría y suma una cantidad al stock actual de cada
// producto (no lo reemplaza). Permite cargar varios a la vez.
// =============================================
function ModalAgregarStock({ productos, categorias, onClose, onGuardado }) {
  const [buscar, setBuscar] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [cantidades, setCantidades] = useState({}); // { [id]: '5' }
  const [guardando, setGuardando] = useState(false);

  const lista = productos.filter(p => {
    if (categoriaFiltro && String(p.categoria_id) !== String(categoriaFiltro)) return false;
    if (buscar.trim()) {
      const t = buscar.trim().toLowerCase();
      const txt = `${p.nombre || ''} ${p.codigo || ''}`.toLowerCase();
      if (!txt.includes(t)) return false;
    }
    return true;
  });

  const setCant = (id, v) => setCantidades(prev => ({ ...prev, [id]: v }));

  const items = Object.entries(cantidades)
    .map(([id, v]) => ({ id: Number(id), cantidad: parseInt(v, 10) }))
    .filter(it => it.cantidad && !isNaN(it.cantidad) && it.cantidad !== 0);

  const guardar = async () => {
    if (items.length === 0) return;
    setGuardando(true);
    try {
      await api.post('/api/productos/stock-sumar', { items });
      onGuardado(items.length);
    } catch (e) {
      alert(e.response?.data?.error || 'Error al sumar el stock');
    } finally { setGuardando(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b bg-green-600 text-white flex-shrink-0">
          <div>
            <h3 className="text-lg font-bold">📥 Agregar stock</h3>
            <p className="text-green-100 text-xs">Suma existencias al stock actual (recepción / compra). No reemplaza el número.</p>
          </div>
          <button onClick={onClose} className="text-green-100 hover:text-white text-2xl leading-none">×</button>
        </div>

        {/* Filtros */}
        <div className="p-3 sm:p-4 border-b flex gap-2 flex-shrink-0">
          <div className="relative flex-1">
            <span className="absolute left-3 top-2.5 text-gray-400 text-sm">🔍</span>
            <input value={buscar} onChange={(e) => setBuscar(e.target.value)} autoFocus
              className="w-full border border-gray-300 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Buscar por nombre o código..." />
          </div>
          <select value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)}
            className={`border rounded-xl px-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 max-w-[160px] ${categoriaFiltro ? 'border-green-500 bg-green-50 font-medium' : 'border-gray-300 bg-white'}`}>
            <option value="">🏷️ Categorías</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>

        {/* Lista de productos para sumar */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {lista.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-10">
              {buscar || categoriaFiltro ? 'No se encontraron productos.' : 'Buscá un producto o elegí una categoría para empezar.'}
            </p>
          ) : (
            lista.slice(0, 300).map(p => {
              const actual = Number(p.stock) || 0;
              const delta = parseInt(cantidades[p.id], 10);
              const nuevo = actual + (isNaN(delta) ? 0 : delta);
              const tieneCant = !isNaN(delta) && delta !== 0;
              return (
                <div key={p.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${tieneCant ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{p.nombre}</p>
                    <p className="text-[11px] text-gray-400">
                      {p.categoria_nombre || 'Sin categoría'} · stock actual:{' '}
                      <span className={actual < 0 ? 'text-red-600 font-semibold' : 'text-gray-600 font-semibold'}>{actual}{p.unidad ? ` ${p.unidad}` : ''}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-gray-400 text-sm">+</span>
                    <input type="number" value={cantidades[p.id] ?? ''} onChange={(e) => setCant(p.id, e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="0" />
                    {tieneCant && (
                      <span className="text-sm font-bold text-green-700 tabular-nums whitespace-nowrap">= {nuevo}</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t flex items-center justify-between gap-2 flex-shrink-0 bg-gray-50">
          <span className="text-sm text-gray-500">{items.length} producto(s) con cantidad</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 text-sm hover:bg-gray-100">Cancelar</button>
            <button onClick={guardar} disabled={guardando || items.length === 0}
              className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed">
              {guardando ? 'Guardando…' : '📥 Sumar al stock'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================
// MODAL: EXPORTAR STOCK (Excel / PDF)
// Muestra las SECCIONES del stock (góndolas, heladeras, depósito...) con sus
// productos para tildar con checkbox qué exportar. Solo exporta lo del stock:
// NOMBRE del producto y CANTIDAD en existencia.
// Pensado para celular: pantalla completa, secciones COLAPSADAS por defecto,
// botones grandes y resumen de lo seleccionado.
// =============================================
const SIN_UBIC_EXP = 'sin';

function ModalExportarStock({ productos, secciones, onClose, onExportado }) {
  const [buscar, setBuscar] = useState('');
  const [seleccion, setSeleccion] = useState(() => new Set(productos.map(p => p.id))); // por defecto: todos
  const [expandidas, setExpandidas] = useState(() => new Set()); // arranca TODO colapsado

  useCerrarConAtras(true, onClose);

  const textoBuscar = buscar.trim().toLowerCase();
  const coincide = (p) => !textoBuscar || `${p.nombre || ''} ${p.codigo || ''}`.toLowerCase().includes(textoBuscar);

  // Agrupa los productos (filtrados por búsqueda) en el orden de las secciones,
  // con "Sin ubicación" al final. Solo muestra secciones con productos visibles.
  const gruposOrdenados = useMemo(() => {
    const visibles = productos.filter(coincide);
    const porSeccion = new Map();
    for (const p of visibles) {
      const clave = p.stock_categoria_id ?? SIN_UBIC_EXP;
      if (!porSeccion.has(clave)) porSeccion.set(clave, []);
      porSeccion.get(clave).push(p);
    }
    for (const lista of porSeccion.values()) {
      lista.sort((a, b) => (a.stock_orden || 0) - (b.stock_orden || 0) || String(a.nombre).localeCompare(String(b.nombre), 'es'));
    }
    const grupos = [];
    for (const sec of secciones) {
      if (porSeccion.has(sec.id)) grupos.push({ clave: sec.id, nombre: sec.nombre, lista: porSeccion.get(sec.id) });
    }
    if (porSeccion.has(SIN_UBIC_EXP)) grupos.push({ clave: SIN_UBIC_EXP, nombre: '📦 Sin ubicación', lista: porSeccion.get(SIN_UBIC_EXP) });
    return grupos;
  }, [productos, secciones, textoBuscar]);

  const idsVisibles = useMemo(() => gruposOrdenados.flatMap(g => g.lista.map(p => p.id)), [gruposOrdenados]);
  const todosVisiblesTildados = idsVisibles.length > 0 && idsVisibles.every(id => seleccion.has(id));
  const algunosVisiblesTildados = !todosVisiblesTildados && idsVisibles.some(id => seleccion.has(id));

  // Buscando: se expande todo para ver los resultados sin tocar nada.
  const estaExpandida = (clave) => !!textoBuscar || expandidas.has(clave);
  const todasExpandidas = gruposOrdenados.length > 0 && gruposOrdenados.every(g => expandidas.has(g.clave));

  const toggleExpandir = (clave) => setExpandidas(prev => {
    const s = new Set(prev);
    s.has(clave) ? s.delete(clave) : s.add(clave);
    return s;
  });
  const expandirOColapsarTodo = () => {
    if (todasExpandidas) setExpandidas(new Set());
    else setExpandidas(new Set(gruposOrdenados.map(g => g.clave)));
  };

  const toggle = (id) => setSeleccion(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });
  const setVarios = (ids, agregar) => setSeleccion(prev => {
    const s = new Set(prev);
    ids.forEach(id => agregar ? s.add(id) : s.delete(id));
    return s;
  });

  const elegidos = productos.filter(p => seleccion.has(p.id));
  const totalUnidades = elegidos.reduce((acc, p) => acc + (Number(p.stock) || 0), 0);

  const sufijo = () => new Date().toLocaleDateString('es-AR').replace(/\//g, '-');

  // Filas en el orden de las secciones; antes de cada sección, una fila título.
  const construirFilas = () => {
    const filas = [];
    for (const sec of secciones) {
      const lista = elegidos.filter(p => p.stock_categoria_id === sec.id)
        .sort((a, b) => (a.stock_orden || 0) - (b.stock_orden || 0) || String(a.nombre).localeCompare(String(b.nombre), 'es'));
      if (lista.length === 0) continue;
      filas.push({ seccion: sec.nombre });
      lista.forEach(p => filas.push({ nombre: p.nombre || '', cant: Number(p.stock ?? 0) }));
    }
    const sinUbic = elegidos.filter(p => p.stock_categoria_id == null)
      .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
    if (sinUbic.length > 0) {
      filas.push({ seccion: 'Sin ubicación' });
      sinUbic.forEach(p => filas.push({ nombre: p.nombre || '', cant: Number(p.stock ?? 0) }));
    }
    return filas;
  };

  const exportarExcel = () => {
    if (elegidos.length === 0) return;
    const aoa = [['Producto', 'Cantidad']];
    for (const f of construirFilas()) {
      if (f.seccion) aoa.push([`— ${f.seccion} —`, '']);
      else aoa.push([f.nombre, f.cant]);
    }
    aoa.push(['', '']);
    aoa.push(['TOTAL UNIDADES', totalUnidades]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 40 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf]), `stock_${sufijo()}.xlsx`);
    onExportado(elegidos.length, 'Excel');
  };

  const exportarPDF = () => {
    if (elegidos.length === 0) return;
    const body = [];
    for (const f of construirFilas()) {
      if (f.seccion) body.push([{ content: f.seccion, colSpan: 2, styles: { fillColor: [229, 231, 235], fontStyle: 'bold', textColor: [55, 65, 81] } }]);
      else body.push([f.nombre, f.cant]);
    }
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Stock - existencias por sección', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generado: ${new Date().toLocaleString('es-AR')}  ·  ${elegidos.length} productos · ${totalUnidades} unidades`, 14, 22);
    autoTable(doc, {
      head: [['Producto', 'Cantidad']],
      body,
      foot: [[{ content: 'TOTAL UNIDADES', styles: { fontStyle: 'bold' } }, { content: String(totalUnidades), styles: { halign: 'right', fontStyle: 'bold' } }]],
      startY: 28,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [22, 163, 74] },
      footStyles: { fillColor: [243, 244, 246], textColor: [17, 24, 39] },
      columnStyles: { 1: { halign: 'right', cellWidth: 30 } },
    });
    doc.save(`stock_${sufijo()}.pdf`);
    onExportado(elegidos.length, 'PDF');
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl h-[100dvh] sm:h-auto sm:max-h-[90vh] sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col overflow-hidden">

        {/* Encabezado */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-700 text-white flex-shrink-0">
          <div className="min-w-0">
            <h3 className="text-lg font-bold">📤 Exportar stock</h3>
            <p className="text-gray-200 text-xs truncate">Tildá qué productos exportar. Sale nombre y cantidad por sección.</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar"
            className="text-gray-200 hover:text-white text-3xl leading-none w-10 h-10 flex items-center justify-center flex-shrink-0">×</button>
        </div>

        {/* Buscador */}
        <div className="p-3 border-b flex-shrink-0">
          <div className="relative">
            <span className="absolute left-3 top-3 text-gray-400 text-sm">🔍</span>
            <input value={buscar} onChange={(e) => setBuscar(e.target.value)}
              className="w-full border border-gray-300 rounded-xl pl-9 pr-9 py-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              placeholder="Buscar producto..." />
            {buscar && (
              <button onClick={() => setBuscar('')} className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">✕</button>
            )}
          </div>
        </div>

        {/* Barra de acciones: seleccionar todo + expandir/colapsar */}
        <div className="px-3 py-2 border-b flex items-center justify-between gap-2 flex-shrink-0 bg-gray-50">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none py-1">
            <input type="checkbox" checked={todosVisiblesTildados}
              ref={el => { if (el) el.indeterminate = algunosVisiblesTildados; }}
              onChange={(e) => setVarios(idsVisibles, e.target.checked)}
              className="w-5 h-5 accent-gray-700" />
            <span className="font-medium">Todo {buscar && 'lo visible'}</span>
            <span className="text-gray-400">({idsVisibles.length})</span>
          </label>
          {!textoBuscar && gruposOrdenados.length > 0 && (
            <button onClick={expandirOColapsarTodo}
              className="text-xs font-semibold text-gray-600 bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 hover:bg-gray-100">
              {todasExpandidas ? '▲ Colapsar todo' : '▼ Expandir todo'}
            </button>
          )}
        </div>

        {/* Secciones con sus productos */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {gruposOrdenados.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-10">No se encontraron productos.</p>
          ) : (
            gruposOrdenados.map(g => {
              const ids = g.lista.map(p => p.id);
              const todos = ids.every(id => seleccion.has(id));
              const algunos = !todos && ids.some(id => seleccion.has(id));
              const abierta = estaExpandida(g.clave);
              const elegidosSec = ids.filter(id => seleccion.has(id)).length;
              return (
                <div key={g.clave} className="rounded-xl border border-gray-200 overflow-hidden">
                  {/* Encabezado de sección (toda la barra abre/cierra; el check aparte) */}
                  <div className="flex items-center bg-gray-100 border-b border-gray-200">
                    <label className="flex items-center pl-3 pr-1 py-3 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={todos}
                        ref={el => { if (el) el.indeterminate = algunos; }}
                        onChange={(e) => setVarios(ids, e.target.checked)}
                        className="w-5 h-5 accent-gray-700 flex-shrink-0" />
                    </label>
                    <button onClick={() => toggleExpandir(g.clave)}
                      className="flex-1 flex items-center gap-2 text-left min-w-0 py-3 pr-3">
                      <span className={`text-gray-400 text-xs transition-transform ${abierta ? 'rotate-90' : ''}`}>▶</span>
                      <span className="font-semibold text-gray-800 text-sm truncate flex-1">{g.nombre}</span>
                      <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${elegidosSec > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                        {elegidosSec}/{g.lista.length}
                      </span>
                    </button>
                  </div>

                  {/* Productos de la sección */}
                  {abierta && (
                    <div className="p-1.5 space-y-0.5">
                      {g.lista.map(p => {
                        const tildado = seleccion.has(p.id);
                        return (
                          <label key={p.id}
                            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer ${tildado ? 'bg-gray-50' : 'hover:bg-gray-50'}`}>
                            <input type="checkbox" checked={tildado} onChange={() => toggle(p.id)}
                              className="w-5 h-5 accent-gray-700 flex-shrink-0" />
                            <span className="flex-1 min-w-0 text-sm text-gray-800 break-words">{p.nombre}</span>
                            <span className="text-sm font-bold text-gray-700 flex-shrink-0 tabular-nums">
                              {p.stock ?? 0}{p.unidad ? ` ${p.unidad}` : ''}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer: resumen + acciones */}
        <div className="border-t flex-shrink-0 bg-gray-50">
          <div className="px-4 pt-2.5 pb-1 flex items-center justify-between text-sm">
            <span className="text-gray-600">
              <strong className="text-gray-800">{elegidos.length}</strong> producto(s)
            </span>
            <span className="text-gray-600">
              <strong className="text-gray-800 tabular-nums">{totalUnidades}</strong> unidades
            </span>
          </div>
          <div className="p-3 flex gap-2">
            <button onClick={onClose}
              className="px-4 py-3 border border-gray-300 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-100 flex-shrink-0">
              Cancelar
            </button>
            <button onClick={exportarExcel} disabled={elegidos.length === 0}
              className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
              📊 Excel
            </button>
            <button onClick={exportarPDF} disabled={elegidos.length === 0}
              className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
              📄 PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Stock;
