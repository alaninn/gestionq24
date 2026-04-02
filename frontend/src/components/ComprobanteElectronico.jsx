// =============================================
// COMPONENTE: Comprobante Electrónico ARCA
// Ticket fiscal real con QR oficial de AFIP/ARCA
// =============================================

import { useEffect, useRef } from 'react';

const fmt = (n) => new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', minimumFractionDigits: 2
}).format(n || 0);

const nombresTipos = {
  1: 'Factura A', 6: 'Factura B', 11: 'Factura C',
  3: 'Nota de Crédito A', 8: 'Nota de Crédito B', 13: 'Nota de Crédito C',
  2: 'Nota de Débito A', 7: 'Nota de Débito B', 12: 'Nota de Débito C',
};

const letraTipo = {
  1: 'A', 2: 'A', 3: 'A',
  6: 'B', 7: 'B', 8: 'B',
  11: 'C', 12: 'C', 13: 'C',
};

const nombresDocumentos = {
  80: 'CUIT', 96: 'DNI', 99: 'Consumidor Final',
};

// ---- Genera la URL del QR oficial de ARCA/AFIP ----
function generarUrlQR(comprobante, cuitEmisor) {
  const fecha = comprobante.fecha_emision
    ? new Date(comprobante.fecha_emision).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  const data = {
    ver: 1,
    fecha: fecha,
    cuit: Number(String(cuitEmisor).replace(/[-\s]/g, '')),
    ptoVta: Number(comprobante.punto_venta || 1),
    tipoCmp: Number(comprobante.tipo_comprobante),
    nroCmp: Number(comprobante.numero_comprobante),
    importe: Number(comprobante.importe_total || 0),
    moneda: "PES",
    ctz: 1,
    tipoDocRec: Number(comprobante.tipo_documento || 99),
    nroDocRec: Number(comprobante.numero_documento || 0),
    tipoCodAut: "E",
    codAut: Number(comprobante.cae)
  };

  const json = JSON.stringify(data);
  const base64 = btoa(unescape(encodeURIComponent(json)));

  return `https://www.afip.gob.ar/fe/qr/?p=${base64}`;
}

// ---- Componente QR usando canvas + qrcodejs ----
function QRCodeCanvas({ value, size }) {
  const canvasRef = useRef(null);
  const sz = size || 120;

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = sz;
    canvas.height = sz;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, sz, sz);

    const generarQR = () => {
      const div = document.createElement('div');
      div.style.display = 'none';
      document.body.appendChild(div);
      try {
        new window.QRCode(div, {
          text: value,
          width: sz,
          height: sz,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: window.QRCode.CorrectLevel.M,
        });
        setTimeout(() => {
          const el = div.querySelector('canvas') || div.querySelector('img');
          if (el) {
            if (el.tagName === 'CANVAS') {
              ctx.drawImage(el, 0, 0, sz, sz);
            } else {
              const img = new Image();
              img.onload = () => ctx.drawImage(img, 0, 0, sz, sz);
              img.src = el.src;
            }
          }
          document.body.removeChild(div);
        }, 300);
      } catch (e) {
        document.body.removeChild(div);
      }
    };

    if (window.QRCode) {
      generarQR();
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
      script.onload = generarQR;
      document.head.appendChild(script);
    }
  }, [value, sz]);

  return <canvas ref={canvasRef} style={{ width: sz, height: sz }} />;
}

// ---- Componente principal ----
function ComprobanteElectronico({ comprobante, onClose, config }) {
  if (!comprobante) return null;
  

  const tipoNombre = nombresTipos[comprobante.tipo_comprobante] || `Tipo ${comprobante.tipo_comprobante}`;
  const letra = letraTipo[comprobante.tipo_comprobante] || 'C';
  const documentoNombre = nombresDocumentos[comprobante.tipo_documento] || 'Sin identificar';
  const cuitEmisor = config?.cuit || comprobante.cuit_emisor || '';

  const puntoVentaStr = String(comprobante.punto_venta || 1).padStart(5, '0');
  const numeroStr = String(comprobante.numero_comprobante || 0).padStart(8, '0');
  const fechaEmision = comprobante.fecha_emision
    ? new Date(comprobante.fecha_emision).toLocaleDateString('es-AR')
    : new Date().toLocaleDateString('es-AR');
  const fechaVto = comprobante.cae_vencimiento
    ? new Date(comprobante.cae_vencimiento).toLocaleDateString('es-AR')
    : '';

  const qrUrl = generarUrlQR(comprobante, cuitEmisor);

  const imprimir = () => {
    const ventana = window.open('', '_blank', 'width=500,height=800');
    if (!ventana) return;

    const htmlImpresion = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${tipoNombre} ${puntoVentaStr}-${numeroStr}</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; font-size: 11px; width: 80mm; padding: 4mm; color: #000; background: #fff; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .grande { font-size: 18px; }
    .sep { border-top: 1px dashed #000; margin: 4px 0; }
    .sep-doble { border-top: 2px solid #000; margin: 4px 0; }
    .fila { display: flex; justify-content: space-between; margin: 2px 0; }
    .letra-box { border: 3px solid #000; width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center; font-size: 22px; font-weight: bold; margin: 4px auto; }
    .qr-container { display: flex; justify-content: center; margin: 8px 0; }
    @media print { body { width: 80mm; } }
  </style>
</head>
<body>
  <div class="center bold grande">${config?.nombre_negocio || 'Mi Negocio'}</div>
  <div class="center">${config?.direccion || 'Sin dirección'}</div>
  ${config?.telefono ? `<div class="center">Tel: ${config.telefono}</div>` : ''}
  ${cuitEmisor ? `<div class="center bold">CUIT: ${cuitEmisor}</div>` : ''}
  ${config?.condicion_iva ? `<div class="center">${config.condicion_iva}</div>` : ''}
  ${config?.ingresos_brutos ? `<div class="center">Ing. Brutos: ${config.ingresos_brutos}</div>` : ''}
  ${config?.inicio_actividades ? `<div class="center">Inicio Act.: ${config.inicio_actividades.split('T')[0].split('-').reverse().join('/')}</div>` : ''}
  <div class="sep-doble"></div>
  <div class="center">
    <div class="letra-box">${letra}</div>
    <div class="bold" style="font-size:13px">${tipoNombre.toUpperCase()}</div>
    <div>N&#176; ${puntoVentaStr}-${numeroStr}</div>
    <div>Fecha: ${fechaEmision}</div>
  </div>
  <div class="sep"></div>
  <div class="fila"><span>Punto de Venta:</span><span>${puntoVentaStr}</span></div>
  <div class="fila"><span>Cond. IVA Receptor:</span><span>${documentoNombre === 'CUIT' ? 'Resp. Inscripto' : 'Consumidor Final'}</span></div>
  <div class="fila"><span>Documento:</span><span>${documentoNombre}</span></div>
  ${comprobante.numero_documento ? `<div class="fila"><span>N&#176; Doc:</span><span>${comprobante.numero_documento}</span></div>` : ''}
  ${comprobante.denominacion_comprador && comprobante.denominacion_comprador !== 'Consumidor Final' ? `<div class="fila"><span>Nombre:</span><span>${comprobante.denominacion_comprador}</span></div>` : ''}
  <div class="sep"></div>
  ${comprobante.importe_neto ? `<div class="fila"><span>Subtotal:</span><span>${fmt(comprobante.importe_neto)}</span></div>` : ''}
  ${Number(comprobante.importe_iva) > 0 ? `<div class="fila"><span>IVA 21%:</span><span>${fmt(comprobante.importe_iva)}</span></div>` : ''}
  <div class="sep-doble"></div>
  <div class="fila bold" style="font-size:14px"><span>TOTAL:</span><span>${fmt(comprobante.importe_total)}</span></div>
  <div class="sep-doble"></div>
  ${comprobante.metodo_pago ? `<div class="center" style="font-size:9px; margin: 2px 0;">Forma de Pago: ${comprobante.metodo_pago.charAt(0).toUpperCase() + comprobante.metodo_pago.slice(1)}</div>` : ''}
  <div class="center" style="font-size:9px; margin: 4px 0;">Régimen de Transparencia Fiscal al Consumidor (Ley 27.743)</div>
  <div class="center">
    <div style="font-size:9px">CAE N&#176;: ${comprobante.cae}</div>
    <div style="font-size:9px">Vto. CAE: ${fechaVto}</div>
  </div>
  <div class="sep"></div>
  <div class="qr-container"><div id="qrcode"></div></div>
  <div class="center" style="font-size:8px">Consulte su comprobante en www.arca.gob.ar</div>
  <div class="sep"></div>
 ${letra === 'C' ? '<div class="center" style="font-size:9px">El presente comprobante no genera credito fiscal</div>' : letra === 'A' ? '<div class="center" style="font-size:9px">IVA discriminado - Valida como credito fiscal</div>' : '<div class="center" style="font-size:9px">IVA incluido en el precio - No valida como credito fiscal</div>'}
  <script>
    window.onload = function() {
      try {
        new QRCode(document.getElementById('qrcode'), {
  text: '${qrUrl}',
  width: 170,
  height: 170,
  colorDark: '#000000',
  colorLight: '#ffffff',
  correctLevel: QRCode.CorrectLevel.H
});
      } catch(e) { console.error('QR error:', e); }
      setTimeout(function() {
        window.print();
        window.onafterprint = function() { window.close(); };
      }, 800);
    };
  <\/script>
</body>
</html>`;

    ventana.document.write(htmlImpresion);
    ventana.document.close();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div
        className="bg-white shadow-2xl w-full max-w-sm overflow-hidden"
        style={{ fontFamily: "'Courier New', monospace", maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Barra superior */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white flex-shrink-0">
          <span className="text-sm font-bold tracking-wide">🧾 COMPROBANTE ELECTRÓNICO</span>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">×</button>
        </div>

        {/* Cuerpo scrolleable */}
        <div className="overflow-y-auto flex-1 bg-white">
          <div className="px-6 py-4" style={{ maxWidth: 320, margin: '0 auto' }}>

           
            {/* Encabezado negocio */}
<div className="text-center mb-3">
  <p className="font-bold text-base">{config?.nombre_negocio || 'Mi Negocio'}</p>
  <p className="text-xs">{config?.direccion || 'Sin dirección'}</p>
  {config?.telefono && <p className="text-xs">Tel: {config.telefono}</p>}
  {cuitEmisor && <p className="text-xs font-bold">CUIT: {cuitEmisor}</p>}
  {config?.condicion_iva && <p className="text-xs">{config.condicion_iva}</p>}
  {config?.ingresos_brutos && <p className="text-xs">Ing. Brutos: {config.ingresos_brutos}</p>}
  {config?.inicio_actividades && (
                <p className="text-xs">Inicio Act.: {config.inicio_actividades.split('T')[0].split('-').reverse().join('/')}</p>
              )}
  
</div>

            <div className="border-t-2 border-dashed border-gray-400 my-2" />

            {/* Letra y tipo — estilo fiscal */}
            <div className="text-center my-3">
              <div className="inline-flex items-center justify-center border-4 border-black w-12 h-12 mb-2">
                <span className="text-3xl font-black">{letra}</span>
              </div>
              <p className="font-bold text-sm tracking-widest">{tipoNombre.toUpperCase()}</p>
              <p className="text-xs mt-1">N° {puntoVentaStr} - {numeroStr}</p>
              <p className="text-xs">Fecha: {fechaEmision}</p>
            </div>

            <div className="border-t border-dashed border-gray-400 my-2" />

            {/* Datos comprador */}
            {/* Datos comprador */}
<div className="text-xs space-y-1 my-2">
  <div className="flex justify-between">
    <span>Punto de Venta:</span>
    <span className="font-bold">{puntoVentaStr}</span>
  </div>
  <div className="flex justify-between">
    <span>Cond. IVA Receptor:</span>
    <span className="font-bold">{documentoNombre === 'CUIT' ? 'Resp. Inscripto' : 'Consumidor Final'}</span>
  </div>
  <div className="flex justify-between">
    <span>Documento:</span>
    <span className="font-bold">{documentoNombre}</span>
  </div>
              {comprobante.numero_documento && (
                <div className="flex justify-between">
                  <span>N° Doc:</span>
                  <span className="font-bold">{comprobante.numero_documento}</span>
                </div>
              )}
              {comprobante.denominacion_comprador && comprobante.denominacion_comprador !== 'Consumidor Final' && (
                <div className="flex justify-between">
                  <span>Nombre:</span>
                  <span className="font-bold">{comprobante.denominacion_comprador}</span>
                </div>
              )}
            </div>

            <div className="border-t border-dashed border-gray-400 my-2" />

            {/* Montos */}
            <div className="text-xs space-y-1 my-2">
              {Number(comprobante.importe_neto) > 0 && (
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{fmt(comprobante.importe_neto)}</span>
                </div>
              )}
              {Number(comprobante.importe_iva) > 0 && (
                <div className="flex justify-between">
                  <span>IVA (21%):</span>
                  <span>{fmt(comprobante.importe_iva)}</span>
                </div>
              )}
            </div>

            <div className="border-t-2 border-b-2 border-black my-2 py-1">
              <div className="flex justify-between font-black text-base">
                <span>TOTAL:</span>
                <span>{fmt(comprobante.importe_total)}</span>
              </div>
            </div>

            {/* Forma de Pago */}
            {comprobante.metodo_pago && (
              <div className="text-center my-2">
                <p className="text-xs text-gray-600">Forma de Pago: {comprobante.metodo_pago.charAt(0).toUpperCase() + comprobante.metodo_pago.slice(1)}</p>
              </div>
            )}

            {/* Régimen de Transparencia Fiscal */}
            <div className="text-center my-2">
              <p className="text-xs text-gray-600">Régimen de Transparencia Fiscal al Consumidor (Ley 27.743)</p>
            </div>

            {/* CAE */}
            <div className="text-center my-3">
              <p className="text-xs">CAE N°:</p>
              <p className="font-bold text-sm tracking-wider">{comprobante.cae}</p>
              <p className="text-xs">Vto. CAE: {fechaVto}</p>
            </div>

            <div className="border-t border-dashed border-gray-400 my-2" />

            {/* QR */}
            <div className="flex flex-col items-center my-3">
              <QRCodeCanvas value={qrUrl} size={170} />
              <p className="text-xs text-center mt-2 text-gray-600">
                Consultá tu comprobante en<br />
                <span className="font-bold">www.arca.gob.ar</span>
              </p>
            </div>

            <div className="border-t border-dashed border-gray-400 my-2" />

            <div className="text-center">
               {letra === 'C' && (
                <p className="text-xs text-gray-500 mb-1">El presente comprobante no genera crédito fiscal</p>
              )}
              {letra === 'A' && (
                <p className="text-xs text-gray-500 mb-1">IVA discriminado - Válida como crédito fiscal</p>
              )}
              {letra === 'B' && (
                <p className="text-xs text-gray-500 mb-1">IVA incluido en el precio - No válida como crédito fiscal</p>
              )}
</div>

          </div>
        </div>

        {/* Footer botones */}
        <div className="flex gap-3 p-3 border-t bg-gray-50 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border-2 border-gray-300 rounded-lg text-gray-700 font-bold text-sm hover:bg-gray-100 transition-colors"
          >
            Cerrar
          </button>
          <button
            onClick={imprimir}
            className="flex-1 py-2.5 bg-gray-900 hover:bg-gray-700 text-white rounded-lg font-bold text-sm transition-colors"
          >
            🖨️ Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}

export default ComprobanteElectronico;
