import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import MiniChat from '../components/shared/MiniChat';
import BotonWhatsApp from '../components/shared/BotonWhatsApp';

// Iconos de linea propios (trazo), para un look mas premium que los emojis.
const svg = (paths) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">{paths}</svg>
);
const ICONS = {
  arca: svg(<><path d="M12 3 5 6v5c0 4.6 3 8 7 9 4-1 7-4.4 7-9V6l-7-3Z" /><path d="m9 11.8 2 2 4-4" /></>),
  pos: svg(<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />),
  stock: svg(<><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z" /><path d="M3 7.5 12 12l9-4.5" /><path d="M12 12v9" /></>),
  tienda: svg(<><path d="M4 8h16l-1.2-4H5.2L4 8Z" /><path d="M5 8v11h14V8" /><path d="M9.5 19v-5h5v5" /></>),
  offline: svg(<><path d="M2 8.7C7 4.3 17 4.3 22 8.7" /><path d="M5.4 12.2C9 9.2 15 9.2 18.6 12.2" /><path d="M9 15.6c1.8-1.4 4.2-1.4 6 0" /><path d="M12 19h.01" /><path d="m3 3 18 18" /></>),
  chart: svg(<><rect x="3" y="12" width="4" height="8" rx="1" /><rect x="10" y="7" width="4" height="13" rx="1" /><rect x="17" y="3" width="4" height="17" rx="1" /></>),
  users: svg(<><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 5.6a3 3 0 0 1 0 4.8" /><path d="M18.5 14a6 6 0 0 1 2.5 4.6" /></>),
  devices: svg(<><rect x="2.5" y="4" width="14" height="10" rx="1.5" /><path d="M6 18h7" /><rect x="16.5" y="9" width="5" height="11" rx="1.2" /></>),
  check: svg(<path d="m5 12 4.5 4.5L19 7" />),
  bolt: svg(<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />),
  wa: svg(<path d="M20 11.5a8 8 0 0 1-11.8 7L4 19.5l1.1-4A8 8 0 1 1 20 11.5Z" />),
  arrow: svg(<><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>),
};

function Landing() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [scrollActivo, setScrollActivo] = useState(false);
  const [faqAbierta, setFaqAbierta] = useState(0);
  // Precios de los planes (los edita el superadmin). Arrancan con un valor por
  // defecto y se actualizan con lo configurado en el sistema.
  const [precios, setPrecios] = useState({ estandar: 10000, premium: 30000 });
  // Datos configurables desde el superadmin (teléfono y textos del hero).
  const [waVentas, setWaVentas] = useState('5491162684353');
  const [heroTitulo, setHeroTitulo] = useState('');
  const [heroSubtitulo, setHeroSubtitulo] = useState('');
  const fmtPrecio = (n) => '$ ' + Number(n || 0).toLocaleString('es-AR');

  useEffect(() => {
    const handleScroll = () => setScrollActivo(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    fetch('/api/publico/landing')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!d) return;
        if (d.precios) setPrecios({ estandar: d.precios.estandar ?? 10000, premium: d.precios.premium ?? 30000 });
        if (d.whatsapp) setWaVentas(String(d.whatsapp).replace(/\D/g, '') || '5491162684353');
        setHeroTitulo(d.hero_titulo || '');
        setHeroSubtitulo(d.hero_subtitulo || '');
      })
      .catch(() => { /* si falla, quedan los valores por defecto */ });
  }, []);

  // Reveal al hacer scroll: los elementos con data-reveal aparecen al entrar.
  useEffect(() => {
    const els = Array.from(document.querySelectorAll('[data-reveal]'));
    if (!('IntersectionObserver' in window)) { els.forEach(el => el.classList.add('lp-in')); return; }
    const io = new IntersectionObserver((entradas) => {
      entradas.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('lp-in'); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  const scrollASeccion = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMenuAbierto(false);
  };

  const features = [
    { k: 'arca', icon: ICONS.arca, destacado: true, titulo: 'Facturación electrónica ARCA', desc: 'Emití comprobantes válidos para AFIP en 1 clic. Integración oficial y homologada — Factura A, B y C.' },
    { k: 'pos', icon: ICONS.pos, destacado: true, titulo: 'Punto de venta ultrarrápido', desc: 'Cobrás en segundos. Ventas en espera, varios métodos de pago a la vez y una interfaz pensada para el mostrador.' },
    { k: 'stock', icon: ICONS.stock, titulo: 'Control de stock', desc: 'Inventario en tiempo real con alertas de stock mínimo.' },
    { k: 'tienda', icon: ICONS.tienda, nuevo: true, titulo: 'Tienda Online', desc: 'Tu página para compartir: catálogo, carrito, delivery y avisos por WhatsApp.' },
    { k: 'offline', icon: ICONS.offline, titulo: 'Funciona sin internet', desc: 'Seguí vendiendo aunque se corte la conexión. Sincroniza solo.' },
    { k: 'chart', icon: ICONS.chart, titulo: 'Reportes en vivo', desc: 'Lo más vendido, rendimiento por cajero y ganancias, al instante.' },
    { k: 'users', icon: ICONS.users, titulo: 'Múltiples usuarios', desc: 'Cada empleado con su perfil y sus permisos.' },
    { k: 'devices', icon: ICONS.devices, titulo: 'En todos tus dispositivos', desc: 'PC, tablet o celular. Sin instalar nada.' },
  ];

  const trust = ['Homologado ARCA / AFIP', 'Mercado Pago', 'Factura A, B y C', 'Funciona sin internet', 'Backup diario', 'Soporte por WhatsApp', 'Sin instalar nada'];

  const faqs = [
    { q: '¿Hay período de prueba gratis?', a: 'Sí. Todos los planes incluyen 7 días de prueba completamente gratis, sin necesidad de tarjeta de crédito.' },
    { q: '¿Puedo cambiar de plan cuando quiera?', a: 'Sí, pasás de Estándar a Premium en cualquier momento y el cambio se aplica al instante.' },
    { q: '¿Mis datos están seguros?', a: 'Tus datos están protegidos y con backup automático diario, guardados de forma local y en la nube.' },
    { q: '¿Necesito conocimientos técnicos?', a: 'Para nada. El sistema es muy intuitivo y cualquier persona lo usa sin capacitación previa.' },
    { q: '¿Funciona en cualquier dispositivo?', a: 'Sí. Anda en PC, notebook, tablet y celular. Solo necesitás un navegador web.' },
  ];

  const planEstandar = ['Gestión completa de productos', 'Hasta 500 productos', 'Control de stock en tiempo real', 'Punto de venta POS moderno', 'Ventas en espera', 'Tickets fiscales y comunes', 'Reportes básicos', 'Hasta 3 usuarios', 'Soporte por WhatsApp'];
  const planPremium = ['Todo lo del Plan Estándar', 'Hasta 3000 productos', 'Usuarios ilimitados', 'Facturación electrónica ARCA oficial', 'Comprobantes válidos para AFIP', 'Reportes avanzados y estadísticas', 'Módulo Tienda Online', 'Clientes y proveedores', 'Backup automático diario', 'Soporte prioritario 24 hs'];

  return (
    <div className="lp-root min-h-screen relative overflow-x-hidden">
      {/* Atmosfera de fondo: aurora + grilla + grano */}
      <div className="lp-atmos" aria-hidden="true">
        <div className="lp-aurora lp-a1" />
        <div className="lp-aurora lp-a2" />
        <div className="lp-aurora lp-a3" />
        <div className="lp-grid" />
        <div className="lp-grain" />
      </div>

      {/* NAV */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-500 ${scrollActivo ? 'lp-nav-solid' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 md:h-[72px]">
            <a href="#top" className="flex items-center gap-2.5 group">
              <span className="lp-logo"><Logo /></span>
              <span className="lp-display font-extrabold text-lg tracking-tight">Gestión<span style={{ color: 'var(--brand)' }}>Q24</span></span>
            </a>

            <div className="hidden md:flex items-center gap-8">
              <button onClick={() => scrollASeccion('caracteristicas')} className="lp-navlink">Características</button>
              <button onClick={() => scrollASeccion('precios')} className="lp-navlink">Precios</button>
              <button onClick={() => scrollASeccion('faq')} className="lp-navlink">Preguntas</button>
              <Link to="/login" className="lp-navlink">Ingresar</Link>
              <button onClick={() => scrollASeccion('precios')} className="lp-btn lp-btn-brand lp-btn-sm">
                Probar gratis <span className="lp-ic-xs">{ICONS.arrow}</span>
              </button>
            </div>

            <button className="md:hidden text-2xl w-10 h-10 grid place-items-center rounded-lg lp-panel" onClick={() => setMenuAbierto(!menuAbierto)} aria-label="Menú">
              {menuAbierto ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {menuAbierto && (
          <div className="md:hidden lp-nav-mobile px-4 py-4 space-y-1 animate-aparecer">
            <button onClick={() => scrollASeccion('caracteristicas')} className="block w-full text-left py-3 px-2 rounded-lg lp-navlink">Características</button>
            <button onClick={() => scrollASeccion('precios')} className="block w-full text-left py-3 px-2 rounded-lg lp-navlink">Precios</button>
            <button onClick={() => scrollASeccion('faq')} className="block w-full text-left py-3 px-2 rounded-lg lp-navlink">Preguntas</button>
            <Link to="/login" className="block py-3 px-2 rounded-lg lp-navlink">Ingresar</Link>
            <button onClick={() => scrollASeccion('precios')} className="lp-btn lp-btn-brand w-full mt-2">Probar 7 días gratis</button>
          </div>
        )}
      </nav>

      {/* HERO */}
      <header id="top" className="relative pt-28 md:pt-36 pb-16 md:pb-24 px-4">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-8 items-center">
          <div className="text-center lg:text-left">
            <div className="lp-eyebrow lp-rise" style={{ animationDelay: '.05s' }}>
              <span className="lp-dot" /> Hecho en Argentina · Homologado ARCA
            </div>
            <h1 className="lp-display lp-h1 mt-5 lp-rise" style={{ animationDelay: '.12s' }}>
              {heroTitulo
                ? heroTitulo
                : <>Llevá tu comercio<br className="hidden sm:block" /> al <span className="lp-grad">siguiente nivel</span>.</>}
            </h1>
            <p className="lp-lead mt-6 lp-rise" style={{ animationDelay: '.2s' }}>
              {heroSubtitulo
                ? heroSubtitulo
                : <>Punto de venta ultrarrápido, control de stock, caja y <b className="text-white/95">facturación electrónica oficial ARCA</b>. Todo en un solo sistema — simple, potente y funciona hasta sin internet.</>}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start lp-rise" style={{ animationDelay: '.28s' }}>
              <button onClick={() => scrollASeccion('precios')} className="lp-btn lp-btn-brand lp-btn-lg">
                Probar 7 días gratis <span className="lp-ic-xs">{ICONS.arrow}</span>
              </button>
              <BotonWhatsApp numero={waVentas} texto="Hablar por WhatsApp" mensaje="Hola! Quiero mas información sobre el sistema de gestión GestionQ24" className="lp-btn lp-btn-ghost lp-btn-lg" />
            </div>
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 justify-center lg:justify-start lp-rise" style={{ animationDelay: '.36s' }}>
              {['7 días gratis, sin tarjeta', 'Facturación oficial AFIP', 'Sin internet'].map((t, i) => (
                <span key={i} className="lp-trust-mini"><span className="lp-ic-check">{ICONS.check}</span>{t}</span>
              ))}
            </div>
          </div>

          {/* Visual: mock de panel + comprobante */}
          <div className="lp-rise" style={{ animationDelay: '.24s' }}>
            <HeroMock fmtPrecio={fmtPrecio} />
          </div>
        </div>
      </header>

      {/* MARQUEE DE CONFIANZA */}
      <div className="lp-marquee-wrap py-4 border-y" style={{ borderColor: 'var(--line)' }}>
        <div className="lp-marquee">
          {[...trust, ...trust].map((t, i) => (
            <span key={i} className="lp-chip-mono">{t}<span className="lp-sep">◆</span></span>
          ))}
        </div>
      </div>

      {/* CARACTERISTICAS (bento) */}
      <section id="caracteristicas" className="py-20 md:py-28 px-4 relative">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-12 md:mb-16" data-reveal>
            <p className="lp-kicker">Todo lo que tu negocio necesita</p>
            <h2 className="lp-display lp-h2 mt-3">Una herramienta seria, sin vueltas.</h2>
            <p className="lp-lead-sm mt-4">Pensado por gente que atendió un mostrador. Cada función resuelve algo real del día a día.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 md:gap-4">
            {features.map((f, i) => (
              <article
                key={f.k}
                data-reveal
                style={{ '--d': `${(i % 3) * 0.08}s` }}
                className={`lp-feature ${f.destacado ? 'col-span-2 md:col-span-3' : 'col-span-1 md:col-span-2'}`}
              >
                <div className="lp-feat-ic">{f.icon}</div>
                <div className="mt-4 flex items-center gap-2 flex-wrap">
                  <h3 className="lp-display font-bold text-lg text-white">{f.titulo}</h3>
                  {f.nuevo && <span className="lp-badge-new">NUEVO</span>}
                </div>
                <p className="lp-feat-desc mt-1.5">{f.desc}</p>
                {f.k === 'arca' && (
                  <div className="lp-cae mt-5">
                    <span className="lp-cae-ok">{ICONS.check}</span>
                    <div>
                      <div className="lp-cae-t">Comprobante emitido con CAE real</div>
                      <div className="lp-cae-n">CAE 86349800964338 · Nº 16840</div>
                    </div>
                  </div>
                )}
                {f.k === 'pos' && (
                  <div className="lp-poschips mt-5">
                    {['Efectivo', 'Tarjeta', 'QR', 'Cta. cte.'].map((c) => <span key={c} className="lp-poschip">{c}</span>)}
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* SHOWCASE: TIENDA ONLINE (novedad premium) */}
      <section className="py-16 md:py-24 px-4 relative">
        <div className="max-w-7xl mx-auto lp-showcase grid lg:grid-cols-[1fr_0.85fr] gap-10 lg:gap-6 items-center" data-reveal>
          <div>
            <p className="lp-kicker"><span className="lp-badge-new mr-2">NUEVO</span> Módulo Premium</p>
            <h2 className="lp-display lp-h2 mt-3">Tu propia <span className="lp-grad">tienda online</span>, lista para vender.</h2>
            <p className="lp-lead-sm mt-4">Compartís un link y tus clientes ven tu catálogo con fotos, arman el carrito y te hacen el pedido. Elegís entre <b className="text-white/90">retiro o delivery</b>, descontás stock automático y te avisás por WhatsApp — todo desde el mismo sistema.</p>
            <ul className="mt-6 space-y-3">
              {['Catálogo con fotos, precios y buscador', 'Pedidos con delivery o retiro y aviso al cliente', 'Descuenta stock y suena en tu punto de venta'].map((t, i) => (
                <li key={i} className="lp-showcase-li"><span className="lp-ic-check">{ICONS.check}</span>{t}</li>
              ))}
            </ul>
            <button onClick={() => scrollASeccion('precios')} className="lp-btn lp-btn-brand mt-8">Activar en mi negocio <span className="lp-ic-xs">{ICONS.arrow}</span></button>
          </div>
          <PhoneMock fmtPrecio={fmtPrecio} />
        </div>
      </section>

      {/* PRECIOS */}
      <section id="precios" className="py-20 md:py-28 px-4 relative">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14 md:mb-16" data-reveal>
            <p className="lp-kicker justify-center">Planes y precios</p>
            <h2 className="lp-display lp-h2 mt-3">Elegí el plan de tu negocio.</h2>
            <p className="lp-lead-sm mt-4 max-w-xl mx-auto">Sin cargos ocultos y con 7 días gratis para probarlo. Cambiás o cancelás cuando quieras.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-5 md:gap-6 max-w-4xl mx-auto items-stretch">
            {/* ESTANDAR */}
            <div className="lp-plan" data-reveal>
              <div className="flex items-baseline justify-between">
                <h3 className="lp-display text-2xl font-bold text-white">Estándar</h3>
                <span className="lp-plan-tag">Negocios chicos</span>
              </div>
              <div className="mt-6 flex items-end gap-1">
                <span className="lp-price">{fmtPrecio(precios.estandar)}</span>
                <span className="lp-price-mes">/ mes</span>
              </div>
              <ul className="mt-7 space-y-3 flex-1">
                {planEstandar.map((t, i) => <li key={i} className="lp-plan-li"><span className="lp-ic-check">{ICONS.check}</span>{t}</li>)}
              </ul>
              <BotonWhatsApp numero={waVentas} texto="Empezar con Estándar" mensaje={`Hola! Quiero contratar el PLAN ESTANDAR de ${fmtPrecio(precios.estandar)} mensuales`} className="lp-btn lp-btn-ghost w-full mt-8" />
            </div>

            {/* PREMIUM */}
            <div className="lp-plan lp-plan-premium" data-reveal style={{ '--d': '.08s' }}>
              <div className="lp-plan-ribbon">Recomendado</div>
              <div className="flex items-baseline justify-between">
                <h3 className="lp-display text-2xl font-bold text-white">Premium</h3>
                <span className="lp-plan-tag lp-plan-tag-brand">Para crecer</span>
              </div>
              <div className="mt-6 flex items-end gap-1">
                <span className="lp-price lp-price-brand">{fmtPrecio(precios.premium)}</span>
                <span className="lp-price-mes">/ mes</span>
              </div>
              <ul className="mt-7 space-y-3 flex-1">
                {planPremium.map((t, i) => (
                  <li key={i} className="lp-plan-li lp-plan-li-on"><span className="lp-ic-check lp-ic-check-brand">{ICONS.check}</span>{t}</li>
                ))}
              </ul>
              <BotonWhatsApp numero={waVentas} texto="Quiero el Premium" mensaje={`Hola! Quiero contratar el PLAN PREMIUM de ${fmtPrecio(precios.premium)} mensuales`} className="lp-btn lp-btn-brand w-full mt-8" />
            </div>
          </div>

          <div className="text-center mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2" data-reveal>
            <span className="lp-trust-mini"><span className="lp-ic-check">{ICONS.check}</span>Mercado Pago, transferencia y efectivo</span>
            <span className="lp-trust-mini"><span className="lp-ic-check">{ICONS.check}</span>Factura A disponible en todos los planes</span>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 md:py-28 px-4 relative">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12" data-reveal>
            <p className="lp-kicker justify-center">Preguntas frecuentes</p>
            <h2 className="lp-display lp-h2 mt-3">¿Te quedan dudas?</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((f, i) => {
              const abierta = faqAbierta === i;
              return (
                <div key={i} className={`lp-faq ${abierta ? 'lp-faq-on' : ''}`} data-reveal style={{ '--d': `${i * 0.05}s` }}>
                  <button className="lp-faq-q" onClick={() => setFaqAbierta(abierta ? -1 : i)} aria-expanded={abierta}>
                    <span>{f.q}</span>
                    <span className="lp-faq-plus">{abierta ? '–' : '+'}</span>
                  </button>
                  <div className="lp-faq-a" style={{ maxHeight: abierta ? '220px' : '0px' }}>
                    <p>{f.a}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-16 md:py-24 px-4 relative">
        <div className="max-w-5xl mx-auto lp-cta" data-reveal>
          <div className="lp-cta-glow" aria-hidden="true" />
          <div className="relative text-center px-6 py-14 md:py-20">
            <h2 className="lp-display text-3xl md:text-5xl font-extrabold text-white leading-tight">¿Listo para vender mejor?</h2>
            <p className="text-white/85 text-lg md:text-xl mt-4 max-w-xl mx-auto">Empezá hoy con 7 días gratis. Te acompañamos en cada paso por WhatsApp.</p>
            <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
              <BotonWhatsApp numero={waVentas} texto="Empezar ahora por WhatsApp" mensaje="Hola! Quiero empezar a usar el sistema GestionQ24" className="lp-btn lp-btn-white lp-btn-lg" />
              <button onClick={() => scrollASeccion('precios')} className="lp-btn lp-btn-ghost-light lp-btn-lg">Ver planes</button>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="pt-14 pb-10 px-4 border-t relative" style={{ borderColor: 'var(--line)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <span className="lp-logo"><Logo /></span>
              <span className="lp-display font-extrabold text-lg">Gestión<span style={{ color: 'var(--brand)' }}>Q24</span></span>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <a href="/sistema-gestion-almacenes-kioscos.html" className="lp-foot-link">Sistema para almacenes y kioscos</a>
              <a href="/facturacion-electronica-arca.html" className="lp-foot-link">Facturación electrónica ARCA</a>
              <a href="/control-de-stock.html" className="lp-foot-link">Control de stock</a>
              <Link to="/login" className="lp-foot-link">Ingresar al sistema</Link>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t flex flex-col sm:flex-row justify-between gap-2 text-sm" style={{ borderColor: 'var(--line)' }}>
            <p style={{ color: 'var(--muted-2)' }}>© 2026 GestiónQ24 — Sistema de gestión comercial</p>
            <p style={{ color: 'var(--muted-2)' }}>Hecho por trabajadores, para trabajadores 🇦🇷</p>
          </div>
        </div>
      </footer>

      <MiniChat />

      <style>{`
        .lp-root{
          --bg:#070d0a; --bg-2:#0a1310;
          --panel:rgba(255,255,255,.035); --panel-2:rgba(255,255,255,.06);
          --line:rgba(255,255,255,.09); --line-strong:rgba(255,255,255,.15);
          --text:#eaf1ed; --muted:#93a49c; --muted-2:#6d7e77;
          --brand:#34d399; --brand-2:#10b981; --brand-deep:#065f46;
          --teal:#2dd4bf; --cyan:#22d3ee; --lime:#c6f24e;
          --font-display:'Bricolage Grotesque','Hanken Grotesk',sans-serif;
          --font-mono:'JetBrains Mono',ui-monospace,monospace;
          background:var(--bg); color:var(--text);
          font-family:'Hanken Grotesk',ui-sans-serif,system-ui,sans-serif;
        }
        .lp-display{ font-family:var(--font-display); letter-spacing:-.02em; }

        /* ATMOSFERA */
        .lp-atmos{ position:fixed; inset:0; z-index:0; pointer-events:none; overflow:hidden; }
        .lp-aurora{ position:absolute; border-radius:50%; filter:blur(70px); opacity:.5; mix-blend-mode:screen; }
        .lp-a1{ width:52vw; height:52vw; top:-16vw; left:-8vw; background:radial-gradient(circle at 40% 40%, rgba(16,185,129,.55), transparent 62%); animation:lp-drift1 22s ease-in-out infinite; }
        .lp-a2{ width:46vw; height:46vw; top:-6vw; right:-10vw; background:radial-gradient(circle at 60% 40%, rgba(34,211,238,.34), transparent 60%); animation:lp-drift2 26s ease-in-out infinite; }
        .lp-a3{ width:60vw; height:60vw; top:32vw; left:20vw; background:radial-gradient(circle at 50% 50%, rgba(45,212,191,.22), transparent 64%); animation:lp-drift1 30s ease-in-out infinite reverse; }
        @keyframes lp-drift1{ 0%,100%{ transform:translate(0,0) scale(1);} 50%{ transform:translate(4vw,3vw) scale(1.08);} }
        @keyframes lp-drift2{ 0%,100%{ transform:translate(0,0) scale(1);} 50%{ transform:translate(-3vw,2vw) scale(1.12);} }
        .lp-grid{ position:absolute; inset:0; background-image:linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px); background-size:44px 44px; mask-image:radial-gradient(ellipse 80% 55% at 50% 0%, #000 40%, transparent 78%); -webkit-mask-image:radial-gradient(ellipse 80% 55% at 50% 0%, #000 40%, transparent 78%); }
        .lp-grain{ position:absolute; inset:0; opacity:.05; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }

        section,header,nav,footer,.lp-marquee-wrap{ position:relative; z-index:1; }

        /* NAV */
        .lp-nav-solid{ background:rgba(7,13,10,.72); backdrop-filter:blur(14px); border-bottom:1px solid var(--line); }
        .lp-navlink{ color:var(--muted); font-weight:500; font-size:.95rem; transition:color .2s; background:none; }
        .lp-navlink:hover{ color:#fff; }
        .lp-nav-mobile{ background:rgba(8,15,12,.96); backdrop-filter:blur(14px); border-bottom:1px solid var(--line); }
        .lp-logo{ width:34px; height:34px; display:grid; place-items:center; border-radius:11px; background:linear-gradient(140deg,var(--brand),var(--brand-deep)); box-shadow:0 6px 20px -6px var(--brand), inset 0 1px 0 rgba(255,255,255,.35); color:#04140d; }

        /* BOTONES */
        .lp-btn{ display:inline-flex; align-items:center; justify-content:center; gap:.5rem; font-weight:600; border-radius:13px; padding:.72rem 1.25rem; font-size:.95rem; transition:transform .18s ease, box-shadow .25s ease, background .2s; cursor:pointer; white-space:nowrap; }
        .lp-btn-sm{ padding:.5rem .95rem; font-size:.9rem; border-radius:11px; }
        .lp-btn-lg{ padding:.95rem 1.6rem; font-size:1.02rem; }
        .lp-btn-brand{ position:relative; color:#04140d; background:linear-gradient(140deg,#5ee9ad,var(--brand-2)); box-shadow:0 10px 30px -10px var(--brand), inset 0 1px 0 rgba(255,255,255,.4); overflow:hidden; }
        .lp-btn-brand::after{ content:""; position:absolute; inset:0; transform:translateX(-120%); background:linear-gradient(105deg,transparent 30%,rgba(255,255,255,.55) 50%,transparent 70%); transition:transform .7s; }
        .lp-btn-brand:hover{ transform:translateY(-2px); box-shadow:0 16px 40px -10px var(--brand); }
        .lp-btn-brand:hover::after{ transform:translateX(120%); }
        .lp-btn-ghost{ color:#fff; background:var(--panel); border:1px solid var(--line-strong); }
        .lp-btn-ghost:hover{ background:var(--panel-2); transform:translateY(-2px); }
        .lp-btn-white{ background:#fff; color:#04241a; box-shadow:0 12px 34px -12px rgba(255,255,255,.6); }
        .lp-btn-white:hover{ transform:translateY(-2px); }
        .lp-btn-ghost-light{ background:rgba(255,255,255,.12); color:#fff; border:1px solid rgba(255,255,255,.35); }
        .lp-btn-ghost-light:hover{ background:rgba(255,255,255,.2); }
        .lp-ic-xs{ width:18px; height:18px; display:inline-block; }
        .lp-ic-xs svg{ width:18px; height:18px; }

        /* HERO */
        .lp-eyebrow{ display:inline-flex; align-items:center; gap:.55rem; font-family:var(--font-mono); font-size:.72rem; letter-spacing:.08em; text-transform:uppercase; color:var(--brand); background:rgba(16,185,129,.08); border:1px solid rgba(52,211,153,.25); padding:.42rem .8rem; border-radius:999px; }
        .lp-dot{ width:7px; height:7px; border-radius:50%; background:var(--brand); box-shadow:0 0 0 0 var(--brand); animation:lp-pulse 2s infinite; }
        @keyframes lp-pulse{ 0%{ box-shadow:0 0 0 0 rgba(52,211,153,.6);} 70%{ box-shadow:0 0 0 8px rgba(52,211,153,0);} 100%{ box-shadow:0 0 0 0 rgba(52,211,153,0);} }
        .lp-h1{ font-weight:800; font-size:clamp(2.5rem,6.4vw,4.6rem); line-height:1.02; color:#fff; }
        .lp-grad{ background:linear-gradient(105deg,var(--brand) 0%,var(--teal) 45%,var(--cyan) 100%); -webkit-background-clip:text; background-clip:text; color:transparent; }
        .lp-lead{ font-size:clamp(1.05rem,1.6vw,1.28rem); line-height:1.6; color:var(--muted); max-width:38rem; margin-left:auto; margin-right:auto; }
        @media(min-width:1024px){ .lp-lead{ margin-left:0; } }
        .lp-lead-sm{ font-size:1.06rem; line-height:1.6; color:var(--muted); }
        .lp-trust-mini{ display:inline-flex; align-items:center; gap:.4rem; font-size:.88rem; color:var(--muted); }
        .lp-ic-check{ width:17px; height:17px; color:var(--brand); flex:0 0 auto; }
        .lp-ic-check svg{ width:17px; height:17px; }

        /* MOCK PANEL */
        .lp-mock{ position:relative; border-radius:22px; padding:1px; background:linear-gradient(150deg,rgba(52,211,153,.5),rgba(255,255,255,.06) 40%,rgba(34,211,238,.3)); box-shadow:0 40px 90px -30px rgba(0,0,0,.75); animation:lp-float 7s ease-in-out infinite; }
        @keyframes lp-float{ 0%,100%{ transform:translateY(0);} 50%{ transform:translateY(-12px);} }
        .lp-mock-inner{ border-radius:21px; background:linear-gradient(180deg,#0b1512,#0a120f); overflow:hidden; }
        .lp-mock-bar{ display:flex; align-items:center; gap:.4rem; padding:.7rem .9rem; border-bottom:1px solid var(--line); }
        .lp-tl{ width:10px; height:10px; border-radius:50%; }
        .lp-mock-body{ padding:1.1rem; }
        .lp-stat{ background:var(--panel); border:1px solid var(--line); border-radius:13px; padding:.75rem .85rem; }
        .lp-stat-l{ font-size:.68rem; text-transform:uppercase; letter-spacing:.06em; color:var(--muted-2); font-family:var(--font-mono); }
        .lp-stat-v{ font-size:1.25rem; font-weight:800; color:#fff; margin-top:.15rem; }
        .lp-stat-v.brand{ color:var(--brand); }
        .lp-chartbox{ background:var(--panel); border:1px solid var(--line); border-radius:13px; padding:.85rem; margin-top:.7rem; }
        .lp-bars{ display:flex; align-items:flex-end; gap:.4rem; height:82px; }
        .lp-bars i{ flex:1; border-radius:5px 5px 2px 2px; background:linear-gradient(180deg,var(--brand),rgba(16,185,129,.25)); transform:scaleY(.06); transform-origin:bottom; animation:lp-bar 1.1s cubic-bezier(.2,.9,.2,1) forwards; }
        @keyframes lp-bar{ to{ transform:scaleY(1);} }
        .lp-mock-ticket{ display:flex; align-items:center; gap:.6rem; margin-top:.7rem; padding:.7rem .8rem; border-radius:12px; background:linear-gradient(100deg,rgba(16,185,129,.16),rgba(16,185,129,.05)); border:1px solid rgba(52,211,153,.28); }
        .lp-mock-ticket .ok{ width:26px; height:26px; flex:0 0 auto; display:grid; place-items:center; border-radius:8px; background:var(--brand); color:#04140d; }
        .lp-mock-ticket .ok svg{ width:16px; height:16px; }

        /* MARQUEE */
        .lp-marquee-wrap{ overflow:hidden; background:rgba(255,255,255,.015); }
        .lp-marquee{ display:flex; gap:0; width:max-content; animation:lp-scroll 34s linear infinite; }
        .lp-marquee-wrap:hover .lp-marquee{ animation-play-state:paused; }
        @keyframes lp-scroll{ to{ transform:translateX(-50%);} }
        .lp-chip-mono{ display:inline-flex; align-items:center; font-family:var(--font-mono); font-size:.8rem; color:var(--muted); letter-spacing:.02em; padding:0 0; white-space:nowrap; }
        .lp-sep{ color:var(--brand); opacity:.5; margin:0 1.4rem; font-size:.55rem; }

        /* KICKERS / TITULOS */
        .lp-kicker{ display:inline-flex; align-items:center; font-family:var(--font-mono); font-size:.75rem; letter-spacing:.14em; text-transform:uppercase; color:var(--brand); }
        .lp-h2{ font-weight:800; font-size:clamp(1.9rem,4vw,3rem); line-height:1.05; color:#fff; }

        /* FEATURES BENTO */
        .lp-feature{ position:relative; background:var(--panel); border:1px solid var(--line); border-radius:20px; padding:1.4rem; overflow:hidden; transition:transform .3s ease, border-color .3s ease, background .3s ease; }
        .lp-feature::before{ content:""; position:absolute; inset:0; background:radial-gradient(400px circle at var(--mx,80%) 0%, rgba(52,211,153,.1), transparent 60%); opacity:0; transition:opacity .3s; }
        .lp-feature:hover{ transform:translateY(-4px); border-color:rgba(52,211,153,.32); background:var(--panel-2); }
        .lp-feature:hover::before{ opacity:1; }
        .lp-feat-ic{ width:46px; height:46px; padding:11px; border-radius:13px; color:var(--brand); background:rgba(16,185,129,.1); border:1px solid rgba(52,211,153,.22); }
        .lp-feat-desc{ color:var(--muted); font-size:.95rem; line-height:1.5; }
        .lp-badge-new{ font-family:var(--font-mono); font-size:.6rem; font-weight:600; letter-spacing:.08em; color:#04140d; background:var(--lime); padding:.18rem .45rem; border-radius:6px; }
        .lp-cae{ display:flex; align-items:center; gap:.6rem; padding:.65rem .75rem; border-radius:12px; background:rgba(16,185,129,.09); border:1px solid rgba(52,211,153,.25); }
        .lp-cae-ok{ width:24px; height:24px; flex:0 0 auto; display:grid; place-items:center; border-radius:7px; background:var(--brand); color:#04140d; }
        .lp-cae-ok svg{ width:15px; height:15px; }
        .lp-cae-t{ font-size:.82rem; font-weight:600; color:#fff; }
        .lp-cae-n{ font-family:var(--font-mono); font-size:.7rem; color:var(--muted); }
        .lp-poschips{ display:flex; flex-wrap:wrap; gap:.4rem; }
        .lp-poschip{ font-size:.78rem; color:var(--muted); background:var(--panel); border:1px solid var(--line); padding:.28rem .6rem; border-radius:8px; }

        /* SHOWCASE */
        .lp-showcase{ background:linear-gradient(150deg,rgba(255,255,255,.03),transparent); border:1px solid var(--line); border-radius:26px; padding:2rem; }
        @media(min-width:1024px){ .lp-showcase{ padding:3rem; } }
        .lp-showcase-li{ display:flex; align-items:flex-start; gap:.6rem; color:var(--text); font-size:1rem; }
        .lp-showcase-li .lp-ic-check{ margin-top:3px; }

        /* PHONE MOCK */
        .lp-phone{ width:250px; margin:0 auto; border-radius:34px; padding:9px; background:linear-gradient(160deg,#1a2620,#0c1310); border:1px solid var(--line-strong); box-shadow:0 40px 80px -28px rgba(0,0,0,.8); animation:lp-float 8s ease-in-out infinite; }
        .lp-phone-screen{ border-radius:26px; overflow:hidden; background:#0a1310; }
        .lp-ph-head{ background:linear-gradient(135deg,var(--brand-2),var(--brand-deep)); padding:.9rem; color:#eafff6; }
        .lp-ph-head h4{ font-family:var(--font-display); font-weight:800; font-size:1rem; }
        .lp-ph-body{ padding:.7rem; display:grid; grid-template-columns:1fr 1fr; gap:.5rem; }
        .lp-ph-card{ background:var(--panel); border:1px solid var(--line); border-radius:11px; overflow:hidden; }
        .lp-ph-img{ height:44px; background:linear-gradient(135deg,rgba(52,211,153,.25),rgba(34,211,238,.14)); }
        .lp-ph-card p{ font-size:.62rem; color:var(--text); padding:.32rem .4rem 0; }
        .lp-ph-card span{ display:block; font-family:var(--font-mono); font-size:.6rem; color:var(--brand); padding:0 .4rem .35rem; }
        .lp-ph-toast{ margin:.2rem .7rem .8rem; display:flex; align-items:center; gap:.45rem; background:rgba(16,185,129,.14); border:1px solid rgba(52,211,153,.3); border-radius:10px; padding:.45rem .55rem; font-size:.66rem; color:#fff; }
        .lp-ph-toast .d{ width:16px;height:16px;flex:0 0 auto;display:grid;place-items:center;border-radius:5px;background:var(--brand);color:#04140d; }
        .lp-ph-toast .d svg{ width:11px;height:11px; }

        /* PLANES */
        .lp-plan{ display:flex; flex-direction:column; background:var(--panel); border:1px solid var(--line); border-radius:22px; padding:1.8rem; position:relative; transition:transform .3s, border-color .3s; }
        .lp-plan:hover{ transform:translateY(-4px); }
        .lp-plan-premium{ border-color:rgba(52,211,153,.4); background:linear-gradient(180deg,rgba(16,185,129,.1),var(--panel) 55%); box-shadow:0 30px 70px -35px var(--brand); }
        .lp-plan-ribbon{ position:absolute; top:0; right:1.6rem; transform:translateY(-50%); font-family:var(--font-mono); font-size:.68rem; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:#04140d; background:linear-gradient(135deg,#5ee9ad,var(--brand-2)); padding:.32rem .8rem; border-radius:999px; box-shadow:0 8px 20px -6px var(--brand); }
        .lp-plan-tag{ font-size:.72rem; color:var(--muted); background:var(--panel-2); border:1px solid var(--line); padding:.22rem .55rem; border-radius:7px; }
        .lp-plan-tag-brand{ color:var(--brand); border-color:rgba(52,211,153,.3); background:rgba(16,185,129,.08); }
        .lp-price{ font-family:var(--font-display); font-weight:800; font-size:2.6rem; color:#fff; line-height:1; }
        .lp-price-brand{ background:linear-gradient(105deg,var(--brand),var(--teal)); -webkit-background-clip:text; background-clip:text; color:transparent; }
        .lp-price-mes{ color:var(--muted); font-size:.95rem; padding-bottom:.25rem; }
        .lp-plan-li{ display:flex; align-items:flex-start; gap:.55rem; font-size:.94rem; color:var(--muted); }
        .lp-plan-li-on{ color:var(--text); }
        .lp-ic-check-brand{ color:var(--brand); }

        /* FAQ */
        .lp-faq{ background:var(--panel); border:1px solid var(--line); border-radius:15px; overflow:hidden; transition:border-color .3s, background .3s; }
        .lp-faq-on{ border-color:rgba(52,211,153,.3); background:var(--panel-2); }
        .lp-faq-q{ width:100%; display:flex; align-items:center; justify-content:space-between; gap:1rem; text-align:left; padding:1.1rem 1.3rem; font-weight:600; color:#fff; font-size:1.02rem; cursor:pointer; background:none; }
        .lp-faq-plus{ font-family:var(--font-mono); font-size:1.4rem; color:var(--brand); flex:0 0 auto; line-height:1; }
        .lp-faq-a{ overflow:hidden; transition:max-height .35s ease; }
        .lp-faq-a p{ padding:0 1.3rem 1.2rem; color:var(--muted); line-height:1.6; }

        /* CTA */
        .lp-cta{ position:relative; border-radius:28px; overflow:hidden; background:linear-gradient(135deg,var(--brand-2),var(--brand-deep) 70%,#043d2b); border:1px solid rgba(52,211,153,.4); box-shadow:0 40px 90px -35px var(--brand); }
        .lp-cta-glow{ position:absolute; inset:0; background:radial-gradient(600px circle at 20% 0%, rgba(198,242,78,.28), transparent 55%),radial-gradient(500px circle at 90% 100%, rgba(34,211,238,.3), transparent 55%); }

        /* FOOTER */
        .lp-foot-link{ color:var(--muted); transition:color .2s; }
        .lp-foot-link:hover{ color:var(--brand); }

        /* REVEAL + RISE */
        [data-reveal]{ opacity:0; transform:translateY(24px); transition:opacity .7s cubic-bezier(.2,.8,.2,1), transform .7s cubic-bezier(.2,.8,.2,1); transition-delay:var(--d,0s); }
        [data-reveal].lp-in{ opacity:1; transform:none; }
        .lp-rise{ opacity:0; animation:lp-rise .8s cubic-bezier(.2,.8,.2,1) forwards; }
        @keyframes lp-rise{ from{ opacity:0; transform:translateY(26px);} to{ opacity:1; transform:none;} }

        @media (prefers-reduced-motion: reduce){
          .lp-aurora,.lp-mock,.lp-phone,.lp-marquee,.lp-dot,.lp-bars i{ animation:none !important; }
          [data-reveal]{ opacity:1 !important; transform:none !important; }
          .lp-rise{ opacity:1 !important; animation:none !important; }
        }
      `}</style>
    </div>
  );
}

// Marca (logo) — storefront minimal sobre el badge con gradiente.
function Logo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
      <path d="M4 8.5 5.2 4h13.6L20 8.5" /><path d="M5 8.5v11h14v-11" /><path d="M4 8.5h16" /><path d="M9.5 19.5V14h5v5.5" />
    </svg>
  );
}

// Mock del panel del sistema para el hero (stats + grafico + comprobante).
function HeroMock({ fmtPrecio }) {
  const bars = [38, 62, 45, 78, 55, 88, 70];
  return (
    <div className="lp-mock">
      <div className="lp-mock-inner">
        <div className="lp-mock-bar">
          <span className="lp-tl" style={{ background: '#ff5f57' }} />
          <span className="lp-tl" style={{ background: '#febc2e' }} />
          <span className="lp-tl" style={{ background: '#28c840' }} />
          <span className="ml-2 text-xs" style={{ color: 'var(--muted-2)', fontFamily: 'var(--font-mono)' }}>panel · gestionq24</span>
        </div>
        <div className="lp-mock-body">
          <div className="grid grid-cols-3 gap-2">
            <div className="lp-stat"><div className="lp-stat-l">Ventas hoy</div><div className="lp-stat-v brand">{fmtPrecio(184500)}</div></div>
            <div className="lp-stat"><div className="lp-stat-l">Tickets</div><div className="lp-stat-v">142</div></div>
            <div className="lp-stat"><div className="lp-stat-l">Stock bajo</div><div className="lp-stat-v">7</div></div>
          </div>
          <div className="lp-chartbox">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs" style={{ color: 'var(--muted)' }}>Ventas de la semana</span>
              <span className="text-xs font-semibold" style={{ color: 'var(--brand)', fontFamily: 'var(--font-mono)' }}>+24%</span>
            </div>
            <div className="lp-bars">
              {bars.map((h, i) => <i key={i} style={{ height: `${h}%`, animationDelay: `${0.4 + i * 0.08}s` }} />)}
            </div>
          </div>
          <div className="lp-mock-ticket">
            <span className="ok">{ICONS.check}</span>
            <div>
              <div className="text-xs font-semibold text-white">Comprobante emitido con CAE real</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.66rem', color: 'var(--muted)' }}>Factura B · Nº 16840 · AFIP OK</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Mock del celular para el showcase de la Tienda Online.
function PhoneMock({ fmtPrecio }) {
  const prods = [['Coca-Cola 1.5L', 2100], ['Pan casero', 1500], ['Fiambre x kg', 8900], ['Cerveza IPA', 3200]];
  return (
    <div className="lp-phone">
      <div className="lp-phone-screen">
        <div className="lp-ph-head">
          <h4>La Esquina</h4>
          <p className="text-xs opacity-90">Envíos a domicilio · Abierto ahora</p>
        </div>
        <div className="lp-ph-body">
          {prods.map(([n, p], i) => (
            <div key={i} className="lp-ph-card">
              <div className="lp-ph-img" />
              <p>{n}</p>
              <span>{fmtPrecio(p)}</span>
            </div>
          ))}
        </div>
        <div className="lp-ph-toast">
          <span className="d">{ICONS.check}</span>
          <span>Pedido #142 confirmado · Te avisamos por WhatsApp</span>
        </div>
      </div>
    </div>
  );
}

export default Landing;
