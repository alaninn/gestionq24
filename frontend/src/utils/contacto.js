// Contacto del administrador del sistema (para renovaciones de suscripción).
// Número en formato internacional sin "+" para los links de wa.me.
export const WHATSAPP_ADMIN = '5491162684353';

// Arma el link de WhatsApp para pedir la renovación, con un mensaje ya escrito.
// estado: 'vencido' | '24h' | número de días | (otro) => "está por vencer".
export function linkRenovarWhatsApp({ negocio, estado } = {}) {
  const nombre = (negocio || 'mi negocio').toString().trim();
  let situacion;
  if (estado === 'vencido') situacion = 'venció';
  else if (estado === '24h') situacion = 'vence en menos de 24 hs';
  else if (typeof estado === 'number') situacion = `vence en ${estado} ${estado === 1 ? 'día' : 'días'}`;
  else situacion = 'está por vencer';

  const texto =
    `Hola! Te escribo desde "${nombre}". Mi suscripción de GestionQ24 ${situacion}. ` +
    `Quiero renovarla, ¿me pasás cómo abonar?`;
  return `https://wa.me/${WHATSAPP_ADMIN}?text=${encodeURIComponent(texto)}`;
}
