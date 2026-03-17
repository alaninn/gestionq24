# 🚀 Gestión Q24 - Sistema SaaS

Sistema completo de gestión para minimercados con panel de SuperAdmin.

## 📋 Requisitos

- Node.js 18+
- PostgreSQL 12+
- npm o yarn

## 🛠️ Instalación

```bash
# Instalar dependencias
npm install

# Configurar base de datos
cd backend
node setup-db-v2.js

# Crear usuario SuperAdmin (opcional)
# El primer usuario creado será SuperAdmin automáticamente
```

## 🚀 Desarrollo

### Opción 1: Desarrollo Completo (Recomendado)
```bash
# Ejecuta backend + frontend en paralelo
npm run dev
```

### Opción 2: Desarrollo Individual
```bash
# Terminal 1 - Backend
npm run dev:backend

# Terminal 2 - Frontend
npm run dev:frontend
```

### Opción 3: Tu método actual
```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend (construir para producción)
cd frontend && npm run build
```

## 📦 Producción

```bash
# Construir y servir
npm run start
```

## 🌐 Acceso

### Desarrollo Local
- **Frontend**: http://localhost:5173 (con `npm run dev`)
- **Backend**: http://localhost:3001
- **Full App**: http://localhost:3001 (con build)

### Producción con No-IP
- **URL**: https://gestionq24.ddns.net:3001
- **IP Local**: 192.168.1.58:3001

## 🔧 Configuración

### Variables de Entorno (.env)
```env
PORT=3001
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
JWT_SECRET=tu_jwt_secret_aqui
```

### Base de Datos
- Ejecutar `backend/setup-db-v2.js` para crear tablas
- Tablas principales: negocios, usuarios, ventas, productos, alertas, tickets_soporte

## 📱 Funcionalidades

### 👤 Panel de Cliente
- Gestión de productos, categorías, ventas
- Control de caja y turnos
- Reportes y estadísticas
- **🎫 Soporte**: Crear tickets de soporte

### 👑 Panel SuperAdmin
- Gestión de todos los negocios
- **🚨 Alertas**: Sistema automático de notificaciones
- **❤️ Salud**: Monitoreo de estado de negocios
- **🎫 Tickets**: Administración de soporte
- **🔓 Acceso**: Entrar a cualquier panel de cliente

## 🔄 Flujo de Trabajo Recomendado

### Para Desarrollo Diario
```bash
# Un solo comando inicia todo
npm run dev
```

### Para Producción
```bash
# Construir frontend
npm run build

# Iniciar backend (sirve frontend automáticamente)
cd backend && npm start
```

## 🐛 Solución de Problemas

### Error de Puerto Ocupado
```bash
# Matar procesos en puerto 3001
npx kill-port 3001
npx kill-port 5173
```

### Error de Base de Datos
```bash
cd backend
node setup-db-v2.js
```

### Frontend no carga
```bash
cd frontend
npm run build
cd ../backend
npm start
```

## 📊 Arquitectura

```
gestion-q24/
├── backend/           # API Express + PostgreSQL
├── frontend/          # React + Vite + TailwindCSS
├── package.json       # Scripts del proyecto
└── README.md          # Esta documentación
```

## 🔐 Seguridad

- Autenticación JWT
- Roles: superadmin, admin, user
- Middleware de autorización
- Hash de contraseñas con bcrypt

## 📈 Escalabilidad

- Sistema SaaS multi-negocio
- Alertas automáticas cada 5 minutos
- Monitoreo de salud en tiempo real
- Sistema de tickets de soporte

---

**Versión**: 2.0.0
**Fecha**: Marzo 2026
**Estado**: ✅ Completo y Funcional</content>
<parameter name="filePath">c:\Users\impresion3d\Desktop\programa gestion qrban\almacenq24\README.md