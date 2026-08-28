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

const SEMAFORO = {
  verde: { color: '#10b981', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', label: 'Vas bien' },
  amarillo: { color: '#f59e0b', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', label: 'Ojo, te estás acercando' },
  rojo: { color: '#ef4444', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', label: 'Te pasaste del tope' },
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
  const [cargando, setCargando] = useState(true);
  const [msg, setMsg] = useState('');
  const [importando, setImportando] = useState(false);
  const fileRef = useRef(null);

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

  const importar = async (file) => {
    if (!file) return;
    setImportando(true); setMsg('');
    try {
      const csv = await file.text();
      const r = await api.post('/api/contador/importar', { tipo: 'recibido', csv });
      setMsg(`✅ Importadas ${r.data.insertados} compras nuevas (de ${r.data.leidos} leídas).`);
      await cargar();
    } catch (e) {
      setMsg(e.response?.data?.error || 'No se pudo importar el archivo');
    } finally { setImportando(false); if (fileRef.current) fileRef.current.value = ''; }
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

          {/* Importar compras de ARCA */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">📥 Traer mis compras de ARCA</h3>
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
