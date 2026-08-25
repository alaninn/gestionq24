import api from '../api/axios';

// ¿El negocio puede renovar la membresía por Mercado Pago y a qué precio?
// No crea preferencia; solo sirve para decidir si mostrar el botón de pago.
export async function estadoAutopago(negocioId) {
  try {
    const r = await api.get('/api/pagos/membresia/estado', { params: { negocio_id: negocioId } });
    return r.data || { disponible: false };
  } catch {
    return { disponible: false };
  }
}

// Inicia el pago y redirige al checkout de Mercado Pago. Devuelve false si no se
// pudo (para poder caer a WhatsApp).
export async function iniciarPagoMembresia(negocioId) {
  try {
    const r = await api.post('/api/pagos/membresia/crear', { negocio_id: negocioId });
    if (r.data?.disponible && r.data?.init_point) {
      window.location.href = r.data.init_point;
      return true;
    }
  } catch {
    /* cae a false */
  }
  return false;
}
