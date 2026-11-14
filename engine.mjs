import { lessons } from './lessons.mjs';

const missions = lessons.map(({ id, title }) => ({ id, title }));
let mission = lessons[0];
let stepIndex = 0;
let phase = 'demo';
let attempts = [];
let feedback = null;
let canAdvance = true;
let solved = false;
let effects = [];

function normalize(value) {
  const text = String(value ?? '').trim().toLowerCase().replace(/[–—]/g, '-');
  if (/^[+-]?\d+$|^0x[\da-f]+$/i.test(text)) return String(Number(text));
  return text.replace(/\s*[,()]\s*|\s+/g, token => token.trim() || ' ');
}

export function getState() {
  const mode = mission.mode ?? 'practice';
  const step = mission.steps[stepIndex];
  const showQuestion = phase === 'question' || phase === 'feedback';
  const frame = phase === 'demo' ? mission.demo : {
    code: step.code,
    activeLine: step.line ?? null,
    ...step.before,
    ...(solved && mode === 'practice' ? step.after : {}),
  };
  const results = phase === 'complete' && mode === 'exam'
    ? mission.steps.map((item, index) => ({
      prompt: item.text,
      answer: attempts[index],
      expected: item.expected,
      explanation: item.explanation,
    }))
    : [];

  return structuredClone({
    missions,
    missionId: mission.id,
    mode,
    phase,
    stepIndex,
    stepCount: mission.steps.length,
    code: [],
    activeLine: null,
    registers: {},
    memory: [],
    consoleText: '',
    displays: { left: 0, right: 0 },
    ...frame,
    prompt: showQuestion ? {
      kind: step.choices ? 'choice' : 'text',
      text: step.text,
      choices: (step.choices ?? []).map(label => ({ id: label, label })),
    } : null,
    hint: showQuestion && mode === 'practice' && !solved
      ? step.hint ?? 'Lee la línea resaltada y anota qué valor se lee y dónde se guarda o a qué línea salta.'
      : null,
    feedback,
    effects,
    canAdvance,
    results,
  });
}

export function startMission(id) {
  const selected = lessons.find(item => item.id === id);
  if (!selected) return getState();

  mission = selected;
  stepIndex = 0;
  phase = selected.demo ? 'demo' : 'question';
  attempts = [];
  feedback = null;
  canAdvance = phase === 'demo';
  solved = false;
  effects = selected.demo?.effects ?? [];
  return getState();
}

export function submitAnswer(value) {
  effects = [];
  const answer = String(value ?? '').trim();
  if (!answer || solved || !['question', 'feedback'].includes(phase)) return getState();

  const step = mission.steps[stepIndex];
  const correct = normalize(answer) === normalize(step.expected);
  phase = 'feedback';
  if (mission.mode === 'exam') {
    attempts[stepIndex] = answer;
    solved = true;
    canAdvance = true;
    return getState();
  }

  solved = correct;
  canAdvance = correct;
  feedback = {
    correct,
    text: correct ? step.explanation : step.hint ?? 'Revisa el valor inicial y sigue esa instrucción una vez.',
  };
  if (correct && step.effect) {
    const [type, target] = step.effect;
    effects = [{ type, target }];
  }
  return getState();
}

export function nextStep() {
  effects = [];
  if (!canAdvance) return getState();

  if (phase === 'demo') {
    phase = 'question';
  } else if (stepIndex === mission.steps.length - 1) {
    phase = 'complete';
  } else {
    stepIndex += 1;
    phase = 'question';
  }
  feedback = null;
  canAdvance = false;
  solved = false;
  return getState();
}

startMission(missions[0].id);
