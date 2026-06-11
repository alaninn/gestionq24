// =============================================
// COMPONENTE: Facturación Electrónica ARCA
// =============================================

import { useState, useEffect } from 'react';
import api from '../../api/axios';
import Toggle from '../shared/Toggle';

function FacturacionElectronica({ config, setConfig }) {
  const [certificados, setCertificados] = useState([]);
  const [comprobantes, setComprobantes] = useState([]);
  const [tiposComprobante, setTiposComprobante] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [exito, setExito] = useState('');
  const [error, setError] = useState('');
  const [paso, setPaso] = useState(0); // 0=tutorial, 1=config, 2=certificados, 3=comprobantes
  
  // Estados para generación de certificados
  const [generandoCert, setGenerandoCert] = useState(false);
  const [archivosGenerados, setArchivosGenerados] = useState(null);
  const [cuitInput, setCuitInput] = useState('');
  const [razonSocialInput, setRazonSocialInput] = useState('');
  
  // Estados para subida de certificado
  const [subiendoCert, setSubiendoCert] = useState(false);
  const [archivoCert, setArchivoCert] = useState(null);
  
  // Estados para formulario de comprobante
  const [mostrarFormComprobante, setMostrarFormComprobante] = useState(false);
  const [formComprobante, setFormComprobante] = useState({
    tipo_comprobante: '',
    tipo_documento: 99,
    numero_documento: '',
    denominacion_comprador: '',
    importe_total: '',
    importe_neto: '',
    importe_iva: ''
  });
  const [emitiendo, setEmitiendo] = useState(false);
  const [testConectando, setTestConectando] = useState(false);
  const [resultadoTest, setResultadoTest] = useState(null);

  // Conexión delegada (web service delegado al CUIT del proveedor)
  const [delegacionInfo, setDelegacionInfo] = useState(null);
  const [formDelegacion, setFormDelegacion] = useState({ cuit: '', punto_venta: '', regimen_fiscal: 'responsable_inscripto' });
  const [activandoDelegacion, setActivandoDelegacion] = useState(false);
  // Qué vía eligió el usuario en la pestaña Certificados: null = sin elegir, 'delegado' | 'propio'
  const [viaConexion, setViaConexion] = useState(null);

  useEffect(() => {
    cargarDatosSecundarios();
    api.get('/api/arca/delegacion-info')
      .then(res => setDelegacionInfo(res.data))
      .catch(() => setDelegacionInfo({ disponible: false }));
  }, [config?.regimen_fiscal]);

  const activarDelegacion = async (e) => {
    e.preventDefault();
    try {
      setActivandoDelegacion(true);
      setError('');
      const res = await api.post('/api/arca/activar-delegacion', formDelegacion);
      setExito(`✅ ${res.data.mensaje}`);
      await cargarDatosSecundarios();
      setTimeout(() => setExito(''), 6000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al activar la conexión delegada');
      setTimeout(() => setError(''), 5000);
    } finally {
      setActivandoDelegacion(false);
    }
  };

  const cargarDatosSecundarios = async () => {
    try {
      setCargando(true);
      const [certRes, compRes] = await Promise.all([
        api.get('/api/arca/certificados'),
        api.get('/api/arca/comprobantes')
      ]);
      
      setCertificados(certRes.data);
      setComprobantes(compRes.data);
      
      // Cargar tipos de comprobante según régimen
      if (config?.regimen_fiscal) {
        const tiposRes = await api.get(`/api/arca/tipos-comprobante/${config.regimen_fiscal}`);
        setTiposComprobante(tiposRes.data);
      }
    } catch (err) {
      console.error('Error cargando datos:', err);
    } finally {
      setCargando(false);
    }
  };

  const guardarConfiguracion = async () => {
    try {
      setGuardando(true);
      setError('');
      await api.put('/api/configuracion', config);
      setExito('✅ Configuración guardada correctamente');
      setTimeout(() => setExito(''), 3000);
    } catch (err) {
      setError('❌ Error al guardar la configuración');
    } finally {
      setGuardando(false);
    }
  };

  const set = (campo, valor) => {
    setConfig(prev => ({ ...prev, [campo]: valor }));
  };

  const cambiarRegimenFiscal = async (regimen) => {
    set('regimen_fiscal', regimen);
    try {
      const tiposRes = await api.get(`/api/arca/tipos-comprobante/${regimen}`);
      setTiposComprobante(tiposRes.data);
    } catch (err) {
      console.error('Error cargando tipos:', err);
    }
  };

  const generarCertificados = async () => {
    if (!cuitInput) {
      setError('Por favor ingresá tu CUIT');
      return;
    }
    
    try {
      setGenerandoCert(true);
      setError('');
      
      const res = await api.post('/api/arca/generar-certificados', {
        cuit: cuitInput.replace(/[-\s]/g, ''),
        razon_social: razonSocialInput || config?.nombre_negocio || 'Usuario ARCA'
      });
      
      setArchivosGenerados(res.data.archivos);
      setExito('✅ Certificados generados. Descargá el .csr y subilo a ARCA');
      setTimeout(() => setExito(''), 5000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al generar certificados');
    } finally {
      setGenerandoCert(false);
    }
  };

  const subirCertificado = async () => {
    if (!archivoCert) {
      setError('Por favor seleccioná el archivo .crt');
      return;
    }
    
    try {
      setSubiendoCert(true);
      setError('');
      
      const formData = new FormData();
      formData.append('certificado', archivoCert);
      formData.append('cuit', cuitInput.replace(/[-\s]/g, ''));
      formData.append('punto_venta', config?.punto_venta_arca || 1);
      formData.append('regimen_fiscal', config?.regimen_fiscal || 'responsable_inscripto');
      
      await api.post('/api/arca/subir-certificado', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setExito('✅ Certificado subido correctamente');
      setArchivoCert(null);
      cargarDatosSecundarios();
      setTimeout(() => setExito(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al subir certificado');
    } finally {
      setSubiendoCert(false);
    }
  };

  const eliminarCertificado = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este certificado?')) return;
    
    try {
      await api.delete(`/api/arca/certificados/${id}`);
      setExito('✅ Certificado eliminado');
      cargarDatosSecundarios();
      setTimeout(() => setExito(''), 3000);
    } catch (err) {
      setError('Error al eliminar certificado');
    }
  };

  const emitirComprobante = async () => {
    if (!formComprobante.tipo_comprobante || !formComprobante.importe_total) {
      setError('Por favor completá los campos requeridos');
      return;
    }
    
    try {
      setEmitiendo(true);
      setError('');
      
      const res = await api.post('/api/arca/emitir', {
        ...formComprobante,
        punto_venta: config?.punto_venta_arca || 1,
        importe_total: parseFloat(formComprobante.importe_total),
        importe_neto: parseFloat(formComprobante.importe_neto || formComprobante.importe_total),
        importe_iva: parseFloat(formComprobante.importe_iva || 0)
      });
      
      if (res.data.exito) {
        setExito(`✅ Comprobante emitido - CAE: ${res.data.comprobante.cae}`);
        setMostrarFormComprobante(false);
        setFormComprobante({
          tipo_comprobante: '',
          tipo_documento: 99,
          numero_documento: '',
          denominacion_comprador: '',
          importe_total: '',
          importe_neto: '',
          importe_iva: ''
        });
        cargarDatosSecundarios();
        setTimeout(() => setExito(''), 5000);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al emitir comprobante');
    } finally {
      setEmitiendo(false);
    }
  };

  const descargarArchivo = async (tipo, filename) => {
    try {
      const res = await api.get(`/api/arca/descargar/${tipo}/${filename}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Error al descargar archivo');
    }
  };

  const certificadoActivo = certificados.find(c => c.activo);
  // Vía de conexión mostrada en la pestaña Certificados: la elegida por el usuario,
  // o la que ya está activa, o ninguna (muestra el selector)
  const via = viaConexion ?? (certificadoActivo ? (certificadoActivo.modo === 'delegado' ? 'delegado' : 'propio') : null);

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p className="text-gray-400">Cargando configuración de facturación...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Título */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800">🧾 Facturación Electrónica</h2>
        <p className="text-gray-500">Configurá ARCA Argentina para emitir facturas electrónicas</p>
      </div>

      {/* Mensajes */}
      {exito && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg">{exito}</div>}
      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">{error}</div>}

      {/* Navegación de pestañas */}
      <div className="flex gap-2 border-b pb-2">
        {[
          { id: 0, label: '📚 Tutorial', icon: '📚' },
          { id: 1, label: '⚙️ Configuración', icon: '⚙️' },
          { id: 2, label: '🔐 Certificados', icon: '🔐' },
          { id: 3, label: '📄 Comprobantes', icon: '📄' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setPaso(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              paso === tab.id
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* PASO 0: TUTORIAL */}
      {paso === 0 && (
        <div className="space-y-6">
          {/* Card principal de bienvenida */}
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-8 text-white">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-4xl">
                🧾
              </div>
              <div>
                <h3 className="text-2xl font-bold">¿Qué es la Facturación Electrónica?</h3>
                <p className="text-orange-100">Es obligatoria para todos los negocios en Argentina</p>
              </div>
            </div>
            <p className="text-orange-50 text-lg leading-relaxed">
              La facturación electrónica te permite emitir facturas válidas ante ARCA (ex AFIP). 
              Cada comprobante tiene un <strong>CAE</strong> (Código de Autorización Electrónico) 
              que lo hace válido fiscalmente.
            </p>
          </div>

          {/* Tutorial paso a paso */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="p-6 border-b bg-gray-50">
              <h4 className="text-lg font-bold text-gray-800">📋 Tutorial Paso a Paso</h4>
              <p className="text-sm text-gray-500">Seguí estos pasos para configurar tu facturación electrónica</p>
            </div>
            
            <div className="divide-y">
              {[
                {
                  paso: 1,
                  titulo: 'Generá la solicitud de certificado en este sistema',
                  descripcion: 'Andá a la pestaña 🔐 Certificados de esta misma pantalla y tocá "Generar Certificados" con tu CUIT.',
                  icono: '🔐',
                  detalle: 'Se crean 2 archivos: la solicitud (.csr) que va a ARCA, y la clave privada (.key) que queda guardada acá y NO se sube a ningún lado.'
                },
                {
                  paso: 2,
                  titulo: 'Ingresá al portal de ARCA',
                  descripcion: 'Entrá con tu CUIT y Clave Fiscal (necesitás nivel 3 o superior).',
                  icono: '🌐',
                  detalle: 'Si no tenés clave fiscal nivel 3, podés elevarla desde la app Mi ARCA con DNI y reconocimiento facial.',
                  link: { url: 'https://auth.afip.gob.ar/contribuyente_/login.xhtml', label: 'Abrir portal de ARCA →' }
                },
                {
                  paso: 3,
                  titulo: 'Tramitá el certificado con el .csr',
                  descripcion: 'En el buscador del portal escribí "Administración de Certificados Digitales" → Agregar alias → subí el archivo .csr → descargá el certificado (.crt).',
                  icono: '📤',
                  detalle: 'Anotá el ALIAS que le pusiste al certificado: lo vas a necesitar en el paso siguiente.'
                },
                {
                  paso: 4,
                  titulo: 'Autorizá el web service al certificado ⚠️ (paso que muchos olvidan)',
                  descripcion: 'En el portal buscá "Administrador de Relaciones de Clave Fiscal" → Nueva Relación → ARCA → WebServices → "Facturación Electrónica" → seleccioná el alias de tu certificado.',
                  icono: '🔗',
                  detalle: 'Sin este paso, el certificado existe pero ARCA rechaza la conexión. Es el error más común.'
                },
                {
                  paso: 5,
                  titulo: 'Creá el Punto de Venta para Web Services ⚠️',
                  descripcion: 'En el portal buscá "Administración de puntos de venta y domicilios" → A/B/M de puntos de venta → agregá uno nuevo eligiendo el sistema "Web Services" (RECE para Responsable Inscripto / Factura Electrónica Monotributo - Web Services).',
                  icono: '🏪',
                  detalle: 'El número de punto de venta que crees acá es el que va en la configuración del sistema. No sirve el punto de venta de "Comprobantes en línea".'
                },
                {
                  paso: 6,
                  titulo: 'Subí el certificado (.crt) a este sistema',
                  descripcion: 'Volvé a la pestaña 🔐 Certificados y subí el archivo .crt que descargaste de ARCA.',
                  icono: '📥',
                  detalle: 'El sistema valida que el archivo sea correcto, que no esté vencido y que corresponda a tu solicitud.'
                },
                {
                  paso: 7,
                  titulo: 'Probá la conexión',
                  descripcion: 'Usá el botón "Probar conexión" para confirmar que ARCA acepta tu certificado antes de facturar.',
                  icono: '✅',
                  detalle: 'Si la prueba da OK, ya podés emitir facturas electrónicas con CAE desde el punto de venta.'
                }
              ].map(item => (
                <div key={item.paso} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-2xl flex-shrink-0">
                      {item.icono}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded">PASO {item.paso}</span>
                        <h5 className="font-bold text-gray-800">{item.titulo}</h5>
                      </div>
                      <p className="text-gray-600">{item.descripcion}</p>
                      <p className="text-sm text-gray-400 mt-1">{item.detalle}</p>
                      {item.link && (
                        <a href={item.link.url} target="_blank" rel="noopener noreferrer"
                          className="inline-block mt-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                          {item.link.label}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Preguntas frecuentes */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="p-6 border-b bg-gray-50">
              <h4 className="text-lg font-bold text-gray-800">❓ Preguntas Frecuentes</h4>
            </div>
            
            <div className="divide-y">
              {[
                {
                  pregunta: '¿Qué régimen fiscal soy?',
                  respuesta: 'Si pagás IVA de forma mensual, sos Responsable Inscripto. Si pagás una cuota fija mensual (monotributo), sos Monotributista. Si no sabés, consultá con tu contador.'
                },
                {
                  pregunta: '¿Los certificados vencen?',
                  respuesta: 'Sí, los certificados de ARCA vencen aproximadamente cada 2 años. Te avisaremos cuando estén por vencer.'
                },
                {
                  pregunta: '¿Puedo anular una factura?',
                  respuesta: 'Sí, podés emitir una Nota de Crédito para anular o modificar una factura emitida.'
                },
                {
                  pregunta: '¿Qué pasa si no tengo internet?',
                  respuesta: 'Podés seguir vendiendo con Factura X (sin valor fiscal). Cuando vuelva internet, las ventas se sincronizarán.'
                }
              ].map((item, idx) => (
                <div key={idx} className="p-6">
                  <h5 className="font-bold text-gray-800 mb-2">❓ {item.pregunta}</h5>
                  <p className="text-gray-600">{item.respuesta}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* PASO 1: CONFIGURACIÓN */}
      {paso === 1 && (
        <div className="space-y-6">
          {/* Activar facturación electrónica */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-bold text-gray-800">🧾 Activar Facturación Electrónica</h4>
                <p className="text-sm text-gray-500">Habilitá este módulo para emitir comprobantes válidos ante ARCA</p>
              </div>
              <Toggle
                activo={config?.facturacion_electronica_activa || false}
                onChange={async (v) => {
                  // Actualizar estado local inmediatamente
                  const newConfig = { ...config, facturacion_electronica_activa: v };
                  setConfig(newConfig);
                  // Guardar automáticamente - solo enviar campos que el backend espera
                  try {
                    const configToSend = {
                      nombre_negocio: newConfig.nombre_negocio,
                      cuit: newConfig.cuit,
                      direccion: newConfig.direccion,
                      telefono: newConfig.telefono,
                      email: newConfig.email,
                      recargo_tarjeta: newConfig.recargo_tarjeta,
                      descuento_maximo: newConfig.descuento_maximo,
                      permite_stock_negativo: newConfig.permite_stock_negativo,
                      moneda: newConfig.moneda,
                      permite_venta_rapida: newConfig.permite_venta_rapida,
                      permite_precio_mayorista: newConfig.permite_precio_mayorista,
                      validar_monto_efectivo: newConfig.validar_monto_efectivo,
                      recargo_modo: newConfig.recargo_modo,
                      descuento_modo: newConfig.descuento_modo,
                      pin_cierre: newConfig.pin_cierre,
                      escaner_barras: newConfig.escaner_barras,
                      impresion_tickets: newConfig.impresion_tickets,
                      impresion_tickets_automatica: newConfig.impresion_tickets_automatica,
                      ocultar_stock_pos: newConfig.ocultar_stock_pos,
                      metodos_pago_activos: newConfig.metodos_pago_activos,
                      nombre_ticket: newConfig.nombre_ticket,
                      mostrar_stock_pos: newConfig.mostrar_stock_pos,
                      cantidad_minima_mayorista: newConfig.cantidad_minima_mayorista,
                      redondeo_precios: newConfig.redondeo_precios,
                      color_primario: newConfig.color_primario,
                      modo_oscuro: newConfig.modo_oscuro,
                      tamanio_ticket: newConfig.tamanio_ticket,
                      tamanio_ticket_personalizado: newConfig.tamanio_ticket_personalizado,
                      facturacion_electronica_activa: v,
                      regimen_fiscal: newConfig.regimen_fiscal,
                      punto_venta_arca: newConfig.punto_venta_arca,
                      tipo_comprobante_default: newConfig.tipo_comprobante_default,
                      entorno_arca: newConfig.entorno_arca,
                      ingresos_brutos: newConfig.ingresos_brutos,
                      inicio_actividades: newConfig.inicio_actividades,
                      condicion_iva: newConfig.condicion_iva,
                      ingresos_brutos: newConfig.ingresos_brutos,
                      inicio_actividades: newConfig.inicio_actividades,
                      condicion_iva: newConfig.condicion_iva
                    };
                    const res = await api.put('/api/configuracion', configToSend);
                    // Actualizar con la respuesta del servidor
                    setConfig(res.data);
                    setExito(v ? '✅ Facturación electrónica activada' : '❌ Facturación electrónica desactivada');
                    setTimeout(() => setExito(''), 2000);
                  } catch (err) {
                    setError('Error al guardar');
                    // Revertir el cambio local en caso de error
                    setConfig(prev => ({ ...prev, facturacion_electronica_activa: !v }));
                  }
                }}
              />
            </div>
            
            {config?.facturacion_electronica_activa && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-green-700 text-sm">
                  ✅ La facturación electrónica está <strong>activada</strong>. 
                  Configurá los datos a continuación para empezar a facturar.
                </p>
              </div>
            )}
          </div>

          {config?.facturacion_electronica_activa && (
            <>
              {/* Régimen Fiscal */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h4 className="font-bold text-gray-800 mb-2">📋 Mi Régimen Fiscal</h4>
                <p className="text-sm text-gray-500 mb-4">Seleccioná tu régimen fiscal según tu situación tributaria</p>
                
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => cambiarRegimenFiscal('responsable_inscripto')}
                    className={`p-6 rounded-xl border-2 text-left transition-all ${
                      config?.regimen_fiscal === 'responsable_inscripto'
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-2xl">🏢</div>
                      <div>
                        <h5 className="font-bold text-gray-800">Responsable Inscripto</h5>
                        <p className="text-xs text-gray-500">Pagás IVA mensual</p>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      <p>📄 Factura A (Responsables Inscriptos)</p>
                      <p>📄 Factura B (Consumidores Finales)</p>
                      <p>📝 Nota de Crédito A y B</p>
                    </div>
                  </button>

                  <button
                    onClick={() => cambiarRegimenFiscal('monotributista')}
                    className={`p-6 rounded-xl border-2 text-left transition-all ${
                      config?.regimen_fiscal === 'monotributista'
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-2xl">🏪</div>
                      <div>
                        <h5 className="font-bold text-gray-800">Monotributista</h5>
                        <p className="text-xs text-gray-500">Cuota fija mensual</p>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      <p>📄 Factura C</p>
                      <p>📝 Nota de Crédito C</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Datos Fiscales del Emisor */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h4 className="font-bold text-gray-800 mb-2">🏢 Datos Fiscales del Emisor</h4>
                <p className="text-sm text-gray-500 mb-4">Estos datos aparecen en el comprobante electrónico y son obligatorios según AFIP</p>

                <div className="space-y-4">
                  {/* Condición IVA */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Condición frente al IVA
                    </label>
                    <select
                      value={config?.condicion_iva || ''}
                      onChange={(e) => set('condicion_iva', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-400"
                    >
                      <option value="">-- Seleccioná --</option>
                      <option value="IVA Responsable Inscripto">IVA Responsable Inscripto</option>
                      <option value="IVA Monotributista">IVA Monotributista</option>
                      <option value="IVA Exento">IVA Exento</option>
                      <option value="No Responsable IVA">No Responsable IVA</option>
                    </select>
                  </div>

                  {/* Ingresos Brutos */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      N° Ingresos Brutos
                    </label>
                    <input
                      type="text"
                      value={config?.ingresos_brutos || ''}
                      onChange={(e) => set('ingresos_brutos', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-400"
                      placeholder="Ej: 12345678 o CM-12345678"
                    />
                  </div>

                  {/* Inicio de Actividades */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Inicio de Actividades
                    </label>
                    <input
                      type="date"
                      value={config?.inicio_actividades || ''}
                      onChange={(e) => set('inicio_actividades', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                </div>
              </div>

              
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h4 className="font-bold text-gray-800 mb-2">🔢 Punto de Venta ARCA</h4>
                <p className="text-sm text-gray-500 mb-4">Es el número que te asigna ARCA para facturar (generalmente es 1)</p>
                
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    value={config?.punto_venta_arca || 1}
                    onChange={(e) => set('punto_venta_arca', parseInt(e.target.value) || 1)}
                    className="w-32 border border-gray-300 rounded-lg px-4 py-3 text-2xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-orange-400"
                    min="1"
                    max="99999"
                  />
                  <div className="text-sm text-gray-500">
                    <p>Si no sabés tu punto de venta, ingresá <strong>1</strong></p>
                    <p>Podés crear más puntos de venta desde el portal de ARCA</p>
                  </div>
                </div>
              </div>

              {/* Entorno de Facturación */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h4 className="font-bold text-gray-800 mb-2"> Entorno de Facturación</h4>
                <p className="text-sm text-gray-500 mb-4">Elegí el entorno según si estás en pruebas o producción real</p>
                
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => set('entorno_arca', 'homologacion')}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      config?.entorno_arca === 'homologacion' || !config?.entorno_arca
                        ? 'border-yellow-500 bg-yellow-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">🧪</span>
                      <div>
                        <h5 className="font-bold text-gray-800">Homologación</h5>
                        <p className="text-xs text-gray-500">Para pruebas</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600">
                      URL: wsaaext.homo.afip.gov.ar
                    </p>
                    <p className="text-xs text-yellow-600 mt-1">
                      ⚠️ Los comprobantes NO son válidos fiscalmente
                    </p>
                  </button>

                  <button
                    onClick={() => set('entorno_arca', 'produccion')}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      config?.entorno_arca === 'produccion'
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">🚀</span>
                      <div>
                        <h5 className="font-bold text-gray-800">Producción</h5>
                        <p className="text-xs text-gray-500">Real / Oficial</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600">
                      URL: wsaa.afip.gov.ar
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      ✅ Los comprobantes SON válidos fiscalmente
                    </p>
                  </button>
                </div>

                {/* Botón de Test de Conexión */}
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-700">🔗 Test de Conexión con ARCA</p>
                      <p className="text-xs text-gray-500">Verificá que tu configuración funcione correctamente</p>
                    </div>
                    <button
                      onClick={async () => {
                        setTestConectando(true);
                        setResultadoTest(null);
                        try {
                          const res = await api.post('/api/arca/test-conexion');
                          setResultadoTest(res.data);
                        } catch (err) {
                          setResultadoTest({ exito: false, mensaje: err.response?.data?.error || 'Error de conexión' });
                        } finally {
                          setTestConectando(false);
                        }
                      }}
                      disabled={testConectando}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      {testConectando ? '⏳ Probando...' : '🔗 Probar Conexión'}
                    </button>
                  </div>

                  {resultadoTest && (
                    <div className={`mt-3 p-3 rounded-lg ${
                      resultadoTest.exito
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-red-50 border border-red-200'
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{resultadoTest.exito ? '✅' : '❌'}</span>
                        <div>
                          <p className={`font-medium ${resultadoTest.exito ? 'text-green-700' : 'text-red-700'}`}>
                            {resultadoTest.exito ? 'Conexión exitosa' : 'Error de conexión'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">{resultadoTest.mensaje}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </>
          )}

          {/* Botón guardar configuración */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-700">💾 Guardar Configuración</p>
                <p className="text-xs text-gray-500">Guardá los cambios de régimen fiscal, punto de venta, entorno y datos fiscales</p>
              </div>
              <button
                onClick={async () => {
                  try {
                    const res = await api.put('/api/configuracion', {
                      ...config,
                      ingresos_brutos: config?.ingresos_brutos,
                      inicio_actividades: config?.inicio_actividades,
                      condicion_iva: config?.condicion_iva,
                    });
                    setConfig(res.data);
                    setExito('✅ Configuración guardada correctamente');
                    setTimeout(() => setExito(''), 3000);
                  } catch (err) {
                    setError('❌ Error al guardar la configuración');
                    setTimeout(() => setError(''), 3000);
                  }
                }}
                className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-colors"
              >
                💾 Guardar
              </button>
            </div>
          </div>

        </div>
      )}

      {/* PASO 2: CERTIFICADOS */}
      {paso === 2 && (
        <div className="space-y-6">
          {/* Estado del certificado */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h4 className="font-bold text-gray-800 mb-4">🔐 Estado de Certificados</h4>
            
            {certificadoActivo ? (
              certificadoActivo.modo === 'delegado' ? (
                <div className="p-4 rounded-xl border-2 bg-blue-50 border-blue-200">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-xl">🚀</div>
                    <div>
                      <p className="font-bold text-gray-800">Conexión rápida activa (servicio delegado)</p>
                      <p className="text-sm text-gray-500">
                        CUIT: {certificadoActivo.cuit} | Punto de Venta: {certificadoActivo.punto_venta}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-blue-700">
                    Facturás con tu CUIT a través de la conexión de gestionq24. No manejás certificados.
                  </p>
                </div>
              ) : (
              <div className={`p-4 rounded-xl border-2 ${
                certificadoActivo.estado_certificado?.valido
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center text-xl">
                    {certificadoActivo.estado_certificado?.valido ? '✅' : '❌'}
                  </div>
                  <div>
                    <p className="font-bold text-gray-800">
                      {certificadoActivo.estado_certificado?.valido ? 'Certificado Vigente' : 'Certificado Vencido/Inválido'}
                    </p>
                    <p className="text-sm text-gray-500">
                      CUIT: {certificadoActivo.cuit} | Punto de Venta: {certificadoActivo.punto_venta}
                    </p>
                  </div>
                </div>
                {certificadoActivo.estado_certificado?.fechaVencimiento && (
                  <p className="text-sm text-gray-600">
                    Vence: {new Date(certificadoActivo.estado_certificado.fechaVencimiento).toLocaleDateString('es-AR')}
                    ({certificadoActivo.estado_certificado.diasRestantes} días restantes)
                  </p>
                )}
              </div>
              )
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <p className="text-yellow-700">
                  ⚠️ Todavía no configuraste la conexión con ARCA. Elegí una de las dos formas de abajo.
                </p>
              </div>
            )}
          </div>

          {/* Selector de vía de conexión */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button type="button" onClick={() => setViaConexion('delegado')}
              className={`text-left p-5 rounded-2xl border-2 transition-all ${via === 'delegado' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300'}`}>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-2xl">🚀</span>
                <p className="font-bold text-gray-800">Conexión rápida</p>
                <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">RECOMENDADA</span>
              </div>
              <p className="text-sm text-gray-600">Sin certificados. Autorizás el servicio a gestionq24 desde tu clave fiscal (un trámite de 3 minutos) y listo.</p>
            </button>
            <button type="button" onClick={() => setViaConexion('propio')}
              className={`text-left p-5 rounded-2xl border-2 transition-all ${via === 'propio' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white hover:border-orange-300'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">🔐</span>
                <p className="font-bold text-gray-800">Certificado propio</p>
                <span className="text-xs bg-gray-100 text-gray-600 font-bold px-2 py-0.5 rounded-full">AVANZADA</span>
              </div>
              <p className="text-sm text-gray-600">Tramitás tu propio certificado digital en ARCA y lo subís acá. Seguí el tutorial de 7 pasos.</p>
            </button>
          </div>

          {/* ---- VÍA DELEGADA ---- */}
          {via === 'delegado' && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
              <h4 className="font-bold text-gray-800">🚀 Activar Conexión Rápida</h4>

              {delegacionInfo?.disponible === false ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <p className="text-yellow-700 text-sm">
                    ⚠️ La conexión rápida todavía no está habilitada en este servidor. Escribinos por soporte y la activamos, o usá la opción de certificado propio.
                  </p>
                </div>
              ) : (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
                    <p className="text-sm font-semibold text-blue-800">Pasos en ARCA (una sola vez):</p>
                    <ol className="text-sm text-blue-800 list-decimal ml-5 space-y-1.5">
                      <li>Entrá a <a href="https://auth.afip.gob.ar/contribuyente_/login.xhtml" target="_blank" rel="noopener noreferrer" className="underline font-medium">arca.gob.ar</a> con tu CUIT y clave fiscal (nivel 3).</li>
                      <li>Buscá <strong>"Administrador de Relaciones de Clave Fiscal"</strong> → Nueva Relación.</li>
                      <li>Elegí ARCA → <strong>WebServices</strong> → <strong>"Facturación Electrónica"</strong>.</li>
                      <li>En "Representante" ingresá el CUIT <strong className="font-mono bg-blue-100 px-1.5 py-0.5 rounded">{delegacionInfo?.cuit_proveedor || '...'}</strong> (gestionq24) y confirmá.</li>
                      <li>Creá tu <strong>Punto de Venta para Web Services</strong> en "Administración de puntos de venta y domicilios" (si todavía no lo tenés).</li>
                    </ol>
                  </div>

                  <form onSubmit={activarDelegacion} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tu CUIT *</label>
                        <input type="text" value={formDelegacion.cuit} required
                          onChange={(e) => setFormDelegacion(p => ({ ...p, cuit: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                          placeholder="Ej: 20123456789" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Punto de Venta (Web Services) *</label>
                        <input type="number" value={formDelegacion.punto_venta} required min="1"
                          onChange={(e) => setFormDelegacion(p => ({ ...p, punto_venta: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                          placeholder="Ej: 3" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Régimen fiscal</label>
                      <div className="flex gap-2">
                        {[
                          { id: 'responsable_inscripto', label: 'Responsable Inscripto' },
                          { id: 'monotributista', label: 'Monotributista' },
                        ].map(r => (
                          <button key={r.id} type="button"
                            onClick={() => setFormDelegacion(p => ({ ...p, regimen_fiscal: r.id }))}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border-2 transition-all ${formDelegacion.regimen_fiscal === r.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}>
                            {r.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button type="submit" disabled={activandoDelegacion}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50">
                      {activandoDelegacion ? 'Activando...' : '🚀 Activar Conexión Rápida'}
                    </button>
                    <p className="text-xs text-gray-400">
                      Después de activar, usá "Probar Conexión" (pestaña Configuración) para confirmar que la delegación en ARCA quedó bien hecha.
                    </p>
                  </form>
                </>
              )}
            </div>
          )}

          {/* ---- VÍA CERTIFICADO PROPIO ---- */}
          {via === 'propio' && (
          <>
          {/* Generar certificados */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h4 className="font-bold text-gray-800 mb-4">📝 Generar Certificados</h4>
            <p className="text-sm text-gray-500 mb-4">
              Generá tus archivos .key y .csr. El .csr lo subís a ARCA para obtener tu certificado .crt
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CUIT *</label>
                <input
                  type="text"
                  value={cuitInput}
                  onChange={(e) => setCuitInput(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="Ej: 20123456789"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Razón Social</label>
                <input
                  type="text"
                  value={razonSocialInput}
                  onChange={(e) => setRazonSocialInput(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="Ej: Mi Empresa SRL"
                />
              </div>
              
              <button
                onClick={generarCertificados}
                disabled={generandoCert || !cuitInput}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
              >
                {generandoCert ? 'Generando...' : '🔐 Generar .key y .csr'}
              </button>
            </div>

            {/* Archivos generados */}
            {archivosGenerados && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <h5 className="font-bold text-blue-800 mb-3">📥 Archivos Generados</h5>
                <div className="space-y-2">
                  <button
                    onClick={() => descargarArchivo('key', archivosGenerados.key.split('/').pop())}
                    className="w-full flex items-center justify-between p-3 bg-white rounded-lg border hover:bg-gray-50 transition-colors"
                  >
                    <span className="font-medium">🔑 Archivo .key (clave privada)</span>
                    <span className="text-blue-600 text-sm">Descargar →</span>
                  </button>
                  <button
                    onClick={() => descargarArchivo('csr', archivosGenerados.csr.split('/').pop())}
                    className="w-full flex items-center justify-between p-3 bg-white rounded-lg border hover:bg-gray-50 transition-colors"
                  >
                    <span className="font-medium">📄 Archivo .csr (subir a ARCA)</span>
                    <span className="text-blue-600 text-sm">Descargar →</span>
                  </button>
                </div>
                <p className="text-xs text-blue-600 mt-3">
                  ⚠️ Guardá el archivo .key en un lugar seguro. Subí el .csr al portal de ARCA.
                </p>
              </div>
            )}
          </div>

          {/* Subir certificado de ARCA */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h4 className="font-bold text-gray-800 mb-4">📤 Subir Certificado de ARCA</h4>
            <p className="text-sm text-gray-500 mb-4">
              Una vez que ARCA te devuelva el archivo .crt, subilo acá
            </p>
            
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-orange-400 transition-colors">
                <input
                  type="file"
                  accept=".crt,.pem"
                  onChange={(e) => setArchivoCert(e.target.files[0])}
                  className="hidden"
                  id="cert-upload"
                />
                <label htmlFor="cert-upload" className="cursor-pointer">
                  <div className="text-4xl mb-2">📁</div>
                  <p className="font-medium text-gray-700">
                    {archivoCert ? archivoCert.name : 'Arrastrá tu archivo .crt acá'}
                  </p>
                  <p className="text-sm text-gray-400">o hacé click para seleccionar</p>
                </label>
              </div>
              
              <button
                onClick={subirCertificado}
                disabled={subiendoCert || !archivoCert}
                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
              >
                {subiendoCert ? 'Subiendo...' : '📤 Subir Certificado .crt'}
              </button>
            </div>
          </div>
          </>
          )}
        </div>
      )}

      {/* PASO 3: COMPROBANTES */}
      {paso === 3 && (
        <div className="space-y-6">
          {/* Tipos de comprobante disponibles */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h4 className="font-bold text-gray-800 mb-4">📄 Tipos de Comprobante Disponibles</h4>
            <p className="text-sm text-gray-500 mb-4">Según tu régimen fiscal: <strong>{config?.regimen_fiscal === 'monotributista' ? 'Monotributista' : 'Responsable Inscripto'}</strong></p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {tiposComprobante.map(tipo => (
                <div key={tipo.codigo} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="text-3xl mb-2">{tipo.emoji}</div>
                  <h5 className="font-bold text-gray-800">{tipo.nombre}</h5>
                  <p className="text-xs text-gray-500">{tipo.descripcion}</p>
                  <p className="text-xs text-gray-400 mt-1">Código ARCA: {tipo.codigo}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Emitir comprobante de prueba */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-bold text-gray-800">🧪 Emitir Comprobante de Prueba</h4>
                <p className="text-sm text-gray-500">Generá un comprobante de prueba para verificar que todo funciona</p>
              </div>
              <button
                onClick={() => setMostrarFormComprobante(!mostrarFormComprobante)}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
              >
                {mostrarFormComprobante ? '✕ Cerrar' : '+ Nuevo Comprobante'}
              </button>
            </div>

            {mostrarFormComprobante && (
              <div className="space-y-4 p-4 bg-gray-50 rounded-xl">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Comprobante *</label>
                    <select
                      value={formComprobante.tipo_comprobante}
                      onChange={(e) => setFormComprobante(p => ({ ...p, tipo_comprobante: parseInt(e.target.value) }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
                    >
                      <option value="">Seleccionar...</option>
                      {tiposComprobante.map(t => (
                        <option key={t.codigo} value={t.codigo}>{t.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Documento</label>
                    <select
                      value={formComprobante.tipo_documento}
                      onChange={(e) => setFormComprobante(p => ({ ...p, tipo_documento: parseInt(e.target.value) }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
                    >
                      <option value={99}>Consumidor Final</option>
                      <option value={96}>DNI</option>
                      <option value={80}>CUIT</option>
                    </select>
                  </div>
                </div>

                {formComprobante.tipo_documento !== 99 && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Número de Documento</label>
                      <input
                        type="text"
                        value={formComprobante.numero_documento}
                        onChange={(e) => setFormComprobante(p => ({ ...p, numero_documento: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
                        placeholder="Ej: 12345678"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Denominación Comprador</label>
                      <input
                        type="text"
                        value={formComprobante.denominacion_comprador}
                        onChange={(e) => setFormComprobante(p => ({ ...p, denominacion_comprador: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
                        placeholder="Ej: Juan Pérez"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Importe Total *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                      <input
                        type="number"
                        value={formComprobante.importe_total}
                        onChange={(e) => setFormComprobante(p => ({ ...p, importe_total: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Importe Neto</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                      <input
                        type="number"
                        value={formComprobante.importe_neto}
                        onChange={(e) => setFormComprobante(p => ({ ...p, importe_neto: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">IVA</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                      <input
                        type="number"
                        value={formComprobante.importe_iva}
                        onChange={(e) => setFormComprobante(p => ({ ...p, importe_iva: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={emitirComprobante}
                  disabled={emitiendo || !formComprobante.tipo_comprobante || !formComprobante.importe_total}
                  className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
                >
                  {emitiendo ? 'Emitiendo...' : '📄 Emitir Comprobante'}
                </button>
              </div>
            )}
          </div>

          {/* Historial de comprobantes */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h4 className="font-bold text-gray-800 mb-4">📊 Historial de Comprobantes</h4>
            
            {comprobantes.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <div className="text-4xl mb-2">📄</div>
                <p>No hay comprobantes emitidos</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">Fecha</th>
                      <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">Tipo</th>
                      <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">Número</th>
                      <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">CAE</th>
                      <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">Total</th>
                      <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comprobantes.map(comp => (
                      <tr key={comp.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3 text-sm">
                          {new Date(comp.fecha_emision).toLocaleDateString('es-AR')}
                        </td>
                        <td className="py-2 px-3 text-sm">
                          {tiposComprobante.find(t => t.codigo === comp.tipo_comprobante)?.nombre || `Tipo ${comp.tipo_comprobante}`}
                        </td>
                        <td className="py-2 px-3 text-sm font-mono">
                          {String(comp.punto_venta).padStart(5, '0')}-{String(comp.numero_comprobante).padStart(8, '0')}
                        </td>
                        <td className="py-2 px-3 text-sm font-mono">{comp.cae}</td>
                        <td className="py-2 px-3 text-sm font-bold">${parseFloat(comp.importe_total).toLocaleString('es-AR')}</td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            comp.estado === 'emitido' ? 'bg-green-100 text-green-700' :
                            comp.estado === 'anulado' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {comp.estado}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default FacturacionElectronica;