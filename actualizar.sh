#!/bin/bash
# =============================================
# Actualiza gestionQ24 en el servidor de forma segura.
# Protege backend/.env (tiene secretos y NO se versiona): lo respalda antes
# del pull y lo restaura después, así nunca se pierde ni bloquea la actualización.
# =============================================

echo "🔄 Actualizando gestionQ24..."
cd /root/gestionq24 || { echo "❌ No se encontró /root/gestionq24"; exit 1; }

# 1) Respaldar el .env (con el token, contraseñas, etc.)
if [ -f backend/.env ]; then
  cp backend/.env /root/.env-gestionq24-backup
  echo "🔐 .env respaldado"
fi

# 2) Bajar cambios sin que un .env local bloquee el pull
echo "📥 Bajando cambios de GitHub..."
git stash 2>/dev/null
git pull
git stash drop 2>/dev/null

# 3) Restaurar el .env desde el respaldo (por si el pull lo movió)
if [ -f /root/.env-gestionq24-backup ]; then
  cp /root/.env-gestionq24-backup backend/.env
  echo "🔐 .env restaurado"
fi

# 4) Frontend
echo "📦 Instalando dependencias del frontend..."
cd frontend && npm install
echo "🏗️  Compilando frontend..."
npm run build

# 5) Backend
echo "📦 Instalando dependencias del backend..."
cd ../backend && npm install

# 6) Migraciones (idempotentes)
echo "🗄️  Aplicando migraciones de base de datos..."
node setup-db.js

# 7) Reiniciar
echo "🔄 Reiniciando servidor..."
pm2 restart gestionq24

echo "✅ Actualización completada"
pm2 logs gestionq24 --lines 10
