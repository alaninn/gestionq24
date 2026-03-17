// =============================================
// ARCHIVO: src/components/admin/Soporte.jsx
// =============================================

import { useState, useEffect } from 'react';
import api from '../../api/axios';

function Soporte() {
  const [tickets, setTickets] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarModalNuevo, setMostrarModalNuevo] = useState(false);
  const [nuevoTicket, setNuevoTicket] = useState({
    titulo: '',
    descripcion: '',
    categoria: 'bug'
  });
  const [exito, setExito] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    cargarTickets();
  }, []);

  const cargarTickets = async () => {
    try {
      setCargando(true);
      const res = await api.get('/api/soporte/tickets');
      setTickets(res.data || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setCargando(false);
    }
  };

  const crearTicket = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/api/soporte/tickets', nuevoTicket);
      setExito('Ticket creado correctamente. El equipo de soporte se pondrá en contacto pronto.');
      setMostrarModalNuevo(false);
      setNuevoTicket({ titulo: '', descripcion: '', categoria: 'bug' });
      cargarTickets();
      setTimeout(() => setExito(''), 5000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear ticket');
    }
  };

  const getEstadoColor = (estado) => {
    switch (estado) {
      case 'abierto': return 'bg-red-100 text-red-700';
      case 'en_progreso': return 'bg-yellow-100 text-yellow-700';
      case 'resuelto': return 'bg-green-100 text-green-700';
      case 'cerrado': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getCategoriaIcon = (categoria) => {
    switch (categoria) {
      case 'bug': return '🐛';
      case 'pregunta': return '❓';
      case 'lentitud': return '🐌';
      case 'acceso': return '🔐';
      default: return '📋';
    }
  };

  if (cargando) return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-500">Cargando soporte...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">🎫 Soporte Técnico</h2>
          <p className="text-gray-500">Reporta problemas o solicita ayuda</p>
        </div>
        <button
          onClick={() => setMostrarModalNuevo(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          📝 Nuevo Ticket
        </button>
      </div>

      {/* Mensajes */}
      {exito && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
          <p className="text-green-700">{exito}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Lista de tickets */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">Mis Tickets</h3>
        </div>

        {tickets.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-4">🎫</div>
            <h4 className="text-lg font-medium text-gray-800 mb-2">No tienes tickets abiertos</h4>
            <p className="text-gray-500">Si tienes algún problema, crea un ticket para recibir ayuda.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {tickets.map(ticket => (
              <div key={ticket.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-lg">{getCategoriaIcon(ticket.categoria)}</span>
                      <h4 className="font-medium text-gray-800">{ticket.titulo}</h4>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${getEstadoColor(ticket.estado)}`}>
                        {ticket.estado.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm mb-2">{ticket.descripcion}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Creado: {new Date(ticket.fecha_creacion).toLocaleDateString('es-AR')}</span>
                      {ticket.fecha_resolucion && (
                        <span>Resuelto: {new Date(ticket.fecha_resolucion).toLocaleDateString('es-AR')}</span>
                      )}
                    </div>
                    {ticket.respuesta && (
                      <div className="mt-3 p-3 bg-blue-50 border-l-4 border-blue-500 rounded">
                        <p className="text-sm text-blue-800">
                          <strong>Respuesta del soporte:</strong> {ticket.respuesta}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Nuevo Ticket */}
      {mostrarModalNuevo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">📝 Crear Nuevo Ticket</h3>
            </div>

            <form onSubmit={crearTicket} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                <input
                  type="text"
                  value={nuevoTicket.titulo}
                  onChange={(e) => setNuevoTicket({...nuevoTicket, titulo: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Breve descripción del problema"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                <select
                  value={nuevoTicket.categoria}
                  onChange={(e) => setNuevoTicket({...nuevoTicket, categoria: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="bug">🐛 Error/Bug</option>
                  <option value="pregunta">❓ Pregunta</option>
                  <option value="lentitud">🐌 Sistema lento</option>
                  <option value="acceso">🔐 Problemas de acceso</option>
                  <option value="otro">📋 Otro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  value={nuevoTicket.descripcion}
                  onChange={(e) => setNuevoTicket({...nuevoTicket, descripcion: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent h-24 resize-none"
                  placeholder="Describe detalladamente el problema o pregunta"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setMostrarModalNuevo(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-lg font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                >
                  📤 Enviar Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Soporte;