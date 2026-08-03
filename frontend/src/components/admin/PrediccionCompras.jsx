import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

const cant = (n) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(Number(n) || 0);
const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(Number(n) || 0);

// Predicción de compras: cuánto reponer para el/los próximos día(s), en base a lo
// vendido por día de la semana (no depende del stock).
function PrediccionCompras() {
  const { puedeUsarFuncion } = useAuth();
  const [dias, setDias] = useState(1);
  const [semanas, setSemanas] = useState(8);
  const [nivel, setNivel] = useState('normal');
  const [categoria, setCategoria] = useState('');
  const [descontarStock, setDescontarStock] = useState(false);
  const [ocultarCero, setOcultarCero] = useState(true);

  const [categorias, setCategorias] = useState([]);
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { api.get('/api/categorias').then(r => setCategorias(r.data || [])).catch(() => {}); }, []);

  const cargar = async () => {
    try {
      setCargando(true); setError('');
      const p = new URLSearchParams({
        dias: String(dias), semanas: String(semanas), nivel,
        descontar_stock: descontarStock ? '1' : '0',
        ocultar_cero: ocultarCero ? '1' : '0',
      });
      if (categoria) p.set('categoria', categoria);
      const r = await api.get('/api/reportes/prediccion-compras?' + p.toString());
      setData(r.data);
    } catch (e) {
      if (e.response?.status === 403) setError('La predicción de compras no está habilitada para este negocio.');
      else setError('No se pudo generar la predicción');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [dias, semanas, nivel, categoria, descontarStock, ocultarCero]);

  const items = data?.items || [];
  const columnas = ['Producto', 'Categoría', 'Se vende (día)', 'Demanda prevista', 'Comprar', 'Costo estimado', 'Stock actual'];
  const filasExport = items.map(i => [
    i.nombre, i.categoria || '', cant(i.prom_dia_objetivo), cant(i.demanda_prevista), i.sugerido, Number(i.costo_estimado) || 0, i.stock_actual,
  ]);

  const exportarExcel = () => {
    const ws = XLSX.utils.aoa_to_sheet([columnas, ...filasExport]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Predicción compras');
    saveAs(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })]), `Prediccion compras ${data?.objetivo || ''}.xlsx`);
  };
  const exportarPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Predicción de compras', 14, 15);
    doc.setFontSize(10); doc.setTextColor(120);
    doc.text(`Para: ${data?.objetivo || ''} · análisis últimas ${semanas} semanas`, 14, 22);
    autoTable(doc, {
      head: [columnas],
      body: items.map(i => [i.nombre, i.categoria || '', cant(i.prom_dia_objetivo), cant(i.demanda_prevista), String(i.sugerido), fmt(i.costo_estimado), String(i.stock_actual)]),
      startY: 28, styles: { fontSize: 8 }, headStyles: { fillColor: [22, 163, 74] },
    });
    doc.save(`Prediccion compras ${data?.objetivo || ''}.pdf`);
  };

  if (!puedeUsarFuncion('prediccion_compras')) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <p className="text-5xl mb-3">🛒</p>
        <h2 className="text-xl font-bold text-gray-700">Función Premium</h2>
        <p className="text-gray-500 mt-2">La predicción de compras se habilita desde tu plan.</p>
      </div>
    );
  }

  const nivelBtns = [['normal', 'Normal'], ['alto', 'Alto'], ['muy_alto', 'Muy alto']];
  const diasBtns = [[1, 'Mañana'], [3, 'Próx. 3 días'], [7, 'Próx. 7 días']];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 bg-clip-text text-transparent">
          🛒 Predicción de compras
        </h2>
        <p className="text-gray-500 text-sm">Cuánto comprar para reponer lo que se vende, según el día de la semana. Se calcula con tu historial de ventas.</p>
      </div>

      {/* Controles */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 mr-1">Comprar para:</span>
          {diasBtns.map(([v, l]) => (
            <button key={v} onClick={() => setDias(v)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${dias === v ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{l}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Cobertura (colchón)</label>
            <div className="flex gap-1">
              {nivelBtns.map(([v, l]) => (
                <button key={v} onClick={() => setNivel(v)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${nivel === v ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Analizar últimas</label>
            <select value={semanas} onChange={e => setSemanas(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {[4, 6, 8, 12, 16].map(s => <option key={s} value={s}>{s} semanas</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Categoría</label>
            <select value={categoria} onChange={e => setCategoria(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Todas</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={descontarStock} onChange={e => setDescontarStock(e.target.checked)} className="w-4 h-4 accent-green-600" />
            Descontar mi stock actual
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={ocultarCero} onChange={e => setOcultarCero(e.target.checked)} className="w-4 h-4 accent-green-600" />
            Ocultar los que no hay que comprar
          </label>
        </div>
        {descontarStock && (
          <p className="text-[11px] text-amber-600">⚠️ Ojo: el stock puede estar desactualizado. Si no lo llevás al día, dejá esta opción apagada.</p>
        )}
      </div>

      {cargando ? (
        <div className="text-center text-gray-400 py-10">Calculando…</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">{error}</div>
      ) : (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <p className="text-xs text-gray-500">Comprar para</p>
              <p className="text-xl font-bold text-gray-800">{data?.objetivo}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <p className="text-xs text-gray-500">Productos a reponer</p>
              <p className="text-2xl font-bold text-green-700">{data?.productos_a_reponer}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <p className="text-xs text-gray-500">Costo estimado de la compra</p>
              <p className="text-xl font-bold text-gray-800">{fmt(data?.costo_total_estimado)}</p>
            </div>
          </div>

          {/* Export */}
          {items.length > 0 && (
            <div className="flex justify-end gap-2">
              <button onClick={exportarExcel} className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-sm font-semibold">📤 Excel</button>
              <button onClick={exportarPDF} className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-semibold">📄 PDF</button>
            </div>
          )}

          {/* Tabla */}
          {items.length === 0 ? (
            <div className="text-center py-12 text-gray-400"><p className="text-4xl mb-2">✅</p><p>No hay nada que comprar para {data?.objetivo} (según lo vendido).</p></div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase">
                  <tr>
                    <th className="text-left px-4 py-2">Producto</th>
                    <th className="text-left px-3">Categoría</th>
                    <th className="text-right px-3" title="Cuánto se vende en un día como el objetivo">Se vende (día)</th>
                    <th className="text-right px-3" title="Demanda estimada para el período">Demanda</th>
                    <th className="text-right px-3">Comprar</th>
                    <th className="text-right px-3">Costo est.</th>
                    <th className="text-right px-4" title="Referencia; puede estar desactualizado">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(i => (
                    <tr key={i.producto_id} className="border-t border-gray-100">
                      <td className="px-4 py-2 text-gray-800">
                        {i.nombre}
                        {i.baja_confianza && <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">pocos datos</span>}
                      </td>
                      <td className="px-3 text-gray-500">{i.categoria || '—'}</td>
                      <td className="text-right px-3 text-gray-500">{cant(i.prom_dia_objetivo)}</td>
                      <td className="text-right px-3 text-gray-600">{cant(i.demanda_prevista)}</td>
                      <td className="text-right px-3 font-bold text-green-700">{i.sugerido}</td>
                      <td className="text-right px-3 text-gray-700">{fmt(i.costo_estimado)}</td>
                      <td className={`text-right px-4 ${Number(i.stock_actual) < 0 ? 'text-red-500' : 'text-gray-400'}`}>{i.stock_actual}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default PrediccionCompras;
