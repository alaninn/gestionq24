// =============================================
// ARCHIVO: src/changelog.js
// Versión actual del programa + historial de cambios.
//
// CÓMO ACTUALIZAR:
//   1. Subí el número en VERSION_ACTUAL (formato: mayor.menor.parche)
//   2. Agregá un objeto nuevo ARRIBA de todo en CHANGELOG con:
//      - version, fecha, titulo
//      - cambios: lista de cambios. Cada uno es { t: 'texto' }.
//        Si el cambio es SOLO del panel SuperAdmin, agregale super: true → { t: 'texto', super: true }
//      - destacados (opcional): cambios importantes con explicación. Mismo criterio: { titulo, detalle, super? }
//
//   El panel del usuario (admin del negocio) muestra solo lo que NO es super.
//   El panel SuperAdmin muestra TODO.
// =============================================

export const VERSION_ACTUAL = '2.1.0';

export const CHANGELOG = [
  {
    version: '2.1.0',
    fecha: '2026-06-10',
    titulo: 'Importación y eliminación masiva de productos',
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
      { t: 'Productos: importación masiva por Excel robusta (lee por nombre de columna, crea categorías que falten, no duplica).' },
      { t: 'Productos: eliminación masiva con selección múltiple y opción de eliminar todo.' },
      { t: 'Productos: corregido el error al subir archivos grandes.' },
      { t: 'Usuarios: botón para eliminar usuarios definitivamente (sin romper turnos ni ventas).' },
      { t: 'Mejoras de visualización en celular (Usuarios y Productos).' },

      // ---- Cambios del panel SuperAdmin (no se muestran en el panel del usuario) ----
      { t: 'SuperAdmin: ahora funcionan Renovar Suscripción, Editar Días de Uso, Historial de Pagos, Salud del Negocio, Mi Cuenta, Editar Administrador y Gestión de Tickets.', super: true },
      { t: 'SuperAdmin: eliminar negocios ya no falla cuando tienen datos cargados.', super: true },
      { t: 'SuperAdmin: al editar el administrador de un negocio ahora se usa el usuario (no el email).', super: true },
      { t: 'SuperAdmin: mejoras de visualización en celular.', super: true },
    ],
  },
  {
    version: '2.0.0',
    fecha: '2026-03-24',
    titulo: 'Sistema de planes y base estable',
    cambios: [
      { t: 'Sistema de planes (Estándar y Premium) con límites de productos y usuarios.' },
      { t: 'Punto de venta con modo offline y atajos de teclado.' },
      { t: 'Reportes, control de caja y cuentas corrientes.' },
      { t: 'Panel SuperAdmin para gestión de negocios.', super: true },
    ],
  },
];
