/**
 * MIDDLEWARE DE VALIDACION DE LIMITES POR PLAN
 * Se ejecuta ANTES de TODAS las rutas para validar que no exceda los limites de su plan
 */

const LIMITES_PLANES = {
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

async function validarLimitePlan(req, res, next) {
  try {
    if (!req.usuario) return next();

    let plan = req.usuario.plan || 'estandar';

    // El superadmin no tiene plan propio en el token. Cuando opera un negocio
    // (header x-negocio-id), se usa el plan REAL de ese negocio; en su propio
    // panel no se le aplican límites.
    if (req.usuario.rol === 'superadmin') {
      if (req.negocio_id) {
        const r = await db.query('SELECT plan FROM negocios WHERE id = $1', [req.negocio_id]);
        plan = r.rows[0]?.plan || 'premium';
      } else {
        plan = 'premium';
      }
    }

    const limites = LIMITES_PLANES[plan] || LIMITES_PLANES.estandar;

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
  LIMITES_PLANES
};