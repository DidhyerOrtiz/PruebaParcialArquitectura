// Interfaz de Misión RISC‑V. Dibuja el estado que entrega engine.mjs y anima sus efectos.
import { getState, startMission, submitAnswer, nextStep } from './engine.mjs';

const $ = id => document.getElementById(id);
const els = {
  missionList: $('mission-list'),
  kicker: $('mission-kicker'),
  title: $('mission-title'),
  progress: $('progress'),
  progressText: $('progress-text'),
  progressFill: $('progress-fill'),
  code: $('code'),
  codeEmpty: $('code-empty'),
  registers: $('registers'),
  memory: $('memory'),
  console: $('console'),
  displayLeft: $('display-left'),
  displayRight: $('display-right'),
  radar: $('radar'),
  board: document.querySelector('.board'),
  sceneEmpty: $('scene-empty'),
  question: $('pregunta'),
  phaseLabel: $('phase-label'),
  prompt: $('prompt-text'),
  form: $('answer-form'),
  textAnswer: $('text-answer'),
  answer: $('answer'),
  submit: $('submit'),
  choices: $('choices'),
  feedback: $('feedback'),
  hint: $('hint'),
  results: $('results'),
  hintBtn: $('hint-btn'),
  restartBtn: $('restart-btn'),
  nextBtn: $('next-btn'),
};

const STORAGE_KEY = 'mision-riscv:hechas';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let state = null;
let stepKey = '';
let hintOpen = false;
let lastAnswer = '';
let done = loadDone();

/* ---------- Utilidades ---------- */

function loadDone() {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')); }
  catch { return new Set(); }
}
function saveDone() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...done])); } catch { /* sin almacenamiento */ }
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function formatValue(value) {
  if (value == null) return '—';
  return String(value);
}

function toByte(value) {
  if (typeof value === 'number') return value & 0xff;
  const parsed = Number(String(value ?? '0').trim());
  return Number.isFinite(parsed) ? parsed & 0xff : 0;
}

function hexByte(value) {
  return '0x' + toByte(value).toString(16).toUpperCase().padStart(2, '0');
}

function missionIndex(id) {
  return state.missions.findIndex(m => m.id === id);
}

function isExam(s = state) { return s.mode === 'exam'; }

/* ---------- Código ---------- */

function renderCodeLine(text, filled) {
  const li = el('li');
  const body = el('span', { class: 'txt' });
  // Etiqueta al inicio: "vuelta: add t0, t0, t1"
  const match = text.match(/^(\s*)([A-Za-z_.][\w.]*:)(.*)$/);
  const rest = match ? match[3] : text;
  if (match) {
    body.append(match[1], el('span', { class: 'label' }, match[2]));
    li.dataset.label = match[2].slice(0, -1);
  }
  // Huecos a completar y comentarios
  for (const part of rest.split(/(___|#.*$)/)) {
    if (!part) continue;
    if (part === '___') {
      body.append(filled
        ? el('span', { class: 'filled' }, filled)
        : el('span', { class: 'blank', 'aria-label': 'línea por completar' }, '___'));
    } else if (part.startsWith('#')) body.append(el('span', { class: 'comment' }, part));
    else body.append(part);
  }
  if (!text.trim()) body.append(' ');
  li.append(body);
  return li;
}

function renderCode(s) {
  // Tras acertar una línea por completar, se escribe la respuesta en el hueco.
  const filled = s.feedback?.correct && s.prompt?.kind === 'text' ? lastAnswer : null;
  els.code.replaceChildren(...s.code.map((line, i) => {
    const li = renderCodeLine(line, filled);
    li.dataset.index = i;
    if (i === s.activeLine) {
      li.classList.add('active');
      li.setAttribute('aria-current', 'step');
    }
    return li;
  }));
  const empty = s.code.length === 0;
  els.code.hidden = empty;
  els.codeEmpty.hidden = !empty;
}


const instructionGuide = {
  li: ['Carga un número en un registro.', 'li t0, 7 guarda 7 en t0.'],
  add: ['Suma los valores de dos registros y guarda el resultado en el primero.', 'add t2, t0, t1 guarda la suma de t0 y t1 en t2.'],
  addi: ['Suma un número escrito en la instrucción al valor de un registro.', 'addi t1, t0, 2 guarda en t1 lo que vale t0 más 2.'],
  la: ['Guarda en un registro la dirección de una etiqueta.', 'la t0, yA guarda en t0 la dirección donde está yA.'],
  lw: ['Lee en memoria una palabra de 4 bytes y la guarda en un registro.', 'lw t1, 0(t0) lee 4 bytes desde la dirección guardada en t0.'],
  sw: ['Guarda los 4 bytes de un registro en memoria.', 'sw t1, 0(t0) escribe t1 en la dirección guardada en t0.'],
  lb: ['Lee un byte de memoria y lo guarda en un registro, extendiendo su signo.', 'lb t0, 0(a0) lee el byte en la dirección guardada en a0.'],
  sb: ['Escribe en memoria el byte menos significativo de un registro.', 'sb t1, 0(t0) escribe ese byte de t1 en la dirección guardada en t0.'],
  ecall: ['Pide un servicio a RARS. a7 indica el servicio y otros registros llevan los datos.', 'Con a7 = 1, ecall imprime el número de a0. Con a7 = 8, lee una cadena. Con a7 = 10, termina.'],
  beq: ['Salta a la etiqueta si los dos registros contienen el mismo valor.', 'beq t0, t1, choque salta a choque cuando t0 y t1 son iguales.'],
  bne: ['Salta a la etiqueta si los dos registros contienen valores distintos.', 'bne t2, zero, vuelta vuelve a vuelta mientras t2 sea distinto de cero.'],
  j: ['Salta directamente a una etiqueta.', 'j fin continúa en fin sin guardar una dirección de regreso.'],
  jal: ['Llama a una subrutina y guarda dónde debe regresar.', 'jal ra, salida salta a salida y guarda en ra la dirección de la instrucción siguiente.'],
  ret: ['Vuelve a la dirección guardada en ra.', 'Después de jal ra, salida, ret vuelve a la línea siguiente a la llamada si ra se conserva.'],
  '.data': ['Indica dónde se declaran los datos del programa.', 'Después de .data, yA: .word 3 reserva una palabra con el valor 3.'],
  '.text': ['Indica dónde va el código que se ejecuta.', 'Después de .text se escriben instrucciones como li o add.'],
  '.word': ['Reserva e inicializa una palabra de 4 bytes.', 'yA: .word 3 inicializa yA con 3.'],
};

function guideEntry(name) {
  const [meaning, example] = instructionGuide[name];
  return [
    el('dt', {}, el('code', {}, name)),
    el('dd', {}, meaning, el('span', { class: 'guide-example' }, example)),
  ];
}

const currentGuide = el('dl');
const currentGuidePanel = el('div', {},
  el('h4', {}, 'En este ejercicio'), currentGuide);
const guide = el('section', { class: 'panel instruction-guide', 'aria-labelledby': 'instruction-guide-title' },
  el('h3', { class: 'lane-tag', id: 'instruction-guide-title' }, 'Guía de instrucciones'),
  el('p', {}, 'Un registro guarda un valor. t0 y t1 son registros; ra guarda el retorno, sp apunta a la pila y zero siempre vale 0. Una etiqueta como vuelta: marca un lugar del código.'),
  currentGuidePanel,
  el('details', {}, el('summary', {}, 'Ver todas las instrucciones'),
    el('dl', {}, ...Object.keys(instructionGuide).flatMap(guideEntry))),
);
els.board.before(guide);

function renderInstructionGuide(s) {
  guide.hidden = isExam(s) || s.phase === 'complete';
  if (guide.hidden) return;

  const names = new Set();
  for (const line of s.code) {
    const instruction = line.replace(/#.*$/, '').replace(/^\s*[\w.]+:/, '').trim().split(/\s+/)[0];
    if (Object.hasOwn(instructionGuide, instruction)) names.add(instruction);
  }
  if (s.code.some(line => line.includes('___'))) {
    for (const word of s.prompt?.text.match(/[a-z]+/g) ?? []) {
      if (Object.hasOwn(instructionGuide, word)) names.add(word);
    }
  }

  currentGuidePanel.hidden = names.size === 0;
  currentGuide.replaceChildren(...[...names].flatMap(guideEntry));
}

/* ---------- Escena ---------- */

function changedKeys(current, previous) {
  const changed = new Set();
  if (!previous) return changed;
  for (const [key, value] of Object.entries(current ?? {})) {
    if (!(key in (previous ?? {})) || String(previous[key]) !== String(value)) changed.add(key);
  }
  return changed;
}

function renderNodes(list, items, changed) {
  list.replaceChildren(...items.map(([name, value]) => el('li', {
    class: 'node' + (changed.has(name) ? ' changed' : ''),
    dataset: { key: name },
  }, el('span', { class: 'name' }, name), el('span', { class: 'value' }, formatValue(value)))));
  list.closest('.lane').classList.toggle('empty', items.length === 0);
}

const SEGMENTS = [ // bit 0 = a … bit 6 = g (Digital Lab Sim)
  { x: 12, y: 4, w: 36, h: 8 },   // a
  { x: 48, y: 12, w: 8, h: 34 },  // b
  { x: 48, y: 54, w: 8, h: 34 },  // c
  { x: 12, y: 88, w: 36, h: 8 },  // d
  { x: 4, y: 54, w: 8, h: 34 },   // e
  { x: 4, y: 12, w: 8, h: 34 },   // f
  { x: 12, y: 46, w: 36, h: 8 },  // g
];

function drawSegments(figure, value) {
  const svg = figure.querySelector('svg');
  if (!svg.childElementCount) {
    for (const seg of SEGMENTS) {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      for (const [k, v] of Object.entries({ x: seg.x, y: seg.y, width: seg.w, height: seg.h, rx: 3 })) rect.setAttribute(k, v);
      rect.setAttribute('class', 's');
      svg.append(rect);
    }
  }
  const byte = toByte(value);
  [...svg.children].forEach((rect, bit) => rect.classList.toggle('on', Boolean(byte & (1 << bit))));
  figure.setAttribute('aria-label', `Display ${figure.dataset.target === 'left' ? 'izquierdo' : 'derecho'}: byte ${hexByte(value)}`);
  figure.setAttribute('role', 'img');
}

const SVG_NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs = {}, text) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text != null) node.textContent = text;
  return node;
}

// Radar con la nave y los asteroides A, B y C cuando la pregunta trabaja con sus alturas.
function renderRadar(s) {
  const lane = els.radar.closest('.lane');
  const heights = ['t0', 't1', 't2'].map(r => s.registers[r]);
  const show = s.missionId === 'colision' && /A, B y C|A y B/.test(s.prompt?.text ?? '')
    && heights.every(h => typeof h === 'number');
  lane.classList.toggle('empty', !show);
  if (!show) { els.radar.replaceChildren(); return; }

  const W = 320, H = 110, top = 14, base = H - 18, maxH = Math.max(5, ...heights);
  const y = h => base - (h / maxH) * (base - top);
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img',
    'aria-label': `Alturas: A=${heights[0]}, B=${heights[1]}, C=${heights[2]}` });
  for (let h = 0; h <= maxH; h++) {
    svg.append(svgEl('line', { class: 'grid', x1: 40, x2: W - 8, y1: y(h), y2: y(h) }));
    if (h % Math.ceil(maxH / 5) === 0) svg.append(svgEl('text', { class: 'axis', x: 28, y: y(h) + 3, 'text-anchor': 'end' }, h));
  }
  svg.append(svgEl('path', { class: 'ship', d: `M48 ${base - 12} L64 ${base - 4} L48 ${base + 4} L52 ${base - 4} Z` }));
  const counts = heights.reduce((m, h) => m.set(h, (m.get(h) ?? 0) + 1), new Map());
  ['A', 'B', 'C'].forEach((name, i) => {
    const cx = 130 + i * 70, cy = y(heights[i]);
    svg.append(svgEl('circle', { class: 'rock' + (counts.get(heights[i]) > 1 ? ' hit' : ''), cx, cy, r: 12 }));
    svg.append(svgEl('text', { class: 'rock-label', x: cx, y: cy }, name));
  });
  els.radar.replaceChildren(svg);
}

function renderScene(s, prev) {
  renderRadar(s);
  const sameStep = prev && prev.missionId === s.missionId;
  const regChanged = sameStep ? changedKeys(s.registers, prev.registers) : new Set();
  const memNow = Object.fromEntries(s.memory.map(m => [m.address, m.value]));
  const memPrev = sameStep ? Object.fromEntries(prev.memory.map(m => [m.address, m.value])) : null;
  const memChanged = changedKeys(memNow, memPrev);
  for (const fx of s.effects) {
    if (fx.type === 'register') regChanged.add(fx.target);
    if (fx.type === 'memory') memChanged.add(fx.target);
  }

  renderNodes(els.registers, Object.entries(s.registers), regChanged);
  renderNodes(els.memory, Object.entries(memNow), memChanged);

  const code = s.code.join('\n');
  els.console.textContent = s.consoleText ?? '';
  els.console.classList.toggle('changed', s.effects.some(fx => fx.type === 'console'));
  els.console.closest('.lane').classList.toggle('empty', !s.consoleText && !/\becall\b/.test(code));

  const { left = 0, right = 0 } = s.displays ?? {};
  drawSegments(els.displayLeft, left);
  drawSegments(els.displayRight, right);
  const displayFx = new Set(s.effects.filter(fx => fx.type === 'display').map(fx => fx.target));
  els.displayLeft.classList.toggle('changed', displayFx.has('left'));
  els.displayRight.classList.toggle('changed', displayFx.has('right'));
  els.displayLeft.closest('.lane').classList.toggle('empty',
    !toByte(left) && !toByte(right) && !displayFx.size && !/0xffff001/i.test(code));

  const anyLane = [...document.querySelectorAll('.scene .lane')].some(l => !l.classList.contains('empty'));
  els.sceneEmpty.hidden = anyLane;
  els.sceneEmpty.textContent = isExam(s)
    ? 'En el parcial la máquina queda oculta: sigue el código en papel y escribe el resultado.'
    : 'Esta pregunta no cambia registros, memoria ni salidas.';
  els.board.hidden = (s.phase === 'complete' && isExam(s)) || (!anyLane && s.code.length === 0);
}

/* ---------- Encabezado y progreso ---------- */

function renderMissions(s) {
  els.missionList.replaceChildren(...s.missions.map((m, i) => {
    const exam = i === s.missions.length - 1 && m.id === 'parcial';
    return el('li', {}, el('button', {
      type: 'button',
      class: done.has(m.id) ? 'done' : null,
      'aria-current': m.id === s.missionId ? 'step' : null,
      'aria-label': `${exam ? 'Parcial' : 'Misión ' + (i + 1)}: ${m.title}${done.has(m.id) ? ' (completada)' : ''}`,
      onclick: () => act(() => startMission(m.id), { focusQuestion: true }),
    }, el('span', { class: 'num' }, el('span', {}, exam ? 'P' : i + 1)), el('span', { class: 'title' }, m.title)));
  }));
}

function renderHeader(s) {
  const index = missionIndex(s.missionId);
  const mission = s.missions[index];
  els.kicker.textContent = isExam(s) ? 'Parcial final · sin pistas' : `Misión ${index + 1} de ${s.missions.length - 1}`;
  els.title.textContent = mission?.title ?? '';

  let text;
  let ratio;
  if (s.phase === 'demo') { text = 'Ejemplo guiado'; ratio = 0; }
  else if (s.phase === 'complete') { text = 'Completado'; ratio = 1; }
  else {
    text = `${isExam(s) ? 'Pregunta' : 'Paso'} ${s.stepIndex + 1} de ${s.stepCount}`;
    const answered = s.phase === 'feedback' && s.canAdvance ? 1 : 0;
    ratio = (s.stepIndex + answered) / s.stepCount;
  }
  els.progressText.textContent = text;
  els.progressFill.style.width = `${Math.round(ratio * 100)}%`;
  els.progress.setAttribute('aria-valuenow', ratio.toFixed(2));
  els.progress.setAttribute('aria-valuetext', text);
}

/* ---------- Pregunta, respuesta y corrección ---------- */

function demoNarration(s) {
  const line = s.activeLine != null ? s.code[s.activeLine] : '';
  const fx = s.effects[0] ?? (s.registers && Object.keys(s.registers).length
    ? { type: 'register', target: Object.keys(s.registers).at(-1) } : null);
  let what = '';
  if (fx?.type === 'register') {
    what = `${fx.target} recibe ${formatValue(s.registers[fx.target])}.`;
    const others = Object.entries(s.registers).filter(([k]) => k !== fx.target);
    if (others.length) what += ` ${others.map(([k, v]) => `${k} conserva ${formatValue(v)}`).join(', ')}.`;
  }
  return `Observa: al ejecutar «${line.trim()}», ${what} Pulsa Siguiente para continuar.`;
}

function renderFeedback(s) {
  const fb = els.feedback;
  fb.className = 'feedback';
  if (s.phase === 'feedback' && isExam(s)) {
    fb.classList.add('neutral');
    fb.replaceChildren(
      el('span', { class: 'icon', 'aria-hidden': 'true' }, '•'),
      el('p', {}, el('strong', {}, 'Respuesta registrada.'),
        s.stepIndex === s.stepCount - 1 ? 'Entrega el parcial para ver la corrección.' : 'La corrección aparece al entregar el parcial.'),
    );
    fb.hidden = false;
    return;
  }
  if (!s.feedback) { fb.hidden = true; return; }
  const { correct, text } = s.feedback;
  fb.classList.add(correct ? 'right' : 'wrong');
  fb.replaceChildren(
    el('span', { class: 'icon', 'aria-hidden': 'true' }, correct ? '✓' : '✗'),
    el('p', {}, el('strong', {}, correct ? 'Correcto.' : 'Todavía no. Puedes reintentar.'), text),
  );
  fb.hidden = false;
}

function renderResults(s) {
  if (!(s.phase === 'complete' && isExam(s) && s.results.length)) {
    els.results.hidden = true;
    els.results.replaceChildren();
    return;
  }
  const good = s.results.filter(r => r.correct).length;
  els.results.replaceChildren(
    el('p', { class: 'score' }, 'Nota: ', el('span', {}, `${good} / ${s.results.length}`)),
    ...s.results.map((r, i) => el('div', { class: 'result' + (r.correct ? '' : ' wrong') },
      el('span', { class: 'mark', 'aria-hidden': 'true' }, r.correct ? '✓' : '✗'),
      el('div', {},
        el('p', { class: 'q' }, `${i + 1}. ${r.prompt}`),
        el('p', { class: 'a' }, `Tu respuesta: ${r.answer || '(vacía)'}`, r.correct ? '' : ` · Esperado: ${r.expected}`),
        el('p', { class: 'why' }, `${r.correct ? 'Correcta.' : 'Incorrecta.'} ${r.explanation}`),
      ),
    )),
  );
  els.results.hidden = false;
}

function renderQuestion(s, keyChanged) {
  const exam = isExam(s);
  const prompt = s.prompt;
  const answering = s.phase === 'question' || (s.phase === 'feedback' && !s.canAdvance);

  if (s.phase === 'demo') {
    els.phaseLabel.textContent = 'Ejemplo';
    els.prompt.textContent = demoNarration(s);
  } else if (s.phase === 'complete') {
    els.phaseLabel.textContent = exam ? 'Parcial entregado' : 'Misión completada';
    els.prompt.textContent = exam
      ? 'Revisa cada respuesta. Lo que falles, vuelve a resolverlo en papel antes de reintentar.'
      : nextMissionId() ? '¡Bien! Pasa a la siguiente misión o reinicia esta para repasar.' : '¡Bien!';
  } else {
    const theory = s.code.length === 0 && prompt?.kind === 'choice';
    els.phaseLabel.textContent = exam ? 'Parcial · responde como en papel' : theory ? 'Teoría' : 'Pregunta';
    els.prompt.textContent = prompt?.text ?? '';
  }

  // Entrada de texto u opciones
  const showText = prompt?.kind === 'text';
  const showChoices = prompt?.kind === 'choice';
  els.textAnswer.hidden = !showText;
  els.choices.hidden = !showChoices;
  els.form.hidden = !prompt;

  if (keyChanged) {
    els.answer.value = '';
    lastAnswer = '';
  }
  els.answer.disabled = !answering;
  els.submit.disabled = !answering;

  if (showChoices) {
    els.choices.replaceChildren(...prompt.choices.map((c, i) => el('button', {
      type: 'button',
      class: 'choice',
      'aria-pressed': String(lastAnswer === c.id),
      disabled: !answering,
      onclick: () => answer(c.id),
    }, el('kbd', {}, i + 1), c.label)));
  }

  renderFeedback(s);

  // Pista a demanda
  const hasHint = Boolean(s.hint) && !exam;
  els.hintBtn.hidden = !hasHint;
  els.hintBtn.setAttribute('aria-expanded', String(hintOpen && hasHint));
  els.hint.hidden = !(hintOpen && hasHint);
  els.hint.textContent = s.hint ?? '';

  renderResults(s);

  // Botón Siguiente
  const nextId = nextMissionId();
  const next = els.nextBtn;
  if (s.phase === 'complete') {
    next.disabled = !nextId;
    next.firstChild.textContent = nextId ? 'Siguiente misión ' : 'Fin ';
    next.hidden = !nextId;
  } else {
    next.hidden = false;
    next.disabled = !s.canAdvance;
    next.firstChild.textContent = exam && s.stepIndex === s.stepCount - 1 && s.phase !== 'demo'
      ? 'Entregar parcial '
      : 'Siguiente ';
  }
  els.restartBtn.textContent = s.phase === 'complete' && exam ? 'Repetir parcial' : 'Reiniciar misión';
}

function nextMissionId() {
  const i = missionIndex(state.missionId);
  return state.missions[i + 1]?.id ?? null;
}

/* ---------- Animación de efectos ---------- */

let liveTokens = [];

function cancelTokens() {
  for (const t of liveTokens) { t.anim?.cancel(); t.node.remove(); }
  liveTokens = [];
}

function effectTarget(fx) {
  switch (fx.type) {
    case 'register': return els.registers.querySelector(`[data-key="${CSS.escape(fx.target)}"]`);
    case 'memory': return els.memory.querySelector(`[data-key="${CSS.escape(fx.target)}"]`);
    case 'console': return els.console;
    case 'display': return fx.target === 'left' ? els.displayLeft : els.displayRight;
    case 'branch':
      return els.code.querySelector(`li[data-label="${CSS.escape(fx.target)}"]`)
        ?? els.code.querySelector('li.active');
    default: return null;
  }
}

function effectLabel(fx, s) {
  switch (fx.type) {
    case 'register': return formatValue(s.registers[fx.target]);
    case 'memory': return formatValue(s.memory.find(m => m.address === fx.target)?.value);
    case 'console': return (s.consoleText ?? '').split('\n').at(-1) || '›';
    case 'display': return hexByte(s.displays?.[fx.target]);
    case 'branch': return `→ ${fx.target}`;
    default: return '';
  }
}

function pulse(node) {
  if (!node || reducedMotion.matches) return;
  node.classList.remove('pulse');
  void node.offsetWidth;
  node.classList.add('pulse');
  node.addEventListener('animationend', () => node.classList.remove('pulse'), { once: true });
}

function animateEffects(s, fromRect) {
  cancelTokens();
  for (const fx of s.effects) {
    const target = effectTarget(fx);
    if (!target) continue;
    if (fx.type === 'branch') target.classList.add('target');
    const source = fromRect ?? els.code.querySelector('li.active')?.getBoundingClientRect()
      ?? els.code.getBoundingClientRect();
    if (reducedMotion.matches || !source.width) { continue; }

    const to = target.getBoundingClientRect();
    const token = el('div', { class: 'token', 'aria-hidden': 'true' }, effectLabel(fx, s));
    document.body.append(token);
    const { width, height } = token.getBoundingClientRect();
    const x0 = source.left + Math.min(source.width - width, 64);
    const y0 = source.top + (source.height - height) / 2;
    const x1 = to.left + (to.width - width) / 2;
    const y1 = to.top + (to.height - height) / 2;
    const anim = token.animate([
      { transform: `translate(${x0}px, ${y0}px) scale(0.9)`, opacity: 0 },
      { transform: `translate(${x0}px, ${y0}px) scale(1)`, opacity: 1, offset: 0.12 },
      { transform: `translate(${x1}px, ${y1}px) scale(1)`, opacity: 1, offset: 0.85 },
      { transform: `translate(${x1}px, ${y1}px) scale(0.8)`, opacity: 0 },
    ], { duration: 720, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'forwards' });
    const entry = { node: token, anim };
    liveTokens.push(entry);
    anim.finished.then(() => {
      token.remove();
      liveTokens = liveTokens.filter(t => t !== entry);
      pulse(target);
    }).catch(() => {});
  }
}

/* ---------- Ciclo principal ---------- */

function keyOf(s) {
  return `${s.missionId}:${s.phase === 'demo' ? 'demo' + s.activeLine : s.phase === 'complete' ? 'fin' : 'q' + s.stepIndex}`;
}

function render(next, { animate = true } = {}) {
  const prev = state;
  const fromRect = els.code.querySelector('li.active')?.getBoundingClientRect() ?? null;
  state = next;

  const key = keyOf(next);
  const keyChanged = key !== stepKey;
  if (keyChanged) hintOpen = false;
  stepKey = key;

  if (next.phase === 'complete' && !done.has(next.missionId)) {
    done.add(next.missionId);
    saveDone();
  }

  renderMissions(next);
  renderHeader(next);
  renderCode(next);
  renderInstructionGuide(next);
  renderScene(next, prev);
  renderQuestion(next, keyChanged);

  if (animate && next.effects.length) {
    // Si la escena cambió de paso, la ficha sale de la línea activa nueva.
    const sameFrame = prev && prev.missionId === next.missionId && prev.code.join('\n') === next.code.join('\n');
    animateEffects(next, sameFrame && fromRect?.width ? fromRect : null);
  } else {
    cancelTokens();
  }
  return keyChanged;
}

function focusForState(s, { focusQuestion = false } = {}) {
  if (focusQuestion) els.question.focus({ preventScroll: true });
  if (s.phase === 'question' || (s.phase === 'feedback' && !s.canAdvance)) {
    if (s.prompt?.kind === 'text') {
      els.answer.focus({ preventScroll: true });
      if (s.phase === 'feedback') els.answer.select();
    } else if (s.prompt?.kind === 'choice') {
      els.choices.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
    }
  } else if (!els.nextBtn.disabled && !els.nextBtn.hidden) {
    els.nextBtn.focus({ preventScroll: true });
  }
}

function act(fn, options = {}) {
  const next = fn();
  render(next);
  focusForState(next, options);
  if (options.focusQuestion) {
    document.querySelector('.stage').scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
  }
}

function answer(value) {
  const text = String(value ?? '').trim();
  if (!text) {
    els.answer.focus();
    return;
  }
  lastAnswer = text;
  act(() => submitAnswer(text));
}

/* ---------- Eventos ---------- */

els.form.addEventListener('submit', event => {
  event.preventDefault();
  answer(els.answer.value);
});

els.nextBtn.addEventListener('click', () => {
  if (state.phase === 'complete') {
    const id = nextMissionId();
    if (id) act(() => startMission(id), { focusQuestion: true });
    return;
  }
  act(() => nextStep());
});

els.restartBtn.addEventListener('click', () => act(() => startMission(state.missionId)));

els.hintBtn.addEventListener('click', () => {
  hintOpen = !hintOpen;
  render(state, { animate: false });
  if (hintOpen) els.hint.scrollIntoView({ block: 'nearest' });
  focusForState(state); // vuelve a la respuesta para seguir escribiendo
});

document.addEventListener('keydown', event => {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
  const typing = event.target === els.answer;
  const onButton = event.target instanceof HTMLButtonElement;

  if (event.key === 'Enter' && !typing && !onButton && !els.nextBtn.disabled && !els.nextBtn.hidden) {
    event.preventDefault();
    els.nextBtn.click();
    return;
  }
  if (typing) return;

  if (/^[1-9]$/.test(event.key) && state.prompt?.kind === 'choice') {
    const button = els.choices.querySelectorAll('button')[Number(event.key) - 1];
    if (button && !button.disabled) {
      event.preventDefault();
      button.click();
    }
  } else if ((event.key === 'p' || event.key === 'P') && !els.hintBtn.hidden) {
    event.preventDefault();
    els.hintBtn.click();
  }
});

/* ---------- Inicio ---------- */

render(getState());
focusForState(state);
