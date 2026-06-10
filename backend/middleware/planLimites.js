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

async function validarLimitePlan(req, res, next) {
  try {
    if (!req.usuario) return next();

    const plan = req.usuario.plan || 'estandar';
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