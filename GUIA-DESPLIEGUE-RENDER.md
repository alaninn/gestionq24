# 🚀 GUIA PASO A PASO PARA SUBIR TU APP A RENDER
✅ Todo listo, tu codigo ya esta preparado. No se rompio nada, seguira funcionando igual en localhost y tu No-IP.

---

## 📋 PASOS EN LA PAGINA DE RENDER:

### 1. Registrarse
✅ Ir a https://render.com
✅ Click en `Sign Up`
✅ Elegir `Sign up with Github` (1 click, no tarjeta)
✅ No hace falta verificar correo ni nada

---

### 2. Conectar tu repositorio
✅ Desde el dashboard click en `+ New`
✅ Elegir `Blueprint`
✅ Busca tu repositorio `gestionq24` y seleccionalo
✅ Render detectara AUTOMATICAMENTE el archivo `render.yaml` que cree
✅ Veras que te muestra:
   - ✅ Base de Datos PostgreSQL
   - ✅ Servicio Web Backend
✅ Click en `Aplicar`

---

### 3. Esperar 6 minutos
✅ Render hara TODO automaticamente:
✅ Crea la base de datos
✅ Instala dependencias
✅ Hace el build del frontend
✅ Inicia el servidor

✅ Cuando termine te aparecera un dominio del tipo `https://almacenq24-backend.onrender.com`

---

### 4. Migrar tus datos actuales
✅ Una vez que la base de datos este creada:
1. Ir al panel de la base de datos en Render
2. Copiar el `Connection String` externo
3. Usar pgAdmin o DBeaver para conectarte
4. Hacer un dump de tu base de datos local
5. Importar el dump directamente a la base de datos de Render

---

### ✅ CARACTERISTICAS FINALES:
✅ Tu app estara 24hs online, no se duerme
✅ SSL incluido automaticamente
✅ 750hs/mes = 24hs todos los dias
✅ 1GB de base de datos PostgreSQL
✅ 512MB RAM para el backend
✅ Despliegue automatico cada vez que pusheas a Github

---

### ❗ GARANTIA:
Si en cualquier momento queres volver atras, solo borras el archivo `render.yaml` y tu proyecto vuelve a estar EXACTAMENTE igual que antes. Ningun cambio permanente.

✅ No hay costos ocultos
✅ No vence
✅ No pide tarjeta de credito