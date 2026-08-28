// =============================================
// ARCHIVO: src/components/admin/TuContador.jsx
// Módulo "Tu Contador": situación fiscal en tiempo real.
// Categoría (ARCA/manual) + ventas vs compras facturadas. Monotributo: tope.
// Responsable: IVA débito − crédito.
// =============================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n || 0);
const diasHasta = (iso) => { if (!iso) return null; const d = new Date(iso + 'T00:00:00'); const h = new Date(); h.setHours(0, 0, 0, 0); return Math.round((d - h) / 86400000); };
const fmtFechaLarga = (iso) => iso ? new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'long' }) : '';

const SEMAFORO = {
  verde: { color: '#10b981', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', label: 'Vas bien' },
  amarillo: { color: '#f59e0b', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', label: 'Ojo, te estás acercando' },
  rojo: { color: '#ef4444', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', label: 'Estás al límite del tope' },
};

function Stat({ label, valor, sub, color = 'text-gray-800', icon }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">{label}</p>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <p className={`text-2xl font-extrabold mt-1 ${color}`}>{valor}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function TuContador() {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth());
  const [data, setData] = useState(null);
  const [historico, setHistorico] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [msg, setMsg] = useState('');
  const [importando, setImportando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [afip, setAfip] = useState(null);
  const [formAfip, setFormAfip] = useState({ cuit: '', usuario: '', password: '' });
  const [verClave, setVerClave] = useState(false);
  const [guardandoAfip, setGuardandoAfip] = useState(false);
  const [syncCompras, setSyncCompras] = useState(false);
  const fileRef = useRef(null);

  const cargarAfip = useCallback(async () => {
    try {
      const r = await api.get('/api/contador/afip-estado');
      setAfip(r.data);
      // Prefill del CUIT con el del negocio para evitar cargar el de otra persona.
      if (!r.data.configurado && r.data.cuit_negocio) setFormAfip(f => (f.cuit ? f : { ...f, cuit: r.data.cuit_negocio }));
    } catch { setAfip({ configurado: false }); }
  }, []);
  useEffect(() => { cargarAfip(); }, [cargarAfip]);

  const guardarClaveFiscal = async () => {
    if (!formAfip.cuit || !formAfip.password) { setMsg('Ingresá tu CUIT y clave fiscal'); return; }
    setGuardandoAfip(true); setMsg('');
    try {
      await api.put('/api/contador/afip-credenciales', formAfip);
      setFormAfip({ cuit: '', usuario: '', password: '' });
      setMsg('✅ Clave fiscal guardada de forma cifrada.');
      await cargarAfip();
    } catch (e) { setMsg(e.response?.data?.error || 'No se pudo guardar'); }
    finally { setGuardandoAfip(false); }
  };

  const sincronizarCompras = async () => {
    setSyncCompras(true); setMsg('');
    try {
      const r = await api.post('/api/contador/sincronizar-compras', { desde, hasta });
      setMsg(`✅ Compras sincronizadas: ${r.data.insertados} nuevas.`);
      await cargar(); await cargarAfip(); await cargarHistorico();
    } catch (e) {
      setMsg('⚠️ ' + (e.response?.data?.error || 'No se pudo sincronizar con AFIP'));
      await cargarAfip();
    } finally { setSyncCompras(false); }
  };

  const desvincularAfip = async () => {
    if (!confirm('¿Quitar la clave fiscal guardada?')) return;
    try { await api.delete('/api/contador/afip-credenciales'); await cargarAfip(); setMsg('Clave fiscal desvinculada.'); }
    catch { setMsg('No se pudo desvincular'); }
  };

  const desde = `${anio}-${String(mes + 1).padStart(2, '0')}-01`;
  const ultimoDia = new Date(anio, mes + 1, 0).getDate();
  const hasta = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
  const esMesActual = anio === hoy.getFullYear() && mes === hoy.getMonth();

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await api.get(`/api/contador/resumen?desde=${desde}&hasta=${hasta}`);
      setData(r.data);
    } catch (e) {
      setMsg(e.response?.data?.error || 'No se pudo cargar la situación fiscal');
    } finally { setCargando(false); }
  }, [desde, hasta]);
  useEffect(() => { cargar(); }, [cargar]);

  const cargarHistorico = useCallback(async () => {
    try { const r = await api.get('/api/contador/historico?meses=12'); setHistorico(r.data.meses || []); } catch { setHistorico([]); }
  }, []);
  useEffect(() => { cargarHistorico(); }, [cargarHistorico]);

  const importar = async (file) => {
    if (!file) return;
    setImportando(true); setMsg('');
    try {
      const csv = await file.text();
      const r = await api.post('/api/contador/importar', { tipo: 'recibido', csv });
      setMsg(`✅ Importadas ${r.data.insertados} compras nuevas (de ${r.data.leidos} leídas).`);
      await cargar(); await cargarHistorico();
    } catch (e) {
      setMsg(e.response?.data?.error || 'No se pudo importar el archivo');
    } finally { setImportando(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const sincronizarArca = async () => {
    setSincronizando(true); setMsg('');
    try {
      const r = await api.post('/api/contador/categoria/sincronizar');
      if (r.data.ok) { setMsg('✅ Categoría actualizada desde ARCA'); await cargar(); }
      else setMsg(r.data.mensaje || 'No se pudo traer de ARCA');
    } catch (e) {
      setMsg('No se pudo consultar ARCA en este momento');
    } finally { setSincronizando(false); }
  };

  const irMes = (delta) => {
    let m = mes + delta, a = anio;
    if (m < 0) { m = 11; a--; } else if (m > 11) { m = 0; a++; }
    if (a > hoy.getFullYear() || (a === hoy.getFullYear() && m > hoy.getMonth())) return;
    setMes(m); setAnio(a);
  };

  const cat = data?.categoria;
  const esMono = cat?.regimen === 'monotributista';

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Encabezado */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">🧮 Tu Contador</h2>
          <p className="text-gray-500 text-sm mt-0.5">Tu situación con ARCA en tiempo real</p>
        </div>
        {cat && (
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1.5 rounded-xl text-sm font-bold ${esMono ? 'bg-indigo-100 text-indigo-700' : 'bg-teal-100 text-teal-700'}`}>
              {esMono ? `Monotributo${cat.categoria_monotributo ? ` · Cat. ${cat.categoria_monotributo}` : ''}` : 'Responsable Inscripto'}
            </span>
            <span className="text-[11px] text-gray-400" title={cat.fuente === 'arca' ? 'Traído de ARCA' : 'Configurado en el sistema'}>
              {cat.fuente === 'arca' ? '● ARCA' : '○ manual'}
            </span>
            <button onClick={sincronizarArca} disabled={sincronizando}
              className="text-[11px] text-blue-600 hover:underline disabled:opacity-50" title="Consultar tu categoría en ARCA">
              {sincronizando ? 'Consultando ARCA…' : '↻ ARCA'}
            </button>
          </div>
        )}
      </div>

      {/* Selector de mes */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3 flex items-center justify-between">
        <button onClick={() => irMes(-1)} className="w-9 h-9 grid place-items-center rounded-xl hover:bg-gray-100 text-gray-600 font-bold text-lg">‹</button>
        <div className="text-center">
          <p className="text-lg font-bold text-gray-800">{MESES[mes]} {anio}</p>
          {esMesActual && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Mes actual</span>}
        </div>
        <button onClick={() => irMes(1)} disabled={esMesActual} className="w-9 h-9 grid place-items-center rounded-xl hover:bg-gray-100 disabled:opacity-30 text-gray-600 font-bold text-lg">›</button>
      </div>

      {cargando ? (
        <div className="bg-white rounded-2xl border p-12 text-center text-gray-400"><div className="animate-spin text-3xl mb-2">⏳</div>Cargando…</div>
      ) : !data ? (
        <div className="bg-white rounded-2xl border p-8 text-center text-red-500">{msg || 'Error'}</div>
      ) : (
        <>
          {/* Vencimiento / número norte */}
          <VencimientoBanner data={data} historico={historico} esMono={esMono} />

          {/* Tarjetas en tiempo real */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Ventas facturadas (mes)" valor={fmt(data.ventas.total)} sub={`${data.ventas.cantidad} comprobantes`} color="text-emerald-600" icon="🧾" />
            <Stat label="Compras facturadas (mes)" valor={fmt(data.compras.total)} sub={`${data.compras.cantidad} comprobantes`} color="text-blue-600" icon="🛒" />
            <Stat label="Facturado en el año" valor={fmt(data.ventas_anio.total)} sub={`${data.ventas_anio.cantidad} este año`} icon="📅" />
            {data.responsable
              ? <Stat label={data.responsable.posicion >= 0 ? 'IVA a pagar (mes)' : 'IVA a favor (mes)'} valor={fmt(Math.abs(data.responsable.posicion))} sub="Débito − Crédito" color={data.responsable.posicion >= 0 ? 'text-orange-600' : 'text-green-600'} icon="📊" />
              : <Stat label="Acumulado 12 meses" valor={fmt(data.monotributo?.acumulado_12m)} sub="Para el tope del monotributo" icon="📈" />}
          </div>

          {/* Panel principal según régimen */}
          {esMono && data.monotributo ? (
            <MonotributoPanel m={data.monotributo} />
          ) : data.responsable ? (
            <ResponsablePanel r={data.responsable} ventas={data.ventas} compras={data.compras} />
          ) : null}

          {/* Histórico mes a mes */}
          {historico && historico.length > 0 && (esMono ? <HistoricoMono meses={historico} /> : <HistoricoResp meses={historico} />)}

          {/* Automatizar compras con Clave Fiscal (BETA) */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">🤖 Compras automáticas (AFIP)
                <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">BETA</span>
              </h3>
              {afip?.configurado && <button onClick={desvincularAfip} className="text-xs text-red-500 hover:underline">Desvincular</button>}
            </div>
            {!afip?.configurado ? (
              <>
                <p className="text-sm text-gray-500 mt-1">Guardá tu Clave Fiscal (cifrada) y el sistema baja tus compras de "Mis Comprobantes" solo, sin descargar nada. Si tenés 2FA en AFIP, esta opción no funciona todavía (usá el CSV de abajo).</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
                  <input className="border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="CUIT" value={formAfip.cuit} onChange={e => setFormAfip(f => ({ ...f, cuit: e.target.value }))} />
                  <input className="border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Usuario (si es distinto al CUIT)" value={formAfip.usuario} onChange={e => setFormAfip(f => ({ ...f, usuario: e.target.value }))} />
                  <div className="relative">
                    <input type={verClave ? 'text' : 'password'} autoComplete="new-password" className="border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm w-full" placeholder="Clave fiscal" value={formAfip.password} onChange={e => setFormAfip(f => ({ ...f, password: e.target.value }))} />
                    <button type="button" onClick={() => setVerClave(v => !v)} tabIndex={-1} title={verClave ? 'Ocultar clave' : 'Ver clave'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-base text-gray-400 hover:text-gray-600">{verClave ? '🙈' : '👁️'}</button>
                  </div>
                </div>
                {formAfip.cuit && afip?.cuit_negocio && formAfip.cuit.replace(/\D/g, '') !== afip.cuit_negocio && (
                  <p className="text-[11px] text-amber-600 mt-2">⚠️ El CUIT ingresado no coincide con el del negocio ({afip.cuit_negocio}). Verificá que sea la clave fiscal de <b>este</b> negocio.</p>
                )}
                <button onClick={guardarClaveFiscal} disabled={guardandoAfip} className="mt-3 px-4 py-2 rounded-lg text-white text-sm font-semibold bg-indigo-600 disabled:opacity-60">{guardandoAfip ? 'Guardando…' : 'Guardar y vincular'}</button>
                <p className="text-[11px] text-gray-400 mt-2">🔒 Tu clave se guarda cifrada y solo se usa para consultar tus comprobantes en AFIP.</p>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-600 mt-1">Vinculado con CUIT <b>{afip.cuit}</b>. {afip.ultima_sync ? `Última sincronización: ${new Date(afip.ultima_sync).toLocaleString('es-AR')}.` : 'Todavía no sincronizaste.'}</p>
                {afip.ultimo_error && <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-2">⚠️ {afip.ultimo_error}</p>}
                <button onClick={sincronizarCompras} disabled={syncCompras} className="mt-3 px-4 py-2 rounded-lg text-white text-sm font-semibold bg-indigo-600 disabled:opacity-60">{syncCompras ? 'Sincronizando con AFIP…' : '↻ Sincronizar compras ahora'}</button>
              </>
            )}
          </div>

          {/* Importar compras de ARCA */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">📥 Traer mis compras de ARCA (CSV)</h3>
            <p className="text-sm text-gray-500 mt-1">
              AFIP no tiene un servicio automático para las compras (comprobantes recibidos). Bajá el CSV desde
              <b> AFIP → Mis Comprobantes → Recibidos → Descargar</b> y subilo acá para sumar tus compras reales.
            </p>
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={(e) => importar(e.target.files[0])} disabled={importando}
                className="text-sm file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:font-medium file:cursor-pointer" />
              {importando && <span className="text-sm text-gray-400">Importando…</span>}
            </div>
            {msg && <p className="text-sm mt-3 font-medium text-gray-700">{msg}</p>}
          </div>

          <p className="text-xs text-gray-400 text-center">
            Las ventas y la categoría se traen solas de ARCA. El detalle completo (Libro IVA) está en{' '}
            <Link to="/admin/resumen-fiscal" className="text-emerald-600 hover:underline font-medium">Resumen Fiscal</Link>.
          </p>
        </>
      )}
    </div>
  );
}

function MonotributoPanel({ m }) {
  const s = SEMAFORO[m.estado] || SEMAFORO.verde;
  const uso = Math.min(100, m.uso_pct);
  return (
    <div className={`rounded-2xl border-2 ${s.border} ${s.bg} p-5`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className={`text-sm font-bold ${s.text}`}>{m.estado === 'rojo' ? '🔴' : m.estado === 'amarillo' ? '🟡' : '🟢'} {s.label}</p>
          <p className="text-xs text-gray-500 mt-0.5">Facturación de los últimos 12 meses vs tope de tu categoría</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-extrabold" style={{ color: s.color }}>{m.uso_pct}%</p>
          <p className="text-xs text-gray-500">del tope usado</p>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="mt-4">
        <div className="h-4 bg-white/70 rounded-full overflow-hidden ring-1 ring-black/5">
          <div className="h-full rounded-full transition-all" style={{ width: `${uso}%`, background: s.color }} />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1.5">
          <span>Facturado: <b className="text-gray-700">{fmt(m.acumulado_12m)}</b></span>
          <span>Tope Cat. {m.categoria_declarada || '—'}: <b className="text-gray-700">{fmt(m.tope_referencia)}</b></span>
        </div>
      </div>

      {/* Detalle */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
        <div className="bg-white/70 rounded-xl p-3">
          <p className="text-xs text-gray-500">{m.restante >= 0 ? 'Te queda para no pasarte' : 'Te pasaste por'}</p>
          <p className={`text-lg font-bold ${m.restante >= 0 ? 'text-gray-800' : 'text-red-600'}`}>{fmt(Math.abs(m.restante))}</p>
        </div>
        <div className="bg-white/70 rounded-xl p-3">
          <p className="text-xs text-gray-500">Por lo facturado te corresponde</p>
          <p className="text-lg font-bold text-gray-800">Categoría {m.categoria_sugerida || '—'}</p>
          {m.categoria_declarada && m.categoria_sugerida && m.categoria_sugerida !== m.categoria_declarada && (
            <p className="text-xs text-amber-600 font-medium mt-0.5">Deberías recategorizar</p>
          )}
        </div>
        <div className="bg-white/70 rounded-xl p-3">
          <p className="text-xs text-gray-500">A este ritmo llegás al tope en</p>
          <p className="text-lg font-bold text-gray-800">{m.proyeccion_meses != null ? `~${m.proyeccion_meses} meses` : (m.restante < 0 ? 'Ya lo superaste' : '—')}</p>
        </div>
      </div>
    </div>
  );
}

function ResponsablePanel({ r, ventas, compras }) {
  const aPagar = r.posicion >= 0;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="font-bold text-gray-800 mb-4">📐 Posición de IVA del mes</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Fila label="IVA Débito (ventas)" valor={fmt(r.iva_debito)} color="text-orange-600" />
          <Fila label="IVA Crédito (compras)" valor={`− ${fmt(r.iva_credito)}`} color="text-blue-600" />
          <div className={`flex justify-between items-center py-3 px-3 rounded-xl mt-1 ${aPagar ? 'bg-orange-50' : 'bg-green-50'}`}>
            <span className={`font-semibold text-sm ${aPagar ? 'text-orange-800' : 'text-green-800'}`}>{aPagar ? '⬆️ IVA a pagar' : '⬇️ Saldo a favor'}</span>
            <span className={`font-extrabold text-lg ${aPagar ? 'text-orange-600' : 'text-green-600'}`}>{fmt(Math.abs(r.posicion))}</span>
          </div>
        </div>
        <div className="space-y-2">
          <Fila label="Total ventas facturadas" valor={fmt(ventas.total)} />
          <Fila label="Neto ventas" valor={fmt(ventas.neto)} muted />
          <Fila label="Total compras facturadas" valor={fmt(compras.total)} />
          <Fila label="Neto compras" valor={fmt(compras.neto)} muted />
        </div>
      </div>
    </div>
  );
}

function Fila({ label, valor, color = 'text-gray-800', muted }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-100">
      <span className={`text-sm ${muted ? 'text-gray-400' : 'text-gray-600'}`}>{label}</span>
      <span className={`font-bold ${muted ? 'text-gray-500' : color}`}>{valor}</span>
    </div>
  );
}

// Banner principal: el "número norte" (qué te vence y cuánto) según el régimen.
function VencimientoBanner({ data, historico, esMono }) {
  if (esMono && data.monotributo) {
    const m = data.monotributo;
    const d = diasHasta(m.vencimiento_cuota);
    const dRecat = diasHasta(m.proxima_recategorizacion);
    return (
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-2xl p-4 bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg">
          <p className="text-[11px] uppercase tracking-wide text-white/70 font-semibold">Cuota de este mes</p>
          <p className="text-2xl font-extrabold mt-0.5">{m.cuota_bienes ? fmt(m.cuota_bienes) : '—'}</p>
          <p className="text-xs text-white/80 mt-1">Vence el {fmtFechaLarga(m.vencimiento_cuota)}{d != null && d >= 0 ? ` · faltan ${d} días` : ''}</p>
        </div>
        <div className="rounded-2xl p-4 bg-white border border-gray-100 shadow-sm">
          <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Próxima recategorización</p>
          <p className="text-lg font-bold text-gray-800 mt-0.5">{fmtFechaLarga(m.proxima_recategorizacion)}</p>
          <p className={`text-xs mt-1 ${m.debe_recategorizar ? 'text-amber-600 font-medium' : 'text-gray-500'}`}>
            {m.debe_recategorizar ? `⚠️ Deberías pasar a Cat. ${m.categoria_sugerida}` : 'Tu categoría está en orden'}{dRecat != null && dRecat >= 0 ? ` · en ${dRecat} días` : ''}
          </p>
        </div>
      </div>
    );
  }
  if (data.responsable) {
    const r = data.responsable;
    const hist = (historico || []).find(h => h.periodo === data.periodo.desde.slice(0, 7));
    const aPagar = hist ? hist.a_pagar : Math.max(0, r.posicion);
    const saldoFavor = hist ? hist.saldo_favor : Math.max(0, -r.posicion);
    const d = diasHasta(r.vencimiento);
    const urgente = d != null && d <= 5 && d >= 0 && aPagar > 0;
    return (
      <div className={`rounded-2xl p-5 text-white shadow-lg bg-gradient-to-br ${aPagar > 0 ? 'from-orange-500 to-rose-600' : 'from-emerald-500 to-teal-600'}`}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-white/70 font-semibold">{aPagar > 0 ? 'IVA a pagar de este período' : 'Saldo de IVA a favor'}</p>
            <p className="text-3xl font-extrabold mt-0.5">{fmt(aPagar > 0 ? aPagar : saldoFavor)}</p>
            {saldoFavor > 0 && aPagar === 0 && <p className="text-xs text-white/80 mt-1">Se traslada al mes siguiente (saldo técnico)</p>}
          </div>
          <div className="text-right">
            <p className="text-[11px] text-white/70 uppercase tracking-wide">Vence</p>
            <p className="text-lg font-bold">{fmtFechaLarga(r.vencimiento)}</p>
            {d != null && <p className="text-xs text-white/80">{d >= 0 ? `faltan ${d} días` : `venció hace ${-d} días`}</p>}
          </div>
        </div>
        {urgente && <p className="text-xs bg-white/20 rounded-lg px-3 py-1.5 mt-3 font-medium">⏰ El vencimiento está cerca. Tené la plata reservada.</p>}
      </div>
    );
  }
  return null;
}

// Histórico de IVA mes a mes (Responsable).
function HistoricoResp({ meses }) {
  const max = Math.max(1, ...meses.map(m => Math.max(m.a_pagar, m.saldo_favor)));
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="font-bold text-gray-800 mb-1">📅 Tu IVA mes a mes</h3>
      <p className="text-xs text-gray-400 mb-4">IVA Débito (ventas) − Crédito (compras). El saldo a favor se traslada al mes siguiente.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[520px]">
          <thead>
            <tr className="text-[11px] uppercase text-gray-400 border-b">
              <th className="text-left py-2 font-semibold">Mes</th>
              <th className="text-right font-semibold">Déb. IVA</th>
              <th className="text-right font-semibold">Créd. IVA</th>
              <th className="text-right font-semibold">A pagar</th>
              <th className="text-left pl-3 font-semibold w-1/3"></th>
            </tr>
          </thead>
          <tbody>
            {meses.map(m => {
              const aFavor = m.a_pagar === 0 && m.saldo_favor > 0;
              const w = Math.round((aFavor ? m.saldo_favor : m.a_pagar) / max * 100);
              return (
                <tr key={m.periodo} className="border-b border-gray-50">
                  <td className="py-2 text-gray-700 font-medium">{m.label}</td>
                  <td className="text-right text-orange-600">{fmt(m.iva_debito)}</td>
                  <td className="text-right text-blue-600">{fmt(m.iva_credito)}</td>
                  <td className={`text-right font-bold ${aFavor ? 'text-emerald-600' : 'text-gray-800'}`}>{aFavor ? `${fmt(m.saldo_favor)} a favor` : fmt(m.a_pagar)}</td>
                  <td className="pl-3">
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${w}%`, background: aFavor ? '#10b981' : '#f97316' }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Histórico de facturación mes a mes (Monotributo).
function HistoricoMono({ meses }) {
  const max = Math.max(1, ...meses.map(m => m.facturado));
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="font-bold text-gray-800 mb-1">📅 Tu facturación mes a mes</h3>
      <p className="text-xs text-gray-400 mb-4">Lo facturado por mes y cómo venís contra el tope (acumulado de 12 meses).</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead>
            <tr className="text-[11px] uppercase text-gray-400 border-b">
              <th className="text-left py-2 font-semibold">Mes</th>
              <th className="text-right font-semibold">Facturado</th>
              <th className="text-left pl-3 font-semibold w-1/3"></th>
              <th className="text-right font-semibold">% tope</th>
            </tr>
          </thead>
          <tbody>
            {meses.map(m => {
              const col = SEMAFORO[m.estado]?.color || '#10b981';
              return (
                <tr key={m.periodo} className="border-b border-gray-50">
                  <td className="py-2 text-gray-700 font-medium">{m.label}</td>
                  <td className="text-right text-gray-800 font-semibold">{fmt(m.facturado)}</td>
                  <td className="pl-3">
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.round(m.facturado / max * 100)}%`, background: '#6366f1' }} />
                    </div>
                  </td>
                  <td className="text-right font-bold" style={{ color: col }}>{m.uso_pct}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
