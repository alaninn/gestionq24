/**
 * MIDDLEWARE DE VALIDACION DE LIMITES POR PLAN
 * Se ejecuta ANTES de TODAS las rutas para validar que no exceda los limites de su plan.
 *
 * Los limites y funciones de cada plan se leen de la tabla planes_config
 * (editable desde el panel de superadmin) con cache en memoria de 60s.
 * Si la tabla no existe o esta vacia, se usan los valores por defecto.
 */

const LIMITES_DEFAULT = {
  estandar: {
    max_productos: 500,
    max_usuarios: 3,
    facturacion_electronica: false,
    reportes_avanzados: false
  },
  premium: {
    max_productos: 3000,
    max_usuarios: 99999,
    facturacion_electronica: true,
    reportes_avanzados: true
  }
};

const db = require('../config/database');

let cachePlanes = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 1000; // 60 segundos

async function obtenerConfigPlanes() {
  if (cachePlanes && (Date.now() - cacheTimestamp) < CACHE_TTL) return cachePlanes;
  try {
    const r = await db.query('SELECT * FROM planes_config');
    if (r.rows.length > 0) {
      const config = {};
      for (const row of r.rows) {
        config[row.plan] = {
          max_productos: row.max_productos,
          max_usuarios: row.max_usuarios,
          facturacion_electronica: row.facturacion_electronica,
          reportes_avanzados: row.reportes_avanzados
        };
      }
      cachePlanes = config;
      cacheTimestamp = Date.now();
      return config;
    }
  } catch (e) {
    // Tabla inexistente u otro error: usar defaults sin romper nada
  }
  return LIMITES_DEFAULT;
}

function invalidarCachePlanes() {
  cachePlanes = null;
  cacheTimestamp = 0;
}

async function validarLimitePlan(req, res, next) {
  try {
    if (!req.usuario) return next();

    let plan = req.usuario.plan || 'estandar';

    // El superadmin no tiene plan propio en el token. Cuando opera un negocio
    // (header x-negocio-id), se usa el plan REAL de ese negocio para resolver
    // funciones, pero los LIMITES numericos nunca lo frenan (req.esSuperadmin).
    if (req.usuario.rol === 'superadmin') {
      req.esSuperadmin = true;
      if (req.negocio_id) {
        const r = await db.query('SELECT plan FROM negocios WHERE id = $1', [req.negocio_id]);
        plan = r.rows[0]?.plan || 'premium';
      } else {
        plan = 'premium';
      }
    }

    const config = await obtenerConfigPlanes();
    const limites = config[plan] || config.estandar || LIMITES_DEFAULT.estandar;

    // Adjuntar limites al request para uso en las rutas
    req.limitesPlan = limites;
    req.planUsuario = plan;

    next();
  } catch (error) {
    next();
  }
}

function puedeUsarFuncion(funcion) {
  return (req, res, next) => {
    if (!req.limitesPlan) return next();

    // El superadmin tiene acceso total a todas las funciones
    if (req.esSuperadmin || req.usuario?.rol === 'superadmin') return next();

    if (req.limitesPlan[funcion] === false) {
      return res.status(403).json({
        error: `Esta funcionalidad solo esta disponible en el Plan Premium`,
        requierePremium: true
      });
    }

    next();
  };
}

module.exports = {
  validarLimitePlan,
  puedeUsarFuncion,
  obtenerConfigPlanes,
  invalidarCachePlanes,
  LIMITES_PLANES: LIMITES_DEFAULT
};
