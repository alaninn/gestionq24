// Módulos del menú de administración que el superadmin puede habilitar/deshabilitar
// por plan. Los módulos "núcleo" (Dashboard, Configuración, Usuarios) NO se listan
// acá: están siempre disponibles para no dejar al negocio sin poder administrarse.
export const MODULOS_PLAN = [
  { key: 'productos', label: 'Productos y Categorías', icon: '📦' },
  { key: 'stock', label: 'Stock', icon: '📉' },
  { key: 'caja', label: 'Control de Caja', icon: '🏦' },
  { key: 'clientes', label: 'Cuentas Corrientes', icon: '👥' },
  { key: 'proveedores', label: 'Proveedores', icon: '🚚' },
  { key: 'gastos', label: 'Gastos', icon: '💸' },
  { key: 'resumen_fiscal', label: 'Resumen Fiscal', icon: '🧾' },
  { key: 'reportes', label: 'Reportes', icon: '📈' },
  { key: 'soporte', label: 'Soporte', icon: '🎫' },
];

// Módulos siempre habilitados (no se pueden quitar de ningún plan).
export const MODULOS_NUCLEO = ['dashboard', 'configuracion', 'usuarios'];

export const CLAVES_MODULOS_PLAN = MODULOS_PLAN.map(m => m.key);
