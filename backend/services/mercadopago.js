// =============================================
// Integración con Mercado Pago para la compra de tokens de revendedores.
// Usa la API REST de MP con axios (sin SDK nuevo, para no agregar dependencias
// ni riesgo al arranque). Todo queda inactivo si no hay MP_ACCESS_TOKEN.
// =============================================

const axios = require('axios');

const MP_API = 'https://api.mercadopago.com';

function habilitado() {
    return !!process.env.MP_ACCESS_TOKEN;
}

function baseUrl() {
    // URL pública del sistema (para back_urls y notification_url del webhook).
    return process.env.PUBLIC_URL || process.env.FRONTEND_URL || 'https://gestionq24.com';
}

// Crea una preferencia de pago por (cantidad x precioUnitario). external_reference
// lleva el revendedor y la cantidad, para acreditar los tokens al aprobarse.
async function crearPreferenciaTokens({ revendedorId, cantidad, precioUnitario, emailRevendedor }) {
    if (!habilitado()) {
        const err = new Error('Mercado Pago no está configurado');
        err.mpDeshabilitado = true;
        throw err;
    }
    const total = cantidad * precioUnitario;
    const externalRef = `rev:${revendedorId}:${cantidad}`;

    const body = {
        items: [{
            title: `${cantidad} token(s) de negocio`,
            quantity: cantidad,
            unit_price: precioUnitario,
            currency_id: 'ARS',
        }],
        payer: emailRevendedor ? { email: emailRevendedor } : undefined,
        external_reference: externalRef,
        notification_url: `${baseUrl()}/api/pagos/mp-webhook`,
        back_urls: {
            success: `${baseUrl()}/revendedor?pago=ok`,
            failure: `${baseUrl()}/revendedor?pago=error`,
            pending: `${baseUrl()}/revendedor?pago=pendiente`,
        },
        auto_return: 'approved',
        metadata: { revendedor_id: revendedorId, cantidad },
    };

    const { data } = await axios.post(`${MP_API}/checkout/preferences`, body, {
        headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
        timeout: 15000,
    });
    return {
        preference_id: data.id,
        init_point: data.init_point,
        total,
    };
}

// Crea una preferencia de pago para RENOVAR la membresía de un negocio.
// external_reference = mem:<negocioId>:<dias>, para que el webhook sepa a qué
// negocio acreditarle los días al aprobarse el pago.
async function crearPreferenciaMembresia({ negocioId, negocioNombre, plan, precio, dias, emailPagador }) {
    if (!habilitado()) {
        const err = new Error('Mercado Pago no está configurado');
        err.mpDeshabilitado = true;
        throw err;
    }
    const monto = Math.round((parseFloat(precio) || 0) * 100) / 100;
    const externalRef = `mem:${negocioId}:${dias}`;

    const body = {
        items: [{
            title: `Membresía GestiónQ24 — plan ${plan} (${dias} días)`,
            description: negocioNombre ? `Renovación de ${negocioNombre}` : undefined,
            quantity: 1,
            unit_price: monto,
            currency_id: 'ARS',
        }],
        payer: emailPagador ? { email: emailPagador } : undefined,
        external_reference: externalRef,
        notification_url: `${baseUrl()}/api/pagos/mp-webhook`,
        back_urls: {
            success: `${baseUrl()}/pago-membresia?estado=ok`,
            failure: `${baseUrl()}/pago-membresia?estado=error`,
            pending: `${baseUrl()}/pago-membresia?estado=pendiente`,
        },
        auto_return: 'approved',
        metadata: { negocio_id: negocioId, dias, tipo: 'membresia' },
    };

    const { data } = await axios.post(`${MP_API}/checkout/preferences`, body, {
        headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
        timeout: 15000,
    });
    return { preference_id: data.id, init_point: data.init_point, total: monto };
}

// Consulta un pago por id para verificar su estado real (no confiar en el webhook).
async function obtenerPago(pagoId) {
    if (!habilitado()) return null;
    const { data } = await axios.get(`${MP_API}/v1/payments/${pagoId}`, {
        headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
        timeout: 15000,
    });
    return data;
}

module.exports = { habilitado, crearPreferenciaTokens, crearPreferenciaMembresia, obtenerPago };
