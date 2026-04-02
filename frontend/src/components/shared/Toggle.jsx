// =============================================
// COMPONENTE: Toggle
// Componente compartido para switches de la interfaz
// =============================================

function Toggle({ activo, onChange, disabled = false }) {
  return (
    <div
      onClick={() => !disabled && onChange(!activo)}
      className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${
        disabled ? 'opacity-50 cursor-not-allowed' :
        activo ? 'bg-green-500 cursor-pointer' : 'bg-gray-300 cursor-pointer'
      }`}
    >
      <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
        activo ? 'translate-x-6' : 'translate-x-0'
      }`} />
    </div>
  );
}

export default Toggle;