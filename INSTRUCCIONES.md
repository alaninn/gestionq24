# 🚀 GESTION Q24 - Guía de Ejecución (Versión Online)

## 📍 Tu Configuración
- **Local**: `http://192.168.1.58:3001`
- **Online**: `https://gestionq24.ddns.net:3001`
- **Hosting**: No-IP (DDNS)
- **Acceso**: Desde cualquier red

---

## 🎯 Tu Flujo de Trabajo (RECOMENDADO)

### **Paso 1: Haz cambios en el código**
Edita los archivos que necesites (ej: `Superadmin.jsx`, componentes, etc.)

### **Paso 2: Recarga TODO con un click**
Ejecuta:
```bash
reload.bat
```

**Esto automáticamente:**
1. ✅ Detiene el servidor anterior
2. ✅ Limpia el caché del frontend (elimina `dist`)
3. ✅ Compila el frontend con los cambios
4. ✅ Inicia el backend
5. ✅ Sirve en `https://gestionq24.ddns.net:3001`

### **Paso 3: Accede desde cualquier red**
- Abre `https://gestionq24.ddns.net:3001`
- Presiona `Ctrl + Shift + R` (recarga forzada)
- ¡Verás los cambios!

---

## 🔧 Scripts Disponibles

### **`reload.bat`** (USO DIARIO)
```bash
reload.bat
```
- Limpia caché
- Compila frontend
- Inicia servidor
- **Ideal para cambios rápidos**

### **`clean-reload.bat`** (LIMPIEZA PROFUNDA)
```bash
clean-reload.bat
```
- Elimina `node_modules` (frontend y backend)
- Limpia `dist`
- Reinstala todas las dependencias
- Compila y ejecuta
- **Usa esto si algo falla o hay problemas raros**

### **`deploy.bat`** (PRODUCCIÓN)
```bash
deploy.bat
```
- Compila frontend
- Inicia servidor
- **Sin limpiar caché (más rápido)**

---

## 📋 Comparativa de Scripts

| Script | Limpia dist | Limpia node_modules | Velocidad | Cuándo usar |
|--------|-------------|-------------------|-----------|------------|
| `reload.bat` | ✅ Sí | ❌ No | ⚡ Rápido | Cambios diarios |
| `clean-reload.bat` | ✅ Sí | ✅ Sí | 🐢 Lento | Problemas graves |
| `deploy.bat` | ❌ No | ❌ No | ⚡⚡ Muy rápido | Producción |

---

## 🔄 Ciclo Completo de Desarrollo

```
1. Editas código (desde cualquier red)
   ↓
2. Ejecutas reload.bat
   ↓
3. Esperas compilación (~30-60 segundos)
   ↓
4. Accedes a https://gestionq24.ddns.net:3001
   ↓
5. Presionas Ctrl + Shift + R
   ↓
6. ¡Ves los cambios online!
```

---

## ⚡ Atajos Rápidos

| Acción | Comando |
|--------|---------|
| Recargar todo (diario) | `reload.bat` |
| Limpieza profunda | `clean-reload.bat` |
| Solo compilar | `cd frontend && npm run build` |
| Ver logs del backend | `cd backend && npm start` |

---

## 🐛 Solución de Problemas

### **Los cambios no se ven después de `reload.bat`**
```bash
# Usa la limpieza profunda
clean-reload.bat
```

### **El navegador sigue mostrando versión vieja**
1. Abre DevTools (F12)
2. Click derecho en botón recarga
3. Selecciona "Vaciar caché y recargar"
4. O presiona `Ctrl + Shift + R`

### **Error "Puerto 3001 ya está en uso"**
```bash
# El script ya lo maneja, pero si persiste:
npx kill-port 3001
```

### **Compilación falla**
```bash
# Usa limpieza profunda
clean-reload.bat
```

---

## 📌 Resumen Final

**Tu flujo es simple:**

1. **Edita código** desde cualquier red
2. **Ejecuta `reload.bat`** en tu PC
3. **Accede a `gestionq24.ddns.net:3001`** desde cualquier lugar
4. **Presiona `Ctrl + Shift + R`** para ver cambios
5. **¡Listo!**

**Nunca más tendrás que hacer `npm run build` manualmente.**

---

## 💡 Pro Tips

- Mantén `reload.bat` en el escritorio para acceso rápido
- Si trabajas desde otra red, espera a que termine la compilación antes de acceder
- Usa `clean-reload.bat` si algo se comporta raro
- Los cambios se ven en `https://gestionq24.ddns.net:3001` (no en localhost)

¡Listo! Ahora puedes trabajar desde cualquier red y ver los cambios online al instante.
