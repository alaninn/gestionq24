// =============================================
// ARCHIVO: src/components/shared/ErrorBoundary.jsx
// Red de seguridad: si un error de render rompe la app, en vez de quedar
// la pantalla en blanco muestra el error y opciones de recuperación.
// =============================================

import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Log al cliente para diagnóstico (visible en consola del navegador)
    console.error('💥 Error de render capturado:', error, info?.componentStack);
  }

  recargar = () => {
    window.location.reload();
  };

  restablecer = () => {
    // Limpia SOLO los datos locales del POS (carritos/pestañas), que son la causa
    // típica de pantallas en blanco por datos viejos. No toca la sesión.
    try {
      localStorage.removeItem('pos_pestanas');
      localStorage.removeItem('pos_pestana_activa');
      localStorage.removeItem('pos_contador_ventas');
    } catch {}
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center space-y-4">
            <div className="text-5xl">😵</div>
            <h1 className="text-xl font-bold text-gray-800">Algo salió mal</h1>
            <p className="text-sm text-gray-500">
              Ocurrió un error inesperado en la pantalla. Probá recargar; si vuelve a pasar,
              usá "Restablecer" (limpia los carritos guardados en este dispositivo, no afecta tus ventas ni productos).
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-left">
              <p className="text-xs font-mono text-red-700 break-all">
                {String(this.state.error?.message || this.state.error)}
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={this.recargar}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold transition-colors">
                🔄 Recargar
              </button>
              <button onClick={this.restablecer}
                className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-colors">
                🧹 Restablecer y recargar
              </button>
            </div>
            <p className="text-xs text-gray-400">
              Si el problema persiste, sacale una captura a este mensaje y envianosla por soporte.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
