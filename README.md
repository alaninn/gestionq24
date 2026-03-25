# 📋 README - Contexto para Futuras IAs

## 🎯 Descripción del Proyecto
**AlmacenQ24** es un sistema de gestión de negocios (POS/Almacén) completo con:
- Frontend: React + Vite + Tailwind CSS
- Backend: Node.js + Express + PostgreSQL
- Autenticación JWT con roles (superadmin, admin, cajero)
- Sistema multi-tenant (cada negocio tiene sus datos)

## 🏗️ Arquitectura

### Backend (`/backend`)
```
server.js              - Servidor principal Express
config/database.js     - Conexión PostgreSQL
middleware/auth.js      - Verificación JWT y permisos
routes/
├── auth.js            - Login/logout (con rate limiting)
├── productos.js       - CRUD productos + búsqueda por código
├── ventas.js          - Registro de ventas
├── categorias.js      - Categorías de productos
├── clientes.js        - Gestión clientes + deudas
├── turnos.js          - Apertura/cierre de cajas
├── gastos.js          - Registro de gastos
├── configuracion.js   - Configuración del negocio
├── reportes.js        - Dashboard y reportes
├── usuarios.js        - Gestión usuarios del negocio
├── superadmin.js      - Panel superadmin (gestión negocios)
├── salud.js           - Health checks
└── soporte.js         - Sistema de tickets
```

### Frontend (`/frontend/src`)
```
api/axios.js           - Cliente HTTP con interceptores
context/
├── AuthContext.jsx    - Estado de autenticación
├── TemaContext.jsx    - Modo oscuro/claro
└── ConectividadContext.jsx - Modo offline/sync
pages/
├── pos.jsx           - Punto de venta principal
├── Login.jsx         - Pantalla login
├── admin.jsx         - Panel administración
└── Superadmin.jsx    - Panel superadmin
components/admin/
├── Productos.jsx     - Gestión productos
├── Dashboard.jsx     - Dashboard principal
├── reportes.jsx      - Reportes y estadísticas
├── Configuracion.jsx - Configuración negocio
├── usuarios.jsx      - Gestión usuarios
├── Gastos.jsx        - Registro gastos
├── DetalleVenta.jsx  - Detalle de ventas
└── ...otros
```

## 🔐 Sistema de Autenticación

### Roles
1. **superadmin**: Acceso total, gestiona todos los negocios
2. **admin**: Acceso total a su negocio
3. **cajero**: Acceso limitado según permisos

### Permisos (para cajeros)
```json
{
  "productos": ["ver", "crear", "editar", "eliminar"],
  "ventas": ["ver", "crear", "editar", "eliminar"],
  "gastos": ["ver", "crear", "eliminar"],
  "reportes": ["ver"]
}
```

### Middleware de Permisos
```javascript
verificarPermiso('modulo', 'accion')
```

## 🗄️ Base de Datos (Tablas Principales)

### Estructura Multi-Tenant
- `negocios` - Negocios registrados
- `usuarios` - Usuarios de cada negocio
- `productos` - Productos del negocio
- `ventas` - Ventas realizadas
- `venta_items` - Items de cada venta
- `categorias` - Categorías de productos
- `clientes` - Clientes del negocio
- `turnos` - Turnos/cajas abiertas
- `gastos` - Gastos registrados
- `configuracion` - Configuración del negocio
- `alertas` - Alertas del sistema
- `tickets_soporte` - Tickets de soporte

## 🔑 Variables de Entorno

### Backend (`.env`)
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=almacenq24
DB_USER=postgres
DB_PASSWORD=tu_password
JWT_SECRET=tu_jwt_secret
PORT=3001
```

## 🛠️ Comandos Útiles

### Desarrollo
```bash
# Backend
cd backend
npm install
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

### Base de Datos
```bash
# Crear base de datos
createdb almacenq24

# Ejecutar migraciones (si existen)
psql -d almacenq24 -f schema.sql
```

## 📊 Endpoints Principales

### Autenticación
- `POST /api/auth/login` - Iniciar sesión
- `GET /api/auth/me` - Verificar token

### Productos
- `GET /api/productos` - Listar productos
- `POST /api/productos` - Crear producto
- `PUT /api/productos/:id` - Editar producto
- `DELETE /api/productos/:id` - Eliminar producto
- `GET /api/productos/buscar-codigo/:codigo` - Buscar por código

### Ventas
- `GET /api/ventas` - Listar ventas
- `POST /api/ventas` - Crear venta
- `PUT /api/ventas/:id/editar` - Editar venta
- `DELETE /api/ventas/:id` - Eliminar venta

### Reportes
- `GET /api/reportes/dashboard` - Dashboard principal
- `GET /api/reportes/historial` - Historial ventas
- `GET /api/reportes/productos-vendidos` - Productos más vendidos
- `GET /api/reportes/rentabilidad` - Análisis rentabilidad

## 🐛 Bugs Corregidos (Última Revisión)

### Backend
1. ✅ **Ruta duplicada** en `productos.js` - Eliminada duplicación de `/buscar-codigo/:codigo`
2. ✅ **Configuración por defecto** en `ventas.js` - Mejorada lógica de inserción
3. ✅ **Acceso seguro a negocio_id** - Agregado `req.usuario?.negocio_id || 1`
4. ✅ **Variable no definida** en `usuarios.js` - `rolFinal` ahora se inicializa correctamente
5. ✅ **Rate limiting** en `auth.js` - Protección contra fuerza bruta

### Frontend
1. ✅ **Inconsistencia case-sensitive** - Nombres de archivos corregidos
2. ✅ **Import no utilizado** - `ModalGasto` removido de `DetalleVenta.jsx`
3. ✅ **Dependencias useEffect** - Agregadas dependencias faltantes

## ⚠️ Consideraciones de Seguridad

### Implementado
- Rate limiting en login (5 intentos, 15 min bloqueo)
- Verificación JWT en todas las rutas protegidas
- Validación de permisos por módulo/acción
- Sanitización de inputs SQL (usando parámetros)
- CORS configurado

### Pendiente (Recomendado)
- [ ] HTTPS en producción
- [ ] Backup automático de base de datos
- [ ] Logging de auditoría
- [ ] Validación de contraseñas más estricta
- [ ] Refresh tokens

## 🔄 Sistema Offline (Frontend)

El POS tiene soporte offline:
- Ventas se guardan en `localStorage`
- Al reconectar, se sincronizan automáticamente
- Contexto: `ConectividadContext.jsx`

## 📱 Atajos de Teclado (POS)

- `F1` - Venta rápida
- `F2` - Buscar producto
- `F3` - Fiados
- `F4` - Cierre de caja
- `F5` - Historial
- `F8` - Confirmar venta
- `F9` - Limpiar carrito
- `F10` - Gastos
- `Escape` - Cerrar modal

## 🎨 Tema y Personalización

- Modo oscuro/claro configurable
- Color primario personalizable por negocio
- Configuración en `configuracion` tabla

## 📈 Escalabilidad

### Optimizaciones Actuales
- Paginación en listados
- Índices en búsquedas
- Pool de conexiones PostgreSQL
- Cache de configuración en frontend

### Recomendaciones Futuras
- Redis para cache de sesiones
- CDN para assets estáticos
- Load balancer para múltiples instancias
- WebSockets para actualizaciones en tiempo real

## 🧪 Testing

### Pendiente
- [ ] Tests unitarios backend
- [ ] Tests unitarios frontend
- [ ] Tests de integración
- [ ] Tests E2E

## 📝 Convenciones de Código

### Backend
- Uso de `async/await`
- Manejo de errores con try/catch
- Respuestas JSON consistentes
- Nombres de rutas en español

### Frontend
- Componentes funcionales con hooks
- Context API para estado global
- Tailwind CSS para estilos
- Nombres de archivos en PascalCase (componentes)

## 🚀 Deployment

### Producción
```bash
# Build frontend
cd frontend
npm run build

# Servir con backend
cd backend
npm start
```

### Docker (Recomendado)
```dockerfile
# Dockerfile pendiente de crear
```

## 📞 Soporte

Para dudas sobre el código:
1. Revisar este README
2. Leer comentarios en código
3. Consultar documentación de APIs

---

**Última actualización**: 24 de Marzo de 2026

**Estado**: ✅ Código funcional y revisado