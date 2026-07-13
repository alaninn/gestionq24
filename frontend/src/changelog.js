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

export const VERSION_ACTUAL = '2.35.0';

export const CHANGELOG = [
  {
    version: '2.35.0',
    fecha: '2026-07-12',
    titulo: 'Corregir a mano las deudas de proveedores',
    cambios: [
      { t: 'Al editar un proveedor ahora podés corregir manualmente los saldos "Nos deben" y "Le debemos", por si quedó cargado un monto equivocado.' },
      { t: 'Editar los datos de un proveedor (nombre, teléfono) ya no modifica sus saldos: las deudas quedan intactas salvo que las cambies a propósito.' },
    ],
  },
  {
    version: '2.34.0',
    fecha: '2026-07-12',
    titulo: 'Refuerzos de seguridad del sistema',
    cambios: [
      { t: 'Se reforzó la asignación de roles al crear o editar usuarios: cada negocio solo puede usar los roles de su propio equipo, sin posibilidad de otorgar permisos que no correspondan.', super: true },
      { t: 'La descarga de certificados de facturación ahora valida el archivo solicitado para que no se pueda acceder a archivos fuera de la carpeta de certificados.', super: true },
      { t: 'La impresión de tickets y comprobantes ahora protege los textos (nombre del negocio, del cliente y de los productos) para que ningún carácter especial pueda alterar la impresión.' },
      { t: 'El resumen de un cliente cuenta únicamente los pagos de su propio negocio.', super: true },
      { t: 'El servidor ahora responde los errores de forma genérica, sin exponer detalles internos.', super: true },
    ],
  },
  {
    version: '2.33.0',
    fecha: '2026-07-11',
    titulo: 'Historial de stock con el usuario y freno a los cambios accidentales',
    cambios: [
      { t: 'El historial de stock (botón del reloj 🕒) ahora muestra en chiquito el nombre del usuario que hizo cada ajuste, así sabés quién cambió una cantidad.' },
      { t: 'Los campos de números (stock, precios, cantidades) ya no se modifican solos al pasar la rueda del mouse por encima. Antes, si el cursor quedaba sobre el casillero y girabas la rueda, el número subía o bajaba sin querer y podía terminar en una cantidad muy distinta a la escrita.' },
    ],
  },
  {
    version: '2.32.0',
    fecha: '2026-07-10',
    titulo: 'El acceso del negocio tiene su propia contraseña',
    cambios: [
      { t: 'El acceso del negocio (Paso 1 del login) ahora usa una contraseña propia, distinta de la del administrador. Así se la puede compartir con todos los usuarios para volver a entrar si el equipo se desloguea, sin dar la clave del admin.', super: true },
      { t: 'Al editar el administrador de un negocio se pueden cambiar por separado la contraseña del portal de acceso y la del administrador.', super: true },
    ],
  },
  {
    version: '2.31.2',
    fecha: '2026-07-04',
    titulo: 'Redondeo por producto: ahora se suma al descuento o recargo',
    cambios: [
      { t: 'En los ajustes de un producto, el redondeo ya no borra el descuento o recargo que tenga puesto: se aplica encima. Podés, por ejemplo, hacer un descuento y además redondear el resultado.' },
      { t: 'Los botones de ajuste por producto ahora se marcan cuando están activos y se apagan al volver a tocarlos. Si cambiás la cantidad, todo se recalcula solo.' },
    ],
  },
  {
    version: '2.31.1',
    fecha: '2026-07-04',
    titulo: 'Los descuentos del carrito ya no se pierden al cambiar de venta',
    cambios: [
      { t: 'Corregido: el descuento, recargo o redondeo general del carrito ahora se mantiene al pasar de una venta en espera a otra y volver. Cada venta conserva los suyos.' },
    ],
  },
  {
    version: '2.31.0',
    fecha: '2026-07-04',
    titulo: 'Descuento, recargo y redondeo por producto en el POS',
    cambios: [
      { t: 'Ahora podés aplicar descuento, recargo o redondeo a UN producto puntual del carrito, sin afectar el resto de la venta. Cada tarjeta del carrito tiene un botón "%" que abre esos ajustes.' },
      { t: 'El ajuste de cada producto se ve en su tarjeta y se suma solo al total. Podés quitarlo cuando quieras. Si cambiás la cantidad, el descuento o recargo se recalcula solo.' },
      { t: 'Cada venta en espera conserva sus propios descuentos y recargos: al cambiar de venta ya no se pierden ni se mezclan con las demás.' },
    ],
  },
  {
    version: '2.30.0',
    fecha: '2026-07-03',
    titulo: 'El stock ya no se pisa al editar un producto',
    cambios: [
      { t: 'Al editar un producto para cambiar su precio, nombre u otro dato, el stock ya no se reemplaza por accidente: solo cambia cuando lo ajustás a propósito. Así los descuentos de las ventas (incluidos los componentes de un combo) nunca se pierden.' },
      { t: 'Cuando ajustás la cantidad de un producto desde su ficha, el cambio queda registrado en el historial de stock, igual que desde el panel de Stock.' },
    ],
  },
  {
    version: '2.29.0',
    fecha: '2026-07-02',
    titulo: 'Nuevas páginas de contenido en la web',
    cambios: [
      { t: 'La web ahora tiene tres guías para atraer clientes desde Google: sistema para almacenes y kioscos, facturación electrónica ARCA y control de stock. Se linkean desde el pie de la página principal.', super: true },
    ],
  },
  {
    version: '2.28.0',
    fecha: '2026-07-02',
    titulo: 'La web ahora está preparada para los buscadores',
    cambios: [
      { t: 'La página de presentación (landing) quedó optimizada para aparecer en Google y otros buscadores: título, descripción, datos del servicio y mapa del sitio.', super: true },
      { t: 'Las pantallas internas del sistema (login, cajas, administración) quedan fuera de los buscadores por privacidad.', super: true },
    ],
  },
  {
    version: '2.27.0',
    fecha: '2026-07-01',
    titulo: 'Superadmin: planes, precios y cobros',
    cambios: [
      { t: 'Configuración de Planes: ahora se elige qué módulos del menú de administración incluye cada plan, con botón "Agregar todos". Dashboard, Configuración y Usuarios quedan siempre disponibles.', super: true },
      { t: 'Configuración de Planes: se puede fijar el precio mensual de cada plan, y ese precio se muestra automáticamente en la web/landing.', super: true },
      { t: 'Nuevo panel de Cobros y ganancias: cobrado del mes, ingreso mensual estimado, cobrado histórico, alertas de vencimientos y últimos cobros.', super: true },
      { t: 'El mail del negocio ahora se actualiza al instante en la lista al editar el administrador.', super: true },
    ],
  },
  {
    version: '2.26.0',
    fecha: '2026-06-30',
    titulo: 'Punto de Venta más estable (sin internet y al cobrar)',
    cambios: [
      { t: 'Si se corta internet, la caja ya no se cierra sola: aunque recargues la página, seguís logueado y con la caja abierta, y las ventas se siguen guardando para subirse cuando vuelve la conexión.' },
      { t: 'Se corrigió un problema poco frecuente por el que, después de cobrar una venta, el carrito a veces quedaba con productos o los volvía a agregar al intentar borrarlo. Ahora el carrito se vacía al instante al confirmar la venta.' },
    ],
  },
  {
    version: '2.25.1',
    fecha: '2026-06-29',
    titulo: 'Producto combinado: precio de venta automático',
    cambios: [
      { t: 'Al crear o editar un producto combinado, el precio de venta final ahora se calcula solo a partir del costo de los componentes y el porcentaje de ganancia que cargás (igual que en un producto normal).' },
    ],
  },
  {
    version: '2.25.0',
    fecha: '2026-06-29',
    titulo: 'Nuevo acceso en dos pasos por negocio',
    cambios: [
      { t: 'El ingreso ahora tiene dos pasos: primero se habilita el negocio en la computadora con el mail y la contraseña del negocio, y después cada persona entra con su nombre de usuario corto. La computadora queda fijada al negocio, así que cada cajero entra rápido con solo su usuario.' },
      { t: 'Con esto, dos negocios distintos pueden tener los mismos nombres de usuario (por ejemplo "caja1") sin que se mezclen ni se pisen los accesos.' },
      { t: 'Para cambiar de negocio en una computadora está el botón "Salir del negocio" en la pantalla de ingreso.' },
      { t: 'Se corrigió que, al pasar de una ventana a otra, la segunda a veces se cerraba sola.' },
    ],
  },
  {
    version: '2.24.1',
    fecha: '2026-06-26',
    titulo: 'Descuento manual editable en el Punto de Venta',
    cambios: [
      { t: 'Cuando en Configuración tenés el descuento en modo "Editable", ahora en el Punto de Venta aparece un campo para escribir el porcentaje de descuento que quieras en cada venta, hasta el máximo configurado. En modo "Fijo" sigue funcionando con el botón directo como antes.' },
      { t: 'Se mejoraron algunos textos del Centro de Control para que sean más claros.' },
    ],
  },
  {
    version: '2.24.0',
    fecha: '2026-06-26',
    titulo: 'Facturación: activar/desactivar el módulo y el IVA en los informes',
    cambios: [
      { t: 'El módulo de Facturación Electrónica ahora es exclusivo del plan Premium: en el plan Estándar la pestaña queda oculta. Viene desactivado por defecto y solo el Premium puede activarlo.' },
      { t: 'Con la facturación DESACTIVADA, el Dashboard, el Centro de Control y los Reportes dejan de descontar IVA: muestran la facturación total sin descuentos de IVA. Al activarla, vuelven a discriminar el IVA 21% en las ganancias.' },
    ],
  },
  {
    version: '2.23.1',
    fecha: '2026-06-26',
    titulo: 'Fix: anular/editar ventas desde el panel de superadmin',
    super: true,
    cambios: [
      { t: 'Se corrigió un error ("negocio_id requerido") al anular, editar o reimprimir una venta cuando el superadmin está operando dentro de otro negocio desde Reportes.', super: true },
    ],
  },
  {
    version: '2.23.0',
    fecha: '2026-06-26',
    titulo: 'Reportes: volver a abrir el detalle de cada venta',
    cambios: [
      { t: 'En Reportes → Historial, volvés a poder hacer clic en cada venta del "Detalle de Ventas" para ver el modal con los artículos vendidos, totales y método de pago.' },
      { t: 'Desde ese modal podés reimprimir el ticket, anular la venta (restaura el stock y el saldo si era fiada) y, en las ventas con factura electrónica, emitir una Nota de Crédito de AFIP.' },
    ],
  },
  {
    version: '2.22.0',
    fecha: '2026-06-26',
    titulo: 'Productos: nuevo tipo "Producto combinado"',
    cambios: [
      { t: 'En Productos podés crear un "Producto combinado" (combo): elegís con un buscador los productos que se venden juntos y su cantidad. El costo se calcula solo (suma de los componentes) y le ponés margen, IVA y precio como cualquier producto.' },
      { t: 'El stock del combo se calcula automáticamente (lo que alcance del componente más escaso). Al vender el combo, se descuenta el stock de cada producto que lo compone; al anular o editar la venta, se restaura.' },
    ],
  },
  {
    version: '2.21.0',
    fecha: '2026-06-26',
    titulo: 'Configuración: reiniciar datos del negocio',
    cambios: [
      { t: 'En Configuración → Zona de Peligro, nuevo botón "Reiniciar datos del negocio": un modal donde elegís con checkbox qué borrar (ventas y estadísticas, gastos y compras, caja/turnos/retiros, fiados). No toca productos, categorías ni secciones.' },
      { t: 'Opciones sensibles aparte (en rojo): borrar las facturas AFIP y/o el borrado total de productos. Hay que escribir "ELIMINAR" para confirmar. Es irreversible y solo lo puede hacer el administrador.' },
    ],
  },
  {
    version: '2.20.0',
    fecha: '2026-06-26',
    titulo: 'Stock: exportar a Excel y PDF',
    cambios: [
      { t: 'Nuevo botón "📤 Exportar" en la pantalla de Stock: abre un modal con las secciones del stock (góndolas, heladeras, depósito...) y sus productos, para tildar con checkbox qué exportar. Las secciones arrancan colapsadas, con botón "Expandir/Colapsar todo", buscador, "seleccionar todo" y selección por sección. Optimizado para celular (pantalla completa, botones grandes).' },
      { t: 'Muestra un resumen de cuántos productos y cuántas unidades elegiste. El archivo (Excel .xlsx o PDF) lleva nombre y cantidad en existencia, agrupado por sección y con el total de unidades.' },
    ],
  },
  {
    version: '2.19.2',
    fecha: '2026-06-25',
    titulo: 'URGENTE: arreglo de facturación',
    cambios: [
      { t: 'Se revirtió un cambio de la versión anterior que, al guardar, hacía que algunas facturas aprobadas por AFIP se guardaran como "error" y se perdiera el CAE. La facturación vuelve a funcionar normalmente.' },
      { t: 'Se recuperaron los CAE de las facturas que ARCA había aprobado pero habían quedado guardadas como error.' },
    ],
  },
  {
    version: '2.19.1',
    fecha: '2026-06-25',
    titulo: 'Facturación: reintento ante error 10016 de AFIP (revertido en 2.19.2)',
    cambios: [
      { t: 'Reintento ante error 10016 de AFIP. NOTA: esta versión tenía un bug que rompía el guardado del CAE; se revirtió en la 2.19.2.' },
    ],
  },
  {
    version: '2.19.0',
    fecha: '2026-06-25',
    titulo: 'Gastos: montos más claros + editar el gasto directo',
    cambios: [
      { t: 'Los registros de factura sin pago ya no muestran "$0": ahora muestran el monto de la factura y abajo, en rojo, "NO SE PAGÓ".' },
      { t: 'Los montos de los gastos pagados se muestran en azul; el rojo queda solo para los que no se pagaron.' },
      { t: 'El botón "Editar" ahora abre un editor del gasto en sí (monto, método de pago, de dónde sale el dinero, tipo de boleta, fecha y descripción).' },
      { t: 'En gastos de proveedor/compra se agregó el botón "Ajustar", que abre el modal de pago/factura de antes.' },
    ],
  },
  {
    version: '2.18.0',
    fecha: '2026-06-25',
    titulo: 'Categorías más completas: unir, ver productos y renombrar',
    cambios: [
      { t: 'Nueva opción "🔗 Unir" para juntar categorías repetidas: elegís la que se borra y la que queda, y todos sus productos se mueven solos. El sistema además avisa cuando detecta nombres de categoría repetidos.' },
      { t: 'Cada categoría ahora muestra cuántos productos tiene, y al tocarla se abre la lista de esos productos (con stock y precio).' },
      { t: 'Se puede renombrar una categoría (✏️) sin tener que borrarla y crearla de nuevo.' },
    ],
  },
  {
    version: '2.17.0',
    fecha: '2026-06-25',
    titulo: 'Stock: botón "Agregar stock" (recepción de mercadería)',
    cambios: [
      { t: 'Nuevo botón "📥 Agregar stock" en la pestaña Stock: buscás un producto (por nombre o por categoría) y le sumás una cantidad, que se SUMA al stock actual (no lo reemplaza). Sirve para cargar compras/reposición sin tener que borrar el número.' },
      { t: 'Maneja bien los negativos: si el stock quedó en -1 (se vendió más de lo que figuraba) y agregás 10, el stock final queda en 9.' },
      { t: 'El modal permite filtrar por categoría y cargar la cantidad de varios productos a la vez, viendo el resultado (= stock nuevo) antes de guardar.' },
    ],
  },
  {
    version: '2.16.0',
    fecha: '2026-06-25',
    titulo: 'Pago a proveedor: origen y boleta + fix modal cierre de caja',
    cambios: [
      { t: 'Al registrar un pago a un proveedor ahora se puede elegir de dónde sale la plata (caja del turno / dinero del local / MP del local) y el tipo de boleta (Gasto X o Factura A con IVA crédito), igual que en Gastos.' },
      { t: 'Se corrigió el modal de resultado del cierre de caja del POS, que se veía desfasado y con el contenido superpuesto.' },
    ],
  },
  {
    version: '2.15.0',
    fecha: '2026-06-23',
    titulo: 'Fiados: agregar deuda a mano',
    cambios: [
      { t: 'Ahora se puede cargar una deuda a mano a un cliente (préstamo, artículo fuera de stock, fiado sin pasar por el carrito), tanto en el panel de Fiados del POS (botón "➕ Agregar deuda") como en Cuentas Corrientes (botón "➕ Deuda" en la lista y en el detalle). Antes solo se podía cobrar.' },
      { t: 'En el detalle del cliente, las deudas cargadas a mano se ven aparte de los pagos.' },
    ],
  },
  {
    version: '2.14.3',
    fecha: '2026-06-23',
    titulo: 'Fix: reporte por categoría sin elegir categoría',
    cambios: [
      { t: 'El reporte "Por Categoría" daba un error en el servidor si se generaba sin elegir una categoría. Ahora pide elegir la categoría y no falla.' },
    ],
  },
  {
    version: '2.14.2',
    fecha: '2026-06-23',
    titulo: 'POS: usuario en sesión visible',
    cambios: [
      { t: 'En el POS, debajo del nombre del negocio ("Punto de Venta"), ahora aparece en chico el usuario que está usando el sistema con un puntito verde de "online".' },
    ],
  },
  {
    version: '2.14.1',
    fecha: '2026-06-23',
    titulo: 'Dinero disponible: el saldo inicial virtual ya no se duplica',
    cambios: [
      { t: 'Al reiniciar el saldo inicial, el MP/virtual ya no suma de más: antes contaba las ventas virtuales de la caja en curso anteriores al reset (que vos ya contaste al cargar el saldo). Ahora el virtual cuenta solo las ventas posteriores al momento exacto en que guardás, y sigue sumando desde ahí. El efectivo sigue contando al cerrar la caja.' },
    ],
  },
  {
    version: '2.14.0',
    fecha: '2026-06-23',
    titulo: 'Dashboard, Centro de Control y Reportes alineados',
    cambios: [
      { t: 'Dashboard: la tarjeta de ganancia ahora muestra la GANANCIA NETA REAL del mes (mismo criterio que el Centro de Control), y el gráfico de ventas suma una segunda línea con la cantidad de ventas (eje derecho).' },
      { t: 'Centro de Control: las tarjetas de método de pago (efectivo/transferencia/MP/tarjeta) ahora se pueden tocar para ver el detalle de esas ventas del período.' },
      { t: 'Reportes: el Historial ahora incluye un "Resumen financiero" del período con el mismo criterio (ganancia real, ganancia efectivo/virtual, IVA, costo, gastos de caja, capital y cigarrillos).' },
      { t: 'Reportes: la Rentabilidad por producto/categoría ahora usa el costo al momento de la venta (igual que el Centro de Control) y aclara que es margen bruto. El reporte por Turno muestra los "Gastos de caja" (los que restan de la ganancia) además del total.' },
    ],
  },
  {
    version: '2.13.2',
    fecha: '2026-06-23',
    titulo: 'Dashboard: filtros del gráfico + tarjetas interactivas',
    cambios: [
      { t: 'Los filtros del gráfico "Análisis de Ventas" (7D/30D/3M/6M/1A) ahora funcionan: el gráfico se recorta según el período elegido y el sistema trae hasta 1 año de datos.' },
      { t: 'Las tarjetas del Dashboard ahora son clickeables y llevan a su sección: Ventas del mes → Reportes, Gastos del mes → Gastos, Ganancia → Centro de Control, Deudas → Cuentas Corrientes, Productos → Productos. La tarjeta "Ayer" muestra el resumen completo de ayer arriba.' },
      { t: 'La tarjeta "Ganancia" del Dashboard se aclara como aproximada (Ventas − Gastos); la ganancia real está en el Centro de Control.' },
    ],
  },
  {
    version: '2.13.1',
    fecha: '2026-06-23',
    titulo: 'Ganancia neta real: solo resta los gastos de la caja del turno',
    cambios: [
      { t: 'La ganancia neta real del Centro de Control ahora solo descuenta los gastos pagados con la CAJA DEL TURNO (plata del día). Lo pagado con "dinero del local" o "MP del local" (capital acumulado de días anteriores, que usás para reposición y compras) ya NO se descuenta de la ganancia: esa plata no salió de las ventas del día y baja del dinero disponible, no de la ganancia.' },
      { t: 'Se agregó una tarjeta informativa "Pagado con dinero/MP del local" que muestra cuánto se gastó del capital acumulado (no afecta la ganancia).' },
    ],
  },
  {
    version: '2.13.0',
    fecha: '2026-06-22',
    titulo: 'Gastos fijos informativos + repaso de reportes',
    cambios: [
      { t: 'Los gastos fijos del local (luz, alquiler…) ya NO se descuentan de la ganancia neta real: eran a modo de especulación y, al pagar el gasto real, se contaban dos veces. Ahora la ganancia neta real solo resta los gastos reales. Igual se muestra una "ganancia estimada" descontando los fijos prorrateados, a modo de referencia.' },
      { t: 'La tarjeta de Gastos fijos aclara que es una referencia (no se descuenta) y muestra el costo diario prorrateado.' },
      { t: 'Reportes: el reporte "Por Categoría" ahora se puede exportar a PDF y Excel (antes los botones no hacían nada).' },
    ],
  },
  {
    version: '2.12.4',
    fecha: '2026-06-21',
    titulo: 'Dinero disponible: fix descuento de gastos + se quita "Registrar retiro"',
    cambios: [
      { t: 'Corregido en serio: los gastos de "MP del local" / "dinero del local" no descontaban del dinero disponible por un desfase de zona horaria en el cálculo. Ahora descuentan bien.' },
      { t: 'Se quitó el botón "Registrar retiro" del Centro de Control: los movimientos se cargan desde el panel de Gastos, y para corregir se usa el "Saldo inicial".' },
    ],
  },
  {
    version: '2.12.3',
    fecha: '2026-06-21',
    titulo: 'Dinero disponible: se refresca al actualizar',
    cambios: [
      { t: 'El "Dinero disponible" ahora se vuelve a calcular al tocar "Actualizar" o al cambiar el período en el Centro de Control. Antes solo se cargaba al entrar, por eso un gasto recién hecho parecía no descontarse hasta recargar la página.' },
    ],
  },
  {
    version: '2.12.2',
    fecha: '2026-06-21',
    titulo: 'Dinero disponible: virtual en tiempo real + gastos que sí descuentan',
    cambios: [
      { t: 'El dinero virtual (MP del local) ahora figura disponible en tiempo real: suma también lo de las cajas que están ABIERTAS (no es plata física, ya está en MP). El efectivo sigue sumando recién cuando se cierra la caja.' },
      { t: 'Corregido: un gasto pagado con "MP del local" (o dinero del local) no siempre descontaba del disponible. Ahora el cálculo usa la hora real de creación del gasto, así descuenta bien aunque la fecha del gasto sea de otro día.' },
    ],
  },
  {
    version: '2.12.1',
    fecha: '2026-06-21',
    titulo: 'Dinero disponible: saldo inicial = reset desde ese momento',
    cambios: [
      { t: 'El "Saldo inicial" ahora funciona como un reinicio: cargás la plata real que tenés en ese momento y el dinero disponible arranca a acumular DESDE ese instante (antes contaba todo el día). Lo anterior a ese momento ya no se suma.' },
      { t: 'El panel de cigarrillos ahora también reconoce la categoría normal (rubro), no solo la categoría de stock, así aparece aunque tengas los cigarrillos en el rubro "Cigarrillos".' },
    ],
  },
  {
    version: '2.12.0',
    fecha: '2026-06-21',
    titulo: 'Centro de Control: dinero disponible + cigarrillos aparte',
    cambios: [
      { t: 'Nueva tarjeta "Dinero disponible ahora": muestra la plata real que hay para comprar o retirar (efectivo = caja del local, virtual = MP del local). Se acumula en el tiempo: la plata de una caja entra al disponible cuando se CIERRA esa caja, y baja con los gastos y los retiros.' },
      { t: 'Botón "Saldo inicial" para cargar desde qué fecha y con cuánta plata (efectivo y virtual) arranca el cálculo del disponible.' },
      { t: 'Botón "Registrar retiro" para sacar plata del local (tomar ganancia): baja el dinero disponible pero NO cuenta como gasto del negocio.' },
      { t: 'Los cigarrillos ahora se muestran en un panel aparte (con su costo a reponer, venta en efectivo/virtual y ganancia) y NO se mezclan con la ganancia del resto; igual su plata suma al dinero disponible. Se identifican por la categoría de stock cuyo nombre empiece con "Cigarr".' },
      { t: 'En Gastos, las opciones "Dinero del local" y "MP del local" ahora aclaran que descuentan del dinero disponible.' },
    ],
  },
  {
    version: '2.11.0',
    fecha: '2026-06-20',
    titulo: 'Control de Caja: cierre general por día',
    cambios: [
      { t: 'El historial de Control de Caja ahora se agrupa por día: cada día es una "caja general" que suma todas las cajas (mañana, tarde, trasnoche…). La cantidad de cajas por día puede variar.' },
      { t: 'Al tocar un día se abre el "Cierre general del día" con el total consolidado (facturación, efectivo, virtual, gastos y ganancia neta) y el detalle de cada caja individual; desde ahí podés abrir el detalle completo de cada una.' },
      { t: 'Arreglos visuales en los modales de cierre: se quitó el efecto que agrandaba el modal (tapaba texto) y la distribución de pagos del cierre de caja ahora usa una leyenda debajo del gráfico para que no se superpongan las etiquetas.' },
    ],
  },
  {
    version: '2.10.4',
    fecha: '2026-06-20',
    titulo: 'Proveedores y Gastos: arreglos',
    cambios: [
      { t: 'Proveedores: las tarjetas de totales "Les debemos" y "Nos deben" mostraban NaN. Ahora suman bien y muestran el total real de deudas.' },
      { t: 'Pago a proveedor: ahora podés elegir la fecha del pago (por si registrás uno de otro día); antes siempre quedaba con la fecha de hoy.' },
      { t: 'Editar un gasto ahora abre el formulario completo (igual que al crear uno nuevo), precargado, para poder cambiar todos los campos incluida la fecha. Antes el editor era muy reducido.' },
    ],
  },
  {
    version: '2.10.3',
    fecha: '2026-06-20',
    titulo: 'POS y Gastos: 3 mejoras',
    cambios: [
      { t: 'En el POS, el cartel de "Venta Exitosa" ahora se cierra también con la tecla F8, sin necesidad del mouse, para arrancar la próxima venta más rápido.' },
      { t: 'Gastos: si elegías una fecha de otro día (ej. un gasto de hace 3 días) igual se guardaba con la fecha de hoy. Ahora se respeta la fecha que pongas.' },
      { t: 'POS: los ajustes de precio (recargo y redondeo) ya no se trasladan a una venta nueva. Cada venta en espera mantiene los suyos por separado.' },
    ],
  },
  {
    version: '2.10.2',
    fecha: '2026-06-17',
    titulo: 'Fix: pantalla de login en loop',
    cambios: [
      { t: 'Corregido un bucle en la pantalla de login (el catálogo offline se intentaba cargar sin sesión y reiniciaba la página una y otra vez). Ahora solo se cachea estando logueado.' },
    ],
  },
  {
    version: '2.10.1',
    fecha: '2026-06-16',
    titulo: 'Centro de Control: accesos y facturación total',
    cambios: [
      { t: 'El Dashboard ahora tiene un botón "🎯 Centro de Control" para entrar directo.' },
      { t: 'En el Centro de Control se agregó la tarjeta de "Facturación total" del período (arriba de la ganancia neta) para entender mejor el número real.' },
      { t: 'Tarjeta de "Gastos fijos del local" con el total mensual; al tocarla muestra (y deja editar) cuáles son.' },
    ],
  },
  {
    version: '2.10.0',
    fecha: '2026-06-16',
    titulo: 'Centro de Control: ganancia real del negocio',
    destacados: [
      {
        titulo: '🎯 Nuevo: Centro de Control',
        detalle: 'Un módulo nuevo (menú Centro de Control) que muestra la ganancia REAL del negocio por día, mes o rango: ventas por método (efectivo, transferencia, Mercado Pago, tarjeta), la ganancia en efectivo (venta − costo de los productos) y la ganancia virtual (descontando el 21% de IVA de lo facturado). Podés cargar los gastos fijos del local (alquiler, luz, impuestos) con su valor mensual; se prorratean por día y se descuentan junto con los gastos variables para darte la ganancia neta real. Con tarjetas y gráficos claros.',
      },
    ],
    cambios: [
      { t: 'Cada venta ahora guarda el costo del producto al momento de venderlo, para que la ganancia histórica sea exacta aunque después cambien los precios de costo.' },
    ],
  },
  {
    version: '2.9.16',
    fecha: '2026-06-16',
    titulo: 'Arreglos: modal de venta exitosa y borrar venta',
    cambios: [
      { t: 'Volvió a aparecer el modal de "Venta Exitosa" con el botón para imprimir el ticket / ver el comprobante (se cerraba solo por un conflicto con el botón "atrás").' },
      { t: 'Al eliminar una venta, si falla ahora se muestra el motivo real (por ej. "no se puede eliminar de un turno cerrado") en vez de un error genérico. Las ventas sin turno se pueden eliminar.' },
    ],
  },
  {
    version: '2.9.15',
    fecha: '2026-06-16',
    titulo: 'Facturación más tolerante cuando AFIP está lento',
    cambios: [
      { t: 'Al facturar, el sistema ahora espera lo suficiente a AFIP (antes cortaba a los 10 segundos y mostraba un error de "tiempo excedido" aunque la factura pudiera salir). Útil de madrugada, cuando AFIP suele estar lento por mantenimiento.' },
      { t: 'Cuando AFIP rechaza un comprobante, el sistema ahora registra el motivo exacto (observaciones/errores) para poder resolverlo más rápido.' },
    ],
  },
  {
    version: '2.9.14',
    fecha: '2026-06-16',
    titulo: 'Modo offline: vender sin internet',
    destacados: [
      {
        titulo: '🔌 El POS funciona sin internet',
        detalle: 'Si se corta internet (con el navegador abierto), el POS sigue vendiendo: el catálogo queda guardado en el dispositivo (se actualiza solo una vez al día) para poder buscar y escanear productos sin conexión. Las ventas se guardan localmente y, cuando vuelve internet, se cargan automáticamente y se factura lo que haya quedado en espera. Cada venta lleva un identificador único para que nunca se duplique al sincronizar.',
      },
    ],
    cambios: [
      { t: 'POS en celular: la barra de Productos/Carrito ya no queda tapada por el teclado, y se quitaron los textos de teclas (F8/F9) que no aplican en celular.' },
    ],
  },
  {
    version: '2.9.13',
    fecha: '2026-06-14',
    titulo: 'POS más prolijo en celular',
    destacados: [
      {
        titulo: '📱 Barra del POS ordenada en celular',
        detalle: 'En celular la barra de arriba ya no se amontona: quedan a la vista la caja/turno, el cambio de usuario y el modo claro/oscuro. El resto de las acciones (Venta rápida, Alta rápida, Fiados, Historial, Gastos, Cierre, Admin, Actualizar) se agruparon en un menú "☰" que se abre cuando lo necesitás.',
      },
    ],
    cambios: [
      { t: 'Modal de gastos en celular: ya no se abre el teclado solo al entrar (el campo Monto no toma el foco automáticamente).' },
      { t: 'Cierre de caja en celular: la sección protegida por PIN ocupa poco (solo el botón "Revelar Información"); el detalle aparece al revelarlo.' },
      { t: 'Se ocultan los atajos de teclado en celular (no aplican sin teclado físico).' },
    ],
  },
  {
    version: '2.9.12',
    fecha: '2026-06-14',
    titulo: 'Cierre en celular: arreglado el encimado',
    cambios: [
      { t: 'Modal de cierre de caja en celular: los paneles ya no se enciman (el botón "Revelar Información" se montaba sobre la sección de comprobantes). Ahora cada sección se apila ordenada con su altura natural.' },
    ],
  },
  {
    version: '2.9.11',
    fecha: '2026-06-14',
    titulo: 'Fix del dashboard y cierre en celular',
    cambios: [
      { t: 'Corregido un error que a veces hacía fallar la carga del panel principal (se enviaba una fecha inválida al servidor).' },
      { t: 'Modal de cierre de caja en celular: la sección protegida por PIN ya no se ve colapsada/encimada.' },
    ],
  },
  {
    version: '2.9.10',
    fecha: '2026-06-14',
    titulo: 'Mejoras de modales en celular',
    cambios: [
      { t: 'Modal de gastos más compacto en celular (menos espacios y botones más chicos) para que entre mejor sin tanto scroll.' },
      { t: 'Modal de cierre de caja: en celular usa una sola columna con alturas naturales para que se vea ordenado (antes se veía apretado).' },
    ],
  },
  {
    version: '2.9.9',
    fecha: '2026-06-14',
    titulo: 'Los modales se adaptan a la pantalla',
    cambios: [
      { t: 'Se revisaron todos los modales del POS (cobro, cierre de caja, contar billetes, gastos, fiados, confirmaciones, etc.) para que se adapten al tamaño de la pantalla: en pantallas chicas o celulares ahora hacen scroll o se reorganizan, así no quedan botones tapados. En pantallas grandes se ven igual que antes.' },
      { t: 'El modal de cierre de caja, que tenía dos columnas, ahora se apila en una sola en celulares.' },
    ],
  },
  {
    version: '2.9.8',
    fecha: '2026-06-14',
    titulo: 'Pago dividido y aviso por montos virtuales',
    destacados: [
      {
        titulo: '🔀 Pago dividido (efectivo + virtual)',
        detalle: 'En el cobro hay un método nuevo "Pago dividido": el cliente paga una parte en efectivo y otra por transferencia, Mercado Pago o tarjeta. Cargás un casillero y el otro se completa solo para que sumen el total. La caja sigue cuadrando: la parte efectivo cuenta como efectivo y la virtual en su medio. Si facturás, por defecto se factura solo la parte virtual (con la opción "Facturar todo" para el total).',
      },
    ],
    cambios: [
      { t: 'Aviso anti-error: si cobrás por un medio virtual (transferencia/MP/tarjeta) por encima de un monto configurable (default $100.000), el POS pide confirmar. Se ajusta en Configuración.' },
      { t: 'Corregido: en algunos monitores el botón "Registrar pago" del modal de gastos quedaba tapado; ahora el modal se adapta a la pantalla.' },
    ],
  },
  {
    version: '2.9.7',
    fecha: '2026-06-14',
    titulo: 'Factura: QR y fecha siempre iguales a AFIP',
    cambios: [
      { t: 'La factura electrónica ahora guarda la fecha exacta que se registró en AFIP y la usa en el código QR y en la fecha impresa. Así el QR siempre valida correctamente contra AFIP, incluso en facturas hechas de noche.' },
    ],
  },
  {
    version: '2.9.6',
    fecha: '2026-06-14',
    titulo: 'Facturación: fecha correcta (hora Argentina)',
    destacados: [
      {
        titulo: '🧾 Las facturas salen con la fecha correcta',
        detalle: 'Corregimos la fecha de las facturas electrónicas (ARCA/AFIP) para que use siempre la hora de Argentina. Antes, las facturas hechas de noche (después de las 21 hs) podían salir con la fecha del día siguiente. Además, el sistema se asegura de no emitir una factura con fecha anterior a la última autorizada, para evitar rechazos de AFIP. Importante para locales que facturan las 24 horas.',
      },
    ],
    cambios: [
      { t: 'El reporte de errores ahora muestra la hora en horario de Argentina (antes estaba en UTC, 3 horas adelantado).', super: true },
    ],
  },
  {
    version: '2.9.5',
    fecha: '2026-06-14',
    titulo: 'Reporte de errores: no subir si está vacío',
    cambios: [
      { t: 'El botón "Subir a GitHub" del reporte de errores ahora solo sube si realmente hay errores (de pantalla, del log del servidor o en memoria). Si no hay nada, avisa "No hay errores para enviar" y no ensucia la rama de reportes.', super: true },
    ],
  },
  {
    version: '2.9.4',
    fecha: '2026-06-14',
    titulo: 'Reporte de errores: limpieza automática',
    cambios: [
      { t: 'Al subir el reporte de errores a GitHub, ahora se limpian las fuentes (errores de pantalla, log de errores del servidor y buffer en memoria) para no repetir errores viejos en el próximo reporte. El mensaje de éxito indica qué se limpió.', super: true },
    ],
  },
  {
    version: '2.9.3',
    fecha: '2026-06-14',
    titulo: 'Plantillas de permisos editables',
    destacados: [
      {
        titulo: '⚙️ Definí qué trae cada rol',
        detalle: 'En Usuarios podés editar las plantillas de permisos de Encargado y Cajero (botón "Plantillas de permisos", o tocando la tarjeta del rol). Elegís qué paneles y acciones trae cada uno y queda guardado. Después, al crear o editar un empleado, aplicás esa plantilla de un toque y ajustás lo puntual. El rol Admin siempre tiene acceso total.',
      },
    ],
  },
  {
    version: '2.9.2',
    fecha: '2026-06-14',
    titulo: 'Reporte de errores para soporte',
    cambios: [
      { t: 'Panel SuperAdmin: nuevo botón "🐞 Errores" que arma un reporte con los errores de pantalla de los usuarios y los últimos errores del servidor, para descargarlo o subirlo a GitHub y que soporte lo revise sin tener que pasar nada a mano.', super: true },
    ],
  },
  {
    version: '2.9.1',
    fecha: '2026-06-14',
    titulo: 'Permisos por panel del menú + plantillas de rol',
    destacados: [
      {
        titulo: '🔐 Elegí qué ve cada empleado',
        detalle: 'En Usuarios, ahora cada panel del menú (Dashboard, Productos, Stock, Control de Caja, Cuentas Corrientes, Proveedores, Gastos, Resumen Fiscal, Reportes, Soporte y el POS) es un permiso que el administrador activa o desactiva por usuario. El que no tiene "Ver panel" de una sección, no la ve en su menú. Usuarios y Configuración quedan siempre solo para administradores por seguridad.',
      },
      {
        titulo: '⚡ Plantillas de rol',
        detalle: 'Al crear o editar un empleado podés aplicar una plantilla rápida (Encargado o Cajero) que carga los permisos típicos de ese rol, y después ajustás lo que quieras. El editor de permisos quedó agrupado por panel con una descripción de cada uno.',
      },
    ],
    cambios: [
      { t: 'Corregido un error de pantalla en blanco/errores en Reportes cuando se filtraba por fechas vacías o inválidas.' },
    ],
  },
  {
    version: '2.9.0',
    fecha: '2026-06-14',
    titulo: 'Alta rápida de productos, permisos de proveedores y gastos por origen',
    destacados: [
      {
        titulo: '🏷️ Alta rápida de productos en el POS',
        detalle: 'Nuevo botón "Alta rápida" (tecla F7) en el POS: cuando encontrás un producto sin precio, lo das de alta al toque con solo el nombre (el código de barras y el precio son opcionales). Queda marcado "por revisar" para que después un administrador le complete los datos. En el menú de Productos aparece un aviso con la lista de productos por revisar (chip ⚠️), y apenas se les carga un precio salen de la lista solos.',
      },
      {
        titulo: '🚚 Permisos de proveedores para tus empleados',
        detalle: 'Ahora podés darle permiso a encargados y cajeros para usar el panel de Proveedores (ver, crear, pagar) tanto en el panel como en el POS. El editor de permisos quedó más claro, agrupado por módulo, e incluye también editar ventas y editar gastos.',
      },
    ],
    cambios: [
      { t: 'Gastos: nuevas tarjetas que desglosan los gastos por origen del dinero (🧰 de caja, 🏪 del local, 📱 de Mercado Pago). Al tocar una, filtra el listado por ese origen.' },
    ],
  },
  {
    version: '2.8.4',
    fecha: '2026-06-12',
    titulo: 'Gastos como libro diario + dato fiscal X / Factura A',
    destacados: [
      {
        titulo: '📒 Menú de Gastos renovado',
        detalle: 'Gastos funciona ahora como un libro diario de los movimientos de dinero del local. Filtros como el Dashboard (Hoy, Por día, Por mes, Rango de fechas o Todo) más filtro por tipo (gastos, compras, pagos a proveedores). Tabla más clara y vista de tarjetas en celular.',
      },
      {
        titulo: '🧾 Dato fiscal en cada gasto: X o Factura A',
        detalle: 'Al cargar un gasto o un pago a proveedor elegís si es un gasto X (sin comprobante) o en blanco con Factura A: estos últimos calculan el IVA contenido y suman crédito fiscal al Resumen Fiscal automáticamente.',
      },
    ],
    cambios: [
      { t: 'Modal de nuevo gasto simplificado: se quitaron la categoría y el toggle de gasto fijo (la descripción cuenta qué se pagó y ahora es obligatoria). Mercado Pago como método de pago.' },
      { t: 'Pago a proveedor desde el modal: ahora también elige de dónde sale el dinero (caja/local/MP) y su dato fiscal.' },
      { t: 'Gasto avanzado: corregido un error que sumaba IVA encima del precio en compras sin factura o con factura B/C (una compra de $1.000 se registraba como $1.210).' },
      { t: 'Proveedores: corregido el botón Editar del historial que cerraba el modal sin abrir el editor; tarjetas del menú más compactas y profesionales; saldos de todos los proveedores reseteados a cero para arrancar limpio.' },
    ],
  },
  {
    version: '2.8.3',
    fecha: '2026-06-12',
    titulo: 'Proveedores: saldos corregidos y modales renovados',
    destacados: [
      {
        titulo: '🛒 Corregido: las compras a crédito ahora generan la deuda',
        detalle: 'Una compra a crédito o con pago parcial registrada desde Gastos no estaba sumando la deuda al proveedor (quedaba en cero). Ahora la deuda se calcula bien (total de la compra menos lo pagado) y aparece en "Le debemos". Además, al eliminar una compra o un pago, los saldos del proveedor se revierten automáticamente.',
      },
    ],
    cambios: [
      { t: 'Modal de pago a proveedor renovado: dos opciones claras (Le pagamos / Nos paga) con el saldo visible en cada una, validación para no pagar más de lo adeudado, botones Total y 50%, Mercado Pago como método, y aviso de cuánto queda pendiente.' },
      { t: 'Se quitó la opción "Pago nuevo / anticipo" que descuadraba los saldos.' },
      { t: 'Historial del proveedor: ahora la lista tiene scroll (antes se cortaba), los botones de ver boleta / editar / eliminar están siempre visibles (en celular no aparecían), etiquetas más claras y total del período filtrado.' },
      { t: 'Corregido: el botón "Quitar" de la boleta enviaba el formulario por error.' },
    ],
  },
  {
    version: '2.8.2',
    fecha: '2026-06-12',
    titulo: 'Proveedores: vista de lista y mejoras generales',
    cambios: [
      { t: 'Proveedores: nuevo botón para elegir cómo ver el listado — 🗂️ Tarjetas o 📋 Lista (tabla compacta con saldos, contacto, último movimiento y acciones). El sistema recuerda tu elección.' },
      { t: 'Proveedores: el botón "atrás" del celular ahora cierra los modales (detalle, pago, edición de gasto) en vez de salir de la pantalla.' },
      { t: 'Proveedores: corregida la búsqueda que disparaba consultas duplicadas en cada tecla.' },
      { t: 'Se revisó todo el circuito de proveedores: crear, editar, detalle con estadísticas, asignación de gastos y compras, pagos/cobros con actualización de saldos, archivar, reactivar y eliminar definitivo.' },
    ],
  },
  {
    version: '2.8.1',
    fecha: '2026-06-12',
    titulo: 'Historial completo por cliente en Cuentas Corrientes',
    destacados: [
      {
        titulo: '📊 Ficha completa del cliente',
        detalle: 'En Cuentas Corrientes, cada cliente tiene ahora un historial completo (botón 📊): cuánto gastó en total, cantidad de compras y ticket promedio, deuda actual, fiado histórico, pagos realizados y desde cuándo es cliente. Incluye el gasto mes a mes (tocás un mes y filtra las compras), lo que más compra, y la lista de todas sus compras — tocá una para ver los productos.',
      },
    ],
    cambios: [
      { t: 'POS: botón 🔄 junto al modo oscuro que recarga la pantalla limpiando caché (equivale a Ctrl+Shift+R) para destrabarse ante cualquier problema.' },
      { t: 'POS: la píldora con el nombre de la caja ahora es un botón para cambiar de caja sin cerrarla (la caja queda abierta para los demás).' },
    ],
  },
  {
    version: '2.8.0',
    fecha: '2026-06-12',
    titulo: 'Cajas fijas por turno y cierre con responsable',
    destacados: [
      {
        titulo: '🏪 Cajas fijas del local',
        detalle: 'Desde Control de Caja ahora se crean las cajas fijas del negocio (ej: Mañana, Tarde, Trasnoche). Al entrar al POS, el usuario ve esas cajas con su estado: si está cerrada la abre con su efectivo inicial, y si ya está abierta se une. También puede crear una caja eventual para un caso particular. Una caja fija no se puede abrir dos veces a la vez.',
      },
      {
        titulo: '🔐 Cierre de caja con responsable y cambio de turno',
        detalle: 'Cada cierre registra qué usuario lo hizo (se ve en Control de Caja y en el detalle del cierre). Al finalizar el turno, la sesión se cierra automáticamente para que el usuario del turno siguiente ingrese con su propia cuenta y abra su caja.',
      },
    ],
    cambios: [
      { t: 'Control de Caja: el historial ahora muestra el nombre de la caja y quién la cerró.' },
      { t: 'POS: si la venta rápida (F1) está desactivada por el administrador, ahora avisa "Función desactivada por el administrador" en vez de no hacer nada.' },
      { t: 'Dashboard: se quitó el widget "Estado del sistema" (duplicaba información y consumía recursos; las alertas importantes siguen en el panel de soporte).' },
    ],
  },
  {
    version: '2.7.2',
    fecha: '2026-06-12',
    titulo: 'Todos los usuarios pueden facturar + detalle de ventas en el Dashboard',
    destacados: [
      {
        titulo: '🧾 Facturación para todos los usuarios',
        detalle: 'Los cajeros y cualquier usuario que venda ahora pueden emitir factura electrónica desde el POS (antes solo los admins podían, y la factura fallaba en silencio: la venta quedaba como efectivo sin facturar). Además, si la factura falla por cualquier motivo, el POS ahora lo avisa con un cartel bien visible.',
      },
    ],
    cambios: [
      { t: 'Dashboard: dentro del detalle de ventas (al tocar una tarjeta), ahora podés tocar cada venta para ver qué productos se vendieron, con cantidades y subtotales.' },
      { t: 'Si ARCA aprueba la factura pero falla el guardado local, el comprobante ya no se pierde (reintento automático).' },
    ],
  },
  {
    version: '2.7.1',
    fecha: '2026-06-11',
    titulo: 'Facturación según estándares ARCA, tickets más legibles y mejoras para celular',
    destacados: [
      {
        titulo: '🧾 Facturación electrónica al día con ARCA',
        detalle: 'Los comprobantes ahora informan la Condición frente al IVA del receptor (RG 5616, obligatoria). Al facturar con CUIT podés elegir la condición del comprador (Monotributista, Exento, etc.). La factura B impresa ahora muestra "IVA Contenido" según la Ley de Transparencia Fiscal (27.743) en vez de discriminar el IVA como una factura A.',
      },
    ],
    cambios: [
      { t: 'Tickets de impresión: letra más grande y clara en el comprobante electrónico y el cierre de caja, y tamaño de página correcto para impresoras térmicas (respeta el ancho configurado, sin márgenes de A4).' },
      { t: 'Productos en celular: nueva vista de tarjetas con edición rápida de precio y stock, selección múltiple y todas las acciones (editar, duplicar, borrar). En pantalla grande sigue la tabla completa.' },
      { t: 'Control de caja en celular: el historial de cierres se ve como tarjetas (tocá una para ver el detalle).' },
      { t: 'Ajustes de diseño móvil en Reportes y Proveedores.' },
    ],
  },
  {
    version: '2.7.0',
    fecha: '2026-06-11',
    titulo: 'Dashboard del día y planes configurables',
    destacados: [
      {
        titulo: '📍 Tu día en el local',
        detalle: 'El Dashboard ahora arranca con un panel completo del día: cuánto vendiste en efectivo, transferencias, tarjetas y Mercado Pago (con cantidad de ventas y porcentaje de cada uno), cuántas ventas se facturaron electrónicamente por ARCA, los gastos del día separados por origen, las ventas hora por hora y lo más vendido. Con el filtro de fecha podés ver el mismo detalle de cualquier día anterior.',
      },
      {
        titulo: '📐 Planes configurables',
        detalle: 'Nuevo apartado "Planes" en el panel SuperAdmin: ahora los límites de usuarios y productos de cada plan se editan desde ahí (por ejemplo subir el límite de usuarios del plan Estándar), y se pueden activar o desactivar funciones como facturación electrónica y reportes avanzados por plan. Los cambios aplican al instante.',
        super: true,
      },
    ],
    cambios: [
      { t: 'Reportes → Historial: ahora muestra el desglose por método de pago (efectivo, transferencias, tarjetas, Mercado Pago) y cuántas ventas se facturaron electrónicamente.' },
      { t: 'Las tarjetas del resumen del día son interactivas: al tocarlas se abre el detalle de esas ventas (hora, ítems, monto y si se facturó por ARCA).' },
      { t: 'El SuperAdmin ya no tiene límites de plan: puede crear usuarios o productos extra en cualquier negocio, aunque el plan esté al tope.', super: true },
      { t: 'Los límites que se muestran en las pantallas de Usuarios y Productos ahora se leen del servidor, así reflejan los cambios hechos desde el panel SuperAdmin.' },
    ],
  },
  {
    version: '2.6.1',
    fecha: '2026-06-11',
    titulo: 'Correcciones de límites de plan',
    cambios: [
      { t: 'Corregido: cuando el SuperAdmin entra a un negocio Premium, ya no se le aplican los límites del plan Estándar (crear usuarios, productos, facturación). Ahora usa el plan real del negocio que está operando.', super: true },
      { t: 'Corregido: el email de los usuarios ahora es realmente opcional al crearlos (antes fallaba si se dejaba vacío).' },
    ],
  },
  {
    version: '2.6.0',
    fecha: '2026-06-11',
    titulo: 'Búsqueda inteligente y gastos que cierran la caja',
    destacados: [
      {
        titulo: '🔍 Búsqueda del POS mejorada',
        detalle: 'Los resultados ahora se ordenan por relevancia: si buscás "leche", primero aparecen las leches y después lo que contiene la palabra (como el alfajor de dulce de leche). Las búsquedas combinadas tipo "coca 2.25" siguen funcionando igual. Además es más rápida.',
      },
      {
        titulo: '🧰 Gastos con origen del dinero',
        detalle: 'Al cargar un gasto ahora elegís de dónde salió la plata: "Caja del turno" (se descuenta del efectivo esperado en el cierre), "Dinero del local" u "Otro" (no afectan la caja). Así el cierre de caja te da bien aunque hayas pagado algo durante el turno.',
      },
    ],
    cambios: [
      { t: 'POS: resultados de búsqueda por relevancia (lo que empieza con lo buscado va primero); podés volver a A-Z o por precio con los chips de orden.' },
      { t: 'POS: búsqueda más rápida (menos datos por consulta e índices nuevos para el lector de códigos).' },
      { t: 'Gastos: selector "¿De dónde sale el dinero?" (caja del turno / dinero del local / otro).' },
      { t: 'Cierre de caja: los gastos pagados con la caja se descuentan del efectivo esperado, se muestran en el resumen y en el ticket impreso.' },
      { t: 'Gastos: ahora se registra qué usuario hizo cada gasto (antes figuraba siempre Admin).' },
      { t: 'Gastos: botón Editar para corregir un gasto (monto, descripción, categoría, método y origen).' },
      { t: 'Gastos: el historial muestra el origen del dinero de cada gasto.' },
    ],
  },
  {
    version: '2.5.2',
    fecha: '2026-06-11',
    titulo: 'Stock: conteo perfecto en el celular',
    cambios: [
      { t: 'Stock: el panel de conteo ahora queda pegado ENCIMA del teclado del celular — se ven el producto, el número y los botones sin cerrar el teclado.' },
      { t: 'Stock: tocar Guardar/Omitir/+/− ya no cierra el teclado: el flujo tipear → guardar → tipear es continuo.' },
      { t: 'Stock: panel de conteo compacto rediseñado (todo en una fila, progreso arriba).' },
      { t: 'Stock: el botón ✏️ ahora abre la edición del producto ahí mismo (nombre, categoría, código, precios, stock mínimo, unidad), sin saltar a la pantalla de Productos.' },
      { t: 'Stock: el botón "atrás" del celular ahora cierra el modal abierto (ajustar, editar, historial) en vez de salir de la página.' },
      { t: 'El botón "atrás" del celular también cierra los modales del Punto de Venta, Productos, Usuarios y panel SuperAdmin.' },
      { t: 'Mejora visual general: nueva tipografía más legible, números alineados en precios y stock, animaciones suaves al abrir paneles, barra de filtros con efecto vidrio y el color de tu negocio como acento en el inventario.' },
      { t: 'POS: el buscador de productos es más ancho y los nombres largos se muestran completos (hasta 2 líneas).' },
      { t: 'POS: tocar la tarjeta de un producto en el carrito suma 1 unidad (igual que el botón +).' },
      { t: 'POS: al tocar la cantidad de un producto, el número queda seleccionado para tipear el nuevo valor directo.' },
      { t: 'Stock: botón Ajustar más discreto y elegante.' },
      { t: 'Formularios de Gastos y Facturación adaptados al celular (campos apilados).' },
    ],
  },
  {
    version: '2.5.1',
    fecha: '2026-06-11',
    titulo: 'Stock: vuelven los botones de siempre + filtro por categoría',
    destacados: [
      {
        titulo: '▶ Modo Conteo: el inventario más rápido',
        detalle: 'Cada sección tiene un botón "▶ Contar" que te lleva producto por producto: tipeás la cantidad y "Guardar y seguir" pasa al siguiente sin cerrar el teclado. Con barra de progreso, botón Omitir para saltear, y aviso cuando terminás la sección. Contar una góndola entera lleva segundos por producto.',
      },
    ],
    cambios: [
      { t: 'Stock: modo Conteo secuencial por sección (▶ Contar) — tipear, seguir, tipear, seguir.' },
      { t: 'Stock: chip "⚠ con stock bajo" para ver de un toque todo lo que hay que reponer.' },
      { t: 'Stock: el buscador y los filtros quedan fijos arriba al hacer scroll.' },
      { t: 'Stock: cada producto vuelve a tener sus botones Ajustar, Historial (🕒), Modificar (✏️) y Eliminar (🗑️).' },
      { t: 'Stock: "Ajustar" abre el teclado numérico con la cantidad seleccionada para tipear directo el conteo (también tiene + y −).' },
      { t: 'Stock: filtro por categoría real de productos, ideal para encontrar y reorganizar productos por góndola.' },
      { t: 'Stock: con un filtro de categoría activo, las secciones sin coincidencias se ocultan para menos ruido.' },
    ],
  },
  {
    version: '2.5.0',
    fecha: '2026-06-11',
    titulo: 'Stock renovado: organizá el inventario como tu local',
    destacados: [
      {
        titulo: '📦 Nueva pantalla de Stock para hacer inventario con el celular',
        detalle: 'Creá secciones propias (Góndola 1, Heladera, Depósito...) y arrastrá los productos para dejarlos en el mismo orden que tus estanterías. Después hacés el stock caminando por el local: la pantalla sigue el recorrido y actualizás cantidades con los botones + y − sin buscar nada. Tocá "✋ Organizar" para armar tus secciones la primera vez.',
      },
    ],
    cambios: [
      { t: 'Stock: secciones personalizadas independientes de las categorías de productos (reflejan el orden físico del local).' },
      { t: 'Stock: productos arrastrables (☰) para ordenarlos igual que en la góndola; las secciones también se reordenan.' },
      { t: 'Stock: botones grandes + / − y edición directa de cantidad, con guardado automático (pensado para el celular).' },
      { t: 'Stock: buscador rápido, indicador de stock bajo por sección e historial de movimientos con un toque en el producto.' },
      { t: 'SuperAdmin: las alertas ahora solo muestran las importantes (alta/crítica) y dejaron de consultarse cada 30 segundos.', super: true },
    ],
  },
  {
    version: '2.4.0',
    fecha: '2026-06-11',
    titulo: 'Respaldo automático y mejoras de productos',
    destacados: [
      {
        titulo: '⚠️ Filtro de stock bajo',
        detalle: 'En Productos, el botón "Stock bajo" te muestra de un vistazo todos los productos que están en o por debajo de su stock mínimo, para saber qué reponer.',
      },
      {
        titulo: '⧉ Duplicar producto',
        detalle: 'El botón ⧉ en cada producto crea una copia precargada (ideal para variantes como 500ml / 1L). Solo cambiás lo que difiere y guardás.',
      },
    ],
    cambios: [
      { t: 'Productos: filtro rápido "Stock bajo" para ver qué hay que reponer.' },
      { t: 'Productos: botón duplicar (⧉) para crear variantes sin cargar todo de nuevo.' },
      { t: 'Respaldo automático diario de la base de datos en el servidor, con rotación de copias.', super: true },
      { t: 'SuperAdmin: backups manuales, listado y descarga desde la API.', super: true },
      { t: 'SuperAdmin: visor de logs del servidor (en vivo o archivos guardados), bajo demanda para no consumir memoria.', super: true },
      { t: 'SuperAdmin: tarjetas de estadísticas globales (negocios, usuarios, ventas, facturado) y alertas pendientes visibles.', super: true },
      { t: 'SuperAdmin: la tabla de negocios ahora muestra última venta, facturado de los últimos 30 días y antigüedad del cliente.', super: true },
      { t: 'SuperAdmin: corregido el botón "Nuevo Negocio" que no abría el formulario.', super: true },
      { t: 'Los errores de pantalla ahora se reportan automáticamente a soporte (con negocio, usuario y detalle) para resolverlos sin pedirte capturas.' },
    ],
  },
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
