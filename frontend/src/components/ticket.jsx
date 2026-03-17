// =============================================
// ARCHIVO: src/components/Ticket.jsx
// FUNCIÓN: Genera e imprime el ticket de venta
// =============================================

const fmt = (n) => new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', minimumFractionDigits: 0
}).format(n || 0);

const fmtFecha = (f) => new Date(f).toLocaleDateString('es-AR', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit'
});

// ---- FUNCIÓN PRINCIPAL: imprimir ticket ----
export function imprimirTicket({ venta, items, config, negocio }) {

  const nombreNegocio = config?.nombre_negocio || negocio || 'Mi Negocio';
  const direccion = config?.direccion || '';
  const telefono = config?.telefono || '';
  const cuit = config?.cuit || '';
  const nombreTicket = config?.nombre_ticket || 'TICKET DE COMPRA';

  // Construimos el HTML del ticket
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Ticket #${venta.id}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
          font-family: 'Courier New', Courier, monospace;
          font-size: 12px;
          width: 80mm;
          max-width: 80mm;
          padding: 4mm;
          color: #000;
          background: #fff;
        }

        .center { text-align: center; }
        .right { text-align: right; }
        .left { text-align: left; }
        .bold { font-weight: bold; }
        .grande { font-size: 16px; }
        .small { font-size: 10px; }

        .separador {
          border-top: 1px dashed #000;
          margin: 4px 0;
        }

        .separador-doble {
          border-top: 2px solid #000;
          margin: 4px 0;
        }

        .fila {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin: 2px 0;
        }

        .fila-item {
          display: flex;
          justify-content: space-between;
          margin: 3px 0;
        }

        .nombre-item {
          flex: 1;
          margin-right: 4px;
          word-break: break-word;
        }

        .precio-item {
          text-align: right;
          white-space: nowrap;
          min-width: 60px;
        }

        .cant-item {
          min-width: 30px;
          text-align: right;
          margin-right: 6px;
        }

        .total-grande {
          font-size: 18px;
          font-weight: bold;
          text-align: right;
        }

        .gracias {
          font-size: 11px;
          text-align: center;
          margin-top: 6px;
        }

        @media print {
          body { width: 80mm; }
          @page { 
            size: 80mm auto;
            margin: 0;
          }
        }
      </style>
    </head>
    <body>

      <!-- ENCABEZADO -->
      <div class="center bold grande">${nombreNegocio}</div>
      ${direccion ? `<div class="center small">${direccion}</div>` : ''}
      ${telefono ? `<div class="center small">Tel: ${telefono}</div>` : ''}
      ${cuit ? `<div class="center small">CUIT: ${cuit}</div>` : ''}
      
      <div class="separador-doble"></div>
      
      <div class="center bold">${nombreTicket}</div>
      <div class="fila small">
        <span>N° ${String(venta.id).padStart(6, '0')}</span>
        <span>${fmtFecha(venta.fecha || new Date())}</span>
      </div>
      ${venta.cliente_nombre ? `<div class="small">Cliente: ${venta.cliente_nombre}</div>` : ''}
      
      <div class="separador"></div>

      <!-- ITEMS -->
      <div class="fila bold small">
        <span class="nombre-item">DESCRIPCIÓN</span>
        <span class="cant-item">CANT</span>
        <span class="precio-item">SUBTOTAL</span>
      </div>
      <div class="separador"></div>

      ${items.map(item => `
        <div class="fila-item">
          <span class="nombre-item">${item.nombre_producto}</span>
          <span class="cant-item">${item.cantidad}</span>
          <span class="precio-item">${fmt(item.subtotal)}</span>
        </div>
        <div class="small" style="color:#555; margin-left:2px; margin-bottom:2px;">
          ${fmt(item.precio_unitario)} c/u
        </div>
      `).join('')}

      <div class="separador"></div>

      <!-- TOTALES -->
      ${venta.descuento > 0 ? `
        <div class="fila">
          <span>Subtotal</span>
          <span>${fmt(parseFloat(venta.total) + parseFloat(venta.descuento) - parseFloat(venta.recargo || 0))}</span>
        </div>
        <div class="fila">
          <span>Descuento</span>
          <span>-${fmt(venta.descuento)}</span>
        </div>
      ` : ''}

      ${venta.recargo > 0 ? `
        <div class="fila">
          <span>Recargo</span>
          <span>+${fmt(venta.recargo)}</span>
        </div>
      ` : ''}

      <div class="separador-doble"></div>
      <div class="fila">
        <span class="bold grande">TOTAL</span>
        <span class="total-grande">${fmt(venta.total)}</span>
      </div>
      <div class="separador"></div>

      <!-- MÉTODO DE PAGO -->
      <div class="fila small">
        <span>Método de pago:</span>
        <span class="bold">${formatearMetodo(venta.metodo_pago)}</span>
      </div>

      ${venta.es_fiado ? `
        <div class="center bold" style="margin-top:4px; font-size:11px;">
          ⚠ FIADO - CUENTA CORRIENTE
        </div>
      ` : ''}

      <!-- PIE -->
      <div class="separador-doble"></div>
      <div class="gracias">¡Gracias por su compra!</div>
      <div class="gracias small">Conserve su ticket</div>
      <div style="margin-top: 8px;"></div>

    </body>
    </html>
  `;

  // Abrimos una ventana nueva e imprimimos
  const ventana = window.open('', '_blank', 'width=400,height=600');
  ventana.document.write(html);
  ventana.document.close();

  // Esperamos a que cargue y luego imprimimos
  ventana.onload = () => {
    ventana.focus();
    ventana.print();
    // Cerramos la ventana después de imprimir
    ventana.onafterprint = () => ventana.close();
  };
}

// Formatea el nombre del método de pago
function formatearMetodo(metodo) {
  const metodos = {
    'efectivo': 'Efectivo',
    'tarjeta': 'Tarjeta',
    'mercadopago': 'Mercado Pago',
    'transferencia': 'Transferencia',
    'cuenta_corriente': 'Cuenta Corriente',
  };
  return metodos[metodo] || metodo;
}