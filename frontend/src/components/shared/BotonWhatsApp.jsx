function BotonWhatsApp({ texto, mensaje, className = '', children, numero }) {
  // Número por defecto (fallback). En la landing se pasa el configurable.
  const NUMERO_WHATSAPP = '5491162684353';

  const abrirWhatsApp = () => {
    const num = (numero ? String(numero).replace(/\D/g, '') : '') || NUMERO_WHATSAPP;
    const url = `https://wa.me/${num}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  };

  return (
    <button onClick={abrirWhatsApp} className={`cursor-pointer ${className}`}>
      {children || texto}
    </button>
  );
}

export default BotonWhatsApp;