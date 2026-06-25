// =============================================
// ARCHIVO: src/components/admin/Categorias.jsx
// FUNCIÓN: Gestión de categorías de productos (ver productos, renombrar, unir)
// =============================================

import { useState, useEffect } from 'react';
import api from '../../api/axios';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n || 0);

function Categorias() {
  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  // Modal crear / renombrar
  const [modalCat, setModalCat] = useState(null); // null | { id?, nombre }
  // Modal ver productos de una categoría
  const [verCategoria, setVerCategoria] = useState(null);
  // Modal unir categorías
  const [mostrarUnir, setMostrarUnir] = useState(false);

  useEffect(() => { cargarCategorias(); }, []);

  const avisoOk = (m) => { setExito(m); setTimeout(() => setExito(''), 3000); };

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

  const guardarCat = async (e) => {
    e.preventDefault();
    setError('');
    const nombre = (modalCat?.nombre || '').trim();
    if (!nombre) { setError('El nombre es obligatorio'); return; }
    try {
      if (modalCat.id) {
        await api.put(`/api/categorias/${modalCat.id}`, { nombre });
        avisoOk('Categoría renombrada');
      } else {
        await api.post('/api/categorias', { nombre });
        avisoOk('Categoría creada');
      }
      setModalCat(null);
      cargarCategorias();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar la categoría');
    }
  };

  const eliminarCategoria = async (cat) => {
    if (!window.confirm(`¿Eliminar la categoría "${cat.nombre}"?\nSolo se puede si no tiene productos.`)) return;
    try {
      await api.delete(`/api/categorias/${cat.id}`);
      avisoOk('Categoría eliminada');
      cargarCategorias();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al eliminar la categoría');
      setTimeout(() => setError(''), 4000);
    }
  };

  // Detectar nombres repetidos (case-insensitive) para sugerir unirlos
  const duplicadas = (() => {
    const grupos = {};
    for (const c of categorias) {
      const k = (c.nombre || '').trim().toLowerCase();
      (grupos[k] = grupos[k] || []).push(c);
    }
    return Object.values(grupos).filter(g => g.length > 1);
  })();

  return (
    <div className="space-y-4">

      {/* Título */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">🏷️ Categorías</h2>
          <p className="text-gray-500 text-sm">{categorias.length} categorías · tocá una para ver sus productos</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setMostrarUnir(true); setError(''); }}
            className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-medium transition-colors">
            🔗 Unir
          </button>
          <button onClick={() => { setModalCat({ nombre: '' }); setError(''); }}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
            + Nueva
          </button>
        </div>
      </div>

      {/* Mensajes */}
      {exito && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg">✅ {exito}</div>}
      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">❌ {error}</div>}

      {/* Aviso de categorías repetidas */}
      {duplicadas.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-3 flex-wrap">
          <span>
            ⚠️ Hay {duplicadas.length} nombre(s) de categoría repetido(s): <b>{duplicadas.map(g => g[0].nombre).join(', ')}</b>. Conviene unirlos.
          </span>
          <button onClick={() => setMostrarUnir(true)}
            className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap">
            🔗 Unir categorías
          </button>
        </div>
      )}

      {/* Grilla de categorías */}
      {cargando ? (
        <div className="text-center py-10 text-gray-400">Cargando categorías...</div>
      ) : categorias.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white rounded-xl shadow">
          <p className="text-4xl mb-2">🏷️</p>
          <p>No hay categorías registradas</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {categorias.map(cat => {
            const n = parseInt(cat.total_productos) || 0;
            return (
              <div key={cat.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-green-300 transition-all p-4 cursor-pointer group"
                onClick={() => setVerCategoria(cat)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{cat.nombre}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {n === 0 ? 'Sin productos' : `${n} producto${n !== 1 ? 's' : ''}`} · tocá para ver →
                    </p>
                  </div>
                  <span className={`text-sm font-bold px-2.5 py-1 rounded-lg flex-shrink-0 ${n > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                    {n}
                  </span>
                </div>
                <div className="flex gap-1.5 mt-3" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => setVerCategoria(cat)}
                    className="flex-1 py-1.5 text-xs font-semibold text-slate-700 border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors">
                    👁️ Ver
                  </button>
                  <button onClick={() => { setModalCat({ id: cat.id, nombre: cat.nombre }); setError(''); }}
                    title="Renombrar"
                    className="px-3 py-1.5 text-xs font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors">
                    ✏️
                  </button>
                  <button onClick={() => eliminarCategoria(cat)}
                    title="Eliminar"
                    className="px-3 py-1.5 text-xs font-semibold text-red-500 border border-red-100 hover:bg-red-50 rounded-lg transition-colors">
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal crear / renombrar */}
      {modalCat && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="text-lg font-bold text-gray-800">{modalCat.id ? '✏️ Renombrar categoría' : '🏷️ Nueva categoría'}</h3>
              <button onClick={() => setModalCat(null)} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">×</button>
            </div>
            <form onSubmit={guardarCat} className="p-5 space-y-4">
              {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2.5 rounded-lg text-sm">❌ {error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la categoría *</label>
                <input type="text" value={modalCat.nombre}
                  onChange={(e) => setModalCat(p => ({ ...p, nombre: e.target.value }))}
                  autoFocus required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Ej: Bebidas, Lácteos, Snacks..." />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setModalCat(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">Cancelar</button>
                <button type="submit"
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors">
                  {modalCat.id ? '💾 Guardar' : '✅ Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal ver productos de una categoría */}
      {verCategoria && (
        <ModalProductosCategoria categoria={verCategoria} onClose={() => setVerCategoria(null)} />
      )}

      {/* Modal unir categorías */}
      {mostrarUnir && (
        <ModalUnirCategorias
          categorias={categorias}
          onClose={() => setMostrarUnir(false)}
          onUnido={(msg) => { setMostrarUnir(false); avisoOk(msg); cargarCategorias(); }}
        />
      )}
    </div>
  );
}

// Lista de productos de una categoría (solo lectura)
function ModalProductosCategoria({ categoria, onClose }) {
  const [productos, setProductos] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const r = await api.get(`/api/productos?categoria=${categoria.id}&limite=1000`);
        const data = Array.isArray(r.data) ? r.data : (r.data.productos || []);
        setProductos(data);
      } catch { setProductos([]); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 sm:p-5 border-b bg-slate-800 text-white flex-shrink-0">
          <div>
            <h3 className="text-lg font-bold">🏷️ {categoria.nombre}</h3>
            <p className="text-slate-300 text-xs">{productos === null ? 'Cargando…' : `${productos.length} producto(s)`}</p>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {productos === null ? (
            <p className="text-center text-gray-400 text-sm py-10">Cargando…</p>
          ) : productos.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-10">Esta categoría no tiene productos.</p>
          ) : (
            <div className="space-y-1.5">
              {productos.map(p => {
                const stock = Number(p.stock) || 0;
                return (
                  <div key={p.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{p.nombre}</p>
                      <p className="text-[11px] text-gray-400">{p.codigo || 'sin código'} · {fmt(p.precio_venta)}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0 ${stock <= (p.stock_minimo ?? 0) ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                      {stock}{p.unidad ? ` ${p.unidad}` : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="p-3 border-t flex-shrink-0">
          <button onClick={onClose} className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm">Cerrar</button>
        </div>
      </div>
    </div>
  );
}

// Unir dos categorías (mueve los productos de la origen a la destino y borra la origen)
function ModalUnirCategorias({ categorias, onClose, onUnido }) {
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const catOrigen = categorias.find(c => String(c.id) === String(origen));
  const nMover = parseInt(catOrigen?.total_productos) || 0;

  const unir = async () => {
    setError('');
    if (!origen || !destino) { setError('Elegí las dos categorías'); return; }
    if (origen === destino) { setError('Tienen que ser distintas'); return; }
    if (!window.confirm(`Se moverán ${nMover} producto(s) a "${categorias.find(c => String(c.id) === String(destino))?.nombre}" y se borrará "${catOrigen?.nombre}". ¿Confirmás?`)) return;
    setGuardando(true);
    try {
      const r = await api.post('/api/categorias/unir', { origen_id: Number(origen), destino_id: Number(destino) });
      onUnido(`Categorías unidas (${r.data?.productos_movidos ?? 0} productos movidos)`);
    } catch (e) {
      setError(e.response?.data?.error || 'Error al unir');
    } finally { setGuardando(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b bg-amber-500 text-white rounded-t-2xl">
          <div>
            <h3 className="text-lg font-bold">🔗 Unir categorías</h3>
            <p className="text-amber-100 text-xs">Junta dos categorías repetidas en una sola</p>
          </div>
          <button onClick={onClose} className="text-amber-100 hover:text-white text-2xl">×</button>
        </div>
        <div className="p-5 space-y-4">
          {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2.5 rounded-lg text-sm">❌ {error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoría a unir (se borra) *</label>
            <select value={origen} onChange={(e) => setOrigen(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
              <option value="">Elegir…</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre} ({parseInt(c.total_productos) || 0})</option>)}
            </select>
          </div>
          <div className="text-center text-gray-400 text-sm">⬇️ se mueve a ⬇️</div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoría que queda *</label>
            <select value={destino} onChange={(e) => setDestino(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
              <option value="">Elegir…</option>
              {categorias.filter(c => String(c.id) !== String(origen)).map(c => <option key={c.id} value={c.id}>{c.nombre} ({parseInt(c.total_productos) || 0})</option>)}
            </select>
          </div>
          {origen && destino && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Se moverán <b>{nMover}</b> producto(s) y se borrará <b>{catOrigen?.nombre}</b>.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 text-sm hover:bg-gray-50">Cancelar</button>
            <button onClick={unir} disabled={guardando || !origen || !destino}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-bold disabled:opacity-40">
              {guardando ? 'Uniendo…' : '🔗 Unir'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Categorias;
