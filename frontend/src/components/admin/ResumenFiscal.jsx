// =============================================
// ARCHIVO: src/components/admin/ResumenFiscal.jsx
// FUNCIÓN: Resumen fiscal - Posición IVA mensual
// Libro IVA Ventas (ARCA) + Libro IVA Compras (en blanco)
// =============================================

import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import * as XLSX from 'xlsx';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const fmt = (n) => new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', minimumFractionDigits: 2
}).format(n || 0);

const calcularIva = (monto, porcentaje = 21) => {
  const m = parseFloat(monto || 0);
  const pct = parseFloat(porcentaje || 21);
  const neto = pct > 0 ? m / (1 + pct / 100) : m;
  const iva = m - neto;
  return { neto: +neto.toFixed(2), iva: +iva.toFixed(2) };
};

// Determina tipo de comprobante de venta según el código ARCA
const tipoComprobanteLabel = (v) => {
  if (v.comprobante_tipo_codigo === 1 || v.comprobante_tipo === 'A') return 'Factura A';
  if (v.comprobante_tipo_codigo === 6 || v.comprobante_tipo === 'B') return 'Factura B';
  if (v.comprobante_tipo_codigo === 11 || v.comprobante_tipo === 'C') return 'Factura C';
  return 'Electrónica';
};

function TarjetaResumen({ icono, titulo, monto, subtitulo, color, bgColor, borderColor }) {
  return (
    <div className={`rounded-2xl p-5 border-2 ${bgColor} ${borderColor}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wider ${color} opacity-70`}>{titulo}</p>
          <p className={`text-2xl font-bold mt-1 ${color}`}>{fmt(monto)}</p>
          {subtitulo && <p className={`text-xs mt-1 ${color} opacity-60`}>{subtitulo}</p>}
        </div>
        <span className="text-3xl">{icono}</span>
      </div>
    </div>
  );
}

export default function ResumenFiscal() {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth()); // 0-indexed

  const [ventas, setVentas] = useState([]);
  const [compras, setCompras] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [tabActiva, setTabActiva] = useState('resumen'); // 'resumen' | 'ventas' | 'compras'

  const fechaDesde = `${anio}-${String(mes + 1).padStart(2, '0')}-01`;
  const ultimoDia = new Date(anio, mes + 1, 0).getDate();
  const fechaHasta = `${anio}-${String(mes + 1).padStart(2, '0')}-${ultimoDia}`;

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      // Ventas con facturación electrónica (ARCA)
      const resVentas = await api.get(
        `/api/reportes/historial?fecha_desde=${fechaDesde}&fecha_hasta=${fechaHasta}`
      );
      const todasVentas = Array.isArray(resVentas.data.ventas) ? resVentas.data.ventas : [];
      const ventasArca = todasVentas.filter(
        v => v.tipo_facturacion === 'electronica' || v.comprobante_electronico_id != null
      );
      setVentas(ventasArca);

      // Compras con factura (en blanco)
      const resCompras = await api.get(
        `/api/gastos?es_compra=1&fecha_desde=${fechaDesde}&fecha_hasta=${fechaHasta}`
      );
      const todasCompras = Array.isArray(resCompras.data) ? resCompras.data : [];
      const comprasBlanco = todasCompras.filter(c =>
        ['factura_a', 'factura_b', 'factura_c'].includes(c.tipo_comprobante)
      );
      setCompras(comprasBlanco);
    } catch (err) {
      console.error('Error al cargar resumen fiscal:', err);
    } finally {
      setCargando(false);
    }
  }, [fechaDesde, fechaHasta]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  // ---- TOTALES ----
  const totalVentas = ventas.reduce((acc, v) => acc + parseFloat(v.total || 0), 0);
  const ivaDebito = ventas.reduce((acc, v) => {
    const { iva } = calcularIva(v.total, 21);
    return acc + iva;
  }, 0);
  const netoVentas = totalVentas - ivaDebito;

  const totalCompras = compras.reduce((acc, c) => acc + parseFloat(c.monto || 0), 0);
  const ivaCredito = compras.reduce((acc, c) => {
    const { iva } = calcularIva(c.monto, c.porcentaje_iva || 21);
    return acc + iva;
  }, 0);
  const netoCompras = totalCompras - ivaCredito;

  const posicionIva = ivaDebito - ivaCredito;

  // ---- EXPORTAR EXCEL ----
  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();

    const hojaVentas = ventas.map(v => {
      const { neto, iva } = calcularIva(v.total, 21);
      return {
        Fecha: new Date(v.fecha).toLocaleDateString('es-AR'),
        'Tipo Comprobante': tipoComprobanteLabel(v),
        Nro: v.comprobante_numero || v.id,
        Cliente: v.cliente_nombre || 'Consumidor Final',
        [`Neto 21%`]: neto,
        [`IVA 21%`]: iva,
        Total: parseFloat(v.total || 0),
      };
    });

    const hojaCompras = compras.map(c => {
      const pct = parseFloat(c.porcentaje_iva || 21);
      const { neto, iva } = calcularIva(c.monto, pct);
      return {
        Fecha: new Date(c.fecha).toLocaleDateString('es-AR'),
        'Tipo Comprobante': c.tipo_comprobante?.replace('_', ' ').toUpperCase() || '-',
        Proveedor: c.proveedor_nombre || 'Sin proveedor',
        [`Neto ${pct}%`]: neto,
        [`IVA ${pct}%`]: iva,
        Total: parseFloat(c.monto || 0),
      };
    });

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hojaVentas), 'Libro IVA Ventas');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hojaCompras), 'Libro IVA Compras');
    XLSX.writeFile(wb, `libro_iva_${MESES[mes]}_${anio}.xlsx`);
  };

  const irMesAnterior = () => {
    if (mes === 0) { setMes(11); setAnio(a => a - 1); }
    else setMes(m => m - 1);
  };
  const irMesSiguiente = () => {
    const esHoy = anio === hoy.getFullYear() && mes === hoy.getMonth();
    if (esHoy) return;
    if (mes === 11) { setMes(0); setAnio(a => a + 1); }
    else setMes(m => m + 1);
  };
  const esMesActual = anio === hoy.getFullYear() && mes === hoy.getMonth();

  return (
    <div className="space-y-5">

      {/* ---- ENCABEZADO ---- */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">🧾 Resumen Fiscal</h2>
          <p className="text-gray-500 text-sm mt-0.5">Posición de IVA mensual y exportación de Libros IVA</p>
        </div>
        <button
          onClick={exportarExcel}
          disabled={cargando || (ventas.length === 0 && compras.length === 0)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-colors shadow"
        >
          <span>⬇️</span> Exportar Excel
        </button>
      </div>

      {/* ---- SELECTOR DE MES ---- */}
      <div className="bg-white rounded-2xl shadow border border-gray-100 px-5 py-4 flex items-center justify-between">
        <button
          onClick={irMesAnterior}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors text-gray-600 font-bold text-lg"
        >
          ‹
        </button>
        <div className="text-center">
          <p className="text-xl font-bold text-gray-800">{MESES[mes]} {anio}</p>
          {esMesActual && (
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Mes actual</span>
          )}
        </div>
        <button
          onClick={irMesSiguiente}
          disabled={esMesActual}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-gray-600 font-bold text-lg"
        >
          ›
        </button>
      </div>

      {cargando ? (
        <div className="bg-white rounded-2xl shadow p-12 text-center">
          <div className="animate-spin text-4xl mb-3">⏳</div>
          <p className="text-gray-400">Cargando datos fiscales...</p>
        </div>
      ) : (
        <>
          {/* ---- TARJETAS DE RESUMEN ---- */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <TarjetaResumen
              icono="🧾"
              titulo="Total Facturado (Ventas)"
              monto={totalVentas}
              subtitulo={`${ventas.length} comprobante${ventas.length !== 1 ? 's' : ''} · IVA Débito: ${fmt(ivaDebito)}`}
              color="text-emerald-900"
              bgColor="bg-emerald-50"
              borderColor="border-emerald-200"
            />
            <TarjetaResumen
              icono="🛒"
              titulo="Total Compras con Factura"
              monto={totalCompras}
              subtitulo={`${compras.length} comprobante${compras.length !== 1 ? 's' : ''} · IVA Crédito: ${fmt(ivaCredito)}`}
              color="text-blue-900"
              bgColor="bg-blue-50"
              borderColor="border-blue-200"
            />
            <div className={`rounded-2xl p-5 border-2 ${posicionIva >= 0 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wider opacity-70 ${posicionIva >= 0 ? 'text-orange-900' : 'text-green-900'}`}>
                    Posición IVA Mensual
                  </p>
                  <p className={`text-2xl font-bold mt-1 ${posicionIva >= 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    {fmt(Math.abs(posicionIva))}
                  </p>
                  <p className={`text-xs mt-1 font-medium ${posicionIva >= 0 ? 'text-orange-700' : 'text-green-700'}`}>
                    {posicionIva >= 0 ? '⬆️ A pagar' : '⬇️ A favor'}
                  </p>
                  <p className={`text-xs mt-0.5 opacity-60 ${posicionIva >= 0 ? 'text-orange-900' : 'text-green-900'}`}>
                    Débito {fmt(ivaDebito)} − Crédito {fmt(ivaCredito)}
                  </p>
                </div>
                <span className="text-3xl">📊</span>
              </div>
            </div>
          </div>

          {/* ---- TABS ---- */}
          <div className="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden">
            <div className="flex border-b border-gray-100">
              {[
                { id: 'ventas', label: `📗 Libro IVA Ventas`, count: ventas.length },
                { id: 'compras', label: `📘 Libro IVA Compras`, count: compras.length },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setTabActiva(tab.id)}
                  className={`flex-1 py-3.5 px-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    tabActiva === tab.id
                      ? 'border-b-2 border-emerald-500 text-emerald-700 bg-emerald-50'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {tab.label}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    tabActiva === tab.id ? 'bg-emerald-200 text-emerald-800' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* ---- TABLA VENTAS ---- */}
            {tabActiva === 'ventas' && (
              <div className="overflow-x-auto">
                {ventas.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <p className="text-5xl mb-3">🧾</p>
                    <p className="font-medium">Sin comprobantes electrónicos en este mes</p>
                    <p className="text-sm mt-1">Las ventas con facturación ARCA aparecerán aquí</p>
                  </div>
                ) : (
                  <>
                    {/* Subtotales */}
                    <div className="flex items-center gap-6 px-5 py-3 bg-emerald-50 border-b border-emerald-100 text-sm">
                      <span className="text-emerald-700 font-semibold">{ventas.length} comprobantes</span>
                      <span className="text-gray-400">·</span>
                      <span className="text-gray-600">Neto: <strong className="text-gray-800">{fmt(netoVentas)}</strong></span>
                      <span className="text-gray-400">·</span>
                      <span className="text-gray-600">IVA Débito: <strong className="text-orange-600">{fmt(ivaDebito)}</strong></span>
                      <span className="text-gray-400">·</span>
                      <span className="text-gray-600">Total: <strong className="text-emerald-700">{fmt(totalVentas)}</strong></span>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="text-left px-4 py-3 text-gray-500 font-semibold">Fecha</th>
                          <th className="text-left px-4 py-3 text-gray-500 font-semibold">Tipo</th>
                          <th className="text-left px-4 py-3 text-gray-500 font-semibold">Nro</th>
                          <th className="text-left px-4 py-3 text-gray-500 font-semibold">Cliente</th>
                          <th className="text-right px-4 py-3 text-gray-500 font-semibold">Neto 21%</th>
                          <th className="text-right px-4 py-3 text-gray-500 font-semibold">IVA 21%</th>
                          <th className="text-right px-4 py-3 text-gray-500 font-semibold">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {ventas.map(v => {
                          const { neto, iva } = calcularIva(v.total, 21);
                          const fecha = new Date(v.fecha);
                          return (
                            <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                                {fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                <span className="block text-xs text-gray-400">
                                  {fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-medium">
                                  {tipoComprobanteLabel(v)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                                {v.comprobante_numero
                                  ? String(v.comprobante_numero).padStart(8, '0')
                                  : `#${v.id}`}
                              </td>
                              <td className="px-4 py-3 text-gray-700">
                                {v.cliente_nombre || 'Consumidor Final'}
                              </td>
                              <td className="px-4 py-3 text-right text-gray-700 font-medium">
                                {fmt(neto)}
                              </td>
                              <td className="px-4 py-3 text-right text-orange-600 font-medium">
                                {fmt(iva)}
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-gray-800">
                                {fmt(v.total)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                        <tr>
                          <td colSpan={4} className="px-4 py-3 text-right font-semibold text-gray-600">Totales</td>
                          <td className="px-4 py-3 text-right font-bold text-gray-800">{fmt(netoVentas)}</td>
                          <td className="px-4 py-3 text-right font-bold text-orange-600">{fmt(ivaDebito)}</td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-700">{fmt(totalVentas)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </>
                )}
              </div>
            )}

            {/* ---- TABLA COMPRAS ---- */}
            {tabActiva === 'compras' && (
              <div className="overflow-x-auto">
                {compras.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <p className="text-5xl mb-3">🛒</p>
                    <p className="font-medium">Sin compras con factura en este mes</p>
                    <p className="text-sm mt-1">Registrá compras con Factura A, B o C desde <strong>Gastos → Nueva Compra</strong></p>
                  </div>
                ) : (
                  <>
                    {/* Subtotales */}
                    <div className="flex items-center gap-6 px-5 py-3 bg-blue-50 border-b border-blue-100 text-sm">
                      <span className="text-blue-700 font-semibold">{compras.length} comprobantes</span>
                      <span className="text-gray-400">·</span>
                      <span className="text-gray-600">Neto: <strong className="text-gray-800">{fmt(netoCompras)}</strong></span>
                      <span className="text-gray-400">·</span>
                      <span className="text-gray-600">IVA Crédito: <strong className="text-blue-600">{fmt(ivaCredito)}</strong></span>
                      <span className="text-gray-400">·</span>
                      <span className="text-gray-600">Total: <strong className="text-blue-700">{fmt(totalCompras)}</strong></span>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="text-left px-4 py-3 text-gray-500 font-semibold">Fecha</th>
                          <th className="text-left px-4 py-3 text-gray-500 font-semibold">Tipo</th>
                          <th className="text-left px-4 py-3 text-gray-500 font-semibold">Proveedor</th>
                          <th className="text-left px-4 py-3 text-gray-500 font-semibold">Descripción</th>
                          <th className="text-right px-4 py-3 text-gray-500 font-semibold">Neto</th>
                          <th className="text-right px-4 py-3 text-gray-500 font-semibold">IVA Crédito</th>
                          <th className="text-right px-4 py-3 text-gray-500 font-semibold">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {compras.map(c => {
                          const pct = parseFloat(c.porcentaje_iva || 21);
                          const { neto, iva } = calcularIva(c.monto, pct);
                          const fecha = new Date(c.fecha);
                          const tipoLabel = c.tipo_comprobante?.replace('_', ' ').toUpperCase() || '-';
                          const colorTipo = c.tipo_comprobante === 'factura_a'
                            ? 'bg-purple-100 text-purple-700'
                            : c.tipo_comprobante === 'factura_b'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-600';
                          return (
                            <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                                {fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                <span className="block text-xs text-gray-400">
                                  {fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorTipo}`}>
                                  {tipoLabel}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-700">
                                {c.proveedor_nombre || <span className="text-gray-400">Sin proveedor</span>}
                              </td>
                              <td className="px-4 py-3 text-gray-500 text-xs max-w-[180px] truncate">
                                {c.descripcion || '-'}
                              </td>
                              <td className="px-4 py-3 text-right text-gray-700 font-medium">
                                {fmt(neto)}
                              </td>
                              <td className="px-4 py-3 text-right text-blue-600 font-medium">
                                {fmt(iva)}
                                <span className="block text-xs text-gray-400">{pct}%</span>
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-gray-800">
                                {fmt(c.monto)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                        <tr>
                          <td colSpan={4} className="px-4 py-3 text-right font-semibold text-gray-600">Totales</td>
                          <td className="px-4 py-3 text-right font-bold text-gray-800">{fmt(netoCompras)}</td>
                          <td className="px-4 py-3 text-right font-bold text-blue-600">{fmt(ivaCredito)}</td>
                          <td className="px-4 py-3 text-right font-bold text-blue-700">{fmt(totalCompras)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ---- CUADRO POSICIÓN IVA DETALLADO ---- */}
          <div className="bg-white rounded-2xl shadow border border-gray-100 p-5">
            <h3 className="font-bold text-gray-800 mb-4">📐 Detalle Posición IVA — {MESES[mes]} {anio}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600 text-sm">IVA Débito Fiscal (ventas)</span>
                  <span className="font-bold text-orange-600">{fmt(ivaDebito)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600 text-sm">IVA Crédito Fiscal (compras)</span>
                  <span className="font-bold text-blue-600">− {fmt(ivaCredito)}</span>
                </div>
                <div className={`flex justify-between items-center py-3 px-3 rounded-xl ${posicionIva >= 0 ? 'bg-orange-50' : 'bg-green-50'}`}>
                  <span className={`font-semibold text-sm ${posicionIva >= 0 ? 'text-orange-800' : 'text-green-800'}`}>
                    {posicionIva >= 0 ? '⬆️ Saldo a pagar ARCA' : '⬇️ Saldo a favor'}
                  </span>
                  <span className={`font-bold text-lg ${posicionIva >= 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    {fmt(Math.abs(posicionIva))}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600 text-sm">Total facturado (ventas electrónicas)</span>
                  <span className="font-bold text-gray-800">{fmt(totalVentas)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600 text-sm">Total compras en blanco</span>
                  <span className="font-bold text-gray-800">{fmt(totalCompras)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600 text-sm">Comprobantes de venta</span>
                  <span className="font-semibold text-gray-700">{ventas.length}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600 text-sm">Comprobantes de compra</span>
                  <span className="font-semibold text-gray-700">{compras.length}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  
}
