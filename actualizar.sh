#!/bin/bash
echo "🔄 Actualizando gestionq24..."
cd /root/gestionq24

echo "📥 Bajando cambios de GitHub..."
git pull

echo "📦 Instalando dependencias del frontend..."
cd frontend && npm install

echo "🏗️  Compilando frontend..."
npm run build

echo "📦 Instalando dependencias del backend..."
cd ../backend && npm install

echo "🔄 Reiniciando servidor..."
pm2 restart gestionq24

echo "✅ Actualización completada"
pm2 logs gestionq24 --lines 10