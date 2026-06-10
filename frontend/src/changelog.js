// =============================================
// ARCHIVO: src/changelog.js
// Versión actual del programa + historial de cambios.
//
// CÓMO ACTUALIZAR:
//   1. Subí el número en VERSION_ACTUAL (formato: mayor.menor.parche)
//   2. Agregá un objeto nuevo ARRIBA de todo en CHANGELOG con:
//      - version, fecha, titulo
//      - cambios: lista de cambios (texto simple)
//      - destacados (opcional): cambios importantes con explicación de cómo usarlos
// =============================================

export const VERSION_ACTUAL = '2.1.0';

export const CHANGELOG = [
  {
    version: '2.1.0',
    fecha: '2026-06-10',
    titulo: 'Importación, eliminación masiva y panel SuperAdmin',
    destacados: [
      {
        titulo: '📥 Importar productos desde Excel',
        detalle: 'En Productos, descargá la "Plantilla Excel", completala (o pegá tu lista) y subila con "Importar Excel". Reconoce las columnas por su nombre, así que no importa el orden. Si un producto ya existe (mismo código), lo actualiza en vez de duplicarlo.',
      },
      {
        titulo: '🗑️ Eliminación masiva de productos',
        detalle: 'En Productos podés tildar varios con los checkboxes y borrarlos juntos. Si tildás "seleccionar todos" aparece la opción de borrar todo el inventario.',
      },
      {
        titulo: '🆕 Versión y novedades',
        detalle: 'Abajo del menú vas a ver la versión del programa. Hacé clic para ver este historial de cambios cada vez que actualicemos.',
      },
    ],
    cambios: [
      'Productos: importación masiva por Excel robusta (lee por nombre de columna, crea categorías que falten, no duplica).',
      'Productos: eliminación masiva con selección múltiple y opción de eliminar todo.',
      'Productos: corregido el error al subir archivos grandes.',
      'Usuarios: botón para eliminar usuarios definitivamente (sin romper turnos ni ventas).',
      'SuperAdmin: ahora funcionan Renovar Suscripción, Editar Días de Uso, Historial de Pagos, Salud del Negocio, Mi Cuenta, Editar Administrador y Gestión de Tickets.',
      'SuperAdmin: eliminar negocios ya no falla cuando tienen datos cargados.',
      'SuperAdmin: al editar el administrador de un negocio ahora se usa el usuario (no el email).',
      'Mejoras de visualización en celular (panel SuperAdmin, Usuarios y Productos).',
    ],
  },
  {
    version: '2.0.0',
    fecha: '2026-03-24',
    titulo: 'Sistema de planes y base estable',
    cambios: [
      'Sistema de planes (Estándar y Premium) con límites de productos y usuarios.',
      'Panel SuperAdmin para gestión de negocios.',
      'Punto de venta con modo offline y atajos de teclado.',
      'Reportes, control de caja y cuentas corrientes.',
    ],
  },
];
