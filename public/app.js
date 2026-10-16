// Interfaz: todo lo que se muestra viene de la API. Ningún dato está escrito en el HTML.
const $ = (sel) => document.querySelector(sel);

// Escapa texto antes de insertarlo en HTML (las descripciones las escriben usuarios)
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const etiqueta = (v) => esc(String(v ?? '').replace(/_/g, ' '));
const badge = (texto, clase) => `<span class="badge ${clase}">${etiqueta(texto)}</span>`;

async function api(ruta, opciones = {}) {
  let res;
  try {
    res = await fetch(`/api${ruta}`, {
      ...opciones,
      headers: { 'Content-Type': 'application/json' },
      body: opciones.body ? JSON.stringify(opciones.body) : undefined,
    });
  } catch {
    throw new Error('No hay conexión con el servidor');
  }
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(datos.error?.mensaje || `Error ${res.status}`);
  return datos;
}

function mensaje(el, texto, tipo) {
  el.classList.remove('e', 's', 'w');
  el.classList.add(tipo);
  el.textContent = texto;
}

async function conCarga(boton, fn) {
  boton.classList.add('cargando');
  boton.disabled = true;
  try { return await fn(); } finally { boton.classList.remove('cargando'); boton.disabled = false; }
}

// Fecha local del campus (Colombia, UTC-5) en AAAA-MM-DD
const hoyCampus = () => new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);

const CLASE_ESTADO = {
  habilitado: 'ok', inhabilitado: 'off', mantenimiento: 'warn',
  operativo: 'ok', danado: 'off', en_reparacion: 'warn',
  abierta: 'busy', en_proceso: 'warn', resuelta: 'ok', activa: 'ok', cancelada: 'off',
};
const CLASE_PRIORIDAD = { baja: 'ok', media: 'busy', alta: 'warn', critica: 'off' };
let catalogos = { categorias: [], prioridades: [], areas: [] };

/* ---------- Módulo 1: espacios y reservas ---------- */
async function cargarEspacios() {
  const tb = $('#tb-espacios');
  try {
    const espacios = await api('/espacios');
    $('#st-esp').textContent = `${espacios.filter((e) => e.estado === 'habilitado').length}/${espacios.length}`;
    tb.innerHTML = espacios.map((e) => `
      <tr>
        <td>${esc(e.nombre)}<div class="meta">${esc(e.codigo)} · ${etiqueta(e.tipo)}</div></td>
        <td>${e.aforo}</td>
        <td>${e.ocupado_por ? badge('Ocupado', 'busy') + `<div class="meta">${esc(e.ocupado_por)}</div>` : badge('Libre', 'ok')}</td>
        <td><select class="mini" data-espacio="${esc(e.codigo)}" aria-label="Estado de ${esc(e.nombre)}">
          ${['habilitado', 'mantenimiento', 'inhabilitado'].map((s) => `<option value="${s}" ${s === e.estado ? 'selected' : ''}>${s}</option>`).join('')}
        </select></td>
      </tr>`).join('');
    const opciones = espacios.map((e) => `<option value="${esc(e.codigo)}">${esc(e.nombre)} (aforo ${e.aforo})</option>`).join('');
    const sel = $('#r-espacio');
    const previo = sel.value;
    sel.innerHTML = opciones;
    if (previo) sel.value = previo;
    $('#i-esp').innerHTML = '<option value="">No lo sé / no aplica</option>' + opciones;
  } catch (err) {
    tb.innerHTML = `<tr><td colspan="4"><div class="msg e">${esc(err.message)}</div></td></tr>`;
  }
}

async function cargarReservas() {
  const fecha = $('#r-fecha').value || hoyCampus();
  $('#t-reservas').textContent = `Reservas del ${fecha}`;
  const tb = $('#tb-reservas');
  try {
    const reservas = await api(`/reservas?fecha=${encodeURIComponent(fecha)}`);
    tb.innerHTML = reservas.length === 0
      ? '<tr><td colspan="7" class="vacio">No hay reservas para esta fecha.</td></tr>'
      : reservas.map((r) => `
        <tr>
          <td>${esc(r.espacio)}</td>
          <td>${esc(r.inicio.slice(11))} – ${esc(r.fin.slice(11))}</td>
          <td>${esc(r.organizacion)}<div class="meta">${etiqueta(r.tipo_solicitante)} · ${esc(r.responsable)}</div></td>
          <td>${r.asistentes}</td>
          <td>${r.equipos_a_transmitir > 0 ? `${r.equipos_a_transmitir} fuente(s)` : '—'}</td>
          <td>${badge(r.estado, CLASE_ESTADO[r.estado])}</td>
          <td>${r.estado === 'activa' ? `<button class="btn btn-s btn-sm" data-cancelar="${r.id}">Cancelar</button>` : ''}</td>
        </tr>`).join('');
  } catch (err) {
    tb.innerHTML = `<tr><td colspan="7"><div class="msg e">${esc(err.message)}</div></td></tr>`;
  }
}

$('#f-reserva').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const f = new FormData(ev.target);
  const m = $('#m-reserva');
  const fecha = f.get('fecha');
  if (!fecha) return mensaje(m, 'Selecciona la fecha de la reserva', 'e');
  await conCarga(ev.submitter, async () => {
    try {
      const r = await api('/reservas', {
        method: 'POST',
        body: {
          espacio_codigo: f.get('espacio_codigo'),
          tipo_solicitante: f.get('tipo_solicitante'),
          organizacion: f.get('organizacion'),
          responsable: f.get('responsable'),
          asistentes: f.get('asistentes'),
          inicio: `${fecha}T${f.get('hora_inicio')}`,
          fin: `${fecha}T${f.get('hora_fin')}`,
          equipos_a_transmitir: f.get('equipos_a_transmitir'),
        },
      });
      const equipos = r.equipos_asignados.length ? ` Equipos asignados: ${r.equipos_asignados.join(', ')}.` : '';
      mensaje(m, `Reserva #${r.id} confirmada: ${r.espacio}, ${r.inicio.slice(11)} – ${r.fin.slice(11)}.${equipos}`, 's');
      await Promise.all([cargarReservas(), cargarEspacios(), cargarRecursos()]);
    } catch (err) {
      mensaje(m, err.message, 'e');
    }
  });
});

$('#r-fecha').addEventListener('change', cargarReservas);

$('#tb-reservas').addEventListener('click', async (ev) => {
  const id = ev.target.dataset.cancelar;
  if (!id || !confirm(`¿Cancelar la reserva #${id}?`)) return;
  await conCarga(ev.target, async () => {
    try {
      await api(`/reservas/${id}/cancelar`, { method: 'PATCH' });
      mensaje($('#m-reserva'), `Reserva #${id} cancelada.`, 's');
      await Promise.all([cargarReservas(), cargarEspacios(), cargarRecursos()]);
    } catch (err) { mensaje($('#m-reserva'), err.message, 'e'); }
  });
});

$('#tb-espacios').addEventListener('change', async (ev) => {
  const codigo = ev.target.dataset.espacio;
  if (!codigo) return;
  try {
    const r = await api(`/espacios/${encodeURIComponent(codigo)}/estado`, { method: 'PATCH', body: { estado: ev.target.value } });
    mensaje($('#m-reserva'), `${r.nombre} ahora está ${r.estado}.`, 's');
  } catch (err) {
    mensaje($('#m-reserva'), err.message, 'e');
  }
  await cargarEspacios();
});

/* ---------- Módulo 2: recursos ---------- */
async function cargarRecursos() {
  const tb = $('#tb-recursos');
  try {
    const recursos = await api('/recursos');
    const op = recursos.filter((r) => r.estado === 'operativo').length;
    $('#st-eq').textContent = recursos.length ? `${Math.round((op / recursos.length) * 100)}%` : '–';
    tb.innerHTML = recursos.map((r) => `
      <tr>
        <td>${esc(r.codigo)}</td>
        <td>${etiqueta(r.tipo)}</td>
        <td>${esc(r.espacio)}</td>
        <td>${badge(r.estado, CLASE_ESTADO[r.estado])}</td>
        <td>${r.disponible ? badge('Disponible', 'ok') : r.en_uso ? badge('En uso', 'busy') : badge('Bloqueado', 'off')}</td>
        <td><select class="mini" data-recurso="${esc(r.codigo)}" aria-label="Estado de ${esc(r.codigo)}">
          ${['operativo', 'danado', 'en_reparacion'].map((s) => `<option value="${s}" ${s === r.estado ? 'selected' : ''}>${etiqueta(s)}</option>`).join('')}
        </select></td>
      </tr>`).join('');
  } catch (err) {
    tb.innerHTML = `<tr><td colspan="6"><div class="msg e">${esc(err.message)}</div></td></tr>`;
  }
}

$('#tb-recursos').addEventListener('change', async (ev) => {
  const codigo = ev.target.dataset.recurso;
  if (!codigo) return;
  const motivo = prompt(`Motivo del cambio de ${codigo} a "${ev.target.value.replace('_', ' ')}":`);
  if (motivo) {
    try {
      const r = await api(`/recursos/${encodeURIComponent(codigo)}/estado`, { method: 'PATCH', body: { estado: ev.target.value, motivo } });
      mensaje($('#m-recursos'), `${r.codigo}: ${r.estado_anterior} → ${r.estado}. Quedó registrado en el historial.`, 's');
    } catch (err) {
      mensaje($('#m-recursos'), err.message, 'e');
    }
  }
  await cargarRecursos();
});

/* ---------- Módulo 3: incidencias ---------- */
function pintarResultado({ incidencia: i, aviso }) {
  const cont = $('#res-ia');
  if (i.origen_clasificacion === 'pendiente') {
    cont.innerHTML = `<div class="msg w">${esc(aviso || 'Pendiente de triaje manual.')}</div>
      <div class="meta">Incidencia #${i.id} registrada. Clasifícala manualmente en la tabla de abajo.</div>`;
    return;
  }
  cont.innerHTML = `
    <div><label>Categoría</label>${badge(i.categoria, 'busy')}</div>
    <div><label>Prioridad</label>${badge(i.prioridad, CLASE_PRIORIDAD[i.prioridad])}</div>
    <div><label>Enrutado a</label>${badge(i.area_destino, 'ok')}</div>
    ${i.espacio || i.recurso_codigo ? `<div><label>Afecta a</label>${esc(i.espacio ?? '')} ${i.recurso_codigo ? `· ${esc(i.recurso_codigo)}` : ''}</div>` : ''}
    <div><label>Justificación de la IA</label><div class="just">${esc(i.ia_justificacion)}</div></div>
    ${i.sugerencia ? `<button class="btn btn-s btn-sm" data-sugerencia="${i.id}">${esc(i.sugerencia.texto)}</button>
      <div class="meta">La IA solo sugiere: el cambio se aplica cuando lo confirmas.</div>` : ''}
    <div class="msg s">Incidencia #${i.id} registrada correctamente.</div>
    <div class="meta">Clasificado por ${esc(i.ia_modelo)}</div>`;
}

async function cargarIncidencias() {
  const tb = $('#tb-incidencias');
  try {
    const lista = await api('/incidencias');
    $('#st-inc').textContent = lista.filter((i) => i.estado !== 'resuelta').length;
    const opts = (vals, sel) => vals.map((v) => `<option value="${v}" ${v === sel ? 'selected' : ''}>${etiqueta(v)}</option>`).join('');
    tb.innerHTML = lista.length === 0
      ? '<tr><td colspan="6" class="vacio">Aún no hay incidencias.</td></tr>'
      : lista.map((i) => `
        <tr>
          <td>${i.id}</td>
          <td class="desc">${esc(i.descripcion)}${i.espacio ? `<div class="meta">${esc(i.espacio)}${i.recurso_codigo ? ' · ' + esc(i.recurso_codigo) : ''}</div>` : ''}</td>
          <td>${i.categoria
            ? `${badge(i.categoria, 'busy')} ${badge(i.prioridad, CLASE_PRIORIDAD[i.prioridad])}<div class="meta">→ ${etiqueta(i.area_destino)}</div>`
            : `<form class="triaje" data-triaje="${i.id}">
                 <select class="mini" name="categoria" aria-label="Categoría">${opts(catalogos.categorias)}</select>
                 <select class="mini" name="prioridad" aria-label="Prioridad">${opts(catalogos.prioridades, 'media')}</select>
                 <select class="mini" name="area_destino" aria-label="Área">${opts(catalogos.areas)}</select>
                 <button class="btn btn-p btn-sm" type="submit">Guardar</button></form>`}</td>
          <td>${badge(i.origen_clasificacion === 'ia' ? 'IA' : i.origen_clasificacion, i.origen_clasificacion === 'ia' ? 'ai' : i.origen_clasificacion === 'manual' ? 'busy' : 'warn')}</td>
          <td>${badge(i.estado, CLASE_ESTADO[i.estado])}</td>
          <td class="fila-acc">
            ${i.sugerencia ? `<button class="btn btn-s btn-sm" data-sugerencia="${i.id}">${esc(i.sugerencia.texto)}</button>` : ''}
            ${i.estado !== 'resuelta' ? `<button class="btn btn-s btn-sm" data-resolver="${i.id}">Resolver</button>` : ''}
          </td>
        </tr>`).join('');
  } catch (err) {
    tb.innerHTML = `<tr><td colspan="6"><div class="msg e">${esc(err.message)}</div></td></tr>`;
  }
}

$('#f-incidencia').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const f = new FormData(ev.target);
  const cont = $('#res-ia');
  cont.innerHTML = '<div class="vacio" style="padding:0">Analizando con IA…</div>';
  await conCarga(ev.submitter, async () => {
    try {
      const r = await api('/incidencias', {
        method: 'POST',
        body: { descripcion: f.get('descripcion'), espacio_codigo: f.get('espacio_codigo') || undefined },
      });
      pintarResultado(r);
      if (r.incidencia.origen_clasificacion === 'ia') ev.target.reset();
      await cargarIncidencias();
    } catch (err) {
      cont.innerHTML = `<div class="msg e">${esc(err.message)}</div>`;
    }
  });
});

async function accionIncidencia(ev) {
  const sug = ev.target.dataset.sugerencia;
  const res = ev.target.dataset.resolver;
  if (!sug && !res) return;
  const m = $('#m-incidencias');
  await conCarga(ev.target, async () => {
    try {
      if (sug) {
        if (!confirm('¿Confirmas marcar el equipo como dañado? Las reservas con transmisión en esa sala quedarán bloqueadas.')) return;
        const i = await api(`/incidencias/${sug}/aplicar-sugerencia`, { method: 'POST' });
        mensaje(m, `${i.recurso_codigo} marcado como dañado por la incidencia #${i.id}.`, 's');
      } else {
        await api(`/incidencias/${res}/estado`, { method: 'PATCH', body: { estado: 'resuelta' } });
        mensaje(m, `Incidencia #${res} resuelta.`, 's');
      }
      await Promise.all([cargarIncidencias(), cargarRecursos()]);
    } catch (err) { mensaje(m, err.message, 'e'); }
  });
}
$('#tb-incidencias').addEventListener('click', accionIncidencia);
$('#res-ia').addEventListener('click', accionIncidencia);

$('#tb-incidencias').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const id = ev.target.dataset.triaje;
  const f = new FormData(ev.target);
  try {
    await api(`/incidencias/${id}/clasificacion`, { method: 'PATCH', body: Object.fromEntries(f) });
    mensaje($('#m-incidencias'), `Incidencia #${id} clasificada manualmente.`, 's');
    await cargarIncidencias();
  } catch (err) { mensaje($('#m-incidencias'), err.message, 'e'); }
});

/* ---------- Inicio ---------- */
async function iniciar() {
  $('#r-fecha').value = hoyCampus();
  try {
    catalogos = await api('/catalogos');
    const ia = await api('/ia/estado');
    $('#b-ia').textContent = ia.configurado ? `IA · ${ia.modelo}` : 'IA sin configurar';
  } catch { /* los paneles muestran su propio error */ }
  await Promise.all([cargarEspacios(), cargarReservas(), cargarRecursos(), cargarIncidencias()]);
}
iniciar();
