// =============================================
// ARCHIVO: src/tutoriales.js
// Contenido de los tutoriales del sistema (uno por módulo/sección).
// Se muestra en el menú "📚 Tutoriales". El contenido está separado de la vista:
// el componente Tutoriales.jsx lee este arreglo y arma las tarjetas + el visor.
//
// CÓMO AGREGAR/EDITAR UN TUTORIAL: agregá/editá un objeto en TUTORIALES con:
//   - id, icono, titulo, resumen, color (gradiente Tailwind de la tarjeta)
//   - gating: quién ve la tarjeta (igual que el menú lateral):
//       { siempre:true } | { permiso:'productos' } | { rolAdmin:true } | { funcion:'multinegocio' }
//   - pro: true  → badge "★ PRO" (función premium)
//   - intro: explicación simple de para qué sirve
//   - beneficios: [ '...' ]  → lista de "para qué te sirve" (ventajas)
//   - pasos: [{ titulo, texto, imagen? }]  (imagen: '/tutoriales/<archivo>.png', opcional)
//   - tips: [ '...' ]  ·  erroresComunes: [ '...' ]
//
// LAS IMÁGENES van en frontend/public/tutoriales/ y se referencian como
// '/tutoriales/archivo.png'. Si una imagen no existe, el visor la oculta sola.
// =============================================

export const TUTORIALES = [
  {
    id: 'pos',
    icono: '🛒',
    titulo: 'Punto de Venta',
    resumen: 'El corazón del negocio: vender y cobrar.',
    color: 'from-emerald-500 to-green-600',
    gating: { siempre: true },
    intro: 'El Punto de Venta (POS) es la pantalla donde vendés. Es como la caja registradora, pero mucho más inteligente: buscás lo que el cliente lleva, el sistema suma solo, calcula el vuelto y, si querés, hace la factura. Entrás desde el botón "🛒 Punto de Venta" arriba de todo.',
    beneficios: [
      'Vendés rapidísimo: escribís o escaneás y listo, no hay que calcular nada a mano.',
      'Calcula el total y el vuelto solo, así no te equivocás dando el cambio.',
      'Descuenta el stock automáticamente en cada venta: siempre sabés cuánto te queda.',
      'Aceptás muchos medios de pago (efectivo, tarjeta, transferencia, Mercado Pago, fiado).',
      'Podés atender a varios clientes a la vez con pestañas de venta separadas.',
      'Si tenés facturación, emitís la factura oficial en el mismo momento de cobrar.',
    ],
    pasos: [
      { titulo: 'Abrí tu caja', texto: 'Al empezar el turno elegís tu caja (mañana, tarde, etc.) y tocás para abrirla o unirte. Es como decir "ya estoy atendiendo". Sin caja abierta no podés cobrar en efectivo.', imagen: '/tutoriales/pos-1.png' },
      { titulo: 'Buscá el producto', texto: 'Escribí el nombre o el código en el buscador de arriba, o pasá el producto por el lector de código de barras. Van apareciendo las coincidencias.', imagen: '/tutoriales/pos-2.png' },
      { titulo: 'Agregalo al carrito', texto: 'Tocá el producto y se suma a la venta (la lista de la derecha). Si el cliente lleva 3 iguales, poné la cantidad con los botones + y − o escribiéndola.' },
      { titulo: 'Revisá el total', texto: 'Abajo a la derecha ves el total. Si hace falta, podés hacer un descuento o un recargo, o sacar un producto con la papelera.' },
      { titulo: 'Cobrá', texto: 'Tocá "Confirmar Venta", elegí cómo paga el cliente (efectivo, tarjeta, transferencia…). Si es efectivo, escribí con cuánto paga y el sistema te dice el vuelto exacto.' },
      { titulo: '(Si querés) Facturá', texto: 'Si tenés la facturación activa, podés emitir la factura en el mismo cobro: elegís el tipo y, si hace falta, cargás el CUIT o DNI del cliente. Sale oficial, con número de AFIP.' },
    ],
    tips: [
      'El lector de código de barras funciona como si escribieras: parate en el buscador y escaneá.',
      'Con las pestañas de arriba tenés varias ventas abiertas a la vez (por si un cliente va a buscar algo más).',
      'Hay atajos de teclado (F1 venta rápida, F8 confirmar, etc.) que te hacen volar.',
      'Al terminar el día, cerrá la caja para ver el arqueo (cuánto debería haber de efectivo).',
    ],
    erroresComunes: [
      'Si no te deja cobrar en efectivo, es porque todavía no abriste la caja.',
      'Si un producto no aparece, fijate que esté activo y con stock (o activá "vender sin stock" en Configuración).',
    ],
  },
  {
    id: 'dashboard',
    icono: '📊',
    titulo: 'Dashboard (Inicio)',
    resumen: 'Cómo va tu negocio, de un vistazo.',
    color: 'from-sky-500 to-blue-600',
    gating: { permiso: 'dashboard' },
    intro: 'El Dashboard es la pantalla de inicio. Es como la foto del día de tu negocio: cuánto vendiste, por qué medio te pagaron, cuánto gastaste y cuánta ganancia hiciste. Todo en tarjetas grandes y fáciles de leer, sin tener que buscar nada.',
    beneficios: [
      'En 5 segundos sabés cómo viene el día y el mes, sin hacer cuentas.',
      'Ves cuánto entró por cada medio de pago (efectivo, tarjeta, transferencia, Mercado Pago).',
      'Te muestra la ganancia real (lo que vendiste menos costos y gastos), no solo la plata que entró.',
      'Te avisa lo importante: productos con poco stock, deudas de clientes, gastos del día.',
      'Las tarjetas son botones: tocás una y te lleva directo al detalle.',
    ],
    pasos: [
      { titulo: 'Mirá el resumen del día', texto: 'Arriba tenés el total vendido hoy, cuántas ventas hiciste y el ticket promedio (cuánto gasta en promedio cada cliente). Se actualiza solo.', imagen: '/tutoriales/dashboard-1.png' },
      { titulo: 'Fijate por dónde entra la plata', texto: 'Las tarjetas de efectivo, transferencias, tarjetas y Mercado Pago te muestran cuánto cobraste por cada uno.' },
      { titulo: 'Controlá el mes', texto: 'Más abajo ves las ventas del mes, los gastos del mes y la ganancia neta real. Así sabés si el negocio te está dejando plata.' },
      { titulo: 'Tocá una tarjeta para el detalle', texto: 'Por ejemplo, "Ventas del mes" te lleva a Reportes, y "Deudas totales" a Cuentas Corrientes.' },
    ],
    tips: [
      'Miralo cada mañana: es la forma más rápida de tomarle el pulso al negocio.',
      'Para que la "ganancia real" sea exacta, cargá bien el costo de tus productos y tus gastos.',
    ],
    erroresComunes: [
      'Si ves todo en cero, puede ser que todavía no haya ventas cargadas en ese período.',
    ],
  },
  {
    id: 'productos',
    icono: '📦',
    titulo: 'Productos',
    resumen: 'Todo lo que vendés, cargado y ordenado.',
    color: 'from-violet-500 to-purple-600',
    gating: { permiso: 'productos' },
    intro: 'Productos es la lista de todo lo que vendés, con su precio, su costo, su código y cuánto tenés de cada uno. Es la base de todo: cuanto mejor cargados estén tus productos, mejor funciona el resto (las ventas son más rápidas y los números salen bien).',
    beneficios: [
      'Vender es más rápido: el producto ya tiene precio y código cargados.',
      'Sabés cuánto ganás con cada cosa (si cargás el costo, el sistema calcula la ganancia).',
      'Podés cambiar precios en segundos, de a uno o de a muchos juntos.',
      'Cargás productos en masa desde una planilla de Excel (ideal para arrancar).',
      'Los organizás por categoría y les ponés foto para encontrarlos rápido.',
      'El sistema te marca los que tienen poco stock para que repongas a tiempo.',
    ],
    pasos: [
      { titulo: 'Creá un producto', texto: 'Tocá "+ Nuevo Producto". Completá el nombre y el precio de venta. Muy recomendable cargar también el costo (lo que te sale a vos) para ver la ganancia.', imagen: '/tutoriales/productos-1.png' },
      { titulo: 'Ponele código y categoría', texto: 'Cargá el código de barras (así lo escaneás al vender) y elegí una categoría (Bebidas, Limpieza, etc.). También podés subirle una foto.' },
      { titulo: 'Cargá el stock', texto: 'Poné cuánto tenés hoy y, si querés, un "stock mínimo": cuando baje de ese número, el sistema te avisa que hay que reponer.' },
      { titulo: 'Editá cuando cambie el precio', texto: 'Tocá un producto de la lista (o el botón "Editar") y cambiá lo que necesites. Con "Actualizar precios" podés subir varios a la vez.', imagen: '/tutoriales/productos-2.png' },
      { titulo: 'Buscá y filtrá', texto: 'Usá el buscador por nombre o código, o los filtros por categoría y "Stock bajo" para encontrar productos al toque.' },
    ],
    tips: [
      'Cargar el costo es la clave para ver la ganancia real en el Dashboard y en Reportes.',
      'Si tenés muchos productos, usá "Importar Excel" para cargarlos todos juntos.',
      'El código de barras es lo que hace que vender sea instantáneo.',
    ],
    erroresComunes: [
      'Si un producto no aparece al vender, fijate que esté "activo".',
      'Ojo con el precio: usá el separador de decimales que muestra el campo para no equivocarte.',
    ],
  },
  {
    id: 'categorias',
    icono: '🏷️',
    titulo: 'Categorías',
    resumen: 'Ordenar los productos por rubro.',
    color: 'from-amber-500 to-orange-600',
    gating: { permiso: 'productos' },
    intro: 'Las categorías son como cajones para ordenar tus productos: Bebidas, Limpieza, Almacén, Golosinas… Sirven para encontrar las cosas más rápido y para entender qué rubro te vende más.',
    beneficios: [
      'Encontrás los productos más rápido, tanto para vender como para editar.',
      'Los reportes por categoría te muestran qué rubro deja más plata.',
      'En el Punto de Venta podés filtrar por categoría para ubicar un producto.',
      'Mantenés todo prolijo aunque tengas cientos de productos.',
    ],
    pasos: [
      { titulo: 'Creá una categoría', texto: 'Tocá "Nueva categoría", ponele un nombre claro (por ejemplo "Bebidas sin alcohol") y guardá.', imagen: '/tutoriales/categorias-1.png' },
      { titulo: 'Asigná los productos', texto: 'Cuando creás o editás un producto, elegís a qué categoría pertenece. Un producto va en una sola categoría.' },
      { titulo: 'Usalas para filtrar', texto: 'En Productos y en el POS podés filtrar por categoría para ver solo ese grupo.' },
    ],
    tips: [
      'Pocas categorías claras funcionan mejor que muchas súper específicas.',
      'Pensá las categorías como las pondría el cliente en la cabeza, así es más fácil.',
    ],
    erroresComunes: [
      'Si borrás una categoría que tenía productos, esos productos quedan sin categoría: acordate de reasignarlos.',
    ],
  },
  {
    id: 'stock',
    icono: '📉',
    titulo: 'Stock',
    resumen: 'Saber cuánto tenés y reponer a tiempo.',
    color: 'from-rose-500 to-red-600',
    gating: { permiso: 'stock' },
    intro: 'Stock es el control de cuánto te queda de cada producto. Cada venta descuenta solo, y cuando llega mercadería nueva la sumás. Así nunca te agarrás desprevenido: sabés qué falta antes de quedarte sin nada.',
    beneficios: [
      'Sabés en todo momento cuánto te queda de cada cosa.',
      'Te avisa cuáles están por agotarse para que repongas a tiempo.',
      'Cargás la mercadería que llega en un par de toques.',
      'Ajustás diferencias (roturas, faltantes) para que el número sea real.',
      'Ves el stock agrupado por secciones para revisarlo más ordenado.',
    ],
    pasos: [
      { titulo: 'Revisá las existencias', texto: 'La lista muestra cuánto tenés de cada producto. Los que están bajos aparecen resaltados, y arriba ves un cartel de "X con stock bajo".', imagen: '/tutoriales/stock-1.png' },
      { titulo: 'Sumá lo que llega', texto: 'Cuando recibís una compra, tocá "📥 Agregar stock" y sumá las cantidades que entraron. Listo, el sistema queda al día.' },
      { titulo: 'Ajustá diferencias', texto: 'Si contaste y hay diferencias (se rompió algo, faltó algo), corregí la cantidad para que el stock refleje la realidad.' },
      { titulo: 'Mirá lo vendido por sección', texto: 'Con "📊 Vendidos por sección" ves qué salió más en un rango de fechas, útil para decidir qué reponer.' },
    ],
    tips: [
      'Cargá la mercadería apenas llega, así no vendés algo que "no tenés" en el sistema.',
      'Ponele stock mínimo a los productos importantes para que te avise antes de quedarte sin ellos.',
    ],
    erroresComunes: [
      'Si el stock no coincide con la realidad, suele ser por ventas no registradas o compras sin cargar.',
    ],
  },
  {
    id: 'reportes',
    icono: '📈',
    titulo: 'Reportes',
    resumen: 'Ver cuánto vendiste y cuánto ganaste.',
    color: 'from-teal-500 to-emerald-600',
    gating: { permiso: 'reportes' },
    intro: 'Reportes es donde ves los números de tu negocio: cuánto vendiste, qué productos, por qué medio de pago te pagaron y cuánta ganancia hiciste. Podés mirar un día, una semana, un mes o el rango que quieras.',
    beneficios: [
      'Sabés exactamente cuánto vendiste en el período que elijas.',
      'Descubrís cuáles son tus productos estrella (los que más venden y más dejan).',
      'Ves la ganancia real, no solo la plata que entró.',
      'Comparás períodos para saber si el negocio crece.',
      'Exportás todo a Excel o PDF para guardarlo o mandárselo al contador.',
    ],
    pasos: [
      { titulo: 'Elegí el período', texto: 'Arriba elegís qué querés ver: Hoy, Por día, Por mes o un Rango de fechas a medida. Todo lo de abajo se ajusta a eso.', imagen: '/tutoriales/reportes-1.png' },
      { titulo: 'Mirá los más vendidos', texto: 'El reporte por producto te muestra qué se vendió más y cuánto dejó de ganancia (si cargaste los costos).' },
      { titulo: 'Revisá el historial', texto: 'En la pestaña de historial ves cada venta con su detalle: qué se vendió, cuándo y cómo se pagó.' },
      { titulo: 'Exportá', texto: 'Con los botones de Excel o PDF te llevás la información para guardarla o compartirla.' },
    ],
    tips: [
      'Compará este mes con el anterior para ver si vas mejorando.',
      'La ganancia sale bien solo si los productos tienen su costo cargado.',
    ],
    erroresComunes: [
      'Si la ganancia se ve rara, casi siempre es porque a algunos productos les falta el costo.',
    ],
  },
  {
    id: 'caja',
    icono: '🏦',
    titulo: 'Control de Caja',
    resumen: 'Abrir, cerrar y controlar el efectivo.',
    color: 'from-lime-500 to-green-600',
    gating: { permiso: 'caja' },
    intro: 'Control de Caja es el registro del efectivo. Al empezar el turno abrís la caja con la plata que hay, durante el día quedan registradas las ventas y los movimientos, y al final la cerrás para comparar cuánto debería haber contra cuánto hay de verdad (el arqueo).',
    beneficios: [
      'Sabés siempre cuánta plata debería haber en la caja.',
      'Detectás diferencias (faltantes o sobrantes) el mismo día, no a fin de mes.',
      'Cada turno queda separado y sabés quién trabajó en cada uno.',
      'Registrás retiros y pagos en efectivo para que el arqueo cierre.',
      'Manejás varias cajas (mañana, tarde, trasnoche) sin mezclar la plata.',
    ],
    pasos: [
      { titulo: 'Abrí la caja', texto: 'Al empezar, abrí la caja con el efectivo inicial (con lo que arrancás). Todo lo que pase después queda asociado a ese turno.', imagen: '/tutoriales/caja-1.png' },
      { titulo: 'Registrá movimientos', texto: 'Si sacás o metés efectivo que no es una venta (pagar a un proveedor, un retiro), cargalo. Así el número siempre cierra.' },
      { titulo: 'Cerrá y arqueá', texto: 'Al terminar, cerrá la caja: el sistema te dice cuánto debería haber. Contás el efectivo real y, si hay diferencia, queda registrada.' },
    ],
    tips: [
      'Cerrá la caja todos los días: es la mejor forma de detectar problemas a tiempo.',
      'Anotá los retiros de plata apenas los hacés, así no aparecen "diferencias" que en realidad no lo son.',
    ],
    erroresComunes: [
      'Una diferencia grande casi siempre es un movimiento de efectivo que no se registró.',
    ],
  },
  {
    id: 'cuentas-corrientes',
    icono: '👥',
    titulo: 'Cuentas Corrientes',
    resumen: 'Los clientes que compran fiado.',
    color: 'from-cyan-500 to-sky-600',
    gating: { permiso: 'clientes' },
    intro: 'Acá manejás a los clientes que compran "fiado" (en cuenta corriente): les anotás lo que se llevan y cuánto deben, y cuando pagan, lo registrás. Nunca más un cuaderno perdido: el sistema lleva la cuenta de cada uno.',
    beneficios: [
      'Sabés al instante cuánto te debe cada cliente.',
      'Tenés el historial completo: qué compró y qué pagó, con fecha.',
      'Podés ponerle un límite de crédito para no arriesgar de más.',
      'Cobrás pagos parciales o totales y el saldo se actualiza solo.',
      'Se terminó el "me parece que me debe": está todo anotado y claro.',
    ],
    pasos: [
      { titulo: 'Creá el cliente', texto: 'Cargá al cliente con su nombre y un teléfono. Si querés, ponele un límite de cuánto puede deber.', imagen: '/tutoriales/cuentas-1.png' },
      { titulo: 'Vendé en cuenta corriente', texto: 'En el Punto de Venta, al cobrar, elegí "cuenta corriente" y seleccioná al cliente. Esa compra se suma a su deuda.' },
      { titulo: 'Registrá el pago', texto: 'Cuando el cliente te paga (todo o una parte), entrá a su cuenta y registrá el pago. El saldo baja automáticamente.' },
      { titulo: 'Revisá los saldos', texto: 'La lista te muestra quién debe y cuánto, para que puedas hacer el seguimiento.' },
    ],
    tips: [
      'Revisá los saldos seguido para no dejar que las deudas se hagan muy grandes.',
      'El límite de crédito te avisa cuando un cliente ya debe demasiado.',
    ],
    erroresComunes: [
      'Si un saldo no cierra, revisá que los pagos se hayan cargado en el cliente correcto.',
    ],
  },
  {
    id: 'proveedores',
    icono: '🚚',
    titulo: 'Proveedores',
    resumen: 'A quién le comprás y cuánto le debés.',
    color: 'from-indigo-500 to-violet-600',
    gating: { permiso: 'proveedores' },
    intro: 'En Proveedores anotás a quién le comprás mercadería, las compras que les hacés y los pagos. Así sabés siempre cuánto le debés a cada uno y tenés el historial ordenado.',
    beneficios: [
      'Sabés cuánto le debés a cada proveedor, sin sorpresas.',
      'Tenés el historial de compras y pagos de cada uno.',
      'Te organizás para pagar en fecha y mantener buena relación.',
      'Cruzás lo que comprás con lo que vendés para tomar mejores decisiones.',
    ],
    pasos: [
      { titulo: 'Cargá el proveedor', texto: 'Creá el proveedor con su nombre y un contacto (teléfono o correo).', imagen: '/tutoriales/proveedores-1.png' },
      { titulo: 'Anotá compras y pagos', texto: 'Cada vez que le comprás, cargá la compra; cada vez que le pagás, cargá el pago. El saldo se lleva solo.' },
      { titulo: 'Mirá el historial', texto: 'Entrá a un proveedor para ver todo lo que le compraste y le pagaste.' },
    ],
    tips: [
      'Tener el saldo al día evita pagar de más o pagar dos veces.',
    ],
    erroresComunes: [
      'Si el saldo no coincide, seguro falta cargar una compra o un pago.',
    ],
  },
  {
    id: 'gastos',
    icono: '💸',
    titulo: 'Gastos',
    resumen: 'Anotar lo que gastás para trabajar.',
    color: 'from-fuchsia-500 to-pink-600',
    gating: { permiso: 'gastos' },
    intro: 'En Gastos anotás todo lo que gastás para que el negocio funcione: alquiler, luz, sueldos, mercadería, fletes, etc. Es clave para saber la ganancia de verdad, porque no alcanza con mirar lo que entra: también hay que restar lo que sale.',
    beneficios: [
      'Sabés cuánto te cuesta realmente tener el negocio abierto.',
      'La ganancia del Dashboard y de Reportes se vuelve real (ventas menos gastos).',
      'Ves en qué se te va la plata y podés recortar lo que no sirve.',
      'Tenés todo junto y ordenado por tipo de gasto y por fecha.',
    ],
    pasos: [
      { titulo: 'Cargá un gasto', texto: 'Tocá "Nuevo gasto", poné el monto, una descripción corta y el tipo (servicios, sueldos, mercadería, etc.).', imagen: '/tutoriales/gastos-1.png' },
      { titulo: 'Mirá el total', texto: 'Podés ver cuánto gastaste en un período y en qué se te fue la plata.' },
    ],
    tips: [
      'Cargá los gastos apenas los tenés, así no se te olvida ninguno.',
      'No mezcles gastos personales con los del negocio: cargá solo los del negocio.',
    ],
    erroresComunes: [
      'Si la ganancia se ve muy alta, quizás te falten gastos por cargar.',
    ],
  },
  {
    id: 'usuarios',
    icono: '👤',
    titulo: 'Usuarios y permisos',
    resumen: 'Tu equipo y qué puede hacer cada uno.',
    color: 'from-slate-500 to-gray-700',
    gating: { rolAdmin: true },
    intro: 'Acá creás las cuentas de tu equipo (cajeros, encargados) y elegís qué puede ver y hacer cada uno. Por ejemplo, un cajero puede vender pero no ver los reportes ni cambiar la configuración. Cada persona entra con su propio usuario y clave.',
    beneficios: [
      'Cada empleado entra con su usuario: sabés quién hizo cada venta.',
      'Le das a cada uno solo lo que necesita (más seguridad y menos errores).',
      'Protegés la información sensible (reportes, ganancias, configuración).',
      'Si alguien deja de trabajar, lo desactivás sin perder su historial.',
    ],
    pasos: [
      { titulo: 'Creá un usuario', texto: 'Tocá "Nuevo usuario", ponele un nombre de usuario y una contraseña. Ese usuario entra al mismo negocio que vos.', imagen: '/tutoriales/usuarios-1.png' },
      { titulo: 'Elegí los permisos', texto: 'Marcá a qué secciones puede entrar (por ejemplo, solo Punto de Venta y Caja). Lo que no marques, no lo va a ver.' },
      { titulo: 'Editá o desactivá', texto: 'Podés cambiar los permisos cuando quieras, o desactivar a alguien que ya no trabaja, sin borrar lo que hizo.' },
    ],
    tips: [
      'Dale a cada persona lo justo y necesario para su tarea.',
      'Que cada uno tenga su propia clave: así el historial dice la verdad de quién hizo qué.',
    ],
    erroresComunes: [
      'Si un empleado dice que "no le aparece" una sección, revisá sus permisos acá.',
    ],
  },
  {
    id: 'configuracion',
    icono: '⚙️',
    titulo: 'Configuración',
    resumen: 'Ajustar el sistema a tu negocio.',
    color: 'from-gray-500 to-slate-700',
    gating: { rolAdmin: true },
    intro: 'En Configuración dejás el sistema con la cara de tu negocio: cargás el nombre y el logo, elegís el color, y activás opciones útiles como "vender sin stock", el modo oscuro o la facturación electrónica. Se configura una vez y queda listo.',
    beneficios: [
      'El sistema queda personalizado con tu nombre, logo y color.',
      'Activás o desactivás opciones según cómo trabajás vos.',
      'Preparás la facturación electrónica para hacer facturas oficiales.',
      'El modo oscuro cuida la vista si trabajás muchas horas.',
    ],
    pasos: [
      { titulo: 'Cargá los datos del negocio', texto: 'Nombre, dirección y logo. Aparecen en la pantalla y en los tickets, para que todo se vea profesional.', imagen: '/tutoriales/configuracion-1.png' },
      { titulo: 'Elegí color y tema', texto: 'Poné el color principal del sistema (el de tu marca) y, si querés, activá el modo oscuro.' },
      { titulo: 'Activá opciones útiles', texto: 'Por ejemplo "vender sin stock", para que una venta no se frene si te faltó cargar mercadería.' },
      { titulo: 'Configurá la facturación', texto: 'Dentro de Configuración está la Facturación Electrónica (ver el tutorial de Facturación para el paso a paso).' },
    ],
    tips: [
      'Cargar el logo y el color hace que el sistema y los tickets se vean prolijos y tuyos.',
    ],
    erroresComunes: [
      'Si un cambio no se ve al toque, recargá la página: algunos ajustes se aplican al recargar.',
    ],
  },
  {
    id: 'facturacion',
    icono: '🧾',
    titulo: 'Facturación Electrónica',
    resumen: 'Hacer facturas oficiales de AFIP.',
    color: 'from-blue-500 to-indigo-600',
    gating: { rolAdmin: true },
    pro: true,
    intro: 'La facturación electrónica te deja hacer facturas oficiales (con el número CAE que da AFIP) directamente desde el sistema. Se configura una sola vez dentro de Configuración, y después facturás en el mismo momento de cobrar en el Punto de Venta.',
    beneficios: [
      'Hacés facturas legales sin usar otra página ni otro programa.',
      'La factura sale en el mismo momento de la venta, en segundos.',
      'Tenés todos los comprobantes guardados y ordenados para el contador.',
      'Con "conexión rápida" arrancás sin tener que generar tu propio certificado.',
      'Sirve para monotributistas (Factura C) y responsables inscriptos (A/B).',
    ],
    pasos: [
      { titulo: 'Elegí el modo de conexión', texto: 'Hay dos: "Conexión rápida" (la más fácil, delegás la facturación en el sistema) o "Certificado propio" (subís tu propio certificado de AFIP). Para arrancar, conexión rápida.', imagen: '/tutoriales/facturacion-1.png' },
      { titulo: 'Cargá tus datos fiscales', texto: 'Tu CUIT, el punto de venta y tu condición (monotributista, responsable inscripto, etc.).' },
      { titulo: 'Probá la conexión', texto: 'Tocá "Probar conexión": el sistema le pregunta a AFIP si todo está bien. Si sale verde, ya podés facturar.' },
      { titulo: 'Facturá al vender', texto: 'En el POS, al cobrar, elegí emitir factura, seleccioná el tipo y (si hace falta) cargá el CUIT o DNI del cliente. La factura sale con número oficial.' },
    ],
    tips: [
      'Con "conexión rápida" no necesitás sacar tu propio certificado: es lo más rápido para empezar.',
      'Si sos monotributista, tus facturas son tipo C (sin IVA discriminado).',
    ],
    erroresComunes: [
      'Si AFIP rechaza, suele ser por el certificado/CUIT o porque falta habilitar el punto de venta en la página de AFIP.',
      'La fecha de la factura no puede ser anterior a la de la última que hiciste en ese punto de venta.',
    ],
  },
  {
    id: 'resumen-fiscal',
    icono: '🧮',
    titulo: 'Resumen Fiscal',
    resumen: 'Lo que facturaste, para tus impuestos.',
    color: 'from-emerald-500 to-teal-700',
    gating: { permiso: 'resumen_fiscal' },
    pro: true,
    intro: 'El Resumen Fiscal junta todo lo que facturaste en un período para ayudarte con la parte de impuestos. Es ideal para controlar, por ejemplo, que no te pases de categoría en el monotributo.',
    beneficios: [
      'Ves de una cuánto facturaste en el mes o en el período que elijas.',
      'Te ayuda a controlar los topes del monotributo y no llevarte sorpresas.',
      'Le facilitás el trabajo (y el gasto) a tu contador.',
      'Tenés el detalle de comprobantes ordenado y a mano.',
    ],
    pasos: [
      { titulo: 'Elegí el período', texto: 'Seleccioná el mes o el rango que querés analizar.', imagen: '/tutoriales/resumen-fiscal-1.png' },
      { titulo: 'Revisá los totales', texto: 'Ves el total facturado y el detalle de comprobantes, útil para vos y para tu contador.' },
    ],
    tips: [
      'Miralo cada mes para ir controlando el acumulado del año.',
    ],
    erroresComunes: [
      'Toma solo lo facturado electrónicamente; las ventas sin factura no cuentan acá.',
    ],
  },
  {
    id: 'prediccion-compras',
    icono: '🛒',
    titulo: 'Predicción de compras',
    resumen: 'Cuánto comprar para no quedarte sin nada.',
    color: 'from-orange-500 to-amber-600',
    gating: { funcion: 'prediccion_compras' },
    pro: true,
    intro: 'La Predicción de compras te dice, mirando lo que vendiste antes, cuánto conviene comprar de cada producto para reponer. Y es inteligente: mira el día de la semana. Si mañana es sábado, mira cómo te fue los sábados, no un promedio cualquiera.',
    beneficios: [
      'Comprás lo justo: ni te quedás sin nada, ni te llenás de mercadería parada.',
      'Se basa en lo que realmente se vende, no en corazonadas.',
      'Tiene en cuenta el día de la semana (no es lo mismo un martes que un finde).',
      'Te arma la lista de compras y la exportás para llevársela al proveedor.',
      'Le suma un colchón de seguridad para no quedarte corto los días fuertes.',
    ],
    pasos: [
      { titulo: 'Elegí qué querés cubrir', texto: 'Indicá si querés reponer para mañana o para los próximos días, y cuántas semanas hacia atrás querés que analice.', imagen: '/tutoriales/prediccion-1.png' },
      { titulo: 'Mirá la sugerencia', texto: 'La tabla te muestra, por producto, cuánto se vende ese día y cuánto conviene comprar.' },
      { titulo: 'Llevate la lista', texto: 'Exportá la lista de compras sugerida a Excel o PDF para el proveedor.' },
    ],
    tips: [
      'Cuanto más historial de ventas tengas, más precisa es la sugerencia.',
      'Es una guía: ajustala con tu criterio si sabés que viene un día especial.',
    ],
    erroresComunes: [
      'Con poco historial aparece un aviso de "baja confianza": la sugerencia es más aproximada.',
    ],
  },
  {
    id: 'multinegocio',
    icono: '🔁',
    titulo: 'Movimiento de mercadería',
    resumen: 'Mover stock entre tus locales.',
    color: 'from-purple-500 to-fuchsia-600',
    gating: { funcion: 'multinegocio' },
    pro: true,
    intro: 'Si tenés más de un local conectado, podés mandar mercadería de uno a otro. Uno envía, el otro recibe y confirma lo que llegó, y el stock se ajusta solo en los dos lados. Con remito y todo, como en las empresas grandes.',
    beneficios: [
      'Movés stock entre locales sin planillas ni llamados.',
      'El que recibe confirma qué llegó: no se pierde ni se "descuenta de más".',
      'El stock se actualiza solo en los dos negocios.',
      'Queda todo registrado: quién envió, quién recibió y cuándo.',
      'Imprimís el remito para que acompañe la mercadería en el viaje.',
    ],
    pasos: [
      { titulo: 'Enviá la mercadería', texto: 'Desde el Punto de Venta (Movimientos), elegí el local destino, agregá los productos y las cantidades, y confirmá. El envío queda "en proceso".', imagen: '/tutoriales/multinegocio-1.png' },
      { titulo: 'Recibí en el otro local', texto: 'En "Movimiento de mercadería", el local que recibe ve el envío, tilda lo que realmente llegó y confirma. Recién ahí se mueve el stock.', imagen: '/tutoriales/multinegocio-2.png' },
      { titulo: 'Seguí el historial', texto: 'Cada movimiento muestra su estado (en proceso, recibido, parcial), con filtros, quién lo hizo y la opción de reimprimir el remito.' },
    ],
    tips: [
      'Lo que se envía no se descuenta hasta que el otro confirma qué recibió: así nunca se pierde stock.',
      'Imprimí el remito: sirve para controlar la mercadería cuando llega.',
    ],
    erroresComunes: [
      'Si el stock no se movió, es porque el envío sigue "en proceso" (falta que el destino lo reciba).',
    ],
  },
];
