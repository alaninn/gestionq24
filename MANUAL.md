# 📖 Manual de uso — gestionQ24

Guía práctica de todas las funciones, botones y opciones del sistema.
Pensado para el usuario del negocio (admin, encargado o cajero).

> Versión del sistema: **2.9.1**

---

## 🔑 Ingreso

- Entrás con **usuario y contraseña** (el email es opcional).
- Según tu rol y permisos vas a ver el **Punto de Venta**, el **Panel de
  administración**, o ambos.
- Abajo del menú figura la **versión** del programa: tocala para ver las
  **novedades** (changelog) de cada actualización.

---

## 🛒 Punto de Venta (POS)

La pantalla para vender. Desde el celular alternás entre **Productos** (buscar y
agregar) y **Carrito** (cobrar) con la barra de abajo.

### Vender
1. Buscá el producto por **nombre o código de barras** (lector o tecleado). Los
   resultados aparecen ordenados por relevancia (lo que empieza con lo buscado va
   primero).
2. Tocá el producto (o su tarjeta en el carrito) para **sumar 1 unidad**. Tocá el
   número de cantidad para escribir el valor directo. Los productos por peso
   (Kg/Lt/Mt) abren una ventana para poner la cantidad.
3. En el **carrito** podés aplicar **Descuento**, **Recargo** y **Redondeo**
   (↓ bajar / ↑ subir) — el total se actualiza al instante antes de cobrar.
4. **Cobrar**: elegís el método (efectivo, tarjeta, transferencia, Mercado Pago,
   o **fiado** a cuenta corriente) y confirmás. Si activás **facturación
   electrónica**, sale Factura B por defecto (la A se elige a mano).

### Botones de la barra superior del POS
| Botón | Atajo | Para qué |
|-------|-------|----------|
| ⚡ **Rápida** | F1 | Venta rápida sin inventario (cargás nombre y precio al momento). Se puede desactivar desde Configuración. |
| 🏷️ **Alta rápida** | F7 | Dar de alta un **producto nuevo** al toque: solo el **nombre es obligatorio**; código de barras y precio son opcionales. Queda marcado **"por revisar"** para que un admin complete sus datos. |
| 👥 **Fiados** | F3 | Ver y gestionar las cuentas corrientes / fiados. |
| 📋 **Historial** | F5 | Ventas del turno actual. |
| 💸 **Gastos** | F10 | Cargar un gasto o pago a proveedor sin salir del POS. |
| 🔴 **Cierre** | F4 | Cerrar la caja (arqueo). |
| 🟢 **Caja: [nombre] ⇄** | — | Muestra en qué caja estás. Tocala para **cambiar de caja** sin cerrarla. |
| 🌙 / ☀️ | — | Modo oscuro / claro (preferencia de ese dispositivo). |
| 🔄 | — | **Actualizar** la pantalla limpiando caché (como Ctrl+Shift+R) si algo se traba. |
| 👤 | — | **Cambiar de usuario** (cambio de turno): cierra la sesión. |

### Otros atajos
`F2` enfocar el buscador · `F8` confirmar venta · `F9` limpiar carrito · `Escape`
cerrar la ventana abierta. El botón **"atrás"** del celular cierra la ventana
abierta en vez de salir de la página.

### Cajas
- Al entrar al POS elegís tu **caja**: las **cajas fijas del local** (Mañana,
  Tarde, Trasnoche…) aparecen con su estado — si está cerrada la abrís con tu
  efectivo inicial; si ya está abierta te unís. También podés crear una **caja
  eventual** para un caso puntual.
- Al **cerrar la caja** se hace el arqueo (cuánto declarás vs. lo que dice el
  sistema), se descuentan los gastos pagados con la caja, y al finalizar se
  **cierra tu sesión** para que entre el turno siguiente.

### Modo offline
Si se corta internet, el POS sigue vendiendo: las ventas se guardan en el
dispositivo y se **sincronizan solas** al volver la conexión.

---

## 📊 Dashboard

Resumen del negocio. Arranca con **"Tu día en el local"**:
- Total vendido del día, cantidad de ventas y ticket promedio.
- Desglose por método: 💵 efectivo, 🏦 transferencias, 💳 tarjetas, 📱 Mercado Pago.
- 🧾 Cuántas ventas se **facturaron** por ARCA.
- 💸 Gastos del día por origen, ventas por hora y lo más vendido.
- **Filtro de fecha** para ver cualquier día anterior.
- Tocá una tarjeta de método para ver **el detalle de esas ventas**, y dentro,
  tocá una venta para ver **qué productos** se vendieron.
- Más abajo: ventas del mes, gastos, ganancia, deudas, productos y stock bajo.

---

## 📦 Productos

- **Lista** de productos con búsqueda, filtro por categoría, y los chips
  **⚠️ Stock bajo** y **🏷️ Por revisar (N)**.
- Editá **precio o stock** tocándolos directo en la fila (Enter para guardar).
- Botones por producto: **Editar**, **Duplicar (⧉)** (para variantes 500ml/1L) y
  **Borrar**. En el celular se ven como tarjetas.
- **Productos por revisar**: los cargados con "Alta rápida" desde el POS aparecen
  con un aviso ⚠️. Apenas les ponés un precio, salen de la lista solos.
- **Actualizar Precios** (💲): subir/bajar por **porcentaje o monto fijo**, o fijar
  un precio exacto, aplicado a **todo / una categoría / lo seleccionado** (sobre
  venta, costo o ambos).
- **Importar Excel** (📥): descargás la plantilla, la completás y la subís.
  Reconoce las columnas por nombre y no duplica (si el código existe, actualiza).
- **Exportar Excel** y **eliminación masiva** (tildá varios; "eliminar todo"
  aparece solo dentro de la barra de selección).

### Categorías
Crear y eliminar categorías de productos (las usás para clasificar y filtrar).

---

## 📉 Stock (inventario)

Pensada para hacer el inventario caminando el local con el celular.
- **Secciones propias** (Góndola 1, Heladera, Depósito…) que reflejan el orden
  físico. Tocá **✋ Organizar** para armarlas y **arrastrar** (☰) los productos.
- **▶ Contar**: modo conteo secuencial por sección — tipeás la cantidad, "Guardar
  y seguir" pasa al siguiente sin cerrar el teclado. Con barra de progreso y botón
  Omitir.
- Cada producto tiene **Ajustar**, **Historial (🕒)**, **Editar (✏️)** y **Eliminar (🗑️)**.
- Filtro por categoría y chip de **stock bajo**.

---

## 🏦 Control de Caja

- **Cajas fijas del local**: creás/eliminás las cajas (Mañana, Tarde, Trasnoche).
- **Historial de cierres** por turno: muestra el nombre de la caja, **quién la
  cerró**, ventas por método, gastos y diferencias. Tocá un cierre para ver el
  detalle (resumen, arqueo y gastos).

---

## 👥 Cuentas Corrientes (fiados)

- Lista de clientes con su **deuda**. Tarjetas de deuda total, clientes con deuda
  y total de clientes.
- **Cobrar**: registrás un pago (efectivo/transferencia/MP/tarjeta), con botones
  50% / pago total.
- **Ficha del cliente (📊)**: historial completo — total gastado, cantidad de
  compras y ticket promedio, deuda, fiado histórico, pagos, desde cuándo es
  cliente, **gasto mes a mes** (tocás un mes y filtra), lo que más compra y todas
  sus compras (tocá una para ver los productos).

---

## 🚚 Proveedores

- Ver como **🗂️ Tarjetas** o **📋 Lista**. Indicadores: cuántos proveedores, cuánto
  "les debemos" y cuánto "nos deben".
- **Ficha del proveedor**: saldos (Nos debe / Le debemos), movimientos recientes,
  gasto por mes, total histórico, y acciones de **cobro/pago**.
- **Registrar pago/cobro**: elegís "Le pagamos" o "Nos paga", con el saldo a la
  vista y validación para no pagar de más. Podés adjuntar la boleta.
- **Historial completo** con filtros por período, y editar/eliminar cada
  movimiento (los saldos se ajustan solos).
- Crear, editar (nombre y teléfono), **archivar/reactivar** y eliminar.
- También podés **crear un proveedor al vuelo** desde el modal de Gastos.

---

## 💸 Gastos

Funciona como un **libro diario** de los movimientos de dinero del local.
- **Filtros** como el Dashboard: Hoy / Por día / Por mes / Rango / Todo, y por
  tipo (gastos, compras, pagos a proveedores).
- **Tarjetas por origen del dinero** (🧰 de caja, 🏪 del local, 📱 de MP): tocá una
  para filtrar el listado por ese origen.
- **Nuevo Gasto**: monto, descripción (qué se pagó), método, **de dónde sale el
  dinero** (caja/local/MP) y **dato fiscal** — *Gasto X* (sin comprobante) o
  *🧾 Factura A* (en blanco, suma IVA crédito al Resumen Fiscal). Otra pestaña es
  **Pago a Proveedor** (con su dato fiscal y origen).
- **Gasto avanzado** (📑): cargar una **boleta completa** a mano, con productos,
  precios, IVA y proveedor (ideal para compras en blanco con factura A).

---

## 🧾 Resumen Fiscal (Premium)

Libro de IVA del período: ventas facturadas por ARCA (IVA débito) y compras/gastos
en blanco con Factura A/B/C (IVA crédito), con exportación a Excel.

---

## 📈 Reportes

Historial de ventas y estadísticas con filtros por fecha (hoy/día/mes/rango):
- **Historial**: total vendido, cantidad, ticket promedio y desglose por método
  (efectivo, transferencias, tarjetas, MP) + cuántas se facturaron.
- Reportes de **productos más vendidos**, **por turno**, **rentabilidad** y
  **por categoría**, con exportación a PDF/Excel.

---

## ⚙️ Configuración (solo admin)

Datos del negocio (nombre, dirección, CUIT, condición IVA), color del sistema,
opciones del POS (venta rápida on/off, mostrar stock, precio mayorista,
descuento/recargo/redondeo), impresión de tickets (tamaño 58/80mm, automática),
y la **Facturación Electrónica** (certificado o conexión rápida con ARCA).

---

## 👤 Usuarios (solo admin)

- Crear empleados con rol **Encargado** o **Cajero** y elegir **qué paneles ve y
  qué puede hacer cada uno**.
- **Plantillas de rol**: aplicás de un toque los permisos típicos de Encargado o
  Cajero y después ajustás.
- Los permisos se marcan **por panel** (Dashboard, Productos, Stock, Control de
  Caja, Cuentas Corrientes, Proveedores, Gastos, Resumen Fiscal, Reportes,
  Soporte, POS) con sus acciones (ver, crear, editar, etc.).
- **Usuarios y Configuración** son siempre solo para administradores.
- Un usuario **sin permisos de panel** solo puede usar el Punto de Venta.

---

## 🎫 Soporte

Crear tickets de soporte para reportar problemas o pedir ayuda. Los errores de
pantalla se reportan **automáticamente** (no hace falta mandar capturas).

---

## 💡 Consejos

- Si una pantalla se traba, usá el botón **🔄** del POS (o Ctrl+Shift+R) para
  recargar limpiando la caché.
- El botón **atrás** del celular cierra la ventana abierta, no te saca del sistema.
- **Nada bloquea la venta**: ni el stock bajo ni los avisos impiden trabajar.
