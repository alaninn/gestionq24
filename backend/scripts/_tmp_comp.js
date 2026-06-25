const db = require('../config/database');
const xml2js = require('xml2js');
(async () => {
  try {
    const r = await db.query("SELECT xml_respuesta FROM comprobantes_electronicos WHERE id = 1304");
    const data = r.rows[0].xml_respuesta;
    const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true });
    const resultado = await parser.parseStringPromise(data);
    const soapBody = resultado['soap:Envelope'] || resultado['soapenv:Envelope'];
    console.log('soapBody keys:', soapBody ? Object.keys(soapBody) : 'NULL');
    const body = soapBody['soap:Body'] || soapBody['soapenv:Body'];
    console.log('body keys:', Object.keys(body));
    const feCAESolicitarResult = body['FECAESolicitarResponse']?.FECAESolicitarResult || body['ns1:FECAESolicitarResponse']?.FECAESolicitarResult;
    console.log('feCAESolicitarResult?', !!feCAESolicitarResult, feCAESolicitarResult ? Object.keys(feCAESolicitarResult) : '');
    const feDetResp = feCAESolicitarResult.FeDetResp?.FECAEDetResponse;
    console.log('feDetResp?', !!feDetResp);
    console.log('Resultado =', feDetResp?.Resultado, '| CAE =', feDetResp?.CAE, '| CAEFchVto =', feDetResp?.CAEFchVto);
    // simular caeVencimientoDate
    const caeVencimiento = feDetResp?.CAEFchVto;
    try {
      const d = new Date(caeVencimiento.substring(0,4), parseInt(caeVencimiento.substring(4,6))-1, caeVencimiento.substring(6,8));
      console.log('caeVencimientoDate =', d, 'valida?', !isNaN(d.getTime()));
    } catch (e) { console.log('EXCEPCION en caeVencimientoDate:', e.message); }
    process.exit(0);
  } catch (e) { console.error('EXCEPCION PARSEO:', e.message); process.exit(1); }
})();
