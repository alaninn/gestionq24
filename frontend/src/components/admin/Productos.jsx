// =============================================
// ARCHIVO: src/components/admin/Productos.jsx
// =============================================

import { useState, useEffect, useRef } from 'react';
import api from '../../api/axios';
import useCerrarConAtras from '../../hooks/useCerrarConAtras';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { useAuth } from '../../context/AuthContext';

const LIMITES_PLAN = { estandar: 500, premium: 3000 };

const CeldaEditable = ({ producto, campo, formatear, alinear = 'right', celdaEditando, iniciarEdicion, guardarEdicionInline, cancelarEdicion, inputRef }) => {
  const estaEditando = celdaEditando?.id === producto.id && celdaEditando?.campo === campo;
  const [valorLocal, setValorLocal] = useState('');

  useEffect(() => {
    if (estaEditando) setValorLocal(String(producto[campo] ?? ''));
  }, [estaEditando]);

  const manejarTecla = (e) => {
    if (e.key === 'Enter') guardarEdicionInline(producto, campo, valorLocal);
    if (e.key === 'Escape') cancelarEdicion();
  };

  if (estaEditando) {
    return (
      <input ref={inputRef} type="text" inputMode="numeric"
        value={valorLocal} onChange={(e) => setValorLocal(e.target.value)}
        onBlur={() => guardarEdicionInline(producto, campo, valorLocal)}
        onKeyDown={manejarTecla}
        className="w-full border-2 border-green-500 rounded px-2 py-1 text-sm focus:outline-none bg-white"
        style={{ textAlign: alinear }} />
    );
  }

  return (
    <div onClick={() => iniciarEdicion(producto, campo)} title="Clic para editar"
      className={`cursor-pointer hover:bg-green-50 hover:text-green-700 px-2 py-1 rounded transition-colors text-${alinear} group`}>
      {formatear ? formatear(producto[campo]) : producto[campo]}
      <span className="opacity-0 group-hover:opacity-100 text-green-400 ml-1 text-xs">✏️</span>
    </div>
  );
};

const LIMITE = 50;

// Orden canónico de columnas (usado por la plantilla y la exportación)
const COLUMNAS_PLANTILLA = ['nombre', 'codigo', 'categoria', 'precio_costo', 'precio_venta', 'stock', 'stock_minimo', 'unidad', 'alicuota_iva', 'margen_ganancia'];

// Normaliza un encabezado: saca acentos, mayúsculas, puntos, % y espacios → guion bajo
const normalizarHeader = (s) => String(s ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().trim()
  .replace(/[.%]/g, '')
  .replace(/\s+/g, '_')
  .replace(/_+/g, '_')
  .replace(/^_|_$/g, '');

// Sinónimos de encabezados → campo canónico. Permite importar la plantilla,
// un archivo exportado, o variantes, sin que importe el orden de las columnas.
const MAPA_COLUMNAS = {
  nombre: 'nombre', producto: 'nombre', descripcion: 'nombre', detalle: 'nombre',
  codigo: 'codigo', cod: 'codigo', codigo_de_barras: 'codigo', codigo_barras: 'codigo', barcode: 'codigo', ean: 'codigo',
  categoria: 'categoria', rubro: 'categoria',
  precio_costo: 'precio_costo', p_costo: 'precio_costo', costo: 'precio_costo', precio_de_costo: 'precio_costo',
  precio_venta: 'precio_venta', p_venta: 'precio_venta', precio: 'precio_venta', venta: 'precio_venta', precio_de_venta: 'precio_venta', precio_final: 'precio_venta',
  stock: 'stock', cantidad: 'stock', existencia: 'stock', existencias: 'stock',
  stock_minimo: 'stock_minimo', stock_min: 'stock_minimo', minimo: 'stock_minimo', stock_minimo_alerta: 'stock_minimo',
  unidad: 'unidad', um: 'unidad', medida: 'unidad', unidad_de_medida: 'unidad',
  alicuota_iva: 'alicuota_iva', iva: 'alicuota_iva', alicuota: 'alicuota_iva', iva_porcentaje: 'alicuota_iva',
  margen_ganancia: 'margen_ganancia', margen: 'margen_ganancia', ganancia: 'margen_ganancia', margen_porcentaje: 'margen_ganancia',
};

function Productos() {
  const { usuario } = useAuth();
  const planUsuario = usuario?.plan || 'estandar';
  const esPremium = usuario?.plan === 'premium' || usuario?.rol === 'superadmin';

  // Límite real del plan: se lee del servidor (configurable por el superadmin).
  // Mientras carga, se usa el valor por defecto hardcodeado.
  const [limiteProductos, setLimiteProductos] = useState(LIMITES_PLAN[planUsuario] ?? LIMITES_PLAN.estandar);
  useEffect(() => {
    api.get('/api/usuarios/plan-info')
      .then(res => { if (res.data?.limites?.max_productos) setLimiteProductos(res.data.limites.max_productos); })
      .catch(() => {});
  }, []);

  const [productos, setProductos] = useState([]);
const [categorias, setCategorias] = useState([]);
  const [nuevaCategoria, setNuevaCategoria] = useState('');
  const [creandoCategoria, setCreandoCategoria] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [buscar, setBuscar] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [soloStockBajo, setSoloStockBajo] = useState(false);
  const [soloPorRevisar, setSoloPorRevisar] = useState(false);
  const [totalPorRevisar, setTotalPorRevisar] = useState(0);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [productoEditando, setProductoEditando] = useState(null);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [columnaOrden, setColumnaOrden] = useState('nombre');
  const [direccionOrden, setDireccionOrden] = useState('asc');
  const [celdaEditando, setCeldaEditando] = useState(null);
  const inputRef = useRef(null);
  const [codigos, setCodigos] = useState([]);
  const [nuevoCodigo, setNuevoCodigo] = useState('');
  const [cargandoCodigos, setCargandoCodigos] = useState(false);

  // Selección múltiple para eliminación masiva
  const [seleccionados, setSeleccionados] = useState([]);
  const [eliminandoMasivo, setEliminandoMasivo] = useState(false);

  // Actualización masiva de precios
  const [mostrarModalPrecios, setMostrarModalPrecios] = useState(false);
  const [aplicandoPrecios, setAplicandoPrecios] = useState(false);
  const [formPrecios, setFormPrecios] = useState({
    alcance: 'todos', categoria_id: '', campo: 'precio_venta',
    operacion: 'porcentaje', direccion: 'aumentar', valor: '',
  });

  // Cambio masivo de categoría (desde la barra de selección)
  const [categoriaMasiva, setCategoriaMasiva] = useState('');

    // Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const [totalProductos, setTotalProductos] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(0);

  const [formulario, setFormulario] = useState({
    codigo: '', nombre: '', categoria_id: '',
    precio_costo: '', margen_ganancia: '', alicuota_iva: '21',
    precio_venta: '', precio_mayorista: '', margen_mayorista: '',
    stock: '0', stock_minimo: '0', unidad: 'Uni',
    es_combinado: false, componentes: [],
  });

  // Guarda el stock que tenía el producto al abrir el modal de edición. Sirve para
  // enviar un ajuste de stock solo si el usuario realmente lo cambió, y así no pisar
  // el stock real (que pudo bajar por ventas) al editar precio, nombre, etc.
  const stockOriginalRef = useRef(null);

  useEffect(() => { cargarProductos(); cargarCategorias(); cargarContadorRevisar(); }, []);

  // El botón "atrás" del celular cierra el modal abierto
  useCerrarConAtras(mostrarFormulario, () => setMostrarFormulario(false));
  useCerrarConAtras(mostrarModalPrecios, () => setMostrarModalPrecios(false));

  useEffect(() => {
    const timer = setTimeout(() => cargarProductos(), 400);
    return () => clearTimeout(timer);
  }, [buscar, categoriaFiltro, soloStockBajo, soloPorRevisar]);

  useEffect(() => {
    if (celdaEditando && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [celdaEditando]);

  // NOTA: el recálculo de precios se hace en manejarCambio (solo cuando el usuario
  // modifica costo/margen/IVA). Antes era un useEffect que se disparaba al abrir el
  // modal de edición y pisaba el precio de venta real del producto.

  const cargarProductos = async (pagina = 1) => {
    try {
      setCargando(true);
      // Filtro "por revisar": usa su propio endpoint (sin paginar, son pocos)
      if (soloPorRevisar) {
        const res = await api.get('/api/productos/por-revisar');
        setProductos(res.data);
        setTotalProductos(res.data.length);
        setTotalPaginas(1);
        setPaginaActual(1);
        setTotalPorRevisar(res.data.length);
        return;
      }
      let url = `/api/productos?pagina=${pagina}&limite=${LIMITE}`;
      if (buscar) url += `&buscar=${buscar}`;
      if (categoriaFiltro) url += `&categoria=${categoriaFiltro}`;
      if (soloStockBajo) url += `&stock_bajo=1`;
      const res = await api.get(url);
      setProductos(res.data.productos);
      setTotalProductos(res.data.total);
      setTotalPaginas(res.data.totalPaginas);
      setPaginaActual(pagina);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setCargando(false);
    }
  };

  // Contador de productos por revisar (para el chip y el banner)
  const cargarContadorRevisar = async () => {
    try {
      const res = await api.get('/api/productos/por-revisar');
      setTotalPorRevisar(res.data.length);
    } catch { /* silencioso */ }
  };

const cargarCategorias = async () => {
    try {
      const res = await api.get('/api/categorias');
      setCategorias(res.data);
    } catch (err) { console.error('Error:', err); }
  };

  const crearCategoriaRapida = async () => {
    if (!nuevaCategoria.trim()) return;
    try {
      const res = await api.post('/api/categorias', { nombre: nuevaCategoria.trim() });
      await cargarCategorias();
      setFormulario(prev => ({ ...prev, categoria_id: res.data.id }));
      setNuevaCategoria('');
      setCreandoCategoria(false);
    } catch (err) {
      alert(err.response?.data?.error || 'Error al crear categoría');
    }
  };

  const ordenarPor = (columna) => {
    if (columnaOrden === columna) setDireccionOrden(d => d === 'asc' ? 'desc' : 'asc');
    else { setColumnaOrden(columna); setDireccionOrden('asc'); }
  };

  const productosOrdenados = [...productos].sort((a, b) => {
    let vA = a[columnaOrden] ?? '', vB = b[columnaOrden] ?? '';
    if (typeof vA === 'string') return direccionOrden === 'asc' ? vA.localeCompare(vB, 'es') : vB.localeCompare(vA, 'es');
    return direccionOrden === 'asc' ? vA - vB : vB - vA;
  });

  const iconoOrden = (col) => {
    if (columnaOrden !== col) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-green-600 ml-1">{direccionOrden === 'asc' ? '↑' : '↓'}</span>;
  };

  const iniciarEdicion = (producto, campo) => setCeldaEditando({ id: producto.id, campo });

  const guardarEdicionInline = async (producto, campo, nuevoValor) => {
    setCeldaEditando(null);
    if (String(nuevoValor) === String(producto[campo])) return;
    try {
      // Al editar un campo que NO es el stock (precio, etc.) no mandamos el stock:
      // el del listado puede estar viejo (bajó por ventas) y lo pisaría. Cuando se
      // edita el stock en sí, ese es el valor que el usuario quiere fijar.
      const { stock: _stockViejo, ...sinStock } = producto;
      const datosActualizados = campo === 'stock'
        ? { ...producto, stock: nuevoValor }
        : { ...sinStock, [campo]: nuevoValor };
      if (campo === 'precio_costo') {
        const nuevoCosto = parseFloat(nuevoValor) || 0;
        const margen = parseFloat(producto.margen_ganancia) || 0;
        const iva = parseFloat(producto.alicuota_iva) || 0;
        if (margen > 0) datosActualizados.precio_venta = Math.round(nuevoCosto * (1 + margen / 100) * (1 + iva / 100));
      }
      await api.put(`/api/productos/${producto.id}`, datosActualizados);
      setProductos(prev => prev.map(p => p.id === producto.id ? { ...p, ...datosActualizados } : p));
      setExito('✅ Guardado');
      setTimeout(() => setExito(''), 2000);
    } catch (err) {
      setError('Error al guardar');
      setTimeout(() => setError(''), 3000);
    }
  };

  const cancelarEdicion = () => setCeldaEditando(null);

  const manejarCambio = (e) => {
    const { name, value } = e.target;
    setFormulario(prev => {
      const next = { ...prev, [name]: value };

      // Recalcular precio de venta SOLO cuando el usuario toca costo, margen o IVA
      if (['precio_costo', 'margen_ganancia', 'alicuota_iva'].includes(name)) {
        const costo = parseFloat(next.precio_costo) || 0;
        const margen = parseFloat(next.margen_ganancia) || 0;
        const iva = parseFloat(next.alicuota_iva) || 0;
        if (costo > 0) {
          next.precio_venta = Math.round(costo * (1 + margen / 100) * (1 + iva / 100)).toString();
        }
        const margenMayorista = parseFloat(next.margen_mayorista) || 0;
        if (costo > 0 && margenMayorista > 0) {
          next.precio_mayorista = Math.round(costo * (1 + margenMayorista / 100) * (1 + iva / 100)).toString();
        }
      }

      // Recalcular precio mayorista cuando el usuario toca su margen
      if (name === 'margen_mayorista') {
        const costo = parseFloat(next.precio_costo) || 0;
        const margenMayorista = parseFloat(value) || 0;
        const iva = parseFloat(next.alicuota_iva) || 0;
        if (costo > 0 && margenMayorista > 0) {
          next.precio_mayorista = Math.round(costo * (1 + margenMayorista / 100) * (1 + iva / 100)).toString();
        }
      }

      return next;
    });
  };

  // En un producto COMBINADO el costo es la suma de los componentes. Mantenemos
  // ese costo en el formulario y, si hay margen cargado, recalculamos el precio de
  // venta final (mismo criterio que un producto normal). Así al poner el % de
  // ganancia el precio de venta se completa solo.
  useEffect(() => {
    if (!formulario.es_combinado) return;
    const costo = formulario.componentes.reduce(
      (s, c) => s + (Number(c.precio_costo) || 0) * (Number(c.cantidad) || 0), 0
    );
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

  const abrirFormularioNuevo = () => {
    setFormulario({ codigo: '', nombre: '', categoria_id: '', precio_costo: '', margen_ganancia: '', alicuota_iva: '21', precio_venta: '', precio_mayorista: '', margen_mayorista: '', stock: '0', stock_minimo: '0', unidad: 'Uni', es_combinado: false, componentes: [] });
    setProductoEditando(null);
    setError('');
    setMostrarFormulario(true);
    setCodigos([]);
    setNuevoCodigo('');
    setNuevaCategoria('');
    setCreandoCategoria(false);
  };

  const abrirFormularioEditar = (producto) => {
    setFormulario({
      codigo: producto.codigo || '', nombre: producto.nombre, categoria_id: producto.categoria_id || '',
      precio_costo: producto.precio_costo, margen_ganancia: producto.margen_ganancia || '',
      alicuota_iva: producto.alicuota_iva || '21', precio_venta: producto.precio_venta,
      precio_mayorista: producto.precio_mayorista || '', margen_mayorista: '',
      stock: producto.stock, stock_minimo: producto.stock_minimo, unidad: producto.unidad,
      es_combinado: !!producto.es_combinado, componentes: [],
    });
    stockOriginalRef.current = producto.stock;
    setProductoEditando(producto.id);
    setError('');
    setMostrarFormulario(true);
    setCodigos([]);
    setNuevaCategoria('');
    setCreandoCategoria(false);
    setCargandoCodigos(true);
    api.get(`/api/productos/${producto.id}/codigos`)
      .then(res => setCodigos(res.data))
      .catch(() => {})
      .finally(() => setCargandoCodigos(false));
    // Si es combinado, traer sus componentes para poder editarlos
    if (producto.es_combinado) {
      api.get(`/api/productos/${producto.id}`)
        .then(res => {
          const comps = (res.data.componentes || []).map(c => ({
            producto_id: c.producto_id, cantidad: c.cantidad,
            nombre: c.nombre, precio_costo: c.precio_costo,
          }));
          setFormulario(prev => ({ ...prev, componentes: comps }));
        })
        .catch(() => {});
    }
  };

  // Abre el formulario de "nuevo producto" precargado con los datos de otro.
  // Útil para variantes (ej: misma gaseosa en 500ml y 1L). El código queda
  // vacío para que se genere uno nuevo y el stock arranca en 0.
  const duplicarProducto = (producto) => {
    setFormulario({
      codigo: '',
      nombre: `${producto.nombre} (copia)`,
      categoria_id: producto.categoria_id || '',
      precio_costo: producto.precio_costo,
      margen_ganancia: producto.margen_ganancia || '',
      alicuota_iva: producto.alicuota_iva ?? '0',
      precio_venta: producto.precio_venta,
      precio_mayorista: producto.precio_mayorista || '',
      margen_mayorista: '',
      stock: '0',
      stock_minimo: producto.stock_minimo,
      unidad: producto.unidad || 'Uni',
      es_combinado: false, componentes: [],
    });
    setProductoEditando(null);
    setError('');
    setMostrarFormulario(true);
    setCodigos([]);
    setNuevoCodigo('');
    setNuevaCategoria('');
    setCreandoCategoria(false);
  };

  const guardarProducto = async (e) => {
    e.preventDefault();
    setError('');
    if (formulario.es_combinado && formulario.componentes.length === 0) {
      setError('Un producto combinado necesita al menos un componente.');
      return;
    }
    try {
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
      // El stock se manda solo cuando corresponde: al crear el producto (stock
      // inicial) o al editar un producto normal cuyo stock el usuario realmente
      // cambió. Así, editar precio/nombre no pisa el stock que bajó por ventas
      // (los combos no tienen stock propio: lo maneja el sistema).
      if (!formulario.es_combinado) {
        const stockCambiado = String(formulario.stock ?? '').trim() !== String(stockOriginalRef.current ?? '').trim();
        if (!productoEditando || stockCambiado) {
          datos.stock = formulario.stock;
        }
      }
      if (productoEditando) {
        await api.put(`/api/productos/${productoEditando}`, datos);
        setExito('Producto actualizado correctamente');
      } else {
        await api.post('/api/productos', datos);
        setExito('Producto creado correctamente');
      }
      setMostrarFormulario(false);
      cargarProductos();
      cargarContadorRevisar();
      setTimeout(() => setExito(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar el producto');
    }
  };

  const eliminarProducto = async (id, nombre) => {
    if (!window.confirm(`¿Desactivar "${nombre}"?`)) return;
    try {
      await api.delete(`/api/productos/${id}`);
      setExito('Producto desactivado');
      cargarProductos();
      setTimeout(() => setExito(''), 3000);
    } catch (err) { setError('Error al eliminar'); }
  };

  // ---- SELECCIÓN MÚLTIPLE ----
  const toggleSeleccion = (id) => {
    setSeleccionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const idsPaginaActual = productosOrdenados.map(p => p.id);
  const todosSeleccionadosEnPagina = idsPaginaActual.length > 0 && idsPaginaActual.every(id => seleccionados.includes(id));

  const toggleSeleccionarTodosPagina = () => {
    if (todosSeleccionadosEnPagina) {
      setSeleccionados(prev => prev.filter(id => !idsPaginaActual.includes(id)));
    } else {
      setSeleccionados(prev => [...new Set([...prev, ...idsPaginaActual])]);
    }
  };

  const limpiarSeleccion = () => setSeleccionados([]);

  const eliminarSeleccionados = async () => {
    if (seleccionados.length === 0) return;
    if (!window.confirm(`¿Eliminar ${seleccionados.length} producto(s) seleccionado(s)?\n\nLos productos se desactivarán y dejarán de aparecer en el listado y en el punto de venta.`)) return;
    try {
      setEliminandoMasivo(true);
      const res = await api.post('/api/productos/eliminar-masivo', { ids: seleccionados });
      setExito(`✅ ${res.data.eliminados} producto(s) eliminado(s)`);
      limpiarSeleccion();
      await cargarProductos(paginaActual);
      setTimeout(() => setExito(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al eliminar productos');
      setTimeout(() => setError(''), 4000);
    } finally {
      setEliminandoMasivo(false);
    }
  };

  // ---- ACTUALIZACIÓN MASIVA DE PRECIOS ----
  const abrirModalPrecios = () => {
    setFormPrecios({
      alcance: seleccionados.length > 0 ? 'seleccion' : 'todos',
      categoria_id: categoriaFiltro || '',
      campo: 'precio_venta', operacion: 'porcentaje', direccion: 'aumentar', valor: '',
    });
    setMostrarModalPrecios(true);
  };

  const aplicarPreciosMasivo = async (e) => {
    e.preventDefault();
    const valorNum = parseFloat(formPrecios.valor);
    if (isNaN(valorNum) || valorNum <= 0) {
      setError('Ingresá un valor mayor a 0');
      setTimeout(() => setError(''), 3000);
      return;
    }
    if (formPrecios.alcance === 'categoria' && !formPrecios.categoria_id) {
      setError('Seleccioná una categoría');
      setTimeout(() => setError(''), 3000);
      return;
    }

    // El signo lo define la dirección (fijar no tiene dirección)
    const valorFinal = formPrecios.operacion === 'fijar'
      ? valorNum
      : (formPrecios.direccion === 'disminuir' ? -valorNum : valorNum);

    const alcanceTexto = formPrecios.alcance === 'todos' ? `TODOS los productos (${totalProductos})`
      : formPrecios.alcance === 'categoria' ? `la categoría "${categorias.find(c => String(c.id) === String(formPrecios.categoria_id))?.nombre || ''}"`
      : `${seleccionados.length} producto(s) seleccionado(s)`;
    const opTexto = formPrecios.operacion === 'fijar' ? `fijar en ${formatearPeso(valorNum)}`
      : `${formPrecios.direccion} ${formPrecios.operacion === 'porcentaje' ? valorNum + '%' : formatearPeso(valorNum)}`;
    const campoTexto = formPrecios.campo === 'ambos' ? 'venta y costo' : formPrecios.campo === 'precio_venta' ? 'precio de venta' : 'precio de costo';

    if (!window.confirm(`¿Aplicar a ${alcanceTexto}?\n\nAcción: ${opTexto} el ${campoTexto}.\n\nEsta acción modifica los precios de forma permanente.`)) return;

    try {
      setAplicandoPrecios(true);
      const res = await api.post('/api/productos/precios-masivo', {
        alcance: formPrecios.alcance,
        categoria_id: formPrecios.categoria_id || null,
        ids: formPrecios.alcance === 'seleccion' ? seleccionados : null,
        campo: formPrecios.campo,
        operacion: formPrecios.operacion,
        valor: valorFinal,
      });
      setExito(`✅ Precios actualizados en ${res.data.actualizados} producto(s)`);
      setMostrarModalPrecios(false);
      limpiarSeleccion();
      await cargarProductos(paginaActual);
      setTimeout(() => setExito(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al actualizar precios');
      setTimeout(() => setError(''), 4000);
    } finally {
      setAplicandoPrecios(false);
    }
  };

  // ---- CAMBIO MASIVO DE CATEGORÍA ----
  const aplicarCategoriaMasiva = async () => {
    if (!categoriaMasiva || seleccionados.length === 0) return;
    const cat = categorias.find(c => String(c.id) === String(categoriaMasiva));
    if (!window.confirm(`¿Mover ${seleccionados.length} producto(s) a la categoría "${cat?.nombre}"?`)) return;
    try {
      const res = await api.post('/api/productos/categoria-masivo', { ids: seleccionados, categoria_id: categoriaMasiva });
      setExito(`✅ ${res.data.actualizados} producto(s) movidos a "${cat?.nombre}"`);
      setCategoriaMasiva('');
      limpiarSeleccion();
      await cargarProductos(paginaActual);
      setTimeout(() => setExito(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cambiar categoría');
      setTimeout(() => setError(''), 4000);
    }
  };

  const eliminarTodos = async () => {
    if (!window.confirm(`⚠️ ¿ELIMINAR TODOS los productos del negocio?\n\nSe desactivarán TODOS los productos (${totalProductos}). Esta acción afecta todo el inventario.`)) return;
    if (!window.confirm(`⚠️ CONFIRMACIÓN FINAL\n\n¿Seguro que querés desactivar los ${totalProductos} productos?`)) return;
    try {
      setEliminandoMasivo(true);
      const res = await api.post('/api/productos/eliminar-masivo', { todos: true });
      setExito(`✅ ${res.data.eliminados} producto(s) eliminado(s)`);
      limpiarSeleccion();
      await cargarProductos(1);
      setTimeout(() => setExito(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al eliminar todos los productos');
      setTimeout(() => setError(''), 4000);
    } finally {
      setEliminandoMasivo(false);
    }
  };

  const agregarCodigo = async () => {
    if (!nuevoCodigo.trim() || !productoEditando) return;
    try {
      const res = await api.post(`/api/productos/${productoEditando}/codigos`, { codigo: nuevoCodigo.trim() });
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

  // ---- EXPORTAR PLANTILLA ----
  const descargarPlantilla = () => {
    const columnas = [['nombre', 'codigo', 'categoria', 'precio_costo', 'precio_venta', 'stock', 'stock_minimo', 'unidad', 'alicuota_iva', 'margen_ganancia']];
    const ejemplos = [
      ['Coca Cola 500ml', '7790895000123', 'Bebidas Sin Alcohol', '800', '1500', '10', '2', 'Uni', '21', '50'],
      ['Leche La Serenísima 1L', '7794000012345', 'Lácteos', '400', '800', '20', '5', 'Uni', '10.5', '50'],
      // Ejemplo sin IVA ni margen: el precio de venta se respeta tal cual está escrito
      ['Pan casero (precio directo)', '', 'Panadería', '500', '900', '15', '3', 'Uni', '0', '0'],
    ];
    const ws = XLSX.utils.aoa_to_sheet([...columnas, ...ejemplos]);
    ws['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Productos');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf]), 'plantilla_productos.xlsx');
  };

  // ---- EXPORTAR PRODUCTOS ----
const exportarExcel = async () => {
    try {
      setExito('⏳ Preparando exportación...');
      
      // Pedimos TODOS los productos sin paginación
      let url = '/api/productos?';
      if (buscar) url += `buscar=${buscar}&`;
      if (categoriaFiltro) url += `categoria=${categoriaFiltro}`;
      
      const res = await api.get(url);
      const todosLosProductos = res.data;

      // Mismo orden que la plantilla/importación para que el archivo exportado
      // se pueda volver a importar sin invertir columnas.
      const columnas = ['nombre', 'codigo', 'categoria', 'precio_costo', 'precio_venta', 'stock', 'stock_minimo', 'unidad', 'alicuota_iva', 'margen_ganancia'];
      const filas = todosLosProductos.map(p => [
        p.nombre,
        p.codigo || '',
        p.categoria_nombre || '',
        p.precio_costo,
        p.precio_venta,
        p.stock,
        p.stock_minimo,
        p.unidad,
        p.alicuota_iva,
        p.margen_ganancia || 0
      ]);

      const ws = XLSX.utils.aoa_to_sheet([columnas, ...filas]);
      ws['!cols'] = [
        { wch: 35 }, { wch: 20 }, { wch: 20 }, { wch: 12 },
        { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 10 },
        { wch: 10 }, { wch: 12 }
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Productos');
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      saveAs(new Blob([buf]), `productos_${new Date().toLocaleDateString('es-AR').replace(/\//g, '-')}.xlsx`);
      
      setExito(`✅ ${todosLosProductos.length} productos exportados`);
      setTimeout(() => setExito(''), 3000);
    } catch (err) {
      setError('Error al exportar productos');
      setTimeout(() => setError(''), 3000);
    }
  };

  // ---- IMPORTAR PRODUCTOS ----
  const importarExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setExito('⏳ Procesando archivo...');
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];

      // Leemos como objetos usando la primera fila como encabezados.
      // defval: '' → las celdas vacías quedan en blanco (no como undefined).
      const filas = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (filas.length === 0) {
        setExito('');
        setError('El archivo está vacío o no tiene encabezados');
        setTimeout(() => setError(''), 4000);
        e.target.value = '';
        return;
      }

      // Verificamos que los encabezados sean reconocibles (mapeamos por nombre, no por posición)
      const headersDetectados = Object.keys(filas[0]).map(h => MAPA_COLUMNAS[normalizarHeader(h)]).filter(Boolean);
      if (!headersDetectados.includes('nombre') || !headersDetectados.includes('precio_venta')) {
        setExito('');
        setError('No se reconocen las columnas. Descargá la plantilla y usá esos encabezados (mínimo: nombre y precio_venta).');
        setTimeout(() => setError(''), 7000);
        e.target.value = '';
        return;
      }

      // Cada fila → objeto canónico mapeando encabezados a campos (independiente del orden de columnas)
      const productosPayload = filas.map(fila => {
        const prod = {};
        for (const [header, valor] of Object.entries(fila)) {
          const campo = MAPA_COLUMNAS[normalizarHeader(header)];
          // Solo asignamos el primer encabezado que mapee a cada campo
          if (campo && prod[campo] === undefined) {
            const v = typeof valor === 'string' ? valor.trim() : valor;
            prod[campo] = v;
          }
        }
        return prod;
      }).filter(p => String(p.nombre ?? '').trim() !== ''); // descartamos filas sin nombre

      if (productosPayload.length === 0) {
        setExito('');
        setError('No se encontraron filas con datos válidos (falta el nombre)');
        setTimeout(() => setError(''), 5000);
        e.target.value = '';
        return;
      }

      // Enviamos en lotes para no exceder el límite de tamaño y mostrar progreso
      const TAM_LOTE = 300;
      let creados = 0, actualizados = 0;
      let errores = [];
      const totalLotes = Math.ceil(productosPayload.length / TAM_LOTE);

      for (let i = 0; i < productosPayload.length; i += TAM_LOTE) {
        const lote = productosPayload.slice(i, i + TAM_LOTE);
        const numLote = Math.floor(i / TAM_LOTE) + 1;
        setExito(`⏳ Importando lote ${numLote} de ${totalLotes}...`);
        const res = await api.post('/api/productos/importar', { productos: lote });
        creados += res.data.creados || 0;
        actualizados += res.data.actualizados || 0;
        if (Array.isArray(res.data.errores)) errores = errores.concat(res.data.errores);
      }

      let msg = `✅ Importación completa: ${creados} creados`;
      if (actualizados > 0) msg += `, ${actualizados} actualizados`;
      if (errores.length > 0) msg += ` · ⚠️ ${errores.length} con problemas`;
      setExito(msg);

      if (errores.length > 0) {
        setError(`Algunas filas no se importaron:\n${errores.slice(0, 5).join('\n')}${errores.length > 5 ? `\n…y ${errores.length - 5} más` : ''}`);
        setTimeout(() => setError(''), 8000);
      }

      await cargarProductos();
      await cargarCategorias();
      setTimeout(() => setExito(''), 6000);
    } catch (err) {
      setExito('');
      setError(err.response?.data?.error || 'Error al leer o importar el archivo.');
      setTimeout(() => setError(''), 5000);
    }
    e.target.value = '';
  };

  const formatearPeso = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-4">

      {/* Título y botones */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Gestión de Productos</h2>
          <p className="text-gray-500">{productos.length} productos encontrados</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={descargarPlantilla}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors">
            📋 Plantilla Excel
          </button>
          <label className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer">
            📥 Importar Excel
            <input type="file" accept=".xlsx,.xls" onChange={importarExcel} className="hidden" />
          </label>
          <button onClick={exportarExcel}
            className="bg-green-100 hover:bg-green-200 text-green-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors">
            📊 Exportar Excel
          </button>
          <button onClick={abrirModalPrecios}
            className="bg-amber-100 hover:bg-amber-200 text-amber-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors">
            💲 Actualizar Precios
          </button>
          {!esPremium && totalProductos >= limiteProductos ? (
            <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-300 text-yellow-800 px-4 py-2 rounded-lg text-sm font-medium">
              ⭐ Límite de {limiteProductos} productos alcanzado. <span className="font-bold">Necesitás Plan Premium</span>
            </div>
          ) : (
            <button onClick={abrirFormularioNuevo}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
              + Nuevo Producto
            </button>
          )}
        </div>
      </div>

      {exito && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg">{exito}</div>}
      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">❌ {error}</div>}

      {/* Barra de uso del plan */}
      {!esPremium && (
        <div className="bg-white rounded-xl p-3 shadow border border-gray-100 flex items-center gap-3">
          <span className="text-xs text-gray-500 whitespace-nowrap">Plan Estándar</span>
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${totalProductos >= limiteProductos ? 'bg-red-500' : totalProductos >= limiteProductos * 0.8 ? 'bg-yellow-500' : 'bg-green-500'}`}
              style={{ width: `${Math.min(100, (totalProductos / limiteProductos) * 100)}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 whitespace-nowrap">{totalProductos} / {limiteProductos} productos</span>
          {totalProductos >= limiteProductos * 0.8 && (
            <span className="text-xs text-yellow-700 font-semibold bg-yellow-100 px-2 py-0.5 rounded">⭐ Actualizá al Plan Premium</span>
          )}
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-xl p-4 shadow flex gap-4 flex-wrap">
        <input type="text" placeholder="Buscar por nombre o código..."
          value={buscar} onChange={(e) => setBuscar(e.target.value)}
          className="flex-1 min-w-48 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" />
        <select value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500">
          <option value="">Todas las categorías</option>
          {categorias.map(cat => <option key={cat.id} value={cat.id}>{cat.nombre}</option>)}
        </select>
        <button onClick={() => { setSoloStockBajo(v => !v); setSoloPorRevisar(false); }}
          title="Mostrar solo productos con stock en o por debajo del mínimo"
          className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
            soloStockBajo
              ? 'bg-red-500 border-red-500 text-white'
              : 'bg-white border-gray-300 text-gray-600 hover:border-red-300'
          }`}>
          ⚠️ Stock bajo
        </button>
        <button onClick={() => { setSoloPorRevisar(v => !v); setSoloStockBajo(false); }}
          title="Productos cargados rápido desde el POS que necesitan completar datos"
          className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
            soloPorRevisar
              ? 'bg-amber-500 border-amber-500 text-white'
              : 'bg-white border-gray-300 text-gray-600 hover:border-amber-300'
          }`}>
          🏷️ Por revisar{totalPorRevisar > 0 ? ` (${totalPorRevisar})` : ''}
        </button>
      </div>

      {/* Banner de productos por revisar */}
      {totalPorRevisar > 0 && !soloPorRevisar && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-amber-800">
            ⚠️ Hay <b>{totalPorRevisar}</b> producto(s) cargado(s) rápido desde el POS que necesitan que completes precio, costo y categoría.
          </p>
          <button onClick={() => { setSoloPorRevisar(true); setSoloStockBajo(false); }}
            className="text-sm bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap">
            Revisarlos ahora
          </button>
        </div>
      )}

      <p className="text-xs text-gray-400">💡 Hacé clic en el precio o stock para editarlo. Enter para guardar, Escape para cancelar.</p>

      {/* Barra de acciones masivas (aparece al seleccionar) */}
      {seleccionados.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex flex-col gap-3 sticky top-0 z-20">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <span className="text-sm font-medium text-red-800">
              {seleccionados.length} producto(s) seleccionado(s)
            </span>
            <div className="flex gap-2 flex-wrap">
              <button onClick={limpiarSeleccion}
                className="text-sm bg-white hover:bg-gray-100 text-gray-600 border border-gray-300 px-3 py-1.5 rounded-lg font-medium transition-colors">
                Cancelar selección
              </button>
              <button onClick={abrirModalPrecios}
                className="text-sm bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
                💲 Actualizar precios
              </button>
              <button onClick={eliminarSeleccionados} disabled={eliminandoMasivo}
                className="text-sm bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50">
                {eliminandoMasivo ? 'Eliminando...' : `🗑️ Eliminar ${seleccionados.length} seleccionado(s)`}
              </button>
            </div>
          </div>

          {/* Cambio masivo de categoría */}
          <div className="flex items-center gap-2 flex-wrap border-t border-red-200 pt-2">
            <span className="text-xs text-gray-600">🏷️ Mover a categoría:</span>
            <select value={categoriaMasiva} onChange={(e) => setCategoriaMasiva(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white">
              <option value="">Elegir categoría...</option>
              {categorias.map(cat => <option key={cat.id} value={cat.id}>{cat.nombre}</option>)}
            </select>
            <button onClick={aplicarCategoriaMasiva} disabled={!categoriaMasiva}
              className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40">
              Aplicar
            </button>
          </div>

          {/* Opción de eliminar TODO el inventario, solo cuando se seleccionó toda la página y hay más productos en otras páginas */}
          {todosSeleccionadosEnPagina && totalProductos > seleccionados.length && (
            <div className="flex items-center justify-between flex-wrap gap-2 border-t border-red-200 pt-2">
              <span className="text-xs text-red-700">
                Seleccionaste toda esta página. Hay {totalProductos} productos en total en el inventario.
              </span>
              <button onClick={eliminarTodos} disabled={eliminandoMasivo}
                className="text-xs bg-red-700 hover:bg-red-800 text-white px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50">
                ⚠️ Eliminar TODO el inventario ({totalProductos})
              </button>
            </div>
          )}
        </div>
      )}

      {/* Lista: tarjetas en celular, tabla en pantallas grandes */}
      <div className="bg-white rounded-xl shadow overflow-hidden">

        {/* Vista móvil: tarjetas con las mismas funciones */}
        <div className="sm:hidden divide-y divide-gray-100">
          {cargando ? (
            <div className="text-center py-8 text-gray-400">Cargando...</div>
          ) : productosOrdenados.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No se encontraron productos</div>
          ) : (
            productosOrdenados.map(producto => (
              <div key={producto.id} className={`p-3 ${seleccionados.includes(producto.id) ? 'bg-red-50' : ''}`}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={seleccionados.includes(producto.id)}
                    onChange={() => toggleSeleccion(producto.id)}
                    className="w-5 h-5 mt-0.5 text-red-600 rounded flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 leading-snug">
                      {producto.requiere_revision && <span title="Cargado rápido — completá sus datos">⚠️ </span>}
                      {producto.es_combinado && <span title="Producto combinado">🧩 </span>}
                      {producto.nombre}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {producto.codigo || 'sin código'}{producto.categoria_nombre ? ` · ${producto.categoria_nombre}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 mt-2 pl-8">
                  <div className="flex items-center gap-3 text-sm">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase">Venta</p>
                      <CeldaEditable producto={producto} campo="precio_venta" formatear={formatearPeso} alinear="left" celdaEditando={celdaEditando} iniciarEdicion={iniciarEdicion} guardarEdicionInline={guardarEdicionInline} cancelarEdicion={cancelarEdicion} inputRef={inputRef} />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase">Stock</p>
                      <CeldaEditable producto={producto} campo="stock"
                        formatear={(val) => (
                          <span className={`font-medium ${Number(val) <= producto.stock_minimo ? 'text-red-600' : 'text-green-600'}`}>
                            {val} {producto.unidad}
                          </span>
                        )}
                        alinear="left" celdaEditando={celdaEditando} iniciarEdicion={iniciarEdicion} guardarEdicionInline={guardarEdicionInline} cancelarEdicion={cancelarEdicion} inputRef={inputRef} />
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => abrirFormularioEditar(producto)} className="bg-blue-100 active:bg-blue-200 text-blue-700 px-2.5 py-1.5 rounded-lg text-xs font-medium">✏️</button>
                    <button onClick={() => duplicarProducto(producto)} title="Duplicar" className="bg-purple-100 active:bg-purple-200 text-purple-700 px-2.5 py-1.5 rounded-lg text-xs font-medium">⧉</button>
                    <button onClick={() => eliminarProducto(producto.id, producto.nombre)} className="bg-red-100 active:bg-red-200 text-red-700 px-2.5 py-1.5 rounded-lg text-xs font-medium">🗑️</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Vista escritorio: tabla completa */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" checked={todosSeleccionadosEnPagina}
                    onChange={toggleSeleccionarTodosPagina}
                    title="Seleccionar todos en esta página"
                    className="w-4 h-4 text-red-600 rounded cursor-pointer" />
                </th>
                <th onClick={() => ordenarPor('codigo')} className="text-left px-4 py-3 text-gray-600 font-medium cursor-pointer hover:bg-gray-100 select-none">Código {iconoOrden('codigo')}</th>
                <th onClick={() => ordenarPor('nombre')} className="text-left px-4 py-3 text-gray-600 font-medium cursor-pointer hover:bg-gray-100 select-none">Nombre {iconoOrden('nombre')}</th>
                <th onClick={() => ordenarPor('categoria_nombre')} className="text-left px-4 py-3 text-gray-600 font-medium cursor-pointer hover:bg-gray-100 select-none">Categoría {iconoOrden('categoria_nombre')}</th>
                <th onClick={() => ordenarPor('precio_costo')} className="text-right px-4 py-3 text-gray-600 font-medium cursor-pointer hover:bg-gray-100 select-none">P. Costo {iconoOrden('precio_costo')}</th>
                <th onClick={() => ordenarPor('precio_venta')} className="text-right px-4 py-3 text-gray-600 font-medium cursor-pointer hover:bg-gray-100 select-none">P. Venta {iconoOrden('precio_venta')}</th>
                <th onClick={() => ordenarPor('stock')} className="text-center px-4 py-3 text-gray-600 font-medium cursor-pointer hover:bg-gray-100 select-none">Stock {iconoOrden('stock')}</th>
                <th className="text-center px-4 py-3 text-gray-600 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cargando ? (
                <tr><td colSpan="8" className="text-center py-8 text-gray-400">Cargando...</td></tr>
              ) : productosOrdenados.length === 0 ? (
                <tr><td colSpan="8" className="text-center py-8 text-gray-400">No se encontraron productos</td></tr>
              ) : (
                productosOrdenados.map(producto => (
                  <tr key={producto.id} className={`hover:bg-gray-50 ${seleccionados.includes(producto.id) ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-2 text-center">
                      <input type="checkbox" checked={seleccionados.includes(producto.id)}
                        onChange={() => toggleSeleccion(producto.id)}
                        className="w-4 h-4 text-red-600 rounded cursor-pointer" />
                    </td>
                    <td className="px-4 py-2 text-gray-500 text-sm">{producto.codigo || '-'}</td>
                    <td className="px-4 py-2 font-medium text-gray-800">
                      {producto.requiere_revision && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full mr-1.5 align-middle" title="Cargado rápido desde el POS — completá sus datos">⚠️ por revisar</span>
                      )}
                      {producto.es_combinado && (
                        <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full mr-1.5 align-middle" title="Producto combinado">🧩 combo</span>
                      )}
                      {producto.nombre}
                    </td>
                    <td className="px-4 py-2 text-gray-500 text-sm">{producto.categoria_nombre || '-'}</td>
                    <td className="px-2 py-1">
                      <CeldaEditable producto={producto} campo="precio_costo" formatear={formatearPeso} alinear="right" celdaEditando={celdaEditando} iniciarEdicion={iniciarEdicion} guardarEdicionInline={guardarEdicionInline} cancelarEdicion={cancelarEdicion} inputRef={inputRef} />
                    </td>
                    <td className="px-2 py-1">
                      <CeldaEditable producto={producto} campo="precio_venta" formatear={formatearPeso} alinear="right" celdaEditando={celdaEditando} iniciarEdicion={iniciarEdicion} guardarEdicionInline={guardarEdicionInline} cancelarEdicion={cancelarEdicion} inputRef={inputRef} />
                    </td>
                    <td className="px-2 py-1">
                      <CeldaEditable producto={producto} campo="stock"
                        formatear={(val) => (
                          <span className={`font-medium ${Number(val) <= producto.stock_minimo ? 'text-red-600' : 'text-green-600'}`}>
                            {val} {producto.unidad}
                          </span>
                        )}
                        alinear="center" celdaEditando={celdaEditando} iniciarEdicion={iniciarEdicion} guardarEdicionInline={guardarEdicionInline} cancelarEdicion={cancelarEdicion} inputRef={inputRef} />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => abrirFormularioEditar(producto)} className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded text-sm transition-colors">Editar</button>
                        <button onClick={() => duplicarProducto(producto)} title="Crear una copia de este producto"
                          className="bg-purple-100 hover:bg-purple-200 text-purple-700 px-2 py-1 rounded text-sm transition-colors">⧉</button>
                        <button onClick={() => eliminarProducto(producto.id, producto.nombre)} className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded text-sm transition-colors">Borrar</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación (compartida por ambas vistas) */}
        {totalPaginas > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t bg-gray-50">
            <p className="text-sm text-gray-500">
              Mostrando {((paginaActual - 1) * LIMITE) + 1}–{Math.min(paginaActual * LIMITE, totalProductos)} de {totalProductos} productos
            </p>
            <div className="flex gap-2 flex-wrap justify-center">
              <button onClick={() => cargarProductos(paginaActual - 1)}
                disabled={paginaActual === 1}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                ← Anterior
              </button>
              {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
                let pagina;
                if (totalPaginas <= 5) pagina = i + 1;
                else if (paginaActual <= 3) pagina = i + 1;
                else if (paginaActual >= totalPaginas - 2) pagina = totalPaginas - 4 + i;
                else pagina = paginaActual - 2 + i;
                return (
                  <button key={pagina} onClick={() => cargarProductos(pagina)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      pagina === paginaActual
                        ? 'bg-green-600 text-white'
                        : 'border border-gray-300 text-gray-600 hover:bg-gray-100'
                    }`}>
                    {pagina}
                  </button>
                );
              })}
              <button onClick={() => cargarProductos(paginaActual + 1)}
                disabled={paginaActual === totalPaginas}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {mostrarFormulario && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
              <h3 className="text-xl font-bold text-gray-800">
                {productoEditando ? '✏️ Editar Producto' : '➕ Nuevo Producto'}
              </h3>
              <button onClick={() => setMostrarFormulario(false)} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">×</button>
            </div>

            <form onSubmit={guardarProducto} className="p-6 space-y-6">
              {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">❌ {error}</div>}

              {/* Tipo de producto: normal o combinado */}
              <div className="flex gap-2">
                <button type="button"
                  onClick={() => setFormulario(prev => ({ ...prev, es_combinado: false }))}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${!formulario.es_combinado ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                  📦 Producto normal
                </button>
                <button type="button"
                  onClick={() => setFormulario(prev => ({ ...prev, es_combinado: true }))}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${formulario.es_combinado ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                  🧩 Producto combinado
                </button>
              </div>

              {/* Componentes del combo */}
              {formulario.es_combinado && (
                <SelectorCombo
                  componentes={formulario.componentes}
                  excludeId={productoEditando}
                  onChange={(comps) => setFormulario(prev => ({ ...prev, componentes: comps }))}
                />
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
                          <option value="">
                            {categorias.length === 0 ? '— Sin categorías —' : 'Seleccionar...'}
                          </option>
                          {categorias.map(cat => <option key={cat.id} value={cat.id}>{cat.nombre}</option>)}
                        </select>
                        <button type="button" onClick={() => setCreandoCategoria(!creandoCategoria)}
                          title="Crear nueva categoría"
                          className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-bold transition-colors">
                          +
                        </button>
                      </div>

                      {/* Input para crear categoría nueva al instante */}
                      {creandoCategoria && (
                        <div className="flex gap-2 mt-2">
                          <input
                            type="text"
                            value={nuevaCategoria}
                            onChange={(e) => setNuevaCategoria(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); crearCategoriaRapida(); } }}
                            placeholder="Nombre de la nueva categoría..."
                            autoFocus
                            className="flex-1 border border-blue-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button type="button" onClick={crearCategoriaRapida}
                            className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-bold transition-colors">
                            ✓
                          </button>
                          <button type="button" onClick={() => { setCreandoCategoria(false); setNuevaCategoria(''); }}
                            className="px-3 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded-lg text-sm font-bold transition-colors">
                            ✕
                          </button>
                        </div>
                      )}

                      {/* Aviso si no hay categorías */}
                      {categorias.length === 0 && !creandoCategoria && (
                        <p className="text-xs text-amber-600 mt-1">
                          ⚠️ No hay categorías. Hacé clic en <strong>+</strong> para crear una antes de guardar el producto.
                        </p>
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
                            min="0" step="0.01" className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="0.00" />
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Margen de Ganancia %</label>
                      <div className="relative">
                        <input type="number" name="margen_ganancia" value={formulario.margen_ganancia} onChange={manejarCambio}
                          min="0" step="0.1" className="w-full border border-gray-300 rounded-lg px-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Ej: 50" />
                        <span className="absolute right-3 top-2 text-gray-500">%</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Alícuota IVA %</label>
                      <div className="relative">
                        <input type="number" name="alicuota_iva" value={formulario.alicuota_iva} onChange={manejarCambio}
                          min="0" max="100" step="0.5" className="w-full border border-gray-300 rounded-lg px-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" />
                        <span className="absolute right-3 top-2 text-gray-500">%</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">21% General · 10.5% Alimentos · 0% Exento</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Precio de Venta Final *</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-gray-500">$</span>
                        <input type="number" name="precio_venta" value={formulario.precio_venta} onChange={manejarCambio}
                          required min="0" className="w-full border border-green-400 bg-green-50 rounded-lg pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 font-semibold text-green-800" />
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
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Stock mínimo (alerta)</label>
                      <input type="number" name="stock_minimo" value={formulario.stock_minimo} onChange={manejarCambio}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" />
                    </div>
                  </div>
                )}
              </div>

              {/* Códigos alternativos */}
              {productoEditando ? (
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
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
                      + Agregar
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">💡 También podés escanear el código directamente en el campo</p>
             </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-sm text-blue-700 font-medium">🔖 Códigos de Barras Alternativos</p>
                  <p className="text-xs text-blue-500 mt-1">
                    Podés agregar códigos alternativos después de crear el producto, desde el botón Editar.
                  </p>
                </div>
              )}

              {/* Botones */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setMostrarFormulario(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit"
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors">
                  {productoEditando ? '💾 Guardar Cambios' : '✅ Crear Producto'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Modal Actualización Masiva de Precios */}
      {mostrarModalPrecios && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-lg font-bold text-gray-800">💲 Actualización Masiva de Precios</h3>
                <p className="text-xs text-gray-500">Modificá los precios de muchos productos a la vez</p>
              </div>
              <button onClick={() => setMostrarModalPrecios(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>

            <form onSubmit={aplicarPreciosMasivo} className="p-5 space-y-5">

              {/* Alcance */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">¿A qué productos se aplica?</label>
                <div className="space-y-2">
                  <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${formPrecios.alcance === 'todos' ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="alcance" checked={formPrecios.alcance === 'todos'}
                      onChange={() => setFormPrecios(p => ({ ...p, alcance: 'todos' }))} className="w-4 h-4 text-amber-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">Todos los productos</p>
                      <p className="text-xs text-gray-500">{totalProductos} productos activos del negocio</p>
                    </div>
                  </label>
                  <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${formPrecios.alcance === 'categoria' ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="alcance" checked={formPrecios.alcance === 'categoria'}
                      onChange={() => setFormPrecios(p => ({ ...p, alcance: 'categoria' }))} className="w-4 h-4 text-amber-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">Una categoría</p>
                      {formPrecios.alcance === 'categoria' && (
                        <select value={formPrecios.categoria_id}
                          onChange={(e) => setFormPrecios(p => ({ ...p, categoria_id: e.target.value }))}
                          className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                          <option value="">Seleccionar categoría...</option>
                          {categorias.map(cat => <option key={cat.id} value={cat.id}>{cat.nombre}</option>)}
                        </select>
                      )}
                    </div>
                  </label>
                  {seleccionados.length > 0 && (
                    <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${formPrecios.alcance === 'seleccion' ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <input type="radio" name="alcance" checked={formPrecios.alcance === 'seleccion'}
                        onChange={() => setFormPrecios(p => ({ ...p, alcance: 'seleccion' }))} className="w-4 h-4 text-amber-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-800">Solo los seleccionados</p>
                        <p className="text-xs text-gray-500">{seleccionados.length} producto(s) tildados en la tabla</p>
                      </div>
                    </label>
                  )}
                </div>
              </div>

              {/* Campo a modificar */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">¿Qué precio se modifica?</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'precio_venta', label: 'Venta' },
                    { id: 'precio_costo', label: 'Costo' },
                    { id: 'ambos', label: 'Ambos' },
                  ].map(c => (
                    <button key={c.id} type="button"
                      onClick={() => setFormPrecios(p => ({ ...p, campo: c.id, ...(c.id === 'ambos' && p.operacion === 'fijar' ? { operacion: 'porcentaje' } : {}) }))}
                      className={`py-2 rounded-xl text-sm font-medium border-2 transition-all ${formPrecios.campo === c.id ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Operación */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de ajuste</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'porcentaje', label: 'Porcentaje %' },
                    { id: 'monto', label: 'Monto fijo $' },
                    ...(formPrecios.campo !== 'ambos' ? [{ id: 'fijar', label: 'Precio exacto' }] : []),
                  ].map(o => (
                    <button key={o.id} type="button"
                      onClick={() => setFormPrecios(p => ({ ...p, operacion: o.id }))}
                      className={`py-2 rounded-xl text-sm font-medium border-2 transition-all ${formPrecios.operacion === o.id ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dirección + Valor */}
              <div className="flex gap-3">
                {formPrecios.operacion !== 'fijar' && (
                  <div className="flex rounded-xl border-2 border-gray-200 overflow-hidden">
                    <button type="button" onClick={() => setFormPrecios(p => ({ ...p, direccion: 'aumentar' }))}
                      className={`px-4 py-2 text-sm font-semibold transition-colors ${formPrecios.direccion === 'aumentar' ? 'bg-green-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                      ↑ Aumentar
                    </button>
                    <button type="button" onClick={() => setFormPrecios(p => ({ ...p, direccion: 'disminuir' }))}
                      className={`px-4 py-2 text-sm font-semibold transition-colors ${formPrecios.direccion === 'disminuir' ? 'bg-red-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                      ↓ Bajar
                    </button>
                  </div>
                )}
                <div className="relative flex-1">
                  <span className="absolute left-3 top-2.5 text-gray-400">{formPrecios.operacion === 'porcentaje' ? '%' : '$'}</span>
                  <input type="number" value={formPrecios.valor} min="0" step="0.01" required autoFocus
                    onChange={(e) => setFormPrecios(p => ({ ...p, valor: e.target.value }))}
                    className="w-full border-2 border-gray-200 rounded-xl pl-8 pr-3 py-2 text-lg font-semibold focus:outline-none focus:border-amber-400"
                    placeholder={formPrecios.operacion === 'porcentaje' ? 'Ej: 10' : 'Ej: 500'} />
                </div>
              </div>

              {/* Resumen */}
              {parseFloat(formPrecios.valor) > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
                  {formPrecios.operacion === 'fijar'
                    ? <>Se va a <strong>fijar el {formPrecios.campo === 'precio_venta' ? 'precio de venta' : 'precio de costo'} en {formatearPeso(parseFloat(formPrecios.valor))}</strong></>
                    : <>Se va a <strong>{formPrecios.direccion} {formPrecios.operacion === 'porcentaje' ? `${formPrecios.valor}%` : formatearPeso(parseFloat(formPrecios.valor))}</strong> el {formPrecios.campo === 'ambos' ? 'precio de venta y de costo' : formPrecios.campo === 'precio_venta' ? 'precio de venta' : 'precio de costo'}</>
                  }
                  {' '}de {formPrecios.alcance === 'todos' ? `los ${totalProductos} productos` : formPrecios.alcance === 'categoria' ? 'la categoría elegida' : `${seleccionados.length} producto(s) seleccionados`}.
                  <p className="text-xs text-blue-600 mt-1">Ejemplo: un producto de {formatearPeso(1000)} pasa a {formatearPeso(
                    formPrecios.operacion === 'fijar' ? parseFloat(formPrecios.valor)
                    : formPrecios.operacion === 'porcentaje'
                      ? Math.max(0, Math.round(1000 * (1 + (formPrecios.direccion === 'disminuir' ? -1 : 1) * parseFloat(formPrecios.valor) / 100)))
                      : Math.max(0, 1000 + (formPrecios.direccion === 'disminuir' ? -1 : 1) * parseFloat(formPrecios.valor))
                  )}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setMostrarModalPrecios(false)}
                  className="flex-1 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={aplicandoPrecios}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold transition-colors disabled:opacity-50">
                  {aplicandoPrecios ? 'Aplicando...' : '💲 Aplicar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

// =============================================
// SELECTOR DE COMPONENTES DE UN PRODUCTO COMBINADO
// Buscador de productos (excluye combos y el propio producto en edición) +
// lista de componentes elegidos con su cantidad y costo. Muestra el costo total.
// =============================================
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

      {/* Buscador */}
      <div className="relative">
        <input value={buscar} onChange={(e) => setBuscar(e.target.value)}
          placeholder="Buscar producto para agregar…"
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

      {/* Componentes elegidos */}
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
                  onChange={(e) => setCant(c.producto_id, e.target.value)}
                  className="w-16 border border-gray-300 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <span className="text-sm font-semibold text-gray-700 w-20 text-right flex-shrink-0">
                {fmt((Number(c.precio_costo) || 0) * (Number(c.cantidad) || 0))}
              </span>
              <button type="button" onClick={() => quitar(c.producto_id)}
                className="text-red-400 hover:text-red-600 text-lg flex-shrink-0">✕</button>
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

export default Productos;