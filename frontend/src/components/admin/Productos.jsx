// =============================================
// ARCHIVO: src/components/admin/Productos.jsx
// =============================================

import { useState, useEffect, useRef } from 'react';
import api from '../../api/axios';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

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

function Productos() {

  const [productos, setProductos] = useState([]);
const [categorias, setCategorias] = useState([]);
  const [nuevaCategoria, setNuevaCategoria] = useState('');
  const [creandoCategoria, setCreandoCategoria] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [buscar, setBuscar] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
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

    // Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const [totalProductos, setTotalProductos] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(0);

  const [formulario, setFormulario] = useState({
    codigo: '', nombre: '', categoria_id: '',
    precio_costo: '', margen_ganancia: '', alicuota_iva: '21',
    precio_venta: '', precio_mayorista: '', margen_mayorista: '',
    stock: '0', stock_minimo: '0', unidad: 'Uni',
  });

  useEffect(() => { cargarProductos(); cargarCategorias(); }, []);

  useEffect(() => {
    const timer = setTimeout(() => cargarProductos(), 400);
    return () => clearTimeout(timer);
  }, [buscar, categoriaFiltro]);

  useEffect(() => {
    if (celdaEditando && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [celdaEditando]);

  useEffect(() => {
    const costo = parseFloat(formulario.precio_costo) || 0;
    const margen = parseFloat(formulario.margen_ganancia) || 0;
    const iva = parseFloat(formulario.alicuota_iva) || 0;
    if (costo > 0) {
      const precio = costo * (1 + margen / 100) * (1 + iva / 100);
      setFormulario(prev => ({ ...prev, precio_venta: Math.round(precio).toString() }));
    }
  }, [formulario.precio_costo, formulario.margen_ganancia, formulario.alicuota_iva]);

  useEffect(() => {
    const costo = parseFloat(formulario.precio_costo) || 0;
    const margen = parseFloat(formulario.margen_mayorista) || 0;
    const iva = parseFloat(formulario.alicuota_iva) || 0;
    if (costo > 0 && margen > 0) {
      const precio = costo * (1 + margen / 100) * (1 + iva / 100);
      setFormulario(prev => ({ ...prev, precio_mayorista: Math.round(precio).toString() }));
    }
  }, [formulario.precio_costo, formulario.margen_mayorista, formulario.alicuota_iva]);

  const cargarProductos = async (pagina = 1) => {
    try {
      setCargando(true);
      let url = `/api/productos?pagina=${pagina}&limite=${LIMITE}`;
      if (buscar) url += `&buscar=${buscar}`;
      if (categoriaFiltro) url += `&categoria=${categoriaFiltro}`;
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
      const datosActualizados = { ...producto, [campo]: nuevoValor };
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
    setFormulario(prev => ({ ...prev, [name]: value }));
  };

  const abrirFormularioNuevo = () => {
    setFormulario({ codigo: '', nombre: '', categoria_id: '', precio_costo: '', margen_ganancia: '', alicuota_iva: '21', precio_venta: '', precio_mayorista: '', margen_mayorista: '', stock: '0', stock_minimo: '0', unidad: 'Uni' });
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
    });
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
  };

  const guardarProducto = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const datos = {
        codigo: formulario.codigo, nombre: formulario.nombre, categoria_id: formulario.categoria_id,
        precio_costo: formulario.precio_costo, precio_venta: formulario.precio_venta,
        precio_mayorista: formulario.precio_mayorista || null, stock: formulario.stock,
        stock_minimo: formulario.stock_minimo, unidad: formulario.unidad,
        alicuota_iva: formulario.alicuota_iva, margen_ganancia: formulario.margen_ganancia || 0,
      };
      if (productoEditando) {
        await api.put(`/api/productos/${productoEditando}`, datos);
        setExito('Producto actualizado correctamente');
      } else {
        await api.post('/api/productos', datos);
        setExito('Producto creado correctamente');
      }
      setMostrarFormulario(false);
      cargarProductos();
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

      const columnas = ['Código', 'Nombre', 'Categoría', 'P. Costo', 'P. Venta', 'Stock', 'Stock Mín', 'Unidad', 'IVA %', 'Margen %'];
      const filas = todosLosProductos.map(p => [
        p.codigo || '',
        p.nombre,
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
        { wch: 20 }, { wch: 35 }, { wch: 20 }, { wch: 12 },
        { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
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
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const filas = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const prods = filas.slice(1).filter(f => f.length > 0 && f[0]);
      if (prods.length === 0) { setError('El archivo está vacío o no tiene el formato correcto'); return; }

      let exitosos = 0, errores = 0;
      for (const fila of prods) {
        const [nombre, codigo, categoria_nombre, precio_costo, precio_venta, stock, stock_minimo, unidad, alicuota_iva, margen_ganancia] = fila;
        if (!nombre || !precio_venta) continue;
        const cat = categorias.find(c => c.nombre.toLowerCase() === String(categoria_nombre || '').toLowerCase());
        try {
          await api.post('/api/productos', {
            nombre: String(nombre), codigo: codigo ? String(codigo) : '',
            categoria_id: cat?.id || null, precio_costo: parseFloat(precio_costo) || 0,
            precio_venta: parseFloat(precio_venta), stock: parseInt(stock) || 0,
            stock_minimo: parseInt(stock_minimo) || 0, unidad: unidad || 'Uni',
            alicuota_iva: parseFloat(alicuota_iva) || 21, margen_ganancia: parseFloat(margen_ganancia) || 0,
          });
          exitosos++;
        } catch { errores++; }
      }
      setExito(`✅ ${exitosos} productos importados${errores > 0 ? `, ${errores} errores` : ''}`);
      cargarProductos();
      setTimeout(() => setExito(''), 5000);
    } catch { setError('Error al leer el archivo.'); }
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
          <button onClick={abrirFormularioNuevo}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
            + Nuevo Producto
          </button>
        </div>
      </div>

      {exito && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg">{exito}</div>}
      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">❌ {error}</div>}

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
      </div>

      <p className="text-xs text-gray-400">💡 Hacé clic en el precio o stock para editarlo. Enter para guardar, Escape para cancelar.</p>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
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
                <tr><td colSpan="7" className="text-center py-8 text-gray-400">Cargando...</td></tr>
              ) : productosOrdenados.length === 0 ? (
                <tr><td colSpan="7" className="text-center py-8 text-gray-400">No se encontraron productos</td></tr>
              ) : (
                productosOrdenados.map(producto => (
                  <tr key={producto.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-500 text-sm">{producto.codigo || '-'}</td>
                    <td className="px-4 py-2 font-medium text-gray-800">{producto.nombre}</td>
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
                        <button onClick={() => eliminarProducto(producto.id, producto.nombre)} className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded text-sm transition-colors">Borrar</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

                {/* Paginación */}
        {totalPaginas > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
            <p className="text-sm text-gray-500">
              Mostrando {((paginaActual - 1) * LIMITE) + 1}–{Math.min(paginaActual * LIMITE, totalProductos)} de {totalProductos} productos
            </p>
            <div className="flex gap-2">
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
                  <div className="grid grid-cols-2 gap-3">
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
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Precio Costo</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-gray-500">$</span>
                        <input type="number" name="precio_costo" value={formulario.precio_costo} onChange={manejarCambio}
                          min="0" step="0.01" className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="0.00" />
                      </div>
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
                  <div className="grid grid-cols-2 gap-3">
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
                <div className="grid grid-cols-2 gap-3">
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

    </div>
  );
}

export default Productos;