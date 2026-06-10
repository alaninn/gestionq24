function BotonWhatsApp({ texto, mensaje, className = '', children }) {
  const NUMERO_WHATSAPP = '5491162684353';

  const abrirWhatsApp = () => {
    const url = `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  };

  return (
    <button onClick={abrirWhatsApp} className={`cursor-pointer ${className}`}>
      {children || texto}
    </button>
  );
}

export default BotonWhatsApp;