// =============================================
// ARCHIVO: src/tutoriales.js
// Contenido de los tutoriales del sistema (uno por módulo/sección).
// Se muestra en el menú "📚 Tutoriales". El contenido está separado de la vista:
// el componente Tutoriales.jsx lee este arreglo y arma las tarjetas + el visor.
//
// CÓMO AGREGAR/EDITAR UN TUTORIAL:
//   Agregá o editá un objeto en TUTORIALES con:
//     - id: identificador único (también se usa para el nombre de las imágenes)
//     - icono: emoji (mismo que usa el menú lateral)
//     - titulo, resumen: texto corto para la tarjeta
//     - color: par de gradiente Tailwind para la tarjeta (ej. 'from-emerald-500 to-green-600')
//     - gating: quién ve la tarjeta (mismo criterio que el menú lateral):
//         { siempre:true } | { permiso:'productos' } | { rolAdmin:true } | { funcion:'multinegocio' }
//     - pro: true  → muestra un badge "★ PRO" (función premium)
//     - intro: 1-2 frases de para qué sirve la sección
//     - pasos: [{ titulo, texto, imagen? }]  (imagen opcional: '/tutoriales/<archivo>.png')
//     - tips: [ '...' ]  (consejos útiles)
//     - erroresComunes: [ '...' ]  (qué mirar si algo no sale)
//
// LAS IMÁGENES van en frontend/public/tutoriales/ y se referencian como
// '/tutoriales/archivo.png'. Si una imagen no existe, el visor simplemente no la muestra.
// =============================================

export const TUTORIALES = [
  {
    id: 'pos',
    icono: '🛒',
    titulo: 'Punto de Venta',
    resumen: 'Cargar productos, cobrar y facturar una venta.',
    color: 'from-emerald-500 to-green-600',
    gating: { siempre: true },
    intro: 'El Punto de Venta (POS) es la pantalla principal para vender: buscás productos, armás la venta y cobrás. Se entra desde el botón "🛒 Punto de Venta" arriba del menú.',
    pasos: [
      { titulo: 'Abrí la caja del día', texto: 'La primera vez del día te pide abrir la caja con el monto inicial (el efectivo con el que arrancás). Escribí el monto y confirmá. Sin la caja abierta no podés cobrar en efectivo.', imagen: '/tutoriales/pos-1.png' },
      { titulo: 'Buscá y agregá productos', texto: 'Escribí el nombre o código en el buscador (o escaneá el código de barras). Tocá el producto para sumarlo al carrito. Podés cambiar la cantidad con los botones + / − o escribiéndola.', imagen: '/tutoriales/pos-2.png' },
      { titulo: 'Revisá el total', texto: 'A la derecha ves el detalle y el total. Podés aplicar un descuento o recargo si tu configuración lo permite, y quitar un ítem con la papelera.' },
      { titulo: 'Cobrá', texto: 'Tocá "Cobrar", elegí el medio de pago (efectivo, tarjeta, transferencia…) y, si es efectivo, ingresá con cuánto paga el cliente para que calcule el vuelto. Confirmá.', imagen: '/tutoriales/pos-3.png' },
      { titulo: '(Opcional) Facturá', texto: 'Si tenés la facturación electrónica activa, podés emitir la factura en el mismo cobro: elegí el tipo de comprobante y, si hace falta, cargá el CUIT/DNI del cliente. Sale con CAE real de AFIP.' },
    ],
    tips: [
      'Podés tener varias ventas abiertas en pestañas al mismo tiempo (útil si atendés a más de un cliente).',
      'El lector de código de barras funciona como si tipearas: enfocá el buscador y escaneá.',
      'Al terminar el día, cerrá la caja para ver el resumen y el arqueo.',
    ],
    erroresComunes: [
      'Si no te deja cobrar en efectivo, es porque la caja no está abierta.',
      'Si un producto no aparece, revisá que esté activo y con stock (o activá "vender sin stock" en Configuración).',
    ],
  },
  {
    id: 'dashboard',
    icono: '📊',
    titulo: 'Dashboard',
    resumen: 'El resumen del negocio de un vistazo.',
    color: 'from-sky-500 to-blue-600',
    gating: { permiso: 'dashboard' },
    intro: 'El Dashboard es la pantalla de inicio: muestra las métricas clave del negocio (ventas del día, del mes, productos con poco stock, etc.) en tarjetas.',
    pasos: [
      { titulo: 'Mirá los números del día', texto: 'Arriba ves las ventas de hoy, la cantidad de operaciones y otros indicadores. Se actualizan solos.', imagen: '/tutoriales/dashboard-1.png' },
      { titulo: 'Tocá una tarjeta para ir al detalle', texto: 'Varias tarjetas son clickeables y te llevan directo a la sección relacionada (por ejemplo, stock bajo te lleva al listado de productos a reponer).' },
    ],
    tips: [
      'Usalo cada mañana para tener el pulso del negocio en 5 segundos.',
      'Las tarjetas de "stock bajo" te avisan qué reponer antes de quedarte sin mercadería.',
    ],
    erroresComunes: [
      'Si un número se ve en cero, puede ser que todavía no haya ventas registradas en ese período.',
    ],
  },
  {
    id: 'productos',
    icono: '📦',
    titulo: 'Productos',
    resumen: 'Cargar y editar los productos que vendés.',
    color: 'from-violet-500 to-purple-600',
    gating: { permiso: 'productos' },
    intro: 'En Productos cargás todo lo que vendés: nombre, precio, costo, código, categoría y stock. Es la base del sistema.',
    pasos: [
      { titulo: 'Creá un producto', texto: 'Tocá "Nuevo producto", completá nombre, precio de venta y (recomendado) el costo. Podés asignarle una categoría, un código de barras y una imagen.', imagen: '/tutoriales/productos-1.png' },
      { titulo: 'Definí el stock', texto: 'Cargá el stock inicial y, si querés, un stock mínimo para que el sistema te avise cuando esté por agotarse.' },
      { titulo: 'Editá cuando cambie el precio', texto: 'Tocá un producto de la lista para editarlo. Podés cambiar precio, costo, categoría, etc. Los cambios se aplican a las próximas ventas.', imagen: '/tutoriales/productos-2.png' },
      { titulo: 'Buscá y filtrá', texto: 'Usá el buscador por nombre o código y los filtros por categoría para encontrar productos rápido.' },
    ],
    tips: [
      'Cargar el costo te permite ver la ganancia real en los reportes.',
      'El código de barras acelera muchísimo la venta en el POS.',
      'Si vendés por peso o unidad suelta, configurá la unidad correspondiente.',
    ],
    erroresComunes: [
      'Si un producto no aparece en el POS, fijate que esté "activo".',
      'Precios con coma vs punto: usá el separador que muestra el campo para evitar errores.',
    ],
  },
  {
    id: 'categorias',
    icono: '🏷️',
    titulo: 'Categorías',
    resumen: 'Organizar los productos por rubro.',
    color: 'from-amber-500 to-orange-600',
    gating: { permiso: 'productos' },
    intro: 'Las categorías agrupan tus productos (ej. Bebidas, Limpieza, Almacén). Ayudan a filtrar, ordenar y a leer mejor los reportes.',
    pasos: [
      { titulo: 'Creá una categoría', texto: 'Tocá "Nueva categoría", ponele un nombre y guardá. Podés crear todas las que necesites.', imagen: '/tutoriales/categorias-1.png' },
      { titulo: 'Asigná productos', texto: 'Al crear o editar un producto, elegí su categoría. Un producto pertenece a una categoría.' },
    ],
    tips: [
      'Pocas categorías claras funcionan mejor que muchas muy específicas.',
      'Los reportes por categoría te muestran qué rubro vende más.',
    ],
    erroresComunes: [
      'Si borrás una categoría con productos, esos productos quedan sin categoría: reasignálos.',
    ],
  },
  {
    id: 'stock',
    icono: '📉',
    titulo: 'Stock',
    resumen: 'Controlar existencias y reponer.',
    color: 'from-rose-500 to-red-600',
    gating: { permiso: 'stock' },
    intro: 'En Stock ves cuánto tenés de cada producto, ajustás cantidades y cargás mercadería nueva cuando llega una compra.',
    pasos: [
      { titulo: 'Revisá las existencias', texto: 'La lista muestra el stock actual de cada producto. Los que están por debajo del mínimo aparecen resaltados.', imagen: '/tutoriales/stock-1.png' },
      { titulo: 'Sumá stock (entrada de mercadería)', texto: 'Cuando llega una compra, usá "Agregar stock" para sumar las cantidades recibidas. Así el sistema queda actualizado.', imagen: '/tutoriales/stock-2.png' },
      { titulo: 'Ajustá diferencias', texto: 'Si hiciste un conteo y hay diferencias (roturas, faltantes), ajustá la cantidad para que el stock refleje la realidad.' },
    ],
    tips: [
      'Cargá la mercadería apenas llega para no vender en negativo.',
      'El stock mínimo por producto activa los avisos de reposición.',
    ],
    erroresComunes: [
      'Si el stock no coincide, revisá si hubo ventas sin registrar o entradas sin cargar.',
    ],
  },
  {
    id: 'reportes',
    icono: '📈',
    titulo: 'Reportes',
    resumen: 'Ver ventas, ganancias e historial.',
    color: 'from-teal-500 to-emerald-600',
    gating: { permiso: 'reportes' },
    intro: 'En Reportes ves el historial de ventas y estadísticas: cuánto vendiste, qué productos, por categoría, por medio de pago y tu ganancia.',
    pasos: [
      { titulo: 'Elegí el período', texto: 'Seleccioná el rango de fechas (hoy, esta semana, este mes o un rango a medida) para ver los datos de ese lapso.', imagen: '/tutoriales/reportes-1.png' },
      { titulo: 'Mirá los productos más vendidos', texto: 'El reporte por producto te muestra qué se vende más y cuánto dejó de ganancia (si cargaste los costos).' },
      { titulo: 'Exportá', texto: 'Podés exportar a Excel o PDF para guardar o compartir la información.', imagen: '/tutoriales/reportes-2.png' },
    ],
    tips: [
      'Compará mes contra mes para ver si el negocio crece.',
      'La ganancia real depende de tener bien cargados los costos de los productos.',
    ],
    erroresComunes: [
      'Si la ganancia se ve mal, probablemente falten costos en algunos productos.',
    ],
  },
  {
    id: 'caja',
    icono: '🏦',
    titulo: 'Control de Caja',
    resumen: 'Abrir, cerrar y arquear la caja.',
    color: 'from-lime-500 to-green-600',
    gating: { permiso: 'caja' },
    intro: 'Control de Caja lleva el registro del efectivo: apertura con el monto inicial, movimientos del día y cierre con el arqueo (lo que debería haber vs lo que hay).',
    pasos: [
      { titulo: 'Abrí la caja', texto: 'Al empezar el día, abrí la caja con el efectivo inicial. Todas las ventas y movimientos quedan asociados a ese turno.', imagen: '/tutoriales/caja-1.png' },
      { titulo: 'Registrá movimientos', texto: 'Podés cargar ingresos o egresos de efectivo que no son ventas (ej. pago a un proveedor, retiro).' },
      { titulo: 'Cerrá y arqueá', texto: 'Al terminar, cerrá la caja: el sistema te muestra cuánto debería haber. Contás el efectivo real y registrás la diferencia si la hay.', imagen: '/tutoriales/caja-2.png' },
    ],
    tips: [
      'Cerrá la caja todos los días para detectar diferencias a tiempo.',
      'Registrar los retiros/pagos en efectivo mantiene el arqueo prolijo.',
    ],
    erroresComunes: [
      'Una diferencia grande suele ser un movimiento de efectivo no registrado.',
    ],
  },
  {
    id: 'cuentas-corrientes',
    icono: '👥',
    titulo: 'Cuentas Corrientes',
    resumen: 'Clientes que compran fiado y sus saldos.',
    color: 'from-cyan-500 to-sky-600',
    gating: { permiso: 'clientes' },
    intro: 'Acá manejás a los clientes que compran en cuenta corriente (fiado): cuánto deben, su historial y los pagos que hacen.',
    pasos: [
      { titulo: 'Creá el cliente', texto: 'Cargá el cliente con su nombre y datos de contacto. Podés asignarle un límite de crédito.', imagen: '/tutoriales/cuentas-1.png' },
      { titulo: 'Vendé en cuenta corriente', texto: 'En el POS, al cobrar, elegí "cuenta corriente" y seleccioná el cliente. La venta se suma a su deuda.' },
      { titulo: 'Registrá un pago', texto: 'Cuando el cliente paga (todo o una parte), registrá el pago en su cuenta para bajar el saldo.', imagen: '/tutoriales/cuentas-2.png' },
    ],
    tips: [
      'Revisá periódicamente los saldos para no acumular deuda incobrable.',
      'El historial de cada cliente te muestra qué compró y qué pagó.',
    ],
    erroresComunes: [
      'Si un saldo no cierra, revisá que los pagos se hayan registrado en el cliente correcto.',
    ],
  },
  {
    id: 'proveedores',
    icono: '🚚',
    titulo: 'Proveedores',
    resumen: 'Tus proveedores, compras y pagos.',
    color: 'from-indigo-500 to-violet-600',
    gating: { permiso: 'proveedores' },
    intro: 'En Proveedores registrás a quién le comprás mercadería, las compras y los pagos que les hacés.',
    pasos: [
      { titulo: 'Cargá el proveedor', texto: 'Creá el proveedor con su nombre y contacto.', imagen: '/tutoriales/proveedores-1.png' },
      { titulo: 'Registrá compras y pagos', texto: 'Anotá las compras que le hacés y los pagos, para llevar el saldo de lo que le debés.' },
      { titulo: 'Consultá el historial', texto: 'Cada proveedor tiene su historial de compras y pagos para que sepas cómo estás con él.' },
    ],
    tips: [
      'Tener el saldo con cada proveedor te evita pagar de más o de menos.',
    ],
    erroresComunes: [
      'Si el saldo con un proveedor no coincide, revisá compras o pagos sin registrar.',
    ],
  },
  {
    id: 'gastos',
    icono: '💸',
    titulo: 'Gastos',
    resumen: 'Registrar los gastos del negocio.',
    color: 'from-fuchsia-500 to-pink-600',
    gating: { permiso: 'gastos' },
    intro: 'En Gastos anotás lo que gastás para operar (alquiler, servicios, sueldos, mercadería, etc.). Sirve para saber la ganancia real.',
    pasos: [
      { titulo: 'Cargá un gasto', texto: 'Tocá "Nuevo gasto", poné el monto, una descripción y la categoría/tipo de gasto.', imagen: '/tutoriales/gastos-1.png' },
      { titulo: 'Mirá el total del período', texto: 'Podés ver cuánto gastaste en un rango de fechas y por tipo de gasto.' },
    ],
    tips: [
      'Registrar los gastos hace que los reportes muestren la ganancia neta real, no solo lo vendido.',
    ],
    erroresComunes: [
      'No mezcles gastos personales con los del negocio: cargá solo los del negocio.',
    ],
  },
  {
    id: 'usuarios',
    icono: '👤',
    titulo: 'Usuarios y permisos',
    resumen: 'Crear cajeros y definir qué puede hacer cada uno.',
    color: 'from-slate-500 to-gray-700',
    gating: { rolAdmin: true },
    intro: 'En Usuarios creás las cuentas de tu equipo (cajeros, encargados) y elegís a qué secciones puede entrar cada uno.',
    pasos: [
      { titulo: 'Creá un usuario', texto: 'Tocá "Nuevo usuario", ponele nombre de usuario y contraseña. Ese usuario entra en el mismo negocio.', imagen: '/tutoriales/usuarios-1.png' },
      { titulo: 'Definí los permisos', texto: 'Marcá a qué módulos puede acceder (por ejemplo, un cajero solo al POS y a la caja, sin ver reportes ni configuración).', imagen: '/tutoriales/usuarios-2.png' },
      { titulo: 'Editá o desactivá', texto: 'Podés cambiar permisos o desactivar un usuario cuando alguien deja de trabajar, sin perder su historial.' },
    ],
    tips: [
      'Dale a cada persona solo los permisos que necesita para su tarea.',
      'Cada usuario tiene su propia clave: así sabés quién hizo cada venta.',
    ],
    erroresComunes: [
      'Si un empleado no ve una sección, revisá sus permisos acá.',
    ],
  },
  {
    id: 'configuracion',
    icono: '⚙️',
    titulo: 'Configuración',
    resumen: 'Datos del negocio, color, y opciones del sistema.',
    color: 'from-gray-500 to-slate-700',
    gating: { rolAdmin: true },
    intro: 'En Configuración ajustás los datos del negocio (nombre, logo), el color del sistema, y opciones como "vender sin stock", medios de pago, tema oscuro y la facturación electrónica.',
    pasos: [
      { titulo: 'Cargá los datos del negocio', texto: 'Nombre, dirección y logo. Aparecen en tickets y en la pantalla.', imagen: '/tutoriales/configuracion-1.png' },
      { titulo: 'Elegí el color y el tema', texto: 'Podés personalizar el color principal del sistema y activar el modo oscuro.' },
      { titulo: 'Activá opciones útiles', texto: 'Por ejemplo "vender sin stock" (para no frenar la venta si falta cargar mercadería) u otras preferencias de venta.' },
    ],
    tips: [
      'El color y el logo hacen que el sistema se sienta "tuyo" y quede prolijo en los tickets.',
    ],
    erroresComunes: [
      'Si un cambio no se ve, refrescá la página; algunos ajustes se aplican al recargar.',
    ],
  },
  {
    id: 'facturacion',
    icono: '🧾',
    titulo: 'Facturación Electrónica',
    resumen: 'Emitir facturas con CAE de AFIP/ARCA.',
    color: 'from-blue-500 to-indigo-600',
    gating: { rolAdmin: true },
    pro: true,
    intro: 'La facturación electrónica te deja emitir comprobantes oficiales (con CAE de AFIP). Se configura una vez, dentro de Configuración, y después facturás desde el POS.',
    pasos: [
      { titulo: 'Elegí el modo de conexión', texto: 'Hay dos: "Certificado propio" (subís tu certificado de AFIP) o "Conexión rápida" (delegás la facturación en el sistema, sin sacar tu propio certificado). La conexión rápida es la más simple.', imagen: '/tutoriales/facturacion-1.png' },
      { titulo: 'Cargá tus datos fiscales', texto: 'CUIT, punto de venta y condición frente al IVA (monotributista, responsable inscripto, etc.).' },
      { titulo: 'Probá la conexión', texto: 'Usá "Probar conexión" para confirmar que AFIP responde y todo quedó bien configurado.', imagen: '/tutoriales/facturacion-2.png' },
      { titulo: 'Facturá desde el POS', texto: 'Al cobrar, elegí emitir factura, seleccioná el tipo de comprobante y (si hace falta) cargá el CUIT/DNI del cliente. El comprobante sale con CAE real.' },
    ],
    tips: [
      'Con "conexión rápida" no necesitás generar tu propio certificado: es lo más rápido para arrancar.',
      'Monotributistas emiten Factura C (sin IVA discriminado).',
    ],
    erroresComunes: [
      'Si AFIP rechaza, suele ser por el certificado/CUIT o porque falta habilitar el punto de venta en AFIP.',
      'La fecha del comprobante no puede ser anterior a la del último emitido en ese punto de venta.',
    ],
  },
  {
    id: 'resumen-fiscal',
    icono: '🧮',
    titulo: 'Resumen Fiscal',
    resumen: 'Ver lo facturado para tus impuestos.',
    color: 'from-emerald-500 to-teal-700',
    gating: { permiso: 'resumen_fiscal' },
    pro: true,
    intro: 'El Resumen Fiscal reúne lo que facturaste en un período para ayudarte con la parte impositiva (por ejemplo, controlar el monotributo).',
    pasos: [
      { titulo: 'Elegí el período', texto: 'Seleccioná el mes o rango que querés analizar.', imagen: '/tutoriales/resumen-fiscal-1.png' },
      { titulo: 'Revisá los totales', texto: 'Ves el total facturado y el detalle de comprobantes, útil para tu contador o para controlar tus topes.' },
    ],
    tips: [
      'Controlá el acumulado para no pasarte de categoría en el monotributo.',
    ],
    erroresComunes: [
      'El resumen toma solo lo facturado electrónicamente; las ventas sin factura no cuentan acá.',
    ],
  },
  {
    id: 'prediccion-compras',
    icono: '🛒',
    titulo: 'Predicción de compras',
    resumen: 'Cuánto reponer para no quedarte sin stock.',
    color: 'from-orange-500 to-amber-600',
    gating: { funcion: 'prediccion_compras' },
    pro: true,
    intro: 'La Predicción de compras te sugiere cuánto comprar de cada producto para reponer lo que se vende, mirando el patrón por día de la semana (si mañana es martes, mira los martes).',
    pasos: [
      { titulo: 'Elegí qué cubrir', texto: 'Indicá si querés reponer para mañana o para los próximos días, y cuántas semanas de historial analizar.', imagen: '/tutoriales/prediccion-1.png' },
      { titulo: 'Mirá la sugerencia', texto: 'La tabla muestra, por producto, cuánto se vende ese día y cuánto conviene comprar (con un colchón de seguridad).' },
      { titulo: 'Exportá la lista', texto: 'Podés exportar la lista de compra sugerida a Excel o PDF para llevarla al proveedor.' },
    ],
    tips: [
      'Se basa en lo vendido, no en el stock: reponés lo que realmente sale.',
      'Respeta el día de la semana: no es lo mismo un martes que un sábado.',
    ],
    erroresComunes: [
      'Con poco historial, la sugerencia es menos precisa (aparece un aviso de "baja confianza").',
    ],
  },
  {
    id: 'multinegocio',
    icono: '🔁',
    titulo: 'Movimiento de mercadería',
    resumen: 'Enviar y recibir stock entre tus negocios.',
    color: 'from-purple-500 to-fuchsia-600',
    gating: { funcion: 'multinegocio' },
    pro: true,
    intro: 'Si tenés más de un local vinculado, podés mover mercadería entre ellos: uno envía y el otro recibe, y el stock se ajusta en ambos.',
    pasos: [
      { titulo: 'Enviá mercadería', texto: 'Desde el POS (Movimientos) elegí el negocio destino, agregá los productos y las cantidades, y confirmá el envío. El envío queda "en proceso".', imagen: '/tutoriales/multinegocio-1.png' },
      { titulo: 'Recibí en el otro local', texto: 'En "Movimiento de mercadería" el local destino ve el envío, tilda lo que llegó y confirma la recepción. Recién ahí se mueve el stock.', imagen: '/tutoriales/multinegocio-2.png' },
      { titulo: 'Seguí el historial', texto: 'Cada movimiento muestra su estado (en proceso, recibido, parcial), quién envió y quién recibió, con filtros y reimpresión del remito.' },
    ],
    tips: [
      'Lo que envía un local no se descuenta hasta que el otro confirma qué recibió: así no se pierde stock.',
      'El remito sirve para acompañar la mercadería en el traslado.',
    ],
    erroresComunes: [
      'Si el stock no se movió, es porque el envío todavía está "en proceso" (falta que el destino lo reciba).',
    ],
  },
];
