// =============================================
// ARCHIVO: src/components/admin/Reportes.jsx
// FUNCIÓN: Reportes e Historial completo
// =============================================

import { useState, useEffect } from 'react';
import api from '../../api/axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { hoyArgentina, fechaArgentina } from '../../utils/fecha';

// ---- FUNCIÓN PARA FORMATEAR PESOS ----
const fmt = (n) => new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', minimumFractionDigits: 0
}).format(n || 0);

// ---- FUNCIÓN PARA FORMATEAR FECHAS ----
const fmtFecha = (f) => new Date(f).toLocaleDateString('es-AR', {
  day: '2-digit', month: '2-digit', year: 'numeric'
});

const fmtFechaHora = (f) => new Date(f).toLocaleDateString('es-AR', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit'
});

function Reportes() {

  // Pestaña principal: 'historial' o 'reportes'
  const [pestana, setPestana] = useState('historial');

  // ---- ESTADOS HISTORIAL ----
  const [historial, setHistorial] = useState(null);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

  // Filtros del historial
  const [filtroPeriodo, setFiltroPeriodo] = useState('hoy');
  const [diaSeleccionado, setDiaSeleccionado] = useState(
    hoyArgentina()
  );
  const [mesSeleccionado, setMesSeleccionado] = useState(() => {
    const h = new Date();
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`;
  });
  const [rangoDesde, setRangoDesde] = useState(
    hoyArgentina()
  );
  const [rangoHasta, setRangoHasta] = useState(
    hoyArgentina()
  );

  // ---- ESTADOS REPORTES ----
  const [reporteActivo, setReporteActivo] = useState(null);
  const [datosReporte, setDatosReporte] = useState(null);
  const [cargandoReporte, setCargandoReporte] = useState(false);
  const [reporteFechaDesde, setReporteFechaDesde] = useState(
    hoyArgentina()
  );
  const [reporteFechaHasta, setReporteFechaHasta] = useState(
    
    hoyArgentina()
  );
  const [categorias, setCategorias] = useState([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('');

  // ---- CALCULAR FECHAS SEGÚN FILTRO ----
const calcularFechas = () => {
    const ahora = new Date();
    const hoy = new Date(ahora - ahora.getTimezoneOffset() * 60000).toISOString().split('T')[0];

    if (filtroPeriodo === 'hoy') return { desde: hoy, hasta: hoy };

    if (filtroPeriodo === 'dia') return { desde: diaSeleccionado, hasta: diaSeleccionado };

    if (filtroPeriodo === 'mes') {
      const [anio, mes] = mesSeleccionado.split('-');
      const ultimo = new Date(anio, mes, 0).getDate();
      return { desde: `${anio}-${mes}-01`, hasta: `${anio}-${mes}-${ultimo}` };
    }

    if (filtroPeriodo === 'rango') return { desde: rangoDesde, hasta: rangoHasta };
  };

  // Cargamos categorías al iniciar para el reporte por categoría
  useEffect(() => {
    api.get('/api/categorias').then(res => setCategorias(res.data));
  }, []);
  
  // ---- CARGAR HISTORIAL ----
  useEffect(() => {
    if (pestana === 'historial') cargarHistorial();
  }, [pestana, filtroPeriodo, diaSeleccionado, mesSeleccionado, rangoDesde, rangoHasta]);

  const cargarHistorial = async () => {
    try {
      setCargandoHistorial(true);
      const { desde, hasta } = calcularFechas();
      const res = await api.get(`/api/reportes/historial?fecha_desde=${desde}&fecha_hasta=${hasta}`);
      setHistorial(res.data);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setCargandoHistorial(false);
    }
  };

  // ---- CARGAR REPORTE ----
  const cargarReporte = async (tipo) => {
    try {
      setReporteActivo(tipo);
      setCargandoReporte(true);
      setDatosReporte(null);

      let url = '';
      if (tipo === 'productos-vendidos') url = `/api/reportes/productos-vendidos?fecha_desde=${reporteFechaDesde}&fecha_hasta=${reporteFechaHasta}`;
      if (tipo === 'por-turno') url = `/api/reportes/por-turno?fecha_desde=${reporteFechaDesde}&fecha_hasta=${reporteFechaHasta}`;
      if (tipo === 'rentabilidad') url = `/api/reportes/rentabilidad?fecha_desde=${reporteFechaDesde}&fecha_hasta=${reporteFechaHasta}`;
      if (tipo === 'stock') url = `/api/reportes/stock`;
      if (tipo === 'por-categoria') url = `/api/reportes/por-categoria?fecha_desde=${reporteFechaDesde}&fecha_hasta=${reporteFechaHasta}&categoria_id=${categoriaSeleccionada}`;

      const res = await api.get(url);
      setDatosReporte(res.data);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setCargandoReporte(false);
    }
  };

  // ---- EXPORTAR A PDF ----
  const exportarPDF = (titulo, columnas, filas) => {
    const doc = new jsPDF();

    // Encabezado
    doc.setFontSize(16);
    doc.text(titulo, 14, 15);
    doc.setFontSize(10);
    doc.text(`Generado: ${fmtFechaHora(new Date())}`, 14, 22);

    // Tabla
    autoTable(doc, {
      head: [columnas],
      body: filas,
      startY: 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [22, 163, 74] }, // verde
    });

    doc.save(`${titulo}.pdf`);
  };

  // ---- EXPORTAR A EXCEL ----
  const exportarExcel = (titulo, columnas, filas) => {
    const ws = XLSX.utils.aoa_to_sheet([columnas, ...filas]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf]), `${titulo}.xlsx`);
  };

  // ---- DATOS PARA EXPORTAR SEGÚN REPORTE ----
  const getDatosExport = () => {
    if (reporteActivo === 'productos-vendidos' && datosReporte) {
      return {
        titulo: 'Artículos Vendidos',
        columnas: ['Producto', 'Código', 'Categoría', 'Cantidad', 'Veces Vendido', 'Total Facturado'],
        filas: datosReporte.map(p => [
          p.nombre_producto, p.codigo || '-', p.categoria || '-',
          p.total_cantidad, p.veces_vendido, fmt(p.total_facturado)
        ])
      };
    }
    if (reporteActivo === 'por-turno' && datosReporte) {
      return {
        titulo: 'Reporte por Turno',
        columnas: ['Apertura', 'Cierre', 'Ventas', 'Total', 'Efectivo', 'Tarjeta', 'MP', 'Gastos'],
        filas: datosReporte.map(t => [
          fmtFechaHora(t.fecha_apertura),
          t.fecha_cierre ? fmtFechaHora(t.fecha_cierre) : 'Abierto',
          t.total_ventas, fmt(t.total_facturado),
          fmt(t.efectivo), fmt(t.tarjeta),
          fmt(t.mercadopago), fmt(t.total_gastos)
        ])
      };
    }
    if (reporteActivo === 'rentabilidad' && datosReporte) {
      return {
        titulo: 'Rentabilidad por Producto',
        columnas: ['Producto', 'Cantidad', 'Total Vendido', 'Costo Total', 'Ganancia', 'Margen %'],
        filas: datosReporte.porProducto.map(p => [
          p.nombre_producto, p.cantidad_vendida,
          fmt(p.total_vendido), fmt(p.total_costo),
          fmt(p.ganancia), `${p.margen_porcentaje}%`
        ])
      };
    }
    if (reporteActivo === 'stock' && datosReporte) {
      return {
        titulo: 'Stock Actual',
        columnas: ['Código', 'Producto', 'Categoría', 'Stock', 'Stock Mín', 'P. Costo', 'P. Venta', 'Valor Stock'],
        filas: datosReporte.productos.map(p => [
          p.codigo || '-', p.nombre, p.categoria || '-',
          p.stock, p.stock_minimo,
          fmt(p.precio_costo), fmt(p.precio_venta), fmt(p.valor_venta)
        ])
      };
    }
    return null;
  };

  // ---- PORCENTAJE DE UN MÉTODO DE PAGO ----
  const pctMetodo = (metodo) => {
    if (!historial?.totalVendido) return 0;
    return Math.round((historial.porMetodo?.[metodo] || 0) / historial.totalVendido * 100);
  };

  // =============================================
  // RENDER
  // =============================================
  return (
    <div className="space-y-4">

      {/* Título */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Reportes e Historial</h2>
        <p className="text-gray-500">Análisis, estadísticas y registro de operaciones</p>
      </div>

      {/* Pestañas principales */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setPestana('historial')}
          className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
            pestana === 'historial'
              ? 'border-green-600 text-green-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          📈 Historial
        </button>
        <button
          onClick={() => setPestana('reportes')}
          className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
            pestana === 'reportes'
              ? 'border-green-600 text-green-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          📊 Reportes
        </button>
      </div>

      {/* ==============================
          PESTAÑA: HISTORIAL
      ============================== */}
      {pestana === 'historial' && (
        <div className="space-y-4">

          {/* Filtros */}
          <div className="bg-white rounded-xl p-4 shadow flex gap-3 flex-wrap items-center">

            {/* Botones de período */}
            {[
              { id: 'hoy', label: 'Hoy' },
              { id: 'dia', label: 'Por día' },
              { id: 'mes', label: 'Por mes' },
              { id: 'rango', label: 'Rango' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFiltroPeriodo(f.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filtroPeriodo === f.id
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}

            {/* Selector según filtro */}
            {filtroPeriodo === 'dia' && (
              <input type="date" value={diaSeleccionado}
                onChange={(e) => setDiaSeleccionado(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" />
            )}
            {filtroPeriodo === 'mes' && (
              <input type="month" value={mesSeleccionado}
                onChange={(e) => setMesSeleccionado(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" />
            )}
            {filtroPeriodo === 'rango' && (
              <div className="flex gap-2 items-center">
                <input type="date" value={rangoDesde}
                  onChange={(e) => setRangoDesde(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" />
                <span className="text-gray-500">hasta</span>
                <input type="date" value={rangoHasta}
                  onChange={(e) => setRangoHasta(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            )}

          </div>

          {cargandoHistorial ? (
            <div className="text-center py-12 text-gray-400">Cargando historial...</div>
          ) : historial && (
            <>
              {/* Tarjetas de resumen */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-5 shadow">
                  <p className="text-gray-500 text-sm">Total Vendido</p>
                  <p className="text-2xl font-bold text-gray-800 mt-1">{fmt(historial.totalVendido)}</p>
                </div>
                <div className="bg-white rounded-xl p-5 shadow">
                  <p className="text-gray-500 text-sm">Total de Ventas</p>
                  <p className="text-2xl font-bold text-gray-800 mt-1">{historial.totalVentas}</p>
                  <p className="text-xs text-gray-400 mt-1">Ticket prom: {fmt(historial.ticketPromedio)}</p>
                </div>
                <div className="bg-white rounded-xl p-5 shadow">
                  <p className="text-gray-500 text-sm">Ventas en Efectivo</p>
                  <p className="text-2xl font-bold text-gray-800 mt-1">{pctMetodo('efectivo')}%</p>
                  <p className="text-xs text-gray-400 mt-1">{fmt(historial.porMetodo?.efectivo)}</p>
                </div>
                <div className="bg-white rounded-xl p-5 shadow">
                  <p className="text-gray-500 text-sm">Ventas con Tarjeta</p>
                  <p className="text-2xl font-bold text-gray-800 mt-1">{pctMetodo('tarjeta')}%</p>
                  <p className="text-xs text-gray-400 mt-1">{fmt(historial.porMetodo?.tarjeta)}</p>
                </div>
              </div>

              {/* Ventas por día */}
              {Object.keys(historial.porDia).length > 0 && (
                <div className="bg-white rounded-xl p-5 shadow">
                  <h3 className="font-semibold text-gray-700 mb-4">Ventas por día</h3>
                  <div className="space-y-2">
                    {Object.entries(historial.porDia)
                      .sort((a, b) => new Date(b[0]) - new Date(a[0]))
                      .map(([dia, total]) => {
                        const max = Math.max(...Object.values(historial.porDia));
                        const pct = (total / max) * 100;
                        return (
                          <div key={dia} className="flex items-center gap-3">
                            <span className="text-sm text-gray-500 w-24">{fmtFecha(dia)}</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                              <div
                                className="bg-green-500 h-full rounded-full flex items-center justify-end pr-2 transition-all"
                                style={{ width: `${pct}%` }}
                              >
                                <span className="text-white text-xs font-medium">{fmt(total)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Tabla de ventas */}
              {historial.ventas.length > 0 && (
                <div className="bg-white rounded-xl shadow overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="font-semibold text-gray-700">
                      Detalle de Ventas ({historial.ventas.length})
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => exportarPDF('Historial de Ventas',
                          ['Fecha', 'Método', 'Items', 'Total'],
                          historial.ventas.map(v => [
                            fmtFechaHora(v.fecha), v.metodo_pago,
                            v.cantidad_items, fmt(v.total)
                          ])
                        )}
                        className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                      >
                        📄 PDF
                      </button>
                      <button
                        onClick={() => exportarExcel('Historial de Ventas',
                          ['Fecha', 'Método', 'Items', 'Total'],
                          historial.ventas.map(v => [
                            fmtFechaHora(v.fecha), v.metodo_pago,
                            v.cantidad_items, v.total
                          ])
                        )}
                        className="bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                      >
                        📊 Excel
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">Fecha</th>
                          <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">Método</th>
                          <th className="text-center px-4 py-3 text-gray-600 font-medium text-sm">Items</th>
                          <th className="text-right px-4 py-3 text-gray-600 font-medium text-sm">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {historial.ventas.map(venta => (
                          <tr key={venta.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {fmtFechaHora(venta.fecha)}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm capitalize bg-gray-100 px-2 py-0.5 rounded">
                                {venta.metodo_pago}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-sm text-gray-600">
                              {venta.cantidad_items}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-gray-800">
                              {fmt(venta.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {historial.ventas.length === 0 && (
                <div className="bg-white rounded-xl p-12 text-center text-gray-400 shadow">
                  <p className="text-4xl mb-2">📭</p>
                  <p>No hay ventas en este período</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ==============================
          PESTAÑA: REPORTES
      ============================== */}
      {pestana === 'reportes' && (
        <div className="space-y-4">

          {/* Si no hay reporte activo, mostramos las tarjetas */}
          {!reporteActivo ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                {
                  id: 'productos-vendidos',
                  icon: '🛒',
                  titulo: 'Artículos Vendidos',
                  desc: 'Listado de productos vendidos por período con cantidades y montos',
                  tag: 'VENTAS',
                  color: 'blue'
                },
                {
                  id: 'por-turno',
                  icon: '🔄',
                  titulo: 'Reporte por Turno',
                  desc: 'Ventas, efectivo y gastos agrupados por cada turno trabajado',
                  tag: 'VENTAS',
                  color: 'purple'
                },
                {
                  id: 'rentabilidad',
                  icon: '💰',
                  titulo: 'Rentabilidad',
                  desc: 'Análisis de ganancias, márgenes y productos más rentables',
                  tag: 'FINANCIERO',
                  color: 'green'
                },

               {
                id: 'por-categoria',
                 icon: '🏷️',
                titulo: 'Por Categoría',
                 desc: 'Ventas, cantidades y ganancias de una categoría específica por período',
                tag: 'VENTAS',
                 color: 'teal'
                },

                {
                  id: 'stock',
                  icon: '📦',
                  titulo: 'Stock Actual',
                  desc: 'Inventario completo con valores de costo y venta',
                  tag: 'INVENTARIO',
                  color: 'orange'
                },
              ].map(r => (
                <div
                  key={r.id}
                  onClick={() => cargarReporte(r.id)}
                  className="bg-white rounded-xl p-5 shadow hover:shadow-md cursor-pointer transition-shadow border border-gray-100 hover:border-green-200"
                >
                  <div className="flex items-start justify-between">
                    <span className="text-3xl">{r.icon}</span>
                    <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                      {r.tag}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-800 mt-3">{r.titulo}</h3>
                  <p className="text-sm text-gray-500 mt-1">{r.desc}</p>
                  <p className="text-green-600 text-sm font-medium mt-3">Generar →</p>
                </div>
              ))}
            </div>
          ) : (
            // Si hay reporte activo, mostramos el resultado
            <div className="space-y-4">

              {/* Barra superior del reporte */}
              <div className="bg-white rounded-xl p-4 shadow flex items-center justify-between flex-wrap gap-3">
                <button
                  onClick={() => { setReporteActivo(null); setDatosReporte(null); }}
                  className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm"
                >
                  ← Volver a reportes
                </button>

                {/* Filtros de fecha para el reporte */}
                {reporteActivo !== 'stock' && (
                  <div className="flex gap-2 items-center">
                    <input type="date" value={reporteFechaDesde}
                      onChange={(e) => setReporteFechaDesde(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                    <span className="text-gray-400 text-sm">hasta</span>
                    <input type="date" value={reporteFechaHasta}
                      onChange={(e) => setReporteFechaHasta(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  
                  {/* Selector de categoría solo para ese reporte */}
                    {reporteActivo === 'por-categoria' && (
                      <select
                        value={categoriaSeleccionada}
                        onChange={(e) => setCategoriaSeleccionada(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        <option value="">Seleccionar categoría...</option>
                        {categorias.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                        ))}
                      </select>
                    )}
                    <button
                      onClick={() => cargarReporte(reporteActivo)}
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                    >
                      Filtrar
                    </button>





                  </div>
                )}

                {/* Botones de exportar */}
                {datosReporte && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const d = getDatosExport();
                        if (d) exportarPDF(d.titulo, d.columnas, d.filas);
                      }}
                      className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                    >
                      📄 Exportar PDF
                    </button>
                    <button
                      onClick={() => {
                        const d = getDatosExport();
                        if (d) exportarExcel(d.titulo, d.columnas, d.filas);
                      }}
                      className="bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                    >
                      📊 Exportar Excel
                    </button>
                  </div>
                )}
              </div>

              {cargandoReporte ? (
                <div className="text-center py-12 text-gray-400">Generando reporte...</div>
              ) : datosReporte && (
                <>
                  {/* ---- REPORTE: ARTÍCULOS VENDIDOS ---- */}
                  {reporteActivo === 'productos-vendidos' && (
                    <div className="bg-white rounded-xl shadow overflow-hidden">
                      <div className="p-4 border-b">
                        <h3 className="font-semibold text-gray-800">
                          🛒 Artículos Vendidos — {datosReporte.length} productos
                        </h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 border-b">
                            <tr>
                              <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">Producto</th>
                              <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">Categoría</th>
                              <th className="text-right px-4 py-3 text-gray-600 font-medium text-sm">Cantidad</th>
                              <th className="text-right px-4 py-3 text-gray-600 font-medium text-sm">Veces Vendido</th>
                              <th className="text-right px-4 py-3 text-gray-600 font-medium text-sm">Total Facturado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {datosReporte.map((p, i) => (
                              <tr key={i} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-medium text-gray-800">{p.nombre_producto}</td>
                                <td className="px-4 py-3 text-sm text-gray-500">{p.categoria || '-'}</td>
                                <td className="px-4 py-3 text-right text-gray-700">{p.total_cantidad}</td>
                                <td className="px-4 py-3 text-right text-gray-700">{p.veces_vendido}</td>
                                <td className="px-4 py-3 text-right font-medium text-green-600">{fmt(p.total_facturado)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* ---- REPORTE: POR TURNO ---- */}
                  {reporteActivo === 'por-turno' && (
                    <div className="bg-white rounded-xl shadow overflow-hidden">
                      <div className="p-4 border-b">
                        <h3 className="font-semibold text-gray-800">
                          🔄 Reporte por Turno — {datosReporte.length} turnos
                        </h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 border-b">
                            <tr>
                              <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">Apertura</th>
                              <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">Cierre</th>
                              <th className="text-center px-4 py-3 text-gray-600 font-medium text-sm">Ventas</th>
                              <th className="text-right px-4 py-3 text-gray-600 font-medium text-sm">Total</th>
                              <th className="text-right px-4 py-3 text-gray-600 font-medium text-sm">Efectivo</th>
                              <th className="text-right px-4 py-3 text-gray-600 font-medium text-sm">Tarjeta</th>
                              <th className="text-right px-4 py-3 text-gray-600 font-medium text-sm">MP</th>
                              <th className="text-right px-4 py-3 text-gray-600 font-medium text-sm">Gastos</th>
                              <th className="text-center px-4 py-3 text-gray-600 font-medium text-sm">Estado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {datosReporte.map(t => (
                              <tr key={t.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm text-gray-600">{fmtFechaHora(t.fecha_apertura)}</td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                  {t.fecha_cierre ? fmtFechaHora(t.fecha_cierre) : '-'}
                                </td>
                                <td className="px-4 py-3 text-center font-medium text-gray-700">{t.total_ventas}</td>
                                <td className="px-4 py-3 text-right font-bold text-green-600">{fmt(t.total_facturado)}</td>
                                <td className="px-4 py-3 text-right text-gray-600 text-sm">{fmt(t.efectivo)}</td>
                                <td className="px-4 py-3 text-right text-gray-600 text-sm">{fmt(t.tarjeta)}</td>
                                <td className="px-4 py-3 text-right text-gray-600 text-sm">{fmt(t.mercadopago)}</td>
                                <td className="px-4 py-3 text-right text-red-600 text-sm">{fmt(t.total_gastos)}</td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                    t.estado === 'abierto'
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-gray-100 text-gray-600'
                                  }`}>
                                    {t.estado}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* ---- REPORTE: RENTABILIDAD ---- */}
                  {reporteActivo === 'rentabilidad' && (
                    <div className="space-y-4">

                      {/* Por categoría */}
                      <div className="bg-white rounded-xl shadow overflow-hidden">
                        <div className="p-4 border-b">
                          <h3 className="font-semibold text-gray-800">Rentabilidad por Categoría</h3>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                              <tr>
                                <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">Categoría</th>
                                <th className="text-right px-4 py-3 text-gray-600 font-medium text-sm">Total Vendido</th>
                                <th className="text-right px-4 py-3 text-gray-600 font-medium text-sm">Costo Total</th>
                                <th className="text-right px-4 py-3 text-gray-600 font-medium text-sm">Ganancia</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {datosReporte.porCategoria.map((c, i) => (
                                <tr key={i} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 font-medium text-gray-800">{c.categoria}</td>
                                  <td className="px-4 py-3 text-right text-gray-700">{fmt(c.total_vendido)}</td>
                                  <td className="px-4 py-3 text-right text-red-500">{fmt(c.total_costo)}</td>
                                  <td className="px-4 py-3 text-right font-bold text-green-600">{fmt(c.ganancia)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Por producto */}
                      <div className="bg-white rounded-xl shadow overflow-hidden">
                        <div className="p-4 border-b">
                          <h3 className="font-semibold text-gray-800">Rentabilidad por Producto</h3>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                              <tr>
                                <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">Producto</th>
                                <th className="text-right px-4 py-3 text-gray-600 font-medium text-sm">Cantidad</th>
                                <th className="text-right px-4 py-3 text-gray-600 font-medium text-sm">Total Vendido</th>
                                <th className="text-right px-4 py-3 text-gray-600 font-medium text-sm">Costo Total</th>
                                <th className="text-right px-4 py-3 text-gray-600 font-medium text-sm">Ganancia</th>
                                <th className="text-right px-4 py-3 text-gray-600 font-medium text-sm">Margen</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {datosReporte.porProducto.map((p, i) => (
                                <tr key={i} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 font-medium text-gray-800">{p.nombre_producto}</td>
                                  <td className="px-4 py-3 text-right text-gray-700">{p.cantidad_vendida}</td>
                                  <td className="px-4 py-3 text-right text-gray-700">{fmt(p.total_vendido)}</td>
                                  <td className="px-4 py-3 text-right text-red-500">{fmt(p.total_costo)}</td>
                                  <td className="px-4 py-3 text-right font-bold text-green-600">{fmt(p.ganancia)}</td>
                                  <td className="px-4 py-3 text-right">
                                    <span className={`text-sm font-medium ${
                                      p.margen_porcentaje > 20 ? 'text-green-600' : 'text-orange-500'
                                    }`}>
                                      {p.margen_porcentaje}%
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ---- REPORTE: STOCK ---- */}
                  {reporteActivo === 'stock' && (
                    <div className="space-y-4">

                      {/* Resumen */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white rounded-xl p-4 shadow">
                          <p className="text-gray-500 text-sm">Total Productos</p>
                          <p className="text-2xl font-bold text-gray-800">{datosReporte.totalProductos}</p>
                        </div>
                        <div className="bg-white rounded-xl p-4 shadow">
                          <p className="text-gray-500 text-sm">Valor al Costo</p>
                          <p className="text-2xl font-bold text-gray-800">{fmt(datosReporte.valorTotalCosto)}</p>
                        </div>
                        <div className="bg-white rounded-xl p-4 shadow">
                          <p className="text-gray-500 text-sm">Valor al Precio Venta</p>
                          <p className="text-2xl font-bold text-green-600">{fmt(datosReporte.valorTotalVenta)}</p>
                        </div>
                        <div className="bg-white rounded-xl p-4 shadow">
                          <p className="text-gray-500 text-sm">Con Stock Bajo</p>
                          <p className="text-2xl font-bold text-red-500">{datosReporte.productosStockBajo}</p>
                        </div>
                      </div>

                      {/* Tabla */}
                      <div className="bg-white rounded-xl shadow overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                              <tr>
                                <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">Código</th>
                                <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">Producto</th>
                                <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">Categoría</th>
                                <th className="text-center px-4 py-3 text-gray-600 font-medium text-sm">Stock</th>
                                <th className="text-center px-4 py-3 text-gray-600 font-medium text-sm">Mín</th>
                                <th className="text-right px-4 py-3 text-gray-600 font-medium text-sm">P. Costo</th>
                                <th className="text-right px-4 py-3 text-gray-600 font-medium text-sm">P. Venta</th>
                                <th className="text-right px-4 py-3 text-gray-600 font-medium text-sm">Valor Stock</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {datosReporte.productos.map(p => (
                                <tr key={p.id} className={`hover:bg-gray-50 ${
                                  p.stock <= p.stock_minimo ? 'bg-red-50' : ''
                                }`}>
                                  <td className="px-4 py-2 text-gray-500 text-sm">{p.codigo || '-'}</td>
                                  <td className="px-4 py-2 font-medium text-gray-800">{p.nombre}</td>
                                  <td className="px-4 py-2 text-gray-500 text-sm">{p.categoria || '-'}</td>
                                  <td className="px-4 py-2 text-center">
                                    <span className={`font-medium ${
                                      p.stock <= p.stock_minimo ? 'text-red-600' : 'text-green-600'
                                    }`}>
                                      {p.stock}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-center text-gray-500 text-sm">{p.stock_minimo}</td>
                                  <td className="px-4 py-2 text-right text-gray-600 text-sm">{fmt(p.precio_costo)}</td>
                                  <td className="px-4 py-2 text-right text-gray-700">{fmt(p.precio_venta)}</td>
                                  <td className="px-4 py-2 text-right font-medium text-green-600">{fmt(p.valor_venta)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                    {/* ---- REPORTE: POR CATEGORÍA ---- */}
                  {reporteActivo === 'por-categoria' && datosReporte && (
                    <div className="space-y-4">

                      {/* Tarjetas resumen */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white rounded-xl p-4 shadow">
                          <p className="text-gray-500 text-sm">Total Vendido</p>
                          <p className="text-2xl font-bold text-green-600">{fmt(datosReporte.totalVendido)}</p>
                        </div>
                        <div className="bg-white rounded-xl p-4 shadow">
                          <p className="text-gray-500 text-sm">Total Unidades</p>
                          <p className="text-2xl font-bold text-gray-800">{datosReporte.totalUnidades}</p>
                        </div>
                        <div className="bg-white rounded-xl p-4 shadow">
                          <p className="text-gray-500 text-sm">Costo Total</p>
                          <p className="text-2xl font-bold text-red-500">{fmt(datosReporte.totalCosto)}</p>
                        </div>
                        <div className="bg-white rounded-xl p-4 shadow">
                          <p className="text-gray-500 text-sm">Ganancia</p>
                          <p className="text-2xl font-bold text-blue-600">{fmt(datosReporte.gananciaTotal)}</p>
                        </div>
                      </div>

                      {/* Tabla de productos */}
                      <div className="bg-white rounded-xl shadow overflow-hidden">
                        <div className="p-4 border-b flex items-center justify-between">
                          <h3 className="font-semibold text-gray-800">
                            🏷️ Productos vendidos — {datosReporte.productos.length} productos
                          </h3>
                        </div>
                        {datosReporte.productos.length === 0 ? (
                          <div className="text-center py-12 text-gray-400">
                            <p className="text-4xl mb-2">📭</p>
                            <p>No hay ventas de esta categoría en el período seleccionado</p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className="bg-gray-50 border-b">
                                <tr>
                                  <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">Producto</th>
                                  <th className="text-right px-4 py-3 text-gray-600 font-medium text-sm">Cantidad</th>
                                  <th className="text-right px-4 py-3 text-gray-600 font-medium text-sm">Veces Vendido</th>
                                  <th className="text-right px-4 py-3 text-gray-600 font-medium text-sm">Total Facturado</th>
                                  <th className="text-right px-4 py-3 text-gray-600 font-medium text-sm">Ganancia</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {datosReporte.productos.map((p, i) => (
                                  <tr key={i} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 font-medium text-gray-800">{p.nombre_producto}</td>
                                    <td className="px-4 py-3 text-right text-gray-700">{p.total_cantidad}</td>
                                    <td className="px-4 py-3 text-right text-gray-500">{p.veces_vendido}</td>
                                    <td className="px-4 py-3 text-right font-medium text-green-600">{fmt(p.total_facturado)}</td>
                                    <td className="px-4 py-3 text-right font-medium text-blue-600">{fmt(p.ganancia)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                </>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}

export default Reportes;
