# CLAUDE.md — instructivo para el agente

> Este archivo lo lee Claude Code automáticamente. Acá está cómo trabajar en el
> proyecto y, sobre todo, **cómo leer los reportes de errores** que el superadmin
> sube desde la app. El contexto completo del sistema está en `README.md` y el
> manual de uso en `MANUAL.md`.

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
