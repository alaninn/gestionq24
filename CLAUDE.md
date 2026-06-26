# CLAUDE.md — instructivo para el agente

> Este archivo lo lee Claude Code automáticamente. Acá está cómo trabajar en el
> proyecto y, sobre todo, **cómo leer los reportes de errores** que el superadmin
> sube desde la app. El contexto completo del sistema está en `README.md` y el
> manual de uso en `MANUAL.md`.

---

## 📌 Última sesión (14/06/2026) — dónde quedamos

Resumen para retomar sin perder contexto (si esta conversación no se recupera con
`claude --continue`):

1. **Reporte de errores del superadmin** (botón 🐞 Errores): se validó el circuito
   completo de punta a punta. Sube el `.md` a la rama `reportes-errores` (carpeta
   `reportes/`) y el agente lo lee desde acá con `git fetch origin reportes-errores`.
   El `GITHUB_TOKEN` ya está configurado en el `backend/.env` del VPS (no en local).
2. **Bug encontrado y ya resuelto**: `DateTimeParseError` en el dashboard
   (`backend/routes/reportes.js`) cuando llegaba una fecha no-string. Ya estaba
   arreglado en `master` (commit `30fc406`, guarda `typeof v !== 'string'` en
   `fechaONull`). Los logs del reporte eran viejos.
3. **v2.9.4 (commit `3fcc367`, pusheado a master)**: al subir el reporte a GitHub
   ahora se **limpian las fuentes** para no repetir errores viejos —
   `limpiarFuentesReporte()` en `superadmin.js` borra los `errores_frontend`
   incluidos, trunca `gestionq24-error.log` y vacía el buffer (`logBuffer.limpiar()`).
   El front muestra qué se limpió. **Pendiente**: correr `actualizar.sh` en el VPS.
4. **Visor de Logs del superadmin** revisado: "Iniciar en vivo" (`/logs/en-vivo`),
   "Archivo (salida)" y "Archivo (errores)" (`/logs/archivo?tipo=out|error`) andan OK.
5. **Plugin de memoria `claude-mem`**: estaba **desactivado** desde el 10/06 (su
   worker no arrancaba por el puerto 37777 ocupado). Se **reactivó** en
   `~/.claude/settings.json` (`"claude-mem@thedotmack": true`). Toma efecto al
   **reiniciar** Claude Code. La memoria vieja (hasta 10/06) está en
   `~/.claude-mem/claude-mem.db`. Esta sesión NO quedó en claude-mem (estaba apagado).

---

## 🐞 Reportes de errores (leerlos desde acá)

El panel **Superadmin** tiene un botón **🐞 Errores** que arma un `.md` con:
- los **errores de pantalla** (frontend) que reportan los usuarios, y
- los **últimos errores del servidor** (log de pm2 + logs en memoria).

Ese `.md` se sube a GitHub (botón **"Subir a GitHub"**) a una rama aparte para no
ensuciar el código:

- **Rama**: `reportes-errores`
- **Carpeta**: `reportes/`
- **Nombre**: `reportes/errores-<fecha-ISO>.md` (uno nuevo por cada subida)

### Cómo los leo (sin cambiar de rama ni tocar el working tree)

```bash
# 1) Traer la rama de reportes
git fetch origin reportes-errores

# 2) Listar los reportes disponibles (el último es el de fecha más alta)
git ls-tree --name-only origin/reportes-errores reportes/

# 3) Leer un reporte concreto
git show origin/reportes-errores:reportes/errores-<fecha>.md

# Atajo: ver el reporte más reciente
git show origin/reportes-errores:"$(git ls-tree --name-only origin/reportes-errores reportes/ | sort | tail -1)"
```

> Si la rama `reportes-errores` no existe todavía, es que aún no se subió ningún
> reporte (o falta `GITHUB_TOKEN` en el `.env` del servidor — ver abajo).

Cuando Alan diga **"revisá los errores"** / **"fijate el último reporte"**, hacé
el `fetch` + leer el más reciente, y diagnosticá a partir de eso.

### Requisito en el servidor para que la subida funcione

El endpoint `POST /api/superadmin/errores/subir-git` usa la API REST de GitHub
(no toca el git de producción). Necesita en `backend/.env` del VPS:

```env
GITHUB_TOKEN=...                      # PAT con permiso de contenidos sobre el repo
GITHUB_REPO=alaninn/gestionq24        # opcional (este es el default)
GITHUB_REPORTES_BRANCH=reportes-errores  # opcional (este es el default)
```

Si no hay `GITHUB_TOKEN`, el botón "Subir a GitHub" avisa y queda disponible
**"Descargar .md"** para guardarlo a mano en la carpeta del proyecto.

**Backend**: `backend/routes/superadmin.js` → `construirReporteErrores()` y las
rutas `GET /errores/reporte` (descargar) y `POST /errores/subir-git` (subir).
**Frontend**: `frontend/src/pages/Superadmin.jsx` (modal del botón 🐞 Errores).

---

## 🔌 Conexión al VPS (producción) y despliegue

Los datos para conectarse están en el archivo **`.vps-credenciales`** (raíz del
proyecto, **ignorado por git** — tiene la contraseña). Resumen:

- **Host**: `66.97.35.172` (`vps-5839248-x.dattaweb.com`) · **Puerto**: `5041` · **Usuario**: `root`
- **Contraseña**: en `.vps-credenciales` (variable `VPS_PASS`).
- **Ruta del proyecto en el VPS**: `/root/gestionq24`

### Cómo me conecto / despliego (Windows + Git Bash)

SSH no acepta la contraseña por stdin; se usa el truco de `SSH_ASKPASS`:

```bash
export VPS_PASS="$(grep '^VPS_PASS=' .vps-credenciales | cut -d= -f2-)"
printf '#!/bin/sh\necho "$VPS_PASS"\n' > /tmp/askpass.sh && chmod +x /tmp/askpass.sh
export SSH_ASKPASS=/tmp/askpass.sh SSH_ASKPASS_REQUIRE=force DISPLAY=:0

ssh -o StrictHostKeyChecking=no -p 5041 root@66.97.35.172 \
  "bash /root/gestionq24/actualizar.sh" < /dev/null
```

> Tras `git push` a `master`, desplegar SIEMPRE con `actualizar.sh`. Verificar en la
> salida que pm2 quedó `online` y, si se tocó facturación, que el out.log muestre
> "Comprobante emitido con CAE real".

---

## 🛠️ Cómo trabajar en este repo (resumen)

- Stack: React 18 + Vite (frontend) · Node + Express + PostgreSQL (backend).
  Detalle completo en `README.md`.
- Build: `cd frontend && npm run build`. El backend sirve `frontend/dist` en el
  puerto 3001 (en dev, Vite en 5173 con proxy a 3001).
- Versionado: subir `VERSION_ACTUAL` en `frontend/src/changelog.js` y agregar la
  entrada nueva ARRIBA. Cambios solo de superadmin → `super: true`.
- Despliegue en el VPS: `bash /root/gestionq24/actualizar.sh` (git pull, npm
  install si hace falta, migraciones idempotentes, build, reinicio de pm2).
- Migraciones siempre idempotentes (`ADD COLUMN IF NOT EXISTS`, etc.).
- **Nada puede bloquear el trabajo**: ningún filtro debe impedir vender/usar el
  sistema.
- `backend/.env` NO se versiona (tiene secretos); `actualizar.sh` lo respalda y
  restaura en cada actualización.
