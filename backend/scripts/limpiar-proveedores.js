// =============================================
// Script de limpieza: borra el historial de movimientos vinculados a
// proveedores (compras y pagos) y deja todos los saldos en cero.
// Útil para arrancar de cero sin datos corruptos del bug de saldos viejo.
//
// USO (desde la carpeta backend):
//   node scripts/limpiar-proveedores.js
//
// NO toca los gastos comunes del libro diario (los que no tienen proveedor).
// =============================================

require('dotenv').config();
const db = require('../config/database');

async function limpiar() {
  try {
    const gastos = await db.query('DELETE FROM gastos WHERE proveedor_id IS NOT NULL');
    const saldos = await db.query('UPDATE proveedores SET saldo_deuda = 0, saldo_a_favor = 0');
    console.log('✅ Listo.');
    console.log('   Movimientos de proveedores borrados:', gastos.rowCount);
    console.log('   Saldos reseteados a cero:', saldos.rowCount, 'proveedor(es)');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al limpiar:', error.message);
    process.exit(1);
  }
}

limpiar();
