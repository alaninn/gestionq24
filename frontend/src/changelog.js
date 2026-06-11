// =============================================
// ARCHIVO: src/changelog.js
// Versión actual del programa + historial de cambios.
//
// CÓMO ACTUALIZAR:
//   1. Subí el número en VERSION_ACTUAL (formato: mayor.menor.parche)
//   2. Agregá un objeto nuevo ARRIBA de todo en CHANGELOG con:
//      - version, fecha, titulo
//      - cambios: lista de cambios. Cada uno es { t: 'texto' }.
//        Si el cambio es SOLO del panel SuperAdmin, agregale super: true → { t: 'texto', super: true }
//      - destacados (opcional): cambios importantes con explicación. Mismo criterio: { titulo, detalle, super? }
//
//   El panel del usuario (admin del negocio) muestra solo lo que NO es super.
//   El panel SuperAdmin muestra TODO.
// =============================================

export const VERSION_ACTUAL = '2.3.0';

export const CHANGELOG = [
  {
    version: '2.3.0',
    fecha: '2026-06-11',
    titulo: 'Facturación electrónica más fácil',
    destacados: [
      {
        titulo: '🚀 Conexión rápida con ARCA (sin certificados)',
        detalle: 'Nueva forma de conectarte para facturar: en vez de tramitar certificados, autorizás el servicio a gestionq24 desde tu clave fiscal (un trámite de 3 minutos en ARCA, guiado paso a paso) y quedás facturando con tu propio CUIT. La opción de certificado propio sigue disponible para quien la prefiera.',
      },
    ],
    cambios: [
      { t: 'Facturación: nueva "Conexión rápida" con ARCA por delegación de servicio (sin manejar certificados).' },
      { t: 'Facturación: tutorial de certificado propio renovado con los 7 pasos completos, incluidos los 2 que suelen olvidarse (autorizar el web service y crear el punto de venta de Web Services) y links directos.' },
      { t: 'Facturación: al subir el certificado, el sistema valida que sea el archivo correcto, que no esté vencido y que corresponda a tu solicitud, con mensajes claros de qué salió mal.' },
      { t: 'Corregido: al cargar un certificado nuevo se limpia la conexión anterior (evita el error de ARCA "No apareció CUIT en lista de relaciones").' },
      { t: 'Corregido: la venta de productos por peso (Kg/Lt/Mt) ahora respeta la configuración "Stock Negativo" — antes bloqueaba siempre, y con stock ya negativo no dejaba vender nunca.' },
      { t: 'Corregido: pantalla en blanco ocasional en el POS. Ahora, ante cualquier error, se muestra una pantalla de recuperación con el detalle y botones para recargar o restablecer.' },
      { t: 'Facturación: al activar facturación electrónica en una venta, ahora sale Factura B (consumidor final) por defecto. La Factura A se elige a mano solo para ventas a otros Responsables Inscriptos.' },
    ],
  },
  {
    version: '2.2.1',
    fecha: '2026-06-11',
    titulo: 'Configuración revisada: todas las opciones ahora funcionan',
    destacados: [
      {
        titulo: '💲 Actualización masiva de precios',
        detalle: 'En Productos, el botón "Actualizar Precios" te deja subir o bajar precios por porcentaje o monto fijo (o fijar un precio exacto), aplicado a todo el inventario, a una categoría o solo a los productos que tildaste. Ideal para aumentos de proveedores o ajustes por inflación.',
      },
      {
        titulo: '🏷️ Mover productos de categoría en masa',
        detalle: 'Tildá varios productos y usá "Mover a categoría" en la barra de selección. Útil para ordenar el inventario después de una importación.',
      },
      {
        titulo: '💲 Precio mayorista automático',
        detalle: 'Si activás "Precio Mayorista" en Configuración y el producto tiene precio mayorista cargado, el POS lo aplica solo cuando la cantidad llega al mínimo configurado (y vuelve al precio normal si baja).',
      },
    ],
    cambios: [
      { t: 'Productos: actualización masiva de precios (% o monto, por total/categoría/selección).' },
      { t: 'Productos: cambio masivo de categoría para productos seleccionados.' },
      { t: 'Configuración: el toggle "Venta Rápida" ahora funciona de verdad (oculta el botón ⚡ y el atajo F1 del POS).' },
      { t: 'Configuración: "Mostrar stock en POS" ahora funciona (oculta la cantidad disponible en la lista de productos).' },
      { t: 'Precio mayorista automático en el carrito según cantidad mínima.' },
      { t: 'Impresión: el modo "Imprimir automáticamente" ahora imprime el ticket solo al confirmar la venta (antes había que tocar Imprimir).' },
      { t: 'Corregido: al editar un producto ya no se recalcula (ni cambia) el precio de venta solo — solo se recalcula si modificás costo, margen o IVA.' },
      { t: 'Importación de productos: si el archivo no trae IVA, queda en 0% para respetar el precio de venta del archivo.' },
      { t: 'Sistema: la versión que se muestra ahora es la real del programa, con fecha de última actualización y plan actual.' },
      { t: 'Sistema: se quitó información técnica sin utilidad (base de datos, servidor) y opciones que no hacían nada (moneda, escáner).' },
      { t: 'Corregido: el botón Guardar de la pestaña Sistema aparecía arriba del contenido.' },
      { t: 'Corregido: el toggle del PIN de cierre aparecía activado aunque no hubiera PIN configurado.' },
    ],
  },
  {
    version: '2.2.0',
    fecha: '2026-06-10',
    titulo: 'Descuento, recargo y redondeo desde el carrito',
    destacados: [
      {
        titulo: '🏷️ Ajustá el precio antes de cobrar',
        detalle: 'En el carrito del Punto de Venta ahora tenés botones de Descuento, Recargo y Redondeo (↓ Bajar / ↑ Subir). Al tocarlos, el total se actualiza al instante, así le confirmás el precio final al cliente antes de abrir el modal de cobro. Los porcentajes se configuran en Admin → Configuración.',
      },
    ],
    cambios: [
      { t: 'Punto de Venta: botones de descuento, recargo y redondeo movidos al carrito (se ve el precio final antes de confirmar).' },
      { t: 'Nuevo: recargo general configurable (Admin → Configuración) para cobrar un extra desde el carrito.' },
      { t: 'Corregido: ya no te desloguea al actualizar el navegador (F5 / Ctrl+Shift+R).' },
      { t: 'Punto de Venta: la barra de botones se acomoda en varias líneas en pantallas chicas (sin barra de scroll).' },
    ],
  },
  {
    version: '2.1.1',
    fecha: '2026-06-10',
    titulo: 'Punto de Venta en el celular y ajustes',
    destacados: [
      {
        titulo: '📱 Punto de Venta optimizado para celular',
        detalle: 'Desde el celular ahora podés vender cómodo: usá la barra de abajo para alternar entre "Productos" (buscar y agregar) y "Carrito" (cobrar). El carrito muestra el total y la cantidad en todo momento.',
      },
    ],
    cambios: [
      { t: 'Punto de Venta: rediseñado para usarse bien desde el celular (alternás entre productos y carrito).' },
      { t: 'Punto de Venta: se quitó el botón "Salir" (riesgo de cerrar sesión sin querer) y se agregó "Cambiar usuario" 🔄 en la esquina, para el cambio de turno.' },
      { t: 'El cartel del plan ahora aparece solo una vez al entrar y se oculta solo (antes quedaba fijo).' },
      { t: 'Corregido: los negocios con plan Premium ahora pueden ingresar normalmente.' },
      { t: 'Mejor visualización en celular de Control de Caja y Cuentas Corrientes.' },
    ],
  },
  {
    version: '2.1.0',
    fecha: '2026-06-10',
    titulo: 'Importación y eliminación masiva de productos',
    destacados: [
      {
        titulo: '📥 Importar productos desde Excel',
        detalle: 'En Productos, descargá la "Plantilla Excel", completala (o pegá tu lista) y subila con "Importar Excel". Reconoce las columnas por su nombre, así que no importa el orden. Si un producto ya existe (mismo código), lo actualiza en vez de duplicarlo.',
      },
      {
        titulo: '🗑️ Eliminación masiva de productos',
        detalle: 'En Productos podés tildar varios con los checkboxes y borrarlos juntos. Si tildás "seleccionar todos" aparece la opción de borrar todo el inventario.',
      },
      {
        titulo: '🆕 Versión y novedades',
        detalle: 'Abajo del menú vas a ver la versión del programa. Hacé clic para ver este historial de cambios cada vez que actualicemos.',
      },
    ],
    cambios: [
      { t: 'Productos: importación masiva por Excel robusta (lee por nombre de columna, crea categorías que falten, no duplica).' },
      { t: 'Productos: eliminación masiva con selección múltiple y opción de eliminar todo.' },
      { t: 'Productos: corregido el error al subir archivos grandes.' },
      { t: 'Usuarios: botón para eliminar usuarios definitivamente (sin romper turnos ni ventas).' },
      { t: 'Mejoras de visualización en celular (Usuarios y Productos).' },

      // ---- Cambios del panel SuperAdmin (no se muestran en el panel del usuario) ----
      { t: 'SuperAdmin: ahora funcionan Renovar Suscripción, Editar Días de Uso, Historial de Pagos, Salud del Negocio, Mi Cuenta, Editar Administrador y Gestión de Tickets.', super: true },
      { t: 'SuperAdmin: eliminar negocios ya no falla cuando tienen datos cargados.', super: true },
      { t: 'SuperAdmin: al editar el administrador de un negocio ahora se usa el usuario (no el email).', super: true },
      { t: 'SuperAdmin: mejoras de visualización en celular.', super: true },
    ],
  },
  {
    version: '2.0.0',
    fecha: '2026-03-24',
    titulo: 'Sistema de planes y base estable',
    cambios: [
      { t: 'Sistema de planes (Estándar y Premium) con límites de productos y usuarios.' },
      { t: 'Punto de venta con modo offline y atajos de teclado.' },
      { t: 'Reportes, control de caja y cuentas corrientes.' },
      { t: 'Panel SuperAdmin para gestión de negocios.', super: true },
    ],
  },
];
