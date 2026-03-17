// =============================================
// ARCHIVO: src/components/admin/Categorias.jsx
// FUNCIÓN: Gestión de categorías de productos
// =============================================

import { useState, useEffect } from 'react';
import api from '../../api/axios';

function Categorias() {

  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [nombreNueva, setNombreNueva] = useState('');
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  useEffect(() => {
    cargarCategorias();
  }, []);

  const cargarCategorias = async () => {
    try {
      setCargando(true);
      const res = await api.get('/api/categorias');
      setCategorias(res.data);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setCargando(false);
    }
  };

  const crearCategoria = async (e) => {
    e.preventDefault();
    setError('');

    if (!nombreNueva.trim()) {
      setError('El nombre es obligatorio');
      return;
    }

    try {
      await api.post('/api/categorias', { nombre: nombreNueva.trim() });
      setExito('Categoría creada correctamente');
      setNombreNueva('');
      setMostrarModal(false);
      cargarCategorias();
      setTimeout(() => setExito(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear la categoría');
    }
  };

  const eliminarCategoria = async (id, nombre) => {
    if (!window.confirm(`¿Eliminar la categoría "${nombre}"?\nLos productos de esta categoría quedarán sin categoría.`)) return;

    try {
      await api.delete(`/api/categorias/${id}`);
      setExito('Categoría eliminada');
      cargarCategorias();
      setTimeout(() => setExito(''), 3000);
    } catch (err) {
      setError('Error al eliminar la categoría');
    }
  };

  return (
    <div className="space-y-4">

      {/* Título */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Categorías</h2>
          <p className="text-gray-500">{categorias.length} categorías registradas</p>
        </div>
        <button
          onClick={() => { setMostrarModal(true); setError(''); setNombreNueva(''); }}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          + Nueva Categoría
        </button>
      </div>

      {/* Mensajes */}
      {exito && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg">✅ {exito}</div>}
      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">❌ {error}</div>}

      {/* Lista de categorías */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {cargando ? (
          <div className="text-center py-8 text-gray-400">Cargando categorías...</div>
        ) : categorias.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-2">🏷️</p>
            <p>No hay categorías registradas</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">#</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Nombre</th>
                <th className="text-right px-4 py-3 text-gray-600 font-medium">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {categorias.map((cat, i) => (
                <tr key={cat.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400 text-sm">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">
                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm">
                      {cat.nombre}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => eliminarCategoria(cat.id, cat.nombre)}
                      className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded text-sm transition-colors"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal nueva categoría */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">

            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="text-lg font-bold text-gray-800">🏷️ Nueva Categoría</h3>
              <button onClick={() => setMostrarModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">×</button>
            </div>

            <form onSubmit={crearCategoria} className="p-5 space-y-4">
              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg text-sm">
                  ❌ {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre de la categoría *
                </label>
                <input
                  type="text"
                  value={nombreNueva}
                  onChange={(e) => setNombreNueva(e.target.value)}
                  autoFocus
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Ej: Bebidas, Lácteos, Snacks..."
                />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setMostrarModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit"
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors">
                  ✅ Crear Categoría
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}

export default Categorias;