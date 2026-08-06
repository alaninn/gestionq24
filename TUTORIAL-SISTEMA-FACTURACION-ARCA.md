# Tutorial: crear un sistema POS multi‑negocio que factura con ARCA/AFIP

> **Para quién es esto:** para una IA (o una persona) que quiera **arrancar un sistema nuevo**
> parecido a este (un POS/gestión SaaS multi‑negocio) pero enfocado en **otro rubro**, sin
> empezar de cero y **sin volver a resolver los problemas que ya resolvimos** — sobre todo la
> **facturación electrónica de AFIP/ARCA**, que es la parte más difícil.
>
> **Cómo usarlo:** leelo de arriba a abajo una vez para entender el modelo mental, y después
> usá las secciones 6–8 y 12 como referencia mientras implementás. Los bloques de código son
> **reales y funcionan** (salen de los sistemas `almacenq24` y `burgerpos`, ambos facturando en
> producción). Copialos y adaptá nombres/rubro.
>
> Sistemas de referencia: **almacenq24/gestionq24** (backend plano) y **burgerpos** (backend
> MVC con Sequelize). El módulo de ARCA es prácticamente idéntico entre los dos.

---

## Índice
1. Qué vas a construir
2. Arquitectura y stack
3. Estructura de carpetas
4. Base multi‑negocio (multi‑tenant) y planes/premium
5. Despliegue (VPS, pm2, `.env`, SSH)
6. **Facturación electrónica ARCA/AFIP — a fondo**
7. Los dos modos de conexión (certificado propio vs conexión rápida/delegación)
8. Gateway de ticket compartido (cuando dos sistemas comparten un CUIT)
9. Esquema de base de datos
10. Servicios/archivos a replicar
11. Frontend de facturación
12. Pruebas y scripts de diagnóstico (reutilizables)
13. Problemas ya resueltos (gotchas) — leé esto sí o sí
14. Checklist para arrancar un sistema nuevo

---

## 1. Qué vas a construir
Un sistema web multi‑negocio (SaaS) donde:
- Cada **negocio** (tenant) tiene sus usuarios, productos, ventas, caja, reportes.
- Hay un **superadmin** que da de alta negocios, cobra suscripciones, activa funciones.
- Hay **planes** (estándar/premium) y funciones que se prenden/apagan por plan o por negocio.
- Los negocios pueden **facturar electrónicamente** ante AFIP/ARGENTINA (ARCA) con **CAE real**,
  ya sea con su **propio certificado** o por **conexión rápida** (delegando en un CUIT maestro).

La facturación es lo que más cuesta. El resto (productos, ventas, caja) es CRUD estándar.

---

## 2. Arquitectura y stack
- **Frontend:** React 18 + Vite. Build a archivos estáticos que el backend sirve.
- **Backend:** Node + Express + PostgreSQL.
- **Infra:** un VPS Linux con **pm2** (proceso siempre vivo) y **nginx** (reverse proxy + SSL).
- **Auth:** JWT. El token lleva `id, email, rol, negocio_id, plan`, dura 24 h.

Dos estilos de backend que vas a ver:
- **Plano** (almacenq24): `backend/routes/*.js`, `backend/services/*.js`,
  `backend/config/database.js` con el driver `pg` crudo (`db.query('SELECT ...', [params])`),
  `backend/setup-db.js` que crea/migra tablas.
- **MVC** (burgerpos): `backend/src/models/*` (Sequelize), `controllers/*`, `routes/*`,
  `services/*`, migraciones en `src/migrations/*`.

**El módulo ARCA es portable entre los dos.** Cambia sólo el acceso a datos (pg crudo vs
Sequelize). La lógica de WSAA/WSFEv1 es idéntica.

---

## 3. Estructura de carpetas (backend plano, recomendado para arrancar)
```
backend/
  config/database.js         # pool de pg + db.query()
  middleware/auth.js         # verificarToken, soloAdmin, verificarPermiso
  routes/
    auth.js                  # login en 2 pasos, /me
    arca.js                  # facturación (config cert, emitir, delegación)
    arcaGateway.js           # endpoint interno de ticket compartido (ver sección 8)
    ...
  services/
    wsaaService.js           # autenticación WSAA (ticket de acceso)
    arcaService.js           # emisión WSFEv1 (CAE), certificados, notas de crédito
  uploads/certificados/      # .crt / .key / .csr por negocio (NO se versiona)
  setup-db.js                # crea/migra tablas (idempotente)
  server.js                  # arma Express, monta rutas, listen(3001)
  .env                       # secretos (NO se versiona)
frontend/
  src/pages/admin/FacturacionElectronica.jsx
  ...
actualizar.sh                # deploy en el VPS
```

---

## 4. Base multi‑negocio y planes/premium
- **Scoping:** todo se filtra por `negocio_id`. En el middleware, `req.negocio_id` sale del token
  (o del header `x-negocio-id` si un superadmin está "impersonando" un negocio).
- **Login en 2 pasos:** (1) *acceso del negocio* (mail+clave → fija el equipo a un negocio, guarda
  un `x-device-token`); (2) *login de usuario* (usuario corto + clave, scopeado a ese negocio).
- **Planes/premium (patrón para prender/apagar features):**
  - Columnas: `planes_config.<feature> BOOLEAN` (capacidad del plan) y
    `negocios.<feature>_habilitado BOOLEAN DEFAULT FALSE` (override por negocio).
  - Efectivo = capacidad del plan **OR** override del negocio **OR** es superadmin.
  - Se expone en `GET /api/usuarios/plan-info` dentro de `caracteristicas`.
  - En el front: `puedeUsarFuncion('facturacion_electronica')` decide si se ve el módulo.
  - Migraciones idempotentes y **apagado por defecto**.

> La facturación electrónica suele ser una feature premium: gateá el módulo con
> `puedeUsarFuncion('facturacion_electronica')`.

---

## 5. Despliegue (VPS, pm2, `.env`, SSH)

### `actualizar.sh` (patrón)
```bash
#!/bin/bash
cd /root/miapp || exit 1
# 1) Respaldar .env (tiene secretos y NO se versiona)
[ -f backend/.env ] && cp backend/.env /root/.env-backup
# 2) Bajar cambios (sin que archivos locales bloqueen)
git stash 2>/dev/null; git pull origin main
# 3) Restaurar .env
[ -f /root/.env-backup ] && cp /root/.env-backup backend/.env
# 4) Dependencias + migraciones idempotentes + build
cd backend && npm install --omit=dev && node setup-db.js
cd ../frontend && npm install && npm run build
# 5) Reiniciar
pm2 restart miapp --update-env
pm2 status
```
Reglas:
- **`.env` nunca se versiona.** `actualizar.sh` lo respalda y restaura en cada deploy.
- **Migraciones idempotentes** (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`).
- Después de deploy: verificar `pm2 status` = `online` y, si tocaste facturación, que el
  `out.log` muestre `✅ Comprobante emitido con CAE real`.

### SSH con contraseña (truco `SSH_ASKPASS`, para automatizar desde Windows/Git Bash)
```bash
export VPS_PASS="$(grep '^VPS_PASS=' .vps-credenciales | cut -d= -f2-)"
printf '#!/bin/sh\necho "$VPS_PASS"\n' > /tmp/askpass.sh && chmod +x /tmp/askpass.sh
export SSH_ASKPASS=/tmp/askpass.sh SSH_ASKPASS_REQUIRE=force DISPLAY=:0
ssh -o StrictHostKeyChecking=no -p 5041 root@TU_VPS "bash /root/miapp/actualizar.sh" < /dev/null
```

### `.env` (backend) — variables típicas
```env
# Base de datos
DB_HOST=localhost
DB_PORT=5432
DB_NAME=miapp
DB_USER=postgres
DB_PASSWORD=...
# Auth
JWT_SECRET=...
PORT=3001
# ARCA — conexión rápida (certificado maestro del proveedor). Opcional.
ARCA_DELEGADO_CUIT=23359052979
ARCA_DELEGADO_CERT=certificados/delegado.crt   # relativo a backend/uploads/
ARCA_DELEGADO_KEY=certificados/delegado.key
# ARCA — gateway de ticket compartido entre 2 sistemas. Opcional (sección 8).
TA_GATEWAY_SECRET=...            # en el sistema DUEÑO del ticket
TA_GATEWAY_URL=http://localhost:3001/api/arca/ticket-compartido   # en el CLIENTE
TA_GATEWAY_CUIT=23359052979      # en el CLIENTE
```

---

## 6. Facturación electrónica ARCA/AFIP — a fondo

### 6.1 Conceptos
- **CUIT:** identificación fiscal del emisor.
- **Certificado digital** = un **`.crt`** (público, firmado por AFIP) + su **`.key`** (clave
  privada). Se genera a partir de un **CSR** (pedido de certificado).
- **WSAA** (Web Service de Autenticación y Autorización): le mandás un pedido firmado con tu
  certificado y te devuelve un **TA (Ticket de Acceso) = token + sign**, válido **~12 horas**.
- **WSFEv1** (Facturación Electrónica): con el TA, pedís el **CAE** (código de autorización) de
  cada comprobante.
- **Entornos:** `homologacion` (pruebas) y `produccion` (real). URLs distintas.

| Servicio | Homologación | Producción |
|---|---|---|
| WSAA | `https://wsaahomo.afip.gov.ar/ws/services/LoginCms` | `https://wsaa.afip.gov.ar/ws/services/LoginCms` |
| WSFEv1 | `https://wswhomo.afip.gov.ar/wsfev1/service.asmx` | `https://servicios1.afip.gov.ar/wsfev1/service.asmx` |

> **`Auth.Cuit` = el CUIT del EMISOR** (el que factura). En delegación, es el CUIT del negocio
> representado, aunque la autenticación use el certificado del maestro.

### 6.2 Ciclo de vida del certificado
1. Generás **clave privada + CSR** en el servidor (con `node-forge`).
2. Subís el **CSR** a AFIP.
3. AFIP te devuelve el **`.crt`** firmado.
4. Guardás **`.crt` + `.key`** juntos y los asociás al negocio.

> 🔴 **GOTCHAS críticos del certificado:**
> - **AFIP nunca te da la clave privada.** Vos la generás; el `.crt` queda "casado"
>   matemáticamente con **esa** `.key`.
> - **Mismo CUIT ≠ misma key.** Cada vez que generás un certificado se crea una key nueva. Un
>   `.crt` sólo sirve con la `.key` exacta con la que se hizo el CSR.
> - **Re‑descargar el `.crt` de AFIP no recupera la key.** Si perdés la `.key`, el `.crt` es
>   inservible → **hay que rehacer el certificado** (nueva key + nuevo CSR + re‑emitir en AFIP).
> - **Nombres de archivo:** `cert_<CUIT>_<timestamp>.crt`, `key_<CUIT>_<timestamp>.key`,
>   `csr_<CUIT>_<timestamp>.csr`. Así **no se pisan** los certificados de distintos negocios, y
>   cada fila en la BD apunta a su archivo.

### 6.3 Pasos manuales en AFIP (una vez por CUIT)
> No se pueden automatizar; se hacen en el sitio de AFIP con clave fiscal. `[captura]` = lugar
> donde conviene pegar una imagen.
1. **Clave fiscal nivel 3** del CUIT. `[captura]`
2. **Administrador de Relaciones** → adherir el servicio **"WebServices"** / habilitar el WS. `[captura]`
3. **Administración de Certificados Digitales** → *Crear certificado* → poné un **alias** (ej:
   "gestionq24") y **subí el CSR** que generó tu backend → descargá el **`.crt`** firmado. `[captura]`
4. **Administrador de Relaciones** → *Nueva relación* → servicio **"Facturación Electrónica"
   (wsfe)** → representante = **tu certificado** (o, para delegación, el CUIT maestro). `[captura]`
5. Dar de alta un **punto de venta** para web services (RECE/WS) en el sitio de AFIP. `[captura]`

### 6.4 WSAA — obtener el ticket de acceso
**`crearTRA`** (pedido de ticket):
```js
function crearTRA(servicio = 'wsfe') {
  const ahora = new Date();
  const exp = new Date(ahora.getTime() + 10 * 60 * 1000); // 10 min
  const f = (d) => d.toISOString().substring(0, 19) + '+00:00';
  return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${Math.floor(Date.now()/1000)}</uniqueId>
    <generationTime>${f(ahora)}</generationTime>
    <expirationTime>${f(exp)}</expirationTime>
  </header>
  <service>${servicio}</service>
</loginTicketRequest>`;
}
```
**`firmarTRA`** (CMS PKCS#7 con node-forge):
```js
const forge = require('node-forge'), fs = require('fs');
function firmarTRA(tra, certPath, keyPath) {
  const cert = forge.pki.certificateFromPem(fs.readFileSync(certPath, 'utf8'));
  const key  = forge.pki.privateKeyFromPem(fs.readFileSync(keyPath, 'utf8'));
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(tra, 'utf8');
  p7.addCertificate(cert);
  p7.addSigner({
    key, certificate: cert, digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  });
  p7.sign();
  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  return forge.util.encode64(der);  // CMS en base64
}
```
Después se manda el CMS dentro de un envelope SOAP `loginCms` por POST al WSAA, y se **parsea el
`loginTicketResponse` anidado** (viene HTML‑encodeado dentro de `loginCmsReturn`):
```js
const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true });
const r = await parser.parseStringPromise(response.data);
const body = r['soapenv:Envelope']?.['soapenv:Body'] || r['Envelope']?.['Body'] || r['soap:Envelope']?.['soap:Body'];
const login = body['loginCmsResponse'] || body['ns1:loginCmsResponse'];
const inner = (login.loginCmsReturn || login.loginTicketReturn)
  .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&amp;/g,'&');
const parsed = await parser.parseStringPromise(inner);
const { token, sign } = parsed.loginTicketResponse.credentials;
const { expirationTime } = parsed.loginTicketResponse.header;
```
> 🔴 **GOTCHA:** cuando AFIP rechaza el CMS (cert vencido, no autorizado, o **ya hay un TA
> vigente**), responde **HTTP 500 con un `<faultstring>`**. Hay que capturar el error de axios y
> extraer el `faultstring` para saber el motivo real:
> ```js
> const m = (err?.response?.data || '').match(/<faultstring>([\s\S]*?)<\/faultstring>/i);
> if (m) throw new Error('WSAA rechazó: ' + m[1].trim());
> ```

### 6.5 🔴 La regla de oro del TA (el problema #1)
**AFIP permite UN solo TA por (certificado, servicio) cada ~12 h.** Si pedís otro mientras hay
uno vigente, te lo **rechaza** ("El CEE ya posee un TA valido para el acceso al WSN solicitado").
→ Por eso **siempre** hay que **cachear el TA en la base** y **reusarlo** hasta que expire:
```js
async function obtenerTicketAcceso(negocioId, servicio = 'wsfe') {
  const cache = await obtenerTicketValido(negocioId, servicio); // SELECT ... WHERE expiracion > NOW()
  if (cache) return cache;                                       // reusar
  const nuevo = await solicitarTicketAcceso(negocioId, servicio);// pedir a AFIP sólo si venció
  await almacenarTicket(negocioId, servicio, nuevo);
  return nuevo;
}
```
Tabla `tickets_acceso_wsaa` (ver sección 9). Este patrón se complica cuando **dos sistemas**
comparten el mismo certificado → sección 8.

### 6.6 WSFEv1 — pedir el CAE
Flujo: primero `FECompUltimoAutorizado` (último número emitido) → después `FECAESolicitar` con
`CbteDesde = CbteHasta = último + 1`.

`FECAESolicitar` (el XML real que funciona):
```xml
<ar:FECAESolicitar>
  <ar:Auth><ar:Token>{token}</ar:Token><ar:Sign>{sign}</ar:Sign><ar:Cuit>{cuitEmisor}</ar:Cuit></ar:Auth>
  <ar:FeCAEReq>
    <ar:FeCabReq><ar:CantReg>1</ar:CantReg><ar:PtoVta>{pv}</ar:PtoVta><ar:CbteTipo>{tipo}</ar:CbteTipo></ar:FeCabReq>
    <ar:FeDetReq><ar:FECAEDetRequest>
      <ar:Concepto>1</ar:Concepto>
      <ar:DocTipo>{docTipo}</ar:DocTipo><ar:DocNro>{docNro}</ar:DocNro>
      <ar:CbteDesde>{nro}</ar:CbteDesde><ar:CbteHasta>{nro}</ar:CbteHasta>
      <ar:CbteFch>{YYYYMMDD}</ar:CbteFch>
      <ar:ImpTotal>{total}</ar:ImpTotal><ar:ImpTotConc>0.00</ar:ImpTotConc>
      <ar:ImpNeto>{neto}</ar:ImpNeto><ar:ImpOpEx>0.00</ar:ImpOpEx>
      <ar:ImpIVA>{iva}</ar:ImpIVA><ar:ImpTrib>0.00</ar:ImpTrib>
      <ar:MonId>PES</ar:MonId><ar:MonCotiz>1.000</ar:MonCotiz>
      <ar:CondicionIVAReceptorId>{cond}</ar:CondicionIVAReceptorId>
      <!-- El bloque <Iva> va SOLO si hay IVA (>0): -->
      <ar:Iva><ar:AlicIva><ar:Id>5</ar:Id><ar:BaseImp>{neto}</ar:BaseImp><ar:Importe>{iva}</ar:Importe></ar:AlicIva></ar:Iva>
    </ar:FECAEDetRequest></ar:FeDetReq>
  </ar:FeCAEReq>
</ar:FECAESolicitar>
```
POST con header `SOAPAction: http://ar.gov.afip.dif.FEV1/FECAESolicitar`. Respuesta: buscar
`FECAESolicitarResult.FeDetResp.FECAEDetResponse`; si `Resultado === 'A'` → tomar `CAE` y
`CAEFchVto`. Si no, leer `Observaciones/Errors/Events` para el motivo.

**Datos por tipo de comprobante:**
| Régimen | Comprobante | tipo | IVA | Neto |
|---|---|---|---|---|
| Monotributista | Factura C | 11 | 0 | neto = total |
| Resp. Inscripto | Factura B | 6 | 21% | neto = total/1.21 |
| Resp. Inscripto | Factura A | 1 | 21% | neto = total/1.21 |

Notas de crédito: A→3, B→8, C→13. Notas de débito: 2/7/12.
`CondicionIVAReceptorId` (RG 5616, **obligatorio**): 1=RI, 4=Exento, 5=Consumidor Final,
6=Monotributo. Para consumidor final: `DocTipo=99`, `DocNro=0`, cond=5.

> 🔴 **GOTCHA fecha (error 10016):** `CbteFch` va en **hora Argentina** (YYYYMMDD) y **nunca**
> puede ser anterior a la fecha del último comprobante autorizado de ese punto de venta. Si el
> último salió "hoy AR" y tu server calcula "ayer UTC", AFIP tira 10016 y traba el PV. Solución:
> consultar la fecha del último autorizado (`FECompConsultar`) y usar el máximo entre esa y hoy.

### 6.7 Emitir y anular
- `emitirComprobante(datos)` hace todo lo de arriba y **guarda** el comprobante en
  `comprobantes_electronicos` con el CAE. Si falla, guarda una fila con `estado='error'` y el XML.
- `emitirNotaCredito({ negocioId, comprobanteId })` busca la factura original, la mapea a NC
  (11→13, 6→8, 1→3), copia importes/doc/condición y emite la NC → **anula** la factura.

---

## 7. Los dos modos de conexión

### 7.1 Certificado propio
Cada negocio sube/genera **su** certificado (su CUIT). Fila propia en `certificados_arca` con
`modo='propio'`, `cert_path`/`key_path` a sus archivos (`cert_<CUIT>_<ts>`). No se pisan entre
negocios. El TA se cachea por `negocio_id`.

### 7.2 Conexión rápida (delegación)
Para que un negocio **no tenga que sacar su propio certificado**: se usa **un certificado
maestro** (el del proveedor del sistema) configurado por env:
```env
ARCA_DELEGADO_CUIT=23359052979
ARCA_DELEGADO_CERT=certificados/delegado.crt
ARCA_DELEGADO_KEY=certificados/delegado.key
```
El negocio, en el sitio de AFIP, **delega** su servicio "Facturación Electrónica" al CUIT
maestro. En el sistema activa "conexión rápida" (`modo='delegado'`, guarda su CUIT + punto de
venta). Al facturar: se **autentica con el certificado maestro** pero el `Auth.Cuit` y el
comprobante salen con **el CUIT del negocio**. El TA es **compartido** entre todos los negocios
delegados (se cachea con servicio `wsfe-delegado` y se lee **por servicio**, no por negocio):
```js
function obtenerCertDelegado() {
  const cuit = process.env.ARCA_DELEGADO_CUIT;
  const certRel = process.env.ARCA_DELEGADO_CERT, keyRel = process.env.ARCA_DELEGADO_KEY;
  if (!cuit || !certRel || !keyRel) return { disponible: false, error: 'delegación no configurada' };
  const base = path.join(__dirname, '../uploads');       // ajustar según estructura
  const certPath = path.join(base, certRel), keyPath = path.join(base, keyRel);
  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) return { disponible: false, error: 'faltan archivos' };
  return { disponible: true, cuit, certPath, keyPath };
}
```
Endpoints: `GET /delegacion-info` (¿disponible? ¿a qué CUIT delegar?) y
`POST /activar-delegacion` (crea la credencial `modo='delegado'`). El front muestra un asistente.

---

## 8. Gateway de ticket compartido (dos sistemas, mismo CUIT)

**El problema:** si tenés **dos sistemas independientes** (dos bases de datos, dos deploys) que
usan **el mismo certificado/CUIT** (ej: `gestionq24` y `burgerpos` comparten `23359052979`), cada
uno cachea **su propio TA**. Como AFIP da **un solo TA por certificado cada 12 h**, cuando uno
pide un TA nuevo mientras el otro tiene uno vigente, **AFIP rechaza al segundo** → ese sistema no
factura hasta que expire el del otro (hasta 12 h de corte). El "modo" (propio/delegado) no
importa: el conflicto es por **dos cachés separadas del mismo certificado**.

**La solución:** que **un sistema sea el dueño del ticket** y el otro se lo pida.

**En el sistema DUEÑO** (`gestionq24`): función que entrega el TA compartido (pide a AFIP sólo si
venció) + un endpoint interno protegido por secreto, montado **antes** del `/api/arca` con login:
```js
// wsaaService.js
async function obtenerTicketDelegadoCompartido(servicio = 'wsfe') {
  const cacheServicio = `${servicio}-delegado`;
  const c = await db.query(
    `SELECT token, sign, expiracion FROM tickets_acceso_wsaa
     WHERE servicio=$1 AND expiracion > NOW() ORDER BY created_at DESC LIMIT 1`, [cacheServicio]);
  if (c.rows.length) return { ...c.rows[0], cacheado: true };
  const delegado = obtenerCertDelegado();
  if (!delegado.disponible) throw new Error(delegado.error);
  const ticket = /* firmar TRA con delegado.cert/key + POST WSAA producción + parsear */;
  const holder = parseInt(process.env.ARCA_DELEGADO_HOLDER_NEGOCIO || '1', 10); // negocio "titular" (la FK exige uno)
  await db.query(`INSERT INTO tickets_acceso_wsaa (negocio_id, servicio, token, sign, expiracion)
                  VALUES ($1,$2,$3,$4,$5)`, [holder, cacheServicio, ticket.token, ticket.sign, new Date(ticket.expirationTime)]);
  return { token: ticket.token, sign: ticket.sign, expiracion: ticket.expirationTime, cacheado: false };
}
```
```js
// routes/arcaGateway.js  (montar en server.js ANTES del /api/arca con JWT:
//   app.use('/api/arca', require('./routes/arcaGateway'));
//   app.use('/api/arca', verificarToken, ..., rutasArca);   )
router.get('/ticket-compartido', async (req, res) => {
  if (!process.env.TA_GATEWAY_SECRET || req.get('x-ta-secret') !== process.env.TA_GATEWAY_SECRET)
    return res.status(403).json({ error: 'No autorizado' });
  const servicio = (req.query.servicio || 'wsfe').replace(/[^a-z0-9]/gi, '') || 'wsfe';
  const ta = await wsaaService.obtenerTicketDelegadoCompartido(servicio);
  res.json({ token: ta.token, sign: ta.sign, expiracion: ta.expiracion, cacheado: ta.cacheado });
});
```
**En el sistema CLIENTE** (`burgerpos`): en `obtenerTicketAcceso`, si el certificado a usar es el
maestro compartido, pedir el TA al gateway en vez de a AFIP (con **fallback** al flujo directo):
```js
async function obtenerTicketDesdeGateway(servicio = 'wsfe') {
  const url = process.env.TA_GATEWAY_URL, secret = process.env.TA_GATEWAY_SECRET;
  if (!url || !secret) return null;
  try {
    const r = await axios.get(url, { params: { servicio }, headers: { 'x-ta-secret': secret }, timeout: 15000 });
    if (r.data?.token && r.data?.sign) return { token: r.data.token, sign: r.data.sign, expirationTime: r.data.expiracion };
  } catch (e) { console.error('gateway falló:', e.response?.data?.error || e.message); }
  return null;
}
// dentro de obtenerTicketAcceso, después del cache local y antes de pedir a AFIP:
const cuitGateway = (process.env.TA_GATEWAY_CUIT || '').replace(/[-\s]/g, '');
const cuitMaster  = (process.env.ARCA_DELEGADO_CUIT || '').replace(/[-\s]/g, '');
const usarGateway = process.env.TA_GATEWAY_URL && cuitGateway &&
  (cuitCred === cuitGateway || (esDelegado && cuitMaster === cuitGateway));
if (usarGateway) {
  const tgw = await obtenerTicketDesdeGateway(servicio);
  if (tgw) { await almacenarTicket(negocioId, servicioCache, tgw); return { token: tgw.token, sign: tgw.sign }; }
}
```
**Cutover sin cortes:** hacé el cambio cuando **no hay ningún TA vigente** (ninguno de los dos
está facturando en ese momento) o **sembrá** la caché del dueño con el TA vigente del cliente
(mismo certificado → el token/sign sirven para los dos). Después, sólo el dueño pide TA nuevos.

---

## 9. Esquema de base de datos (las 3 tablas de ARCA)
```sql
-- Certificado por negocio (propio o delegado)
CREATE TABLE IF NOT EXISTS certificados_arca (
  id SERIAL PRIMARY KEY,
  negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  cuit VARCHAR(15) NOT NULL,
  cert_path TEXT, key_path TEXT,          -- null en modo delegado
  punto_venta INTEGER DEFAULT 1,
  regimen_fiscal VARCHAR(30) DEFAULT 'responsable_inscripto',
  entorno_produccion BOOLEAN DEFAULT FALSE,
  modo VARCHAR(20) NOT NULL DEFAULT 'propio',   -- 'propio' | 'delegado'
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Caché del ticket de acceso WSAA (clave para no pedir dos por certificado)
CREATE TABLE IF NOT EXISTS tickets_acceso_wsaa (
  id SERIAL PRIMARY KEY,
  negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  servicio VARCHAR(50) DEFAULT 'wsfe',    -- 'wsfe' o 'wsfe-delegado' (compartido)
  token TEXT NOT NULL, sign TEXT NOT NULL,
  expiracion TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Comprobantes emitidos
CREATE TABLE IF NOT EXISTS comprobantes_electronicos (
  id SERIAL PRIMARY KEY,
  negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  cae VARCHAR(20), cae_vencimiento DATE,
  numero_comprobante INTEGER, punto_venta INTEGER, tipo_comprobante INTEGER,
  letra_comprobante VARCHAR(2),
  tipo_documento INTEGER, numero_documento VARCHAR(20), denominacion_comprador VARCHAR(200),
  importe_total NUMERIC(12,2), importe_neto NUMERIC(12,2), importe_iva NUMERIC(12,2),
  condicion_iva_receptor INTEGER,
  cbte_fecha VARCHAR(8),
  xml_enviado TEXT, xml_respuesta TEXT,
  estado VARCHAR(20) DEFAULT 'emitido',   -- 'emitido' | 'error' | 'anulado'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```
> 🔴 **GOTCHA setup-db:** si tu `setup-db.js` arma las migraciones partiendo un string SQL por
> `;`, **los comentarios NO pueden tener `;`** (parte la sentencia y rompe la migración).

---

## 10. Servicios/archivos a replicar
**`services/wsaaService.js`** (autenticación):
`crearTRA(servicio)`, `firmarTRA(tra, certPath, keyPath)`, `solicitarTicketAcceso(negocioId, servicio)`,
`obtenerTicketValido(negocioId, servicio, compartido)`, `almacenarTicket(...)`,
`obtenerTicketAcceso(negocioId, servicio)`, `obtenerCertDelegado()`,
`obtenerTicketDelegadoCompartido(servicio)` (para el gateway).

**`services/arcaService.js`** (emisión):
`generarCertificados(cuit, razonSocial)` (key+CSR con node-forge),
`guardarCertificado(buffer, cuit)`, `verificarCertificado(certPath)` (chequea vencimiento),
`obtenerTiposComprobante(regimen)`, `obtenerUltimoNumero(...)` (FECompUltimoAutorizado),
`emitirComprobante(datos)`, `emitirNotaCredito({negocioId, comprobanteId})`,
`obtenerComprobantes(negocioId, filtros)`.

**Rutas:** `routes/arca.js` (config cert, test-conexión, emitir, delegación) + `routes/arcaGateway.js`.

---

## 11. Frontend de facturación
`FacturacionElectronica.jsx` (gateado por `puedeUsarFuncion('facturacion_electronica')`):
- **Config de certificado con dos modos:** "Certificado propio" (generar CSR / subir `.crt`) y
  "Conexión rápida (delegada)" (asistente que dice a qué CUIT delegar + botón "Activar"). La
  sección de conexión rápida se muestra sólo si `delegacion-info` devuelve `disponible:true`
  (es decir, si el server tiene el certificado maestro configurado).
- **Probar conexión** (`POST /arca/test-conexion`) → confirma que el TA se obtiene y la
  delegación en AFIP está bien hecha.
- **Configuración fiscal:** CUIT, punto de venta, régimen, entorno (homologación/producción).
- **Lista de comprobantes** emitidos con reimpresión y anulación (nota de crédito).

---

## 12. Pruebas y scripts de diagnóstico (reutilizables)
> 🔴 **GOTCHA general:** cualquier script que `require` a los services/models **abre el pool de
> PostgreSQL** y el proceso **no termina solo** (se cuelga hasta el timeout). Terminá siempre con
> **`process.exit(0)`**. En Windows/Git Bash, `find`/rutas: usá **rutas absolutas** y ojo que
> `node` resuelve `/tmp` distinto que Git Bash.

**a) Verificar que un `.crt` y una `.key` son pareja (por módulo):**
```js
const forge = require('node-forge'), fs = require('fs');
const cert = forge.pki.certificateFromPem(fs.readFileSync(CRT, 'utf8'));
const key  = forge.pki.privateKeyFromPem(fs.readFileSync(KEY, 'utf8'));
console.log('aparean:', cert.publicKey.n.toString(16) === key.n.toString(16));
```
**b) Ver el CUIT (serialNumber) y CN de un `.crt`:**
```js
const cert = forge.pki.certificateFromPem(fs.readFileSync(CRT,'utf8'));
console.log(cert.subject.attributes.map(a => a.shortName + '=' + a.value).join(', '));
// serialNumber = "CUIT 23359052979", CN = "gestionq24"
```
**c) Buscar en todo el disco la `.key` que aparea con un `.crt`:** listar todos los `*.key`/`*.pem`
y comparar `privateKeyFromPem(x).n` contra `cert.publicKey.n`. (Sirve si "perdiste" la clave.)

**d) ¿Está disponible el certificado delegado?** (sin abrir la BD):
```js
require('dotenv').config(); const fs=require('fs'), path=require('path');
const base = path.join(process.cwd(), 'uploads');
console.log({ cuit: process.env.ARCA_DELEGADO_CUIT,
  cert: fs.existsSync(path.join(base, process.env.ARCA_DELEGADO_CERT||'')),
  key:  fs.existsSync(path.join(base, process.env.ARCA_DELEGADO_KEY||'')) });
```
**e) Probar el gateway (sección 8):**
```bash
curl -s -H "x-ta-secret: EL_SECRETO" "http://localhost:3001/api/arca/ticket-compartido"
# => {"token":"...","sign":"...","expiracion":"...","cacheado":false|true}
```
**f) Emitir una Factura C de prueba de $100 (monotributista, consumidor final):**
```js
const arca = require('./src/services/arcaService'); // o './services/arcaService'
(async () => {
  const r = await arca.emitirComprobante({
    negocioId: 'ID_DEL_NEGOCIO', tipoComprobante: 11, puntoVenta: 3,
    tipoDocumento: 99, numeroDocumento: 0, denominacion: 'Consumidor Final',
    importeTotal: 100, importeNeto: 100, importeIVA: 0, condicionIvaReceptor: 5,
  });
  console.log(r.exito ? ('CAE=' + r.comprobante.cae + ' Nro=' + r.comprobante.numeroComprobante) : r.error);
  process.exit(0);
})();
```
**g) Anular esa factura con Nota de Crédito:**
```js
const orig = /* buscar el comprobante emitido (nro/pv/tipo) */;
const r = await arca.emitirNotaCredito({ negocioId, pedidoId: null, comprobanteId: orig.id });
console.log(r.exito ? ('NC CAE=' + r.comprobante.cae) : r.error);
process.exit(0);
```
**h) Sembrar el TA compartido de un sistema con el de otro** (cutover del gateway): leer el TA
vigente (`SELECT ... WHERE servicio='wsfe' AND expiracion > NOW()`) de la BD del cliente e
`INSERT` en la del dueño como `servicio='wsfe-delegado'`.

---

## 13. Problemas ya resueltos (gotchas) — checklist mental
- **TA único por certificado/12 h:** cacheá y reusá el TA; nunca pidas uno nuevo si hay vigente.
- **Mismo CUIT ≠ misma key.** El `.crt` sólo sirve con la `.key` de su CSR. **Key perdida = rehacer.**
- **AFIP no entrega la clave privada;** re‑descargar el `.crt` no la recupera.
- **WSAA rechaza con HTTP 500 + `<faultstring>`;** extraelo para diagnosticar.
- **`CondicionIVAReceptorId` es obligatorio** (RG 5616).
- **`Auth.Cuit` = CUIT del emisor** (en delegación, el representado, no el del certificado).
- **Fecha del comprobante (error 10016):** hora AR, nunca menor a la del último autorizado.
- **Nombres `cert_<CUIT>_<ts>`** para no pisar certificados entre negocios; fila por negocio.
- **Dos sistemas, mismo certificado → conflicto de TA.** Un dueño del ticket + gateway (sección 8).
- **`setup-db.js` que parte SQL por `;`:** comentarios sin `;`.
- **Scripts Node que abren el pool de pg no terminan solos → `process.exit(0)`.**
- **SSH con contraseña desde scripts:** truco `SSH_ASKPASS` (sección 5).
- **Bloque `<Iva>` sólo si hay IVA (>0);** en Factura C no va.

---

## 14. Checklist para arrancar un sistema nuevo
1. Clonar la base (backend plano + frontend) y renombrar al rubro nuevo.
2. Crear las tablas base (negocios, usuarios, productos, ventas…) y las **3 tablas de ARCA** (sección 9).
3. Portar `wsaaService.js`, `arcaService.js`, `routes/arca.js` y `FacturacionElectronica.jsx`.
4. En AFIP: sacar clave fiscal, **crear certificado** (subir CSR), **asociar el servicio WSFEv1**,
   dar de alta el **punto de venta** (sección 6.3).
5. Elegir modo:
   - **Certificado propio** por negocio → cada uno sube su `.crt`+`.key`.
   - **Conexión rápida** → configurar `ARCA_DELEGADO_*` con el certificado maestro; los negocios
     delegan en AFIP a ese CUIT.
6. (Opcional) Si dos sistemas comparten el mismo CUIT/certificado → montar el **gateway** (sección 8).
7. **Probar el TA** (script d/e) → **emitir una Factura C de $100** (script f) → **anular con NC**
   (script g). Confirmar **CAE real**.
8. Desplegar con `actualizar.sh`, verificar `pm2 online` y `CAE real` en el `out.log`.

---

*Este tutorial nació de poner en producción la facturación ARCA de `almacenq24`/`gestionq24` y
`burgerpos`, incluyendo el esquema de ticket compartido entre ambos. Todo lo de acá está probado
con CAE real. Si algo no coincide con AFIP, ganó AFIP: revisá primero la regla del TA (6.5), la
fecha (6.6) y que la `.key` sea pareja del `.crt` (12.a).*
