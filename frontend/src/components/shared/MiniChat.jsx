import { useState, useRef, useEffect } from 'react';
import BotonWhatsApp from './BotonWhatsApp';

function MiniChat() {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState([]);
  const mensajesRef = useRef(null);

  const respuestasAutomaticas = [
    {
      pregunta: '¿Como contratar el servicio?',
      respuesta: 'Muy facil! Solo tenes que elegir el plan que te guste y hacer click en el boton de WhatsApp. Nos contactamos inmediatamente para darte de alta en menos de 15 minutos.'
    },
    {
      pregunta: '¿Hay prueba gratuita?',
      respuesta: 'Si! Todos los planes incluyen 7 dias completamente gratuitos sin compromiso ni tarjeta de credito. Podés probar absolutamente todas las funciones.'
    },
    {
      pregunta: '¿Funciona sin internet?',
      respuesta: 'Si! El sistema esta diseñado para funcionar 100% offline. Todos los datos se guardan localmente y se sincronizan automaticamente cuando volves a tener conexion.'
    },
    {
      pregunta: '¿Que metodos de pago aceptan?',
      respuesta: 'Aceptamos Mercado Pago, Transferencia Bancaria, Efectivo y todas las tarjetas de credito. Podés pagar mensual o anual con 10% de descuento.'
    },
    {
      pregunta: '¿Puedo migrar mis datos actuales?',
      respuesta: 'Por supuesto! Nosotros nos encargamos de migrar todos tus productos, clientes y datos historicos completamente gratis al contratar cualquier plan.'
    }
  ];

  const enviarPregunta = (index) => {
    const nuevoMensajeUsuario = { tipo: 'usuario', texto: respuestasAutomaticas[index].pregunta };
    const nuevoMensajeBot = { tipo: 'bot', texto: respuestasAutomaticas[index].respuesta };
    
    setMensajes(prev => [...prev, nuevoMensajeUsuario, nuevoMensajeBot]);
  };

  useEffect(() => {
    if (mensajesRef.current) {
      mensajesRef.current.scrollTop = mensajesRef.current.scrollHeight;
    }
  }, [mensajes]);

  useEffect(() => {
    if (abierto && mensajes.length === 0) {
      setMensajes([{
        tipo: 'bot',
        texto: '👋 Hola! ¿En que puedo ayudarte hoy? Elegi alguna de las preguntas frecuentes:'
      }]);
    }
  }, [abierto]);

  return (
    <>
      {/* BOTON FLOTANTE */}
      <button
        onClick={() => setAbierto(!abierto)}
        className="fixed bottom-6 right-6 z-50 w-16 h-16 bg-green-500 rounded-full shadow-2xl flex items-center justify-center text-3xl hover:bg-green-600 transition transform hover:scale-110"
      >
        {abierto ? '✕' : '💬'}
      </button>

      {/* VENTANA DEL CHAT */}
      {abierto && (
        <div className="fixed bottom-24 right-6 z-40 w-80 md:w-96 bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-700">
          {/* CABECERA */}
          <div className="bg-green-500 p-4">
            <h3 className="font-bold text-lg">Chat de Ayuda</h3>
            <p className="text-sm opacity-90">Respuestas automaticas inmediatas</p>
          </div>

          {/* MENSAJES */}
          <div ref={mensajesRef} className="h-72 overflow-y-auto p-4 space-y-3">
            {mensajes.map((msg, i) => (
              <div key={i} className={`${msg.tipo === 'usuario' ? 'text-right' : 'text-left'}`}>
                <div className={`inline-block p-3 rounded-xl max-w-[80%] ${msg.tipo === 'usuario' ? 'bg-green-600' : 'bg-gray-700'}`}>
                  {msg.texto}
                </div>
              </div>
            ))}
          </div>

          {/* OPCIONES DE PREGUNTAS */}
          <div className="p-3 border-t border-gray-700">
            <div className="space-y-2 mb-3">
              {respuestasAutomaticas.map((item, i) => (
                <button
                  key={i}
                  onClick={() => enviarPregunta(i)}
                  className="block w-full text-left p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition"
                >
                  {item.pregunta}
                </button>
              ))}
            </div>

            <BotonWhatsApp
              texto="Hablar con un asesor real por WhatsApp"
              mensaje="Hola! Necesito ayuda con el sistema de gestión"
              className="w-full bg-green-500 hover:bg-green-600 py-3 rounded-lg font-medium text-center text-sm transition"
            />
          </div>
        </div>
      )}
    </>
  );
}

export default MiniChat;