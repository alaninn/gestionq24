import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';

function Stock() {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [buscar, setBuscar] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [mostrarAjustar, setMostrarAjustar] = useState(false);
  const [productoAjustar, setProductoAjustar] = useState(null);
  const [nuevoStock, setNuevoStock] = useState('');
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [productoHistorial, setProductoHistorial] = useState(null);

  const navigate = useNavigate();

  const cargarProductos = async () => {
    try {
      setCargando(true);
      let url = '/api/productos?';
      if (buscar) url += `buscar=${encodeURIComponent(buscar)}&`;
      if (categoriaFiltro) url += `categoria=${encodeURIComponent(categoriaFiltro)}&`;
      const res = await api.get(url);
      setProductos(res.data.productos || res.data || []);
    } catch (e) {
      console.error(e);
      setError('Error al cargar productos');
    } finally {
      setCargando(false);
    }
  };

  const cargarCategorias = async () => {
    try {
      const res = await api.get('/api/categorias');
      setCategorias(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { cargarCategorias(); }, []);

  useEffect(() => {
    const timer = setTimeout(cargarProductos, 300);
    return () => clearTimeout(timer);
  }, [buscar, categoriaFiltro]);

  const abrirAjustar = (producto) => {
    setProductoAjustar(producto);
    setNuevoStock(String(producto.stock ?? 0));
    setMostrarAjustar(true);
  };

  const guardarAjuste = async () => {
    const parsed = parseInt(nuevoStock, 10);
    if (isNaN(parsed) || parsed < 0) {
      setError('Stock inválido');
      return;
    }

    try {
      const res = await api.put(`/api/productos/${productoAjustar.id}/stock`, { stock: parsed });
      setExito('Stock actualizado');
      setError('');
      setMostrarAjustar(false);
      setProductoAjustar(null);
      setNuevoStock('');
      cargarProductos();
      setTimeout(() => setExito(''), 3000);
    } catch (e) {
      console.error(e);
      setError('Error al actualizar stock');
    }
  };

  const abrirHistorial = async (producto) => {
    try {
      const res = await api.get(`/api/productos/${producto.id}/historial-stock`);
      setHistorial(res.data || []);
      setProductoHistorial(producto);
      setMostrarHistorial(true);
    } catch (e) {
      console.error(e);
      setError('Error al cargar historial');
    }
  };

  const eliminarProducto = async (producto) => {
    if (!window.confirm(`¿Desactivar producto ${producto.nombre}?`)) return;
    try {
      await api.delete(`/api/productos/${producto.id}`);
      setExito('Producto desactivado');
      cargarProductos();
      setTimeout(() => setExito(''), 3000);
    } catch (e) {
      console.error(e);
      setError('Error al desactivar producto');
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Stock</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div>
          <input
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            className="w-full border p-2 rounded"
            placeholder="Buscar producto..."
          />
        </div>
        <div>
          <select
            value={categoriaFiltro}
            onChange={(e) => setCategoriaFiltro(e.target.value)}
            className="w-full border p-2 rounded"
          >
            <option value="">Todas las categorías</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="text-red-600">{error}</div>}
      {exito && <div className="text-green-600">{exito}</div>}

      <div className="overflow-x-auto">
        <table className="w-full border border-gray-200 text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-2">Nombre</th>
              <th className="border p-2">Categoría</th>
              <th className="border p-2">Stock</th>
              <th className="border p-2">Stock mínimo</th>
              <th className="border p-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr><td colSpan="5" className="text-center p-4">Cargando...</td></tr>
            ) : productos.length === 0 ? (
              <tr><td colSpan="5" className="text-center p-4">No hay productos</td></tr>
            ) : productos.map((p) => (
              <tr key={p.id} className={p.stock <= (p.stock_minimo ?? 0) ? 'bg-red-50' : ''}>
                <td className="border p-2">{p.nombre}</td>
                <td className="border p-2">{p.categoria_nombre || ''}</td>
                <td className="border p-2">{p.stock ?? 0}</td>
                <td className="border p-2">{p.stock_minimo ?? 0}</td>
                <td className="border p-2 space-x-2">
                  <button onClick={() => abrirAjustar(p)} className="bg-yellow-400 px-2 py-1 rounded">Ajustar</button>
                  <button onClick={() => abrirHistorial(p)} className="bg-blue-500 text-white px-2 py-1 rounded">Historial</button>
                  <button onClick={() => eliminarProducto(p)} className="bg-red-500 text-white px-2 py-1 rounded">Eliminar</button>
                  <button onClick={() => navigate('/admin/productos')} className="bg-gray-700 text-white px-2 py-1 rounded">Modificar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {mostrarAjustar && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96">
            <h3 className="text-lg font-bold mb-3">Ajustar stock: {productoAjustar?.nombre}</h3>
            <div className="mb-3">
              <label className="block text-sm">Nuevo stock</label>
              <input type="number" value={nuevoStock} onChange={(e) => setNuevoStock(e.target.value)} className="w-full border p-2 rounded" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setMostrarAjustar(false)} className="px-3 py-2 border rounded">Cancelar</button>
              <button onClick={guardarAjuste} className="px-3 py-2 bg-green-600 text-white rounded">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {mostrarHistorial && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Historial de stock: {productoHistorial?.nombre}</h3>
              <button onClick={() => setMostrarHistorial(false)} className="text-xl">×</button>
            </div>
            <table className="w-full border border-gray-200 text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border p-2">Fecha</th>
                  <th className="border p-2">Stock anterior</th>
                  <th className="border p-2">Stock nuevo</th>
                </tr>
              </thead>
              <tbody>
                {historial.length === 0 ? (
                  <tr><td colSpan="3" className="p-2 text-center">No hay historial</td></tr>
                ) : historial.map(h => (
                  <tr key={h.id}>
                    <td className="border p-2">{new Date(h.fecha).toLocaleString()}</td>
                    <td className="border p-2">{h.stock_anterior}</td>
                    <td className="border p-2">{h.stock_nuevo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default Stock;
