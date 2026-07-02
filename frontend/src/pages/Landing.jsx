import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import MiniChat from '../components/shared/MiniChat';
import BotonWhatsApp from '../components/shared/BotonWhatsApp';

function Landing() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [scrollActivo, setScrollActivo] = useState(false);
  // Precios de los planes (los edita el superadmin). Arrancan con un valor por
  // defecto y se actualizan con lo configurado en el sistema.
  const [precios, setPrecios] = useState({ estandar: 10000, premium: 30000 });
  const fmtPrecio = (n) => '$ ' + Number(n || 0).toLocaleString('es-AR');

  useEffect(() => {
    const handleScroll = () => {
      setScrollActivo(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    fetch('/api/publico/precios')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setPrecios({ estandar: d.estandar ?? 10000, premium: d.premium ?? 30000 }); })
      .catch(() => { /* si falla, quedan los valores por defecto */ });
  }, []);

  const scrollASeccion = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMenuAbierto(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* BARRA DE NAVEGACION */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrollActivo ? 'bg-gray-900/95 shadow-lg backdrop-blur-sm' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center mr-3">
                <span className="text-xl">🏪</span>
              </div>
              <span className="font-bold text-xl">Gestión Q24</span>
            </div>

            <div className="hidden md:flex items-center space-x-8">
              <button onClick={() => scrollASeccion('caracteristicas')} className="text-gray-300 hover:text-white transition">Características</button>
              <button onClick={() => scrollASeccion('precios')} className="text-gray-300 hover:text-white transition">Precios</button>
              <button onClick={() => scrollASeccion('faq')} className="text-gray-300 hover:text-white transition">Preguntas</button>
              <Link to="/login" className="bg-green-500 hover:bg-green-600 px-5 py-2 rounded-lg font-medium transition transform hover:scale-105">
                Ingresar al Sistema
              </Link>
            </div>

            <button className="md:hidden text-white text-2xl" onClick={() => setMenuAbierto(!menuAbierto)}>
              {menuAbierto ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* MENU MOVIL */}
        {menuAbierto && (
          <div className="md:hidden bg-gray-800 px-4 py-4 space-y-4">
            <button onClick={() => scrollASeccion('caracteristicas')} className="block w-full text-left py-2 text-gray-300">Características</button>
            <button onClick={() => scrollASeccion('precios')} className="block w-full text-left py-2 text-gray-300">Precios</button>
            <button onClick={() => scrollASeccion('faq')} className="block w-full text-left py-2 text-gray-300">Preguntas</button>
            <Link to="/login" className="block bg-green-500 text-center py-3 rounded-lg font-medium">
              Ingresar al Sistema
            </Link>
          </div>
        )}
      </nav>

      {/* HERO SECTION */}
      <section className="pt-32 pb-24 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Sistema de Gestión <span className="text-green-400">Completo</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto mb-10">
            Administra tu negocio, controla stock, gestiona ventas, turnos y mucho más. Todo en un solo lugar, simple y profesional.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={() => scrollASeccion('precios')} className="bg-green-500 hover:bg-green-600 px-8 py-4 rounded-xl text-lg font-bold transition transform hover:scale-105 shadow-lg shadow-green-500/20">
              Ver Planes y Precios
            </button>
            <BotonWhatsApp
              texto="Consultar Información"
              mensaje="Hola! Quiero mas información sobre el sistema de gestión"
              className="bg-gray-700 hover:bg-gray-600 px-8 py-4 rounded-xl text-lg font-bold transition"
            />
          </div>
        </div>
      </section>

      {/* CARACTERISTICAS */}
      <section id="caracteristicas" className="py-20 px-4 bg-gray-800/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">Todo lo que necesitas</h2>
          
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {[
              { icono: '📦', titulo: 'Control de Stock', descripcion: 'Gestiona productos, categorias, ingresos y salidas de inventario con alertas de stock minimo' },
              { icono: '💳', titulo: 'Punto de Venta', descripcion: 'Interfaz super rapida, ventas en espera, multiples metodos de pago al mismo tiempo' },
              { icono: '🎫', titulo: 'Impresion de Tickets', descripcion: 'Tickets fiscales, tickets no fiscales, facturas, remitos, todos los comprobantes que necesites' },
              { icono: '📊', titulo: 'Reportes y Estadisticas', descripcion: 'Ventas por periodo, productos mas vendidos, rendimiento por cajero, graficos en tiempo real' },
              { icono: '👥', titulo: 'Multiples Usuarios', descripcion: 'Crea perfiles con permisos diferenciados, controla todo lo que hace cada empleado' },
              { icono: '🧾', titulo: 'Facturacion Electronica', descripcion: 'Integrado oficialmente con ARCA, emití comprobantes validos para AFIP en 1 click' },
              { icono: '🤝', titulo: 'Creado para vos', descripcion: 'Desarrollado por trabajadores para trabajadores. Conocemos exactamente lo que necesitas en el dia a dia.' },
              { icono: '🔌', titulo: 'Funciona Sin Internet', descripcion: 'Trabaja 100% offline, todos los datos se sincronizan automaticamente cuando volves a tener conexion' },
              { icono: '📱', titulo: 'Multiplataforma', descripcion: 'Funciona en PC, Notebook, Tablet y Celular. No necesitas instalar nada' }
            ].map((item, i) => (
              <div key={i} className="bg-gray-800 p-6 rounded-2xl hover:bg-gray-750 transition transform hover:-translate-y-1">
                <div className="text-4xl mb-4">{item.icono}</div>
                <h3 className="text-xl font-bold mb-2">{item.titulo}</h3>
                <p className="text-gray-400">{item.descripcion}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLANES Y PRECIOS */}
      <section id="precios" className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">Planes y Precios</h2>
          <p className="text-gray-400 text-center mb-16 max-w-2xl mx-auto">Elije el plan que mejor se adapte a tu negocio, sin cargos ocultos</p>

          <div className="md:grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* PLAN ESTANDAR */}
            <div className="bg-gray-800 rounded-2xl p-8 mb-6 md:mb-0 border border-gray-700">
              <h3 className="text-2xl font-bold mb-2">Plan Estandar</h3>
              <p className="text-gray-400 mb-6">Ideal para negocios pequeños</p>
              
              <div className="mb-8">
                <span className="text-5xl font-bold">{fmtPrecio(precios.estandar)}</span>
                <span className="text-gray-400"> / mes</span>
              </div>

              <ul className="space-y-4 mb-10">
                {['✅ Gestión completa de productos', '✅ Hasta 500 productos cargados', '✅ Control de stock en tiempo real', '✅ Punto de Venta POS moderno', '✅ Ventas en espera', '✅ Impresion de Tickets Fiscales y Comunes', '✅ Reportes basicos', '✅ Hasta 3 usuarios del sistema', '✅ Soporte por WhatsApp'].map((item, i) => (
                  <li key={i} className="flex items-center">
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <BotonWhatsApp
                texto="Contratar Plan Estandar"
                mensaje={`Hola! Quiero contratar el PLAN ESTANDAR de ${fmtPrecio(precios.estandar)} mensuales`}
                className="w-full bg-gray-700 hover:bg-gray-600 py-4 rounded-xl font-bold text-center transition"
              />
            </div>

            {/* PLAN PREMIUM */}
            <div className="bg-gradient-to-b from-green-900/30 to-gray-800 rounded-2xl p-8 border-2 border-green-500 relative">
              <div className="absolute top-0 right-4 -translate-y-1/2 bg-green-500 px-4 py-1 rounded-full text-sm font-bold">
                RECOMENDADO
              </div>
              
              <h3 className="text-2xl font-bold mb-2">Plan Premium</h3>
              <p className="text-gray-400 mb-6">Para negocios que quieren crecer</p>
              
              <div className="mb-8">
                <span className="text-5xl font-bold">{fmtPrecio(precios.premium)}</span>
                <span className="text-gray-400"> / mes</span>
              </div>

              <ul className="space-y-4 mb-10">
                {['✅ TODO lo incluido en Plan Estandar', '✅ Hasta 3000 productos cargados', '✅ Usuarios ILIMITADOS', '✅ ✅ Facturación Electronica ARCA oficial', '✅ Comprobantes validos para AFIP', '✅ Reportes avanzados y estadisticas', '✅ Clientes y proveedores', '✅ Backup automatico diario', '✅ Soporte prioritario 24hs', '✅ Actualizaciones exclusivas'].map((item, i) => (
                  <li key={i} className="flex items-center">
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <BotonWhatsApp
                texto="Contratar Plan Premium"
                mensaje={`Hola! Quiero contratar el PLAN PREMIUM de ${fmtPrecio(precios.premium)} mensuales`}
                className="w-full bg-green-500 hover:bg-green-600 py-4 rounded-xl font-bold text-center transition"
              />
            </div>
          </div>

          <div className="text-center mt-12 text-gray-400">
            <p>✅ Aceptamos Mercado Pago, Transferencia Bancaria y Efectivo</p>
            <p className="mt-2">✅ Factura A disponible para todos los planes</p>
          </div>
        </div>
      </section>

      {/* PREGUNTAS FRECUENTES */}
      <section id="faq" className="py-20 px-4 bg-gray-800/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">Preguntas Frecuentes</h2>

          <div className="space-y-4">
            {[
              { pregunta: '¿Hay periodo de prueba gratuito?', respuesta: 'Si, todos los planes incluyen 7 dias de prueba completamente gratuita sin necesidad de tarjeta de credito.' },
              { pregunta: '¿Puedo cambiar de plan cuando quiera?', respuesta: 'Si, podes pasar de Estandar a Premium en cualquier momento, el cambio se aplica inmediatamente.' },
              { pregunta: '¿Mis datos estan seguros?', respuesta: 'Todos los datos estan encriptados y guardados en servidores locales y en la nube con backup diario automatico.' },
              { pregunta: '¿Necesito conocimientos tecnicos?', respuesta: 'No, el sistema fue diseñado para ser muy intuitivo, cualquier persona lo puede usar sin capacitacion previa.' },
              { pregunta: '¿Funciona en cualquier dispositivo?', respuesta: 'Si, funciona en PC, Notebook, Tablet y Celular. Solo necesitas un navegador web.' }
            ].map((item, i) => (
              <div key={i} className="bg-gray-800 p-6 rounded-xl">
                <h4 className="font-bold text-lg mb-2">{item.pregunta}</h4>
                <p className="text-gray-400">{item.respuesta}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center bg-gradient-to-r from-green-600 to-green-500 rounded-2xl p-10">
          <h2 className="text-3xl font-bold mb-4">¿Listo para empezar?</h2>
          <p className="text-xl mb-8 opacity-90">Empeza hoy mismo a administrar tu negocio de forma profesional</p>
          <BotonWhatsApp
            texto="Hablanos Ahora por WhatsApp"
            mensaje="Hola! Quiero empezar a usar el sistema"
            className="bg-white text-green-700 hover:bg-gray-100 px-10 py-4 rounded-xl text-lg font-bold transition transform hover:scale-105 inline-block"
          />
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-10 px-4 border-t border-gray-800 text-gray-500 text-center">
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-6 text-sm">
          <a href="/sistema-gestion-almacenes-kioscos.html" className="hover:text-green-400 transition">Sistema para almacenes y kioscos</a>
          <a href="/facturacion-electronica-arca.html" className="hover:text-green-400 transition">Facturación electrónica ARCA</a>
          <a href="/control-de-stock.html" className="hover:text-green-400 transition">Control de stock</a>
        </div>
        <p>© 2026 Gestión Q24 - Sistema de Gestión Comercial</p>
        <p className="mt-2">Todos los derechos reservados</p>
      </footer>

      {/* MINICHAT FLOTANTE */}
      <MiniChat />
    </div>
  );
}

export default Landing;