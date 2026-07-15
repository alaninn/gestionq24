// =============================================
// ARCHIVO: src/components/admin/ControlCaja.jsx
// =============================================

import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { hoyArgentina } from '../../utils/fecha';

const fmt = (n) => new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', minimumFractionDigits: 0
}).format(n || 0);

const fmtFecha = (f) => new Date(f).toLocaleDateString('es-AR', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit'
});

// Solo la hora (HH:MM) — para mostrar el horario de cada caja dentro de un día
const fmtHora = (f) => f ? new Date(f).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '—';

// Fecha del día en texto largo (ej: "Mié 18/06/2026")
const fmtDiaLargo = (iso) => {
  // iso = 'YYYY-MM-DD' → armamos un Date local a mediodía para no saltar de día
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d, 12).toLocaleDateString('es-AR', {
    weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric'
  });
};

const virtualDe = (t) => parseFloat(t.ventas_tarjeta || 0) + parseFloat(t.ventas_mp || 0) + parseFloat(t.ventas_transferencia || 0);

// Fecha calendario (YYYY-MM-DD, hora Argentina) de un timestamp.
const fechaDiaAR = (ts) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires',
  year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date(ts));

// Hora (HH:MM, Argentina) de un timestamp.
const horaAR = (ts) => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'America/Argentina/Buenos_Aires',
  hour: '2-digit', minute: '2-digit', hour12: false,
}).format(new Date(ts));

// Rango horario de una caja DENTRO de un día calendario. Una caja que cruza la
// medianoche se muestra recortada: de su apertura a 00:00 el primer día, y de
// 00:00 a su cierre el día siguiente.
function rangoSegmento(turno, dia) {
  const diaApertura = fechaDiaAR(turno.fecha_apertura);
  const desde = diaApertura === dia ? horaAR(turno.fecha_apertura) : '00:00';
  let hasta;
  if (!turno.fecha_cierre) hasta = 'en curso';
  else hasta = fechaDiaAR(turno.fecha_cierre) === dia ? horaAR(turno.fecha_cierre) : '00:00';
  return { desde, hasta };
}

// Arma los días del informe a partir del desglose por (caja, día) del backend.
// El día SIEMPRE corta a la medianoche (00 a 00): una caja que cruza la
// medianoche aparece como un segmento en cada día, con su rango horario y sus
// montos de ese día. El arqueo va al día donde ocurre: el efectivo inicial al
// día de apertura; el retirado / para el día siguiente al día de cierre. Esto es
// solo informativo y no toca el cierre real de la caja.
function armarDias(turnos = [], ventasPorDia = [], gastosPorDia = []) {
  const vKey = new Map(); ventasPorDia.forEach(v => vKey.set(`${v.turno_id}|${v.dia}`, v));
  const gKey = new Map(); gastosPorDia.forEach(g => gKey.set(`${g.turno_id}|${g.dia}`, g));

  const diasMap = new Map();
  const addSeg = (dia, seg) => {
    if (!diasMap.has(dia)) diasMap.set(dia, []);
    diasMap.get(dia).push(seg);
  };

  for (const t of turnos) {
    const diaApertura = fechaDiaAR(t.fecha_apertura);
    const diaCierre = t.fecha_cierre ? fechaDiaAR(t.fecha_cierre) : null;
    // Días en los que esta caja tuvo presencia (ventas, gastos, apertura o cierre)
    const dias = new Set();
    ventasPorDia.forEach(v => { if (v.turno_id === t.id) dias.add(v.dia); });
    gastosPorDia.forEach(g => { if (g.turno_id === t.id) dias.add(g.dia); });
    dias.add(diaApertura);
    if (diaCierre) dias.add(diaCierre);

    for (const dia of dias) {
      const v = vKey.get(`${t.id}|${dia}`) || {};
      const g = gKey.get(`${t.id}|${dia}`) || {};
      const esApertura = dia === diaApertura;
      const esCierre = diaCierre != null && dia === diaCierre;
      addSeg(dia, {
        turno: t,
        dia,
        rango: rangoSegmento(t, dia),
        abierta: t.estado === 'abierto',
        total_facturado: parseFloat(v.total_facturado || 0),
        total_ventas: parseInt(v.total_ventas || 0),
        ventas_efectivo: parseFloat(v.ventas_efectivo || 0),
        ventas_tarjeta: parseFloat(v.ventas_tarjeta || 0),
        ventas_mp: parseFloat(v.ventas_mp || 0),
        ventas_transferencia: parseFloat(v.ventas_transferencia || 0),
        total_gastos: parseFloat(g.total_gastos || 0),
        gastos_caja: parseFloat(g.gastos_caja || 0),
        inicio_caja: esApertura ? parseFloat(t.inicio_caja || 0) : 0,
        efectivo_retirado: esCierre ? parseFloat(t.efectivo_retirado || 0) : 0,
        dinero_siguiente: esCierre ? parseFloat(t.dinero_siguiente || 0) : 0,
        esApertura, esCierre,
      });
    }
  }

  const dias = [];
  for (const [dia, segmentos] of diasMap) {
    segmentos.sort((a, b) => new Date(a.turno.fecha_apertura) - new Date(b.turno.fecha_apertura));
    const totales = segmentos.reduce((acc, s) => ({
      total_facturado: acc.total_facturado + s.total_facturado,
      total_ventas: acc.total_ventas + s.total_ventas,
      ventas_efectivo: acc.ventas_efectivo + s.ventas_efectivo,
      ventas_tarjeta: acc.ventas_tarjeta + s.ventas_tarjeta,
      ventas_mp: acc.ventas_mp + s.ventas_mp,
      ventas_transferencia: acc.ventas_transferencia + s.ventas_transferencia,
      total_gastos: acc.total_gastos + s.total_gastos,
      inicio_caja: acc.inicio_caja + s.inicio_caja,
      efectivo_retirado: acc.efectivo_retirado + s.efectivo_retirado,
      dinero_siguiente: acc.dinero_siguiente + s.dinero_siguiente,
    }), {
      total_facturado: 0, total_ventas: 0, ventas_efectivo: 0, ventas_tarjeta: 0,
      ventas_mp: 0, ventas_transferencia: 0, total_gastos: 0, inicio_caja: 0,
      efectivo_retirado: 0, dinero_siguiente: 0,
    });
    totales.virtual = totales.ventas_tarjeta + totales.ventas_mp + totales.ventas_transferencia;
    totales.ganancia = totales.total_facturado - totales.total_gastos;
    dias.push({ dia, segmentos, totales, algunaAbierta: segmentos.some(s => s.abierta) });
  }
  dias.sort((a, b) => (a.dia < b.dia ? 1 : -1));
  return dias;
}

// =============================================
// MODAL: CIERRE GENERAL DEL DÍA
// Consolida todas las cajas (mañana/tarde/trasnoche) de un mismo día.
// =============================================
function ModalCierreGeneralDia({ diaData, onCerrar, onVerCaja }) {
  const { dia, segmentos, totales, algunaAbierta } = diaData;

  const metodos = [
    { label: '💵 Efectivo', valor: totales.ventas_efectivo, color: 'text-green-600' },
    { label: '💳 Tarjeta', valor: totales.ventas_tarjeta, color: 'text-blue-600' },
    { label: '📱 Mercado Pago', valor: totales.ventas_mp, color: 'text-purple-600' },
    { label: '🏦 Transferencia', valor: totales.ventas_transferencia, color: 'text-orange-600' },
  ].filter(m => parseFloat(m.valor) > 0);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">

        {/* Encabezado */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white px-5 py-4 flex items-start justify-between gap-3 flex-shrink-0">
          <div className="min-w-0">
            <h3 className="text-lg sm:text-xl font-bold capitalize">🗓️ Cierre general · {fmtDiaLargo(dia)}</h3>
            <p className="text-slate-300 text-xs sm:text-sm mt-1">
              {segmentos.length} caja{segmentos.length !== 1 ? 's' : ''} en el día
              {algunaAbierta && <span className="ml-2 bg-green-400/20 text-green-300 border border-green-400/30 px-2 py-0.5 rounded-full text-[11px]">una sigue abierta</span>}
            </p>
          </div>
          <button onClick={onCerrar} className="text-slate-300 hover:text-white text-3xl leading-none flex-shrink-0">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">

          {/* TOTAL GENERAL DEL DÍA */}
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-2">Total general del día</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="border border-gray-200 rounded-xl p-3.5 bg-green-50/50">
                <p className="text-[11px] text-gray-500 font-medium">Facturación total</p>
                <p className="text-xl font-bold text-green-700 mt-0.5 tabular-nums break-words">{fmt(totales.total_facturado)}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{totales.total_ventas} ventas</p>
              </div>
              <div className="border border-gray-200 rounded-xl p-3.5">
                <p className="text-[11px] text-gray-500 font-medium">Efectivo</p>
                <p className="text-xl font-bold text-gray-800 mt-0.5 tabular-nums break-words">{fmt(totales.ventas_efectivo)}</p>
              </div>
              <div className="border border-gray-200 rounded-xl p-3.5">
                <p className="text-[11px] text-gray-500 font-medium">Virtual</p>
                <p className="text-xl font-bold text-gray-800 mt-0.5 tabular-nums break-words">{fmt(totales.virtual)}</p>
              </div>
              <div className="border border-gray-200 rounded-xl p-3.5 bg-blue-50/50">
                <p className="text-[11px] text-gray-500 font-medium">Ganancia neta</p>
                <p className="text-xl font-bold text-blue-700 mt-0.5 tabular-nums break-words">{fmt(totales.ganancia)}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">menos {fmt(totales.total_gastos)} gastos</p>
              </div>
            </div>
          </div>

          {/* Desglose por método del día */}
          {metodos.length > 0 && (
            <div className="border border-gray-200 rounded-xl p-3.5">
              <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-2">Ventas por método (día)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {metodos.map(m => (
                  <div key={m.label} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">{m.label}</span>
                    <span className={`font-bold tabular-nums ${m.color}`}>{fmt(m.valor)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cada caja del día (segmentos: una caja que cruza la medianoche se
              muestra recortada al tramo de este día). */}
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-2">Cajas del día (por horario)</p>
            <div className="space-y-2">
              {segmentos.map(seg => {
                const caja = seg.turno;
                const partida = !seg.esApertura || !seg.esCierre;
                return (
                <div key={`${caja.id}-${seg.dia}`} className="border border-gray-200 rounded-xl p-3.5 flex items-center justify-between gap-3 hover:border-slate-300 transition-colors">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-800 truncate">{caja.nombre || 'Caja'}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        seg.abierta ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>{caja.estado}</span>
                      {caja.es_provisoria && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-700">Provisoria</span>
                      )}
                      {partida && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600" title="Esta caja cruza la medianoche; se muestra solo el tramo de este día">tramo del día</span>
                      )}
                      {caja.cerrado_fuera_de_hora && seg.esCierre && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">⚠ fuera de hora</span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {seg.rango.desde} → {seg.rango.hasta}
                      {seg.esCierre && caja.usuario_cierre_nombre ? ` · cerró ${caja.usuario_cierre_nombre}` : ''}
                    </p>
                    <div className="flex gap-3 mt-1 text-[11px] text-gray-500 flex-wrap">
                      <span>💵 {fmt(seg.ventas_efectivo)}</span>
                      <span>📲 {fmt(virtualDe(seg))}</span>
                      <span className="text-red-500">💸 {fmt(seg.total_gastos)}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-green-600 tabular-nums">{fmt(seg.total_facturado)}</p>
                    <button onClick={() => onVerCaja(caja)}
                      className="mt-1 text-xs font-semibold text-slate-600 border border-gray-300 hover:bg-gray-100 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap">
                      Ver caja completa
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================
// MODAL: DETALLE DE CIERRE
// =============================================
function ModalDetalleCierre({ turno, onCerrar }) {
  const [pestana, setPestana] = useState('resumen');
  const [gastos, setGastos] = useState([]);
  const [ventas, setVentas] = useState(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      const desde = turno.fecha_apertura.split('T')[0];
      const hasta = turno.fecha_cierre
        ? turno.fecha_cierre.split('T')[0]
        : hoyArgentina();

      const [resVentas, resGastos] = await Promise.all([
        api.get(`/api/reportes/historial?fecha_desde=${desde}&fecha_hasta=${hasta}`),
        api.get(`/api/gastos?fecha_desde=${desde}&fecha_hasta=${hasta}`),
      ]);

      setVentas(resVentas.data);
      // Filtramos gastos del turno específico
      setGastos(resGastos.data.filter(g => g.turno_id === turno.id));
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const totalGastos = gastos.reduce((a, g) => a + parseFloat(g.monto), 0);
  const totalVirtual = parseFloat(turno.ventas_tarjeta || 0)
    + parseFloat(turno.ventas_mp || 0)
    + parseFloat(turno.ventas_transferencia || 0);
  const totalEfectivo = parseFloat(turno.ventas_efectivo || 0);
  const totalFacturado = parseFloat(turno.total_facturado || 0);

  // Arqueo: efectivo esperado
  const efectivoEsperado = parseFloat(turno.inicio_caja || 0)
    + totalEfectivo
    - totalGastos;

  // Total declarado al cierre
  const totalDeclarado = parseFloat(turno.efectivo_retirado || 0)
    + parseFloat(turno.dinero_siguiente || 0);

  const diferencia = totalDeclarado - efectivoEsperado;

  const pestanas = [
    { id: 'resumen', label: '📋 Resumen' },
    { id: 'arqueo', label: '🏦 Arqueo de Caja' },
    { id: 'gastos', label: '💸 Gastos' },
  ];

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-black via-gray-900 to-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">

        {/* Encabezado */}
        <div className="bg-gradient-to-r from-green-600 via-green-500 to-emerald-600 text-white p-6 flex items-center justify-between flex-shrink-0 shadow-lg">
          <div>
            <h3 className="text-xl font-bold">🏦 Detalle de Cierre{turno.nombre ? ` — ${turno.nombre}` : ''}</h3>
            <div className="flex items-center gap-3 text-green-100 text-sm mt-2 flex-wrap">
              <span>Apertura: {fmtFecha(turno.fecha_apertura)}</span>
              {turno.fecha_cierre && (
                <>
                  <span>•</span>
                  <span>Cierre: {fmtFecha(turno.fecha_cierre)}</span>
                </>
              )}
              {turno.usuario_cierre_nombre && (
                <>
                  <span>•</span>
                  <span>👤 Cerró: {turno.usuario_cierre_nombre}</span>
                </>
              )}
              <span>•</span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                turno.estado === 'abierto'
                  ? 'bg-green-400 text-white'
                  : 'bg-white text-green-700'
              }`}>
                {turno.estado}
              </span>
            </div>
          </div>
          <button onClick={onCerrar} className="text-green-200 hover:text-white text-3xl transition-all duration-200 hover:scale-110">×</button>
        </div>

        {/* Pestañas */}
        <div className="flex border-b flex-shrink-0 bg-gradient-to-r from-green-50 to-emerald-50">
          {pestanas.map(p => (
            <button key={p.id} onClick={() => setPestana(p.id)}
              className={`flex-1 py-4 px-6 text-sm font-semibold transition-all duration-300 ${
                pestana === p.id
                  ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 rounded-full shadow-md transform scale-105'
                  : 'text-gray-600 hover:text-green-600 hover:bg-white hover:rounded-full hover:shadow-sm'
              }`}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ---- PESTAÑA RESUMEN ---- */}
          {pestana === 'resumen' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 font-medium">Total Ventas</p>
                      <p className="text-3xl font-bold text-green-700 mt-1">{fmt(totalFacturado)}</p>
                      <p className="text-xs text-gray-500 mt-1">{turno.total_ventas} operaciones</p>
                    </div>
                    <div className="text-4xl opacity-20">💰</div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-red-50 to-pink-50 border border-red-200 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 font-medium">Total Gastos</p>
                      <p className="text-3xl font-bold text-red-600 mt-1">{fmt(totalGastos)}</p>
                      <p className="text-xs text-gray-500 mt-1">{gastos.length} gastos</p>
                    </div>
                    <div className="text-4xl opacity-20">💸</div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 font-medium">Ganancia Neta</p>
                      <p className="text-3xl font-bold text-blue-700 mt-1">{fmt(totalFacturado - totalGastos)}</p>
                    </div>
                    <div className="text-4xl opacity-20">📈</div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-gray-50 to-slate-50 border border-gray-200 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 font-medium">Inicio de Caja</p>
                      <p className="text-3xl font-bold text-gray-700 mt-1">{fmt(turno.inicio_caja)}</p>
                    </div>
                    <div className="text-4xl opacity-20">🏦</div>
                  </div>
                </div>
              </div>

              {/* Desglose por método */}
              <div className="bg-gradient-to-r from-white to-gray-50 border border-gray-200 rounded-2xl p-6 shadow-lg">
                <h4 className="font-semibold text-gray-700 mb-4 text-lg flex items-center gap-2">
                  📊 Ventas por Método de Pago
                </h4>
                <div className="space-y-3">
                  {[
                    { label: '💵 Efectivo', valor: turno.ventas_efectivo, color: 'text-green-600' },
                    { label: '💳 Tarjeta', valor: turno.ventas_tarjeta, color: 'text-blue-600' },
                    { label: '📱 Mercado Pago', valor: turno.ventas_mp, color: 'text-purple-600' },
                    { label: '🏦 Transferencia', valor: turno.ventas_transferencia, color: 'text-orange-600' },
                  ].map(m => (
                    parseFloat(m.valor) > 0 && (
                      <div key={m.label} className="flex justify-between items-center py-3 px-4 bg-white rounded-xl border border-gray-100 hover:shadow-md transition-all duration-200">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{m.label.split(' ')[0]}</span>
                          <span className="text-sm text-gray-600 font-medium">{m.label.split(' ')[1]}</span>
                        </div>
                        <span className={`font-bold text-lg ${m.color}`}>{fmt(m.valor)}</span>
                      </div>
                    )
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ---- PESTAÑA ARQUEO ---- */}
          {pestana === 'arqueo' && (
            <div className="space-y-6">

              {/* Total del turno */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-6 shadow-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Total Ventas del Turno</p>
                    <p className="text-3xl font-bold text-gray-800 mt-1">{fmt(totalFacturado)}</p>
                  </div>
                  <div className="text-right">
                    <div className="space-y-1">
                      <p className="text-sm text-gray-600">Efectivo: <span className="font-medium text-green-600">{fmt(totalEfectivo)}</span></p>
                      <p className="text-sm text-gray-600">Virtual: <span className="font-medium text-blue-600">{fmt(totalVirtual)}</span></p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Flujo de efectivo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">

                {/* Cálculo del sistema */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                  <h4 className="font-semibold text-gray-700 mb-4 flex items-center gap-3 text-lg">
                    🖥️ Cálculo del Sistema
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 px-3 bg-white rounded-lg border border-green-100">
                      <span className="text-gray-600 font-medium">Efectivo Inicial</span>
                      <span className="font-bold text-green-700">{fmt(turno.inicio_caja)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 px-3 bg-white rounded-lg border border-green-100">
                      <span className="text-gray-600 font-medium">Ventas en Efectivo</span>
                      <span className="font-bold text-green-700">+{fmt(totalEfectivo)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 px-3 bg-white rounded-lg border border-green-100">
                      <span className="text-gray-600 font-medium">Gastos Efectivo</span>
                      <span className="font-bold text-red-600">-{fmt(totalGastos)}</span>
                    </div>
                    <div className="flex justify-between items-center py-3 px-3 bg-gradient-to-r from-green-100 to-emerald-100 rounded-lg border border-green-200 font-bold text-lg">
                      <span>Total Esperado</span>
                      <span className="text-green-800">{fmt(efectivoEsperado)}</span>
                    </div>
                  </div>
                </div>

                {/* Declarado por usuario */}
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                  <h4 className="font-semibold text-gray-700 mb-4 flex items-center gap-3 text-lg">
                    👤 Declarado al Cierre
                  </h4>
                  {turno.estado === 'abierto' ? (
                    <div className="text-center py-6">
                      <p className="text-gray-400 text-sm">Caja abierta, sin datos de cierre</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 px-3 bg-white rounded-lg border border-blue-100">
                        <span className="text-gray-600 font-medium">Efectivo Retirado</span>
                        <span className="font-bold text-blue-700">{fmt(turno.efectivo_retirado)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 px-3 bg-white rounded-lg border border-blue-100">
                        <span className="text-gray-600 font-medium">Para Siguiente Turno</span>
                        <span className="font-bold text-blue-700">+{fmt(turno.dinero_siguiente)}</span>
                      </div>
                      <div className="flex justify-between items-center py-3 px-3 bg-gradient-to-r from-blue-100 to-cyan-100 rounded-lg border border-blue-200 font-bold text-lg">
                        <span>Total Contado</span>
                        <span className="text-blue-800">{fmt(totalDeclarado)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Diferencia */}
              {turno.estado === 'cerrado' && (
                <div className={`bg-gradient-to-r from-white to-gray-50 rounded-2xl p-6 shadow-lg border-2 ${
                  Math.abs(diferencia) < 1
                    ? 'border-green-200 bg-green-50'
                    : diferencia > 0
                    ? 'border-blue-200 bg-blue-50'
                    : 'border-red-200 bg-red-50'
                }`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold text-gray-700 text-lg">DIFERENCIA EN EFECTIVO</p>
                      <p className="text-sm text-gray-500 mt-1">Diferencia entre sistema y conteo manual</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-4xl font-extrabold ${
                        Math.abs(diferencia) < 1 ? 'text-green-600' :
                        diferencia > 0 ? 'text-blue-600' : 'text-red-600'
                      }`}>
                        {diferencia > 0 ? '+' : ''}{fmt(diferencia)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Medios virtuales declarados */}
              {turno.estado === 'cerrado' && (
                <div className="bg-gradient-to-r from-white to-gray-50 border border-gray-200 rounded-2xl p-6 shadow-lg">
                  <h4 className="font-semibold text-gray-700 mb-4 text-lg flex items-center gap-2">
                    📋 Validación Medios Virtuales
                  </h4>
                  <div className="overflow-hidden rounded-xl">
                    <table className="w-full">
                      <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                        <tr>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Medio</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Sistema</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Declarado</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Diferencia</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {[
                          { label: '💳 Tarjetas', sistema: turno.ventas_tarjeta, declarado: turno.total_tarjetas },
                          { label: '📱 Mercado Pago', sistema: turno.ventas_mp, declarado: turno.total_mercadopago },
                          { label: '🏦 Transferencias', sistema: turno.ventas_transferencia, declarado: turno.total_transferencias },
                        ].map(m => {
                          const diff = parseFloat(m.declarado || 0) - parseFloat(m.sistema || 0);
                          return (
                            <tr key={m.label} className="hover:bg-gray-50 transition-colors">
                              <td className="py-3 px-4 text-gray-700 font-medium">{m.label}</td>
                              <td className="py-3 px-4 text-right font-semibold text-gray-800">{fmt(m.sistema)}</td>
                              <td className="py-3 px-4 text-right font-semibold text-gray-800">{fmt(m.declarado)}</td>
                              <td className={`py-3 px-4 text-right font-bold ${
                                Math.abs(diff) < 1 ? 'text-green-600' :
                                diff > 0 ? 'text-blue-600' : 'text-red-600'
                              }`}>
                                {diff > 0 ? '+' : ''}{fmt(diff)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Comentarios del cierre */}
              {turno.comentarios && (
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-2xl p-6 shadow-lg">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">📝</div>
                    <div>
                      <p className="font-semibold text-yellow-800 text-lg">Comentarios del cierre</p>
                      <p className="text-gray-600 mt-2">{turno.comentarios}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ---- PESTAÑA GASTOS ---- */}
          {pestana === 'gastos' && (
            <div className="space-y-6">
              {gastos.length === 0 ? (
                <div className="text-center py-16 bg-gradient-to-r from-red-50 to-pink-50 rounded-2xl shadow-lg">
                  <p className="text-6xl mb-4">✅</p>
                  <p className="text-xl font-semibold text-gray-700">No hubo gastos en este turno</p>
                </div>
              ) : (
                <>
                  <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-2xl p-6 shadow-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-bold text-gray-700 text-lg">Total gastos del turno</p>
                        <p className="text-sm text-gray-500 mt-1">Resumen de todos los gastos registrados</p>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-extrabold text-red-600">{fmt(totalGastos)}</p>
                        <p className="text-sm text-gray-500">{gastos.length} gastos registrados</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {gastos.map(g => (
                      <div key={g.id} className="bg-gradient-to-r from-white to-gray-50 border border-gray-200 rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                              <p className="font-semibold text-gray-800 text-lg">{g.descripcion || 'Sin descripción'}</p>
                            </div>
                            <div className="flex gap-2 mb-3 flex-wrap">
                              {g.categoria && (
                                <span className="text-sm bg-gray-100 text-gray-600 px-3 py-1 rounded-full font-medium">
                                  {g.categoria}
                                </span>
                              )}
                              <span className={`text-sm px-3 py-1 rounded-full font-medium ${
                                g.tipo === 'fijo' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                              }`}>
                                {g.tipo}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500">{fmtFecha(g.fecha)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-red-600">{fmt(g.monto)}</p>
                            <p className="text-xs text-gray-400 mt-1">Gasto registrado</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// =============================================
// COMPONENTE PRINCIPAL
// =============================================
function ControlCaja() {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [turnoSeleccionado, setTurnoSeleccionado] = useState(null);
  // Día (caja general) seleccionado para ver el cierre general del día
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);
  const [mesSeleccionado, setMesSeleccionado] = useState(() => {
    const h = new Date();
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`;
  });

  // Cajas FIJAS del local (Mañana, Tarde, Trasnoche...)
  const [cajasFijas, setCajasFijas] = useState([]);
  const [nuevaCajaNombre, setNuevaCajaNombre] = useState('');
  const [creandoCaja, setCreandoCaja] = useState(false);
  const [errorCajas, setErrorCajas] = useState('');
  // Configuración de cajas: alerta/política de cierre de fin de día. El día de la
  // caja siempre va de 00:00 a 00:00.
  const [cfgCajas, setCfgCajas] = useState({
    alerta_cierre_activa: false,
    alerta_cierre_minutos: 30,
    cierre_politica: 'seguir',
  });
  const [okCfg, setOkCfg] = useState(false);

  // Guarda (auto) la config de cajas usando el endpoint dedicado.
  const guardarCfgCajas = async (cambios) => {
    const nueva = { ...cfgCajas, ...cambios };
    setCfgCajas(nueva);
    try {
      await api.put('/api/configuracion/cajas', nueva);
      setOkCfg(true);
      setTimeout(() => setOkCfg(false), 1500);
    } catch { }
  };

  const cargarCajasFijas = async () => {
    try {
      const res = await api.get('/api/turnos/cajas-fijas');
      setCajasFijas(res.data);
    } catch { }
  };

  const crearCajaFija = async (e) => {
    e.preventDefault();
    if (!nuevaCajaNombre.trim()) return;
    try {
      setCreandoCaja(true);
      setErrorCajas('');
      await api.post('/api/turnos/cajas-fijas', { nombre: nuevaCajaNombre.trim() });
      setNuevaCajaNombre('');
      cargarCajasFijas();
    } catch (err) {
      setErrorCajas(err.response?.data?.error || 'Error al crear la caja');
      setTimeout(() => setErrorCajas(''), 4000);
    } finally {
      setCreandoCaja(false);
    }
  };

  const eliminarCajaFija = async (caja) => {
    if (!window.confirm(`¿Eliminar la caja fija "${caja.nombre}"?\n\nEl historial de cierres no se pierde; solo deja de aparecer como opción al abrir caja.`)) return;
    try {
      await api.delete(`/api/turnos/cajas-fijas/${caja.id}`);
      cargarCajasFijas();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al eliminar la caja');
    }
  };

  useEffect(() => { cargarCajasFijas(); }, []);

  useEffect(() => {
    api.get('/api/configuracion')
      .then(res => {
        const c = res.data || {};
        setCfgCajas({
          alerta_cierre_activa: !!c.alerta_cierre_activa,
          alerta_cierre_minutos: parseInt(c.alerta_cierre_minutos) || 30,
          cierre_politica: c.cierre_politica === 'forzar' ? 'forzar' : 'seguir',
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [mesSeleccionado]);

  const cargarDatos = async () => {
    try {
      setCargando(true);
      const [anio, mes] = mesSeleccionado.split('-');
      const desde = `${anio}-${mes}-01`;
      const ultimo = new Date(anio, mes, 0).getDate();
      const hasta = `${anio}-${mes}-${ultimo}`;
      const res = await api.get(`/api/reportes/control-caja?fecha_desde=${desde}&fecha_hasta=${hasta}`);
      setDatos(res.data);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setCargando(false);
    }
  };



  return (
    <div className="space-y-4">

      {/* Título */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Control de Caja</h2>
          <p className="text-gray-500">Historial completo de cierres de caja por turno</p>
        </div>
        <input type="month" value={mesSeleccionado}
          onChange={(e) => setMesSeleccionado(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>

      {/* Cajas fijas del local */}
      <div className="bg-white rounded-xl shadow p-4 sm:p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
          <h3 className="font-semibold text-gray-700">🏪 Cajas del local</h3>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          Cajas fijas que los usuarios abren y cierran según su turno (ej: Mañana, Tarde, Trasnoche). Aparecen siempre al entrar al POS.
        </p>
        {errorCajas && <p className="text-sm text-red-600 mb-2">❌ {errorCajas}</p>}
        <div className="flex flex-wrap gap-2 mb-3">
          {cajasFijas.length === 0 && (
            <p className="text-sm text-gray-400">No hay cajas fijas todavía. Creá las de tus turnos 👇</p>
          )}
          {cajasFijas.map(c => (
            <span key={c.id} className={`inline-flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-full text-sm font-medium border ${
              c.turno_abierto_id ? 'bg-green-50 border-green-300 text-green-800' : 'bg-gray-50 border-gray-200 text-gray-700'
            }`}>
              {c.turno_abierto_id ? '🔓' : '🔒'} {c.nombre}
              {c.turno_abierto_id && <span className="text-[10px] bg-green-200 text-green-800 px-1.5 py-0.5 rounded-full">abierta</span>}
              <button onClick={() => eliminarCajaFija(c)} title="Eliminar caja fija"
                className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors">×</button>
            </span>
          ))}
        </div>
        <form onSubmit={crearCajaFija} className="flex gap-2 flex-wrap">
          <input type="text" value={nuevaCajaNombre} onChange={(e) => setNuevaCajaNombre(e.target.value)}
            placeholder="Nombre de la caja (ej: Mañana)"
            className="flex-1 min-w-44 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          <button type="submit" disabled={creandoCaja || !nuevaCajaNombre.trim()}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
            ➕ Crear caja fija
          </button>
        </form>
      </div>

      {/* Cierre de caja: aviso de fin de día */}
      <div className="bg-white rounded-xl shadow p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 className="font-semibold text-gray-700">⏰ Cierre de caja</h3>
          {okCfg && <span className="text-xs text-green-600 font-medium">✓ Guardado</span>}
        </div>
        <p className="text-xs text-gray-400 mb-4">
          El día de la caja va de 00:00 a 00:00. Elegí si querés un aviso para cerrar la caja antes de la medianoche.
        </p>

        {/* Alerta de fin de día */}
        <div>
          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-gray-700">Avisar antes del fin del día</p>
              <p className="text-xs text-gray-500">Muestra un aviso en el POS para cerrar la caja a tiempo.</p>
            </div>
            <input type="checkbox" checked={cfgCajas.alerta_cierre_activa}
              onChange={(e) => guardarCfgCajas({ alerta_cierre_activa: e.target.checked })}
              className="w-5 h-5 accent-green-600 flex-shrink-0" />
          </label>

          {cfgCajas.alerta_cierre_activa && (
            <div className="mt-3 space-y-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-sm text-gray-700">Avisar</label>
                <input type="number" min="5" max="120" value={cfgCajas.alerta_cierre_minutos}
                  onWheel={(e) => e.currentTarget.blur()}
                  onChange={(e) => setCfgCajas(p => ({ ...p, alerta_cierre_minutos: e.target.value }))}
                  onBlur={(e) => guardarCfgCajas({ alerta_cierre_minutos: Math.min(120, Math.max(5, parseInt(e.target.value) || 30)) })}
                  className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                <span className="text-sm text-gray-700">minutos antes del fin del día.</span>
              </div>

              <div>
                <p className="text-sm text-gray-700 mb-2">Si la caja sigue abierta al pasar el fin del día:</p>
                <div className="space-y-2">
                  <button type="button" onClick={() => guardarCfgCajas({ cierre_politica: 'seguir' })}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${cfgCajas.cierre_politica === 'seguir' ? 'border-green-500 bg-white' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${cfgCajas.cierre_politica === 'seguir' ? 'border-green-500' : 'border-gray-300'}`}>
                      {cfgCajas.cierre_politica === 'seguir' && <div className="w-2.5 h-2.5 rounded-full bg-green-500" />}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">Seguir normal (recomendado)</p>
                      <p className="text-xs text-gray-500">Sigue vendiendo; en el detalle del día se marca que la caja se pasó de horario.</p>
                    </div>
                  </button>
                  <button type="button" onClick={() => guardarCfgCajas({ cierre_politica: 'forzar' })}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${cfgCajas.cierre_politica === 'forzar' ? 'border-amber-500 bg-white' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${cfgCajas.cierre_politica === 'forzar' ? 'border-amber-500' : 'border-gray-300'}`}>
                      {cfgCajas.cierre_politica === 'forzar' && <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">Forzar cierre</p>
                      <p className="text-xs text-gray-500">Esa caja no puede seguir vendiendo hasta cerrarla. El usuario puede cerrar sesión y otro sigue en otra caja.</p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {cargando ? (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      ) : datos && (
        <>
          {/* Tarjetas resumen */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-green-500 text-white rounded-xl p-5 shadow">
              <p className="text-green-100 text-sm">VENTAS DEL MES</p>
              <p className="text-3xl font-bold mt-1">{fmt(datos.totales.total_facturado)}</p>
              <p className="text-green-100 text-sm mt-1">{datos.totales.total_ventas} ventas · {datos.turnos.length} turnos</p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow border-l-4 border-red-400">
              <p className="text-gray-500 text-sm">GASTOS DEL MES</p>
              <p className="text-3xl font-bold text-red-500 mt-1">{fmt(datos.totales.total_gastos)}</p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow border-l-4 border-blue-400">
              <p className="text-gray-500 text-sm">GANANCIA NETA</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">
                {fmt(datos.totales.total_facturado - datos.totales.total_gastos)}
              </p>
            </div>
          </div>

          {/* Historial por DÍA: cada día es una "caja general" (suma de las
              cajas mañana/tarde/trasnoche). Al tocarlo se ve el cierre general
              del día con el detalle de cada caja individual. */}
          {(() => {
            const dias = armarDias(datos.turnos, datos.ventasPorDia, datos.gastosPorDia);
            return (
              <div className="bg-white rounded-xl shadow overflow-hidden">
                <div className="p-4 border-b flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="font-semibold text-gray-700">
                    Cierres por día — {dias.length} día{dias.length !== 1 ? 's' : ''}
                  </h3>
                  <p className="text-xs text-gray-400">Tocá un día para ver el cierre general y cada caja</p>
                </div>
                {dias.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <p className="text-4xl mb-2">📭</p>
                    <p>No hay cierres de caja en este período</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {dias.map(d => (
                      <button key={d.dia} onClick={() => setDiaSeleccionado(d)}
                        className="w-full text-left p-4 hover:bg-gray-50 transition-colors flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-800 capitalize">{fmtDiaLargo(d.dia)}</p>
                            <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                              {d.segmentos.length} caja{d.segmentos.length !== 1 ? 's' : ''}
                            </span>
                            {d.algunaAbierta && (
                              <span className="text-[11px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">en curso</span>
                            )}
                          </div>
                          <div className="flex gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                            <span>💵 {fmt(d.totales.ventas_efectivo)}</span>
                            <span>📲 {fmt(d.totales.virtual)}</span>
                            <span className="text-red-500">💸 {fmt(d.totales.total_gastos)}</span>
                            <span className="text-gray-400">· {d.totales.total_ventas} ventas</span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-green-600 tabular-nums">{fmt(d.totales.total_facturado)}</p>
                          <p className="text-[11px] text-blue-600 tabular-nums">Neta {fmt(d.totales.ganancia)}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </>
      )}

      {/* Modal cierre general del día (caja general) */}
      {diaSeleccionado && (
        <ModalCierreGeneralDia
          diaData={diaSeleccionado}
          onCerrar={() => setDiaSeleccionado(null)}
          onVerCaja={(caja) => setTurnoSeleccionado(caja)}
        />
      )}

      {/* Modal detalle de una caja individual (se abre encima del general) */}
      {turnoSeleccionado && (
        <ModalDetalleCierre
          turno={turnoSeleccionado}
          onCerrar={() => setTurnoSeleccionado(null)}
        />
      )}

    </div>
  );
}

export default ControlCaja;