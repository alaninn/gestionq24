// Página HTML del escáner (se sirve como string desde escaner.js). Sin frameworks.
module.exports = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Escáner de Seguridad</title>
<style>
  :root { --bg:#070b07; --panel:#0c120c; --line:#173417; --green:#7CFC7C; --green2:#39d353; --dim:#4b7a4b; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--green); font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
  .wrap { max-width:1000px; margin:0 auto; padding:20px 16px 60px; }
  header { display:flex; align-items:center; gap:10px; border-bottom:1px solid var(--line); padding-bottom:12px; margin-bottom:16px; }
  .dot { width:12px;height:12px;border-radius:50%;display:inline-block }
  h1 { font-size:16px; margin:0; color:var(--green2); font-weight:700; }
  .sub { color:var(--dim); font-size:12px; margin:2px 0 0; }
  .card { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:14px; margin-bottom:14px; }
  label.f { display:block; font-size:12px; color:var(--dim); margin-bottom:6px; }
  textarea, input[type=text] { width:100%; background:#050805; border:1px solid var(--line); color:var(--green); border-radius:8px; padding:10px; font-family:inherit; font-size:13px; }
  textarea { min-height:64px; resize:vertical; }
  .metodos { display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:6px 14px; margin-top:6px; }
  .metodos label { display:flex; align-items:center; gap:8px; font-size:13px; color:var(--green); cursor:pointer; }
  .row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-top:12px; }
  button { background:var(--green2); color:#022; border:none; border-radius:8px; padding:10px 18px; font-weight:800; font-family:inherit; cursor:pointer; }
  button:disabled { opacity:.55; cursor:default; }
  .btn-sec { background:transparent; color:var(--green); border:1px solid var(--line); }
  .warn { color:#e8b04b; font-size:12px; margin-top:10px; }
  .chips { display:flex; gap:6px; flex-wrap:wrap; margin:8px 0; }
  .chip { font-size:11px; padding:2px 8px; border-radius:6px; color:#031; font-weight:700; }
  .sev-CRITICA{background:#ff4d4d;color:#200} .sev-ALTA{background:#ff8c1a;color:#200} .sev-MEDIA{background:#ffd11a;color:#200}
  .sev-BAJA{background:#4da6ff;color:#001} .sev-INFO{background:#8a8a8a;color:#000} .sev-OK{background:#39d353;color:#022}
  .hall { border:1px solid var(--line); border-left-width:4px; border-radius:8px; padding:10px 12px; margin:8px 0; background:#0a0f0a; }
  .hall .t { font-weight:700; }
  .hall .d { color:#bfe9bf; font-size:12.5px; margin-top:4px; }
  .hall .r { color:var(--green2); font-size:12.5px; margin-top:4px; }
  .bl-CRITICA{border-left-color:#ff4d4d} .bl-ALTA{border-left-color:#ff8c1a} .bl-MEDIA{border-left-color:#ffd11a}
  .bl-BAJA{border-left-color:#4da6ff} .bl-INFO{border-left-color:#8a8a8a} .bl-OK{border-left-color:#39d353}
  .target-h { color:var(--green2); font-size:14px; margin:16px 0 4px; border-top:1px dashed var(--line); padding-top:14px; }
  .muted { color:var(--dim); }
  a { color:var(--green2); }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <span class="dot" style="background:#ff5f56"></span>
    <span class="dot" style="background:#ffbd2e"></span>
    <span class="dot" style="background:#27c93f"></span>
    <div style="margin-left:8px">
      <h1>🕵️  Escáner de Seguridad</h1>
      <p class="sub">Herramienta independiente · pruebas no destructivas · usala SOLO en sistemas propios o autorizados</p>
    </div>
  </header>

  <div class="card">
    <label class="f">URLs a probar (una por línea)</label>
    <textarea id="urls" placeholder="https://tu-sistema.com&#10;http://localhost:3001&#10;http://192.168.1.50:4000"></textarea>
  </div>

  <div class="card">
    <label class="f">Métodos de prueba</label>
    <div class="metodos" id="metodos"></div>
    <div class="row">
      <button id="btn">▶ Escanear</button>
      <button class="btn-sec" id="todos" type="button">Marcar todo</button>
      <button class="btn-sec" id="ninguno" type="button">Desmarcar</button>
      <span id="estado" class="muted"></span>
    </div>
    <p class="warn">⚠ La prueba de <b>fuerza bruta</b> hace intentos de login: puede bloquear cuentas del objetivo o hacer que su firewall te banee la IP. Dejala destildada para sistemas remotos que no controlás del todo.</p>
  </div>

  <div id="salida"></div>
</div>

<script>
const METODOS = [
  ['headers','Encabezados de seguridad',true],
  ['jwt','Tokens JWT falsificados',true],
  ['authz','Endpoints sin login',true],
  ['sqli','Inyección SQL (login)',true],
  ['archivos','Archivos sensibles (.env/.git)',true],
  ['cors','CORS mal configurado',true],
  ['credenciales','Credenciales por defecto',true],
  ['errores','Fuga de info en errores',true],
  ['metodos','Métodos HTTP',true],
  ['fuerzabruta','Fuerza bruta (lenta / puede bloquear)',false],
];
const ORDEN = ['CRITICA','ALTA','MEDIA','BAJA','INFO','OK'];
const cont = document.getElementById('metodos');
METODOS.forEach(([k,label,def]) => {
  const l = document.createElement('label');
  l.innerHTML = '<input type="checkbox" value="'+k+'" '+(def?'checked':'')+'> '+label;
  cont.appendChild(l);
});
const checks = () => [...document.querySelectorAll('#metodos input:checked')].map(c=>c.value);
document.getElementById('todos').onclick = ()=>document.querySelectorAll('#metodos input').forEach(c=>c.checked=true);
document.getElementById('ninguno').onclick = ()=>document.querySelectorAll('#metodos input').forEach(c=>c.checked=false);

function esc(s){ return String(s).replace(/[&<>]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

function render(res){
  const div = document.createElement('div');
  if (res.error){ div.innerHTML = '<div class="target-h">'+esc(res.objetivo)+'</div><div class="hall bl-CRITICA"><div class="t">⚠ '+esc(res.error)+'</div></div>'; return div; }
  const problemas = res.hallazgos.filter(h=>h.sev!=='OK').length;
  let chips = ORDEN.filter(s=>res.resumen[s]).map(s=>'<span class="chip sev-'+s+'">'+s+': '+res.resumen[s]+'</span>').join('');
  let html = '<div class="target-h">'+esc(res.objetivo)+'  '+(problemas===0?'<span class="chip sev-OK">SIN PROBLEMAS</span>':'<span class="muted">('+problemas+' a revisar)</span>')+'</div>';
  html += '<div class="chips">'+chips+'</div>';
  for (const h of res.hallazgos){
    html += '<div class="hall bl-'+h.sev+'"><div class="t"><span class="chip sev-'+h.sev+'">'+h.sev+'</span> '+esc(h.titulo)+'</div>'
      + (h.detalle?'<div class="d">'+esc(h.detalle)+'</div>':'')
      + (h.recomendacion?'<div class="r">→ '+esc(h.recomendacion)+'</div>':'') + '</div>';
  }
  div.innerHTML = html; return div;
}

document.getElementById('btn').onclick = async () => {
  const urls = document.getElementById('urls').value.split('\\n').map(u=>u.trim()).filter(Boolean);
  const metodos = checks();
  const salida = document.getElementById('salida');
  const estado = document.getElementById('estado');
  const btn = document.getElementById('btn');
  if (!urls.length){ estado.textContent = 'Poné al menos una URL.'; return; }
  if (!metodos.length){ estado.textContent = 'Elegí al menos un método.'; return; }
  salida.innerHTML=''; btn.disabled=true;
  for (let i=0;i<urls.length;i++){
    estado.textContent = 'Escaneando '+(i+1)+'/'+urls.length+': '+urls[i]+' ...';
    try {
      const r = await fetch('/scan?url='+encodeURIComponent(urls[i])+'&metodos='+encodeURIComponent(metodos.join(',')));
      const res = await r.json();
      salida.appendChild(render(res));
    } catch(e){
      const d = document.createElement('div'); d.className='hall bl-CRITICA'; d.textContent='Error escaneando '+urls[i]+': '+e.message; salida.appendChild(d);
    }
  }
  estado.textContent = 'Listo ✓'; btn.disabled=false;
};
</script>
</body>
</html>`;
