# 📋 gestionQ24 — Contexto del proyecto y memoria de trabajo

> Documento maestro del proyecto. Si se pierde el contexto de una conversación,
> leé esto para saber qué es el sistema, cómo está construido, cómo trabajamos
> y todo lo que se fue haciendo. El **manual de uso** (funciones y botones para
> el usuario final) está en **`MANUAL.md`**.

---

## 🎯 Qué es

**gestionQ24** es un sistema de gestión / punto de venta (POS) para minimercados y
almacenes de Argentina. Es **multi-tenant** (un mismo sistema sirve a varios
negocios, cada uno con sus datos aislados por `negocio_id`) y se vende como
**SaaS** con planes Estándar y Premium.

- **En producción**: https://gestionq24.store
- **Hosting**: VPS de Don Web (Ubuntu, 1 GB de RAM) con nginx + SSL + pm2.
- **Dueño/cliente**: Alan (`reeberg.alan@gmail.com`).

---

## 🏗️ Stack y arquitectura

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite (rolldown) + Tailwind CSS + React Router |
| Backend | Node.js + Express |
| Base de datos | PostgreSQL (pool `pg`) |
| Auth | JWT (token en `localStorage`) |
| Proceso en prod | pm2 (`gestionq24`) detrás de nginx con SSL |
| Gráficos | recharts · Excel: xlsx · PDF/QR: en cliente |

### Backend (`/backend`)
```
server.js                  Servidor Express (monta todas las rutas)
setup-db.js                Migraciones idempotentes (las corre actualizar.sh)
config/database.js         Pool de PostgreSQL (exporta db.query y db.pool)
middleware/
  auth.js                  verificarToken, soloAdmin, soloSuperadmin, verificarPermiso
  planLimites.js           Límites por plan (tabla planes_config, cache 60s)
routes/
  auth.js                  Login (rate limiting)
  productos.js             CRUD productos, búsqueda, import Excel, masivos, alta rápida
  ventas.js                Registro de ventas
  categorias.js            Categorías de productos
  clientes.js              Clientes, fiados, pagos, historial
  proveedores.js           Proveedores, saldos, pagos, estadísticas
  gastos.js                Libro de gastos / compras / pagos a proveedor
  turnos.js                Cajas: fijas (cajas_definidas) + apertura/cierre/unirse/salir
  reportes.js              Dashboard, historial, control de caja, rentabilidad, etc.
  configuracion.js         Config del negocio (solo admin para escribir)
  usuarios.js              Usuarios del negocio (solo admin)
  superadmin.js            Panel superadmin (negocios, planes, backups, logs)
  arca.js                  Facturación electrónica ARCA/AFIP
  salud.js                 Health checks + reporte de errores del frontend
  soporte.js               Tickets de soporte
services/
  arcaService.js           WSFE: emisión de comprobantes (CAE)
  wsaaService.js           WSAA: tickets de acceso AFIP (cache por cert)
  backupService.js         Respaldo diario de la BD
  logBuffer.js             Buffer de logs en memoria para el visor del superadmin
```

### Frontend (`/frontend/src`)
```
api/axios.js               Cliente HTTP. Interceptor agrega el JWT y, si el
                           superadmin opera un negocio, el header x-negocio-id.
context/
  AuthContext.jsx          usuario, login/logout, tienePermiso(), esPremium()
  TemaContext.jsx          Color primario del negocio + modo oscuro
  ConectividadContext.jsx  Modo offline / sincronización del POS
hooks/useCerrarConAtras.js El botón "atrás" del celular cierra modales
pages/
  Login.jsx
  pos.jsx                  Punto de venta (≈3000 líneas, el corazón operativo)
  admin.jsx                Layout del panel admin + menú filtrado por permisos
  Superadmin.jsx           Panel superadmin
components/admin/
  Dashboard.jsx Productos.jsx Stock.jsx Gastos.jsx Proveedores.jsx
  Cuentascorrientes.jsx Controlcaja.jsx Reportes.jsx ResumenFiscal.jsx
  Configuracion.jsx usuarios.jsx Categorias.jsx Soporte.jsx
  FacturacionElectronica.jsx VentaProductoModal.jsx DetalleVenta.jsx ...
  ComprobanteElectronico.jsx (impresión fiscal con QR) · ticket.jsx (ticket común)
changelog.js               VERSION_ACTUAL + historial (se muestra dentro de la app)
```

---

## 🔐 Roles y permisos

### Roles
- **superadmin**: gestiona TODOS los negocios. Único, es el dueño del SaaS. No
  tiene límites de plan y puede operar cualquier negocio (header `x-negocio-id`).
- **admin**: acceso total a SU negocio. `tienePermiso()` siempre devuelve `true`.
- **encargado / cajero**: acceso según los permisos que el admin les marque.

### Permisos por panel (desde v2.9.1)
Cada panel del menú es un permiso (`modulo:ver`) que el admin activa por usuario.
Módulos: `dashboard, productos, stock, caja, clientes, proveedores, gastos,
resumen_fiscal, reportes, soporte, ventas`. Dentro de cada uno hay acciones
finas (`crear, editar, eliminar, anular, abrir, cerrar`).
- El menú (admin.jsx) muestra cada sección solo si el usuario tiene su `ver`.
- **Usuarios y Configuración son siempre solo-admin** (blindado en backend con
  `soloAdmin`, no se otorgan a empleados).
- Las rutas de **reportes** son solo lectura: no llevan gate de permiso (la
  visibilidad la controla el menú). Las **escrituras** (productos, gastos,
  proveedores, ventas) sí están protegidas con `verificarPermiso(modulo, accion)`.
- Plantillas de rol (Encargado / Cajero) en el editor de usuarios para cargar
  permisos típicos de un toque.

---

## 🧾 Facturación electrónica (ARCA/AFIP)

- **WSAA** (`wsaaService`): obtiene el ticket de acceso (válido 12 h; AFIP
  permite **un solo ticket vigente por certificado** — un ticket viejo da el
  error 600). Al subir un certificado se borran los tickets previos.
- **WSFE** (`arcaService`): emite el comprobante y obtiene el **CAE**.
- Campos clave: `CondicionIVAReceptorId` (RG 5616, obligatorio), IVA discriminado
  en Factura A, "IVA contenido" en Factura B (Ley 27.743 de Transparencia Fiscal).
- Por defecto se emite **Factura B** (consumidor final); la A se elige a mano.
- **Cualquier usuario que vende puede facturar** (no solo el admin).
- Dos formas de conectarse: certificado propio, o **delegación de servicio**
  (el negocio autoriza a gestionq24 desde su clave fiscal). La delegación está
  programada pero **dormida** hasta configurar el certificado del proveedor.
- Entornos: `homologacion` (pruebas) / `produccion` por negocio.

---

## 💵 Conceptos de negocio importantes

- **Cajas fijas** (`cajas_definidas`): el local define sus cajas (Mañana, Tarde,
  Trasnoche). Al entrar al POS el usuario abre/se une a una. También puede crear
  una caja eventual. Una caja fija no se abre dos veces a la vez. Al cerrar se
  guarda `usuario_cierre_id` y se cierra la sesión para el turno siguiente.
- **Origen del dinero en gastos** (`origen_dinero`): `caja` (descuenta del cierre
  del turno), `local` (plata del local) y `otro` (Mercado Pago del local).
- **Gastos = libro diario**: gastos, compras y pagos a proveedor, con filtros por
  fecha (hoy/día/mes/rango/todo) y por origen.
- **Dato fiscal del gasto**: "Gasto X" (sin comprobante) o "Factura A" (en blanco,
  suma IVA crédito al Resumen Fiscal).
- **Proveedores**: `saldo_a_favor` = lo que el negocio le debe al proveedor;
  `saldo_deuda` = lo que el proveedor le debe al negocio. Una compra a crédito
  suma deuda; un pago la baja; eliminar un movimiento revierte los saldos.
- **Productos "por revisar"** (`requiere_revision`): alta rápida desde el POS con
  solo el nombre; quedan marcados hasta que un admin les complete el precio.
- **Planes** (`planes_config`): límites de usuarios/productos y funciones
  (facturación, reportes avanzados) editables desde el panel superadmin.

---

## 🔄 Cómo trabajamos (flujo de desarrollo y despliegue)

1. Se programa y se prueba **en local** (build con `npm run build`; el backend
   sirve `frontend/dist` en el puerto 3001; en dev, Vite en 5173 con proxy a 3001).
2. Cada tanda de cambios se sube a **GitHub** (`git push origin master`).
3. En el VPS de Don Web se actualiza con:
   ```bash
   bash /root/gestionq24/actualizar.sh
   ```
   Ese script hace `git pull`, `npm install` si hace falta, corre las migraciones
   (`setup-db.js`, idempotentes), compila el frontend y reinicia pm2.
4. **Convención de versionado**: subir `VERSION_ACTUAL` en `frontend/src/changelog.js`
   y agregar la entrada nueva ARRIBA. Los cambios solo del panel superadmin se
   marcan con `super: true` (no se muestran en el changelog del usuario).
5. Reglas acordadas:
   - **Nada puede bloquear el trabajo**: ningún filtro de stock bajo ni nada
     impide vender o usar el sistema.
   - Tag de rollback estable disponible: `v2.5.2-estable`
     (`git fetch --tags && git reset --hard v2.5.2-estable`).
   - Migraciones siempre idempotentes (`ADD COLUMN IF NOT EXISTS`, etc.).

### Scripts útiles en el servidor
```bash
# Resetear saldos de proveedores a cero
node backend/scripts/limpiar-proveedores.js     # también borra movimientos de proveedores
```

### Variables de entorno (`backend/.env`)
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=almacenq24
DB_USER=postgres
DB_PASSWORD=...
JWT_SECRET=...
PORT=3001
# ARCA delegación (opcional, dormido):
# ARCA_DELEGADO_CUIT=  ARCA_DELEGADO_CERT=  ARCA_DELEGADO_KEY=
```

---

## 🗄️ Tablas principales

`negocios, usuarios, productos, producto_codigos, categorias, stock_categorias,
ventas, venta_items, clientes, pagos_deuda, proveedores, gastos, turnos,
cajas_definidas, turno_usuarios, configuracion, planes_config,
certificados_arca, comprobantes_electronicos, tickets_acceso_wsaa, alertas,
tickets_soporte, salud_negocio, pagos_historial, errores_frontend, historial_stock`.

Columnas que se fueron agregando por migración (en `setup-db.js`): `gastos.usuario_id`,
`gastos.origen_dinero`, `productos.requiere_revision`, `productos.stock_categoria_id`,
`turnos.usuario_cierre_id`, `turnos.caja_definida_id`,
`comprobantes_electronicos.condicion_iva_receptor`, entre otras.

---

## 🧠 Bugs/decisiones que conviene recordar

- **Case-sensitive en Linux**: los nombres de archivos importan en el VPS (no en
  Windows). Imports y nombres reales deben coincidir (ej. `controlcaja.jsx`).
- **Fechas en reportes**: cualquier fecha por query se sanea (`fechaONull` /
  `rangoSeguro`) para no romper PostgreSQL con `''::date` (DateTimeParseError).
- **IVA en compras**: el precio cargado es lo que se paga; solo la Factura A
  discrimina IVA. No sumar 21% encima del precio en B/C o sin factura.
- **paramsOrden separado de valores** en la búsqueda de productos (el COUNT no
  debe recibir los params extra del ORDER BY por relevancia).
- **Búsqueda del POS**: relevancia por SQL (prefijo primero) sin romper la
  búsqueda multi-palabra ("coca 2.25").

---

## 📌 Historial de versiones (resumen)

El detalle vive en `frontend/src/changelog.js` (y se muestra dentro de la app).
Resumen de hitos:

- **2.9.x** — Permisos por panel del menú + plantillas de rol. Alta rápida de
  productos en el POS (por revisar). Permisos de proveedores para empleados.
  Tarjetas de gastos por origen. Fix de fechas en reportes.
- **2.8.x** — Cajas fijas por turno + responsable de cierre + deslogueo. Historial
  por cliente. Circuito de proveedores (saldos, pagos, compras a crédito). Gastos
  como libro diario con dato fiscal X / Factura A.
- **2.7.x** — Dashboard "Tu día en el local" con desglose por método y filtro de
  fecha. Planes configurables (superadmin). Facturación ARCA según RG 5616 para
  todos los usuarios. Tickets térmicos legibles.
- **2.6.x** — Búsqueda inteligente del POS. Gastos con origen del dinero que
  cierran la caja. Límites de plan corregidos.
- **2.5.x** — Pantalla de Stock renovada (secciones por góndola, modo conteo,
  drag&drop, conteo sobre el teclado del celular).
- **2.4.x** — Respaldo automático de la BD, visor de logs y stats en superadmin.
- **2.3.x** — Facturación electrónica más fácil (conexión rápida/delegación).
- **2.2.x** — Descuento/recargo/redondeo en el carrito. Actualización masiva de
  precios. Configuración revisada.
- **2.1.x** — Importación/eliminación masiva de productos. POS para celular.
  Versión y changelog visibles.
- **2.0.0** — Sistema de planes y base estable (POS offline, reportes, caja,
  cuentas corrientes, panel superadmin).

---

**Última actualización de este documento**: 14 de junio de 2026 · versión del sistema **2.9.1**
