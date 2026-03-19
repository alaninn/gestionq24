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
export function imprimirTicket({ venta, items, config, negocio, modo = 'automatico' }) {

  const nombreNegocio = config?.nombre_negocio || negocio || 'Mi Negocio';
  const tamanioTicket = config?.tamanio_ticket || '80';
  const tamanioPersonalizado = parseInt(config?.tamanio_ticket_personalizado || 0, 10);
  const anchoTicket = tamanioTicket === 'personalizado' && tamanioPersonalizado > 0 ? tamanioPersonalizado : parseInt(tamanioTicket, 10) || 80;
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
          width: ${anchoTicket}mm;
          max-width: ${anchoTicket}mm;
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

        /* Botones para modo vista previa */
        .controles-vista-previa {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: white;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 10px 20px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          display: flex;
          gap: 10px;
          z-index: 1000;
        }

        .btn-imprimir {
          background: #10b981;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-weight: bold;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-imprimir:hover {
          background: #059669;
        }

        .btn-cancelar {
          background: #ef4444;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-weight: bold;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-cancelar:hover {
          background: #dc2626;
        }

        @media print {
          body { width: ${anchoTicket}mm; }
          @page { 
            size: ${anchoTicket}mm auto;
            margin: 0;
          }
          .controles-vista-previa { display: none; }
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

      <!-- Controles para modo vista previa -->
      ${modo === 'vista_previa' ? `
        <div class="controles-vista-previa">
          <button class="btn-imprimir" onclick="window.print()">🖨️ Imprimir Ticket</button>
          <button class="btn-cancelar" onclick="window.close()">❌ Cancelar</button>
        </div>
      ` : ''}

      <script>
        // Lógica para el modo vista previa
        if ('${modo}' === 'vista_previa') {
          // No hacer nada, los botones se encargan de imprimir o cerrar
        } else {
          // Modo automático: imprimir directamente
          window.onload = function() {
            window.print();
            // Cerrar después de imprimir
            window.onafterprint = function() {
              window.close();
            };
          };
        }
      </script>

    </body>
    </html>
  `;

  // Abrimos una ventana nueva
  const ventana = window.open('', '_blank', 'width=400,height=600');
  ventana.document.write(html);
  ventana.document.close();

  // Lógica según el modo
  if (modo === 'vista_previa') {
    // En modo vista previa, solo mostramos el ticket con controles
    ventana.onload = () => {
      ventana.focus();
    };
  } else {
    // Modo automático: imprimir directamente sin mostrar vista previa
    ventana.onload = () => {
      ventana.focus();
      ventana.print();
      ventana.onafterprint = () => ventana.close();
    };
  }
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