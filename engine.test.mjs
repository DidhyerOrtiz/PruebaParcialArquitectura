import assert from 'node:assert/strict';
import test from 'node:test';
import { getState, nextStep, startMission, submitAnswer } from './engine.mjs';

test('la demo muestra las dos instrucciones antes de la primera pregunta', () => {
  let state = startMission('registros');
  assert.equal(state.phase, 'demo');
  assert.equal(state.activeLine, 0);
  assert.deepEqual(state.registers, { t0: 7 });
  assert.deepEqual(state.effects, [{ type: 'register', target: 't0' }]);

  state = nextStep();
  assert.equal(state.phase, 'demo');
  assert.equal(state.activeLine, 1);
  assert.deepEqual(state.registers, { t0: 7, t1: 9 });
  assert.deepEqual(state.effects, [{ type: 'register', target: 't1' }]);

  state = nextStep();
  assert.equal(state.phase, 'question');
  assert.equal(state.stepIndex, 0);
  assert.deepEqual(state.effects, []);
});

test('un error permite reintentar y solamente el acierto activa el display', () => {
  startMission('salida');
  submitAnswer('7');
  nextStep();

  let state = submitAnswer('sw t1, 0(t0)');
  assert.equal(state.feedback.correct, false);
  assert.equal(state.canAdvance, false);
  assert.deepEqual(state.displays, { left: 0, right: 0 });
  assert.equal(nextStep().stepIndex, 1);

  state = submitAnswer('sb t1 0(t0)');
  assert.equal(state.feedback.correct, true);
  assert.equal(state.canAdvance, true);
  assert.deepEqual(state.displays, { left: 0, right: 7 });
  assert.deepEqual(state.effects, [{ type: 'display', target: 'right' }]);

  state = nextStep();
  assert.deepEqual(state.code, []);
  assert.equal(state.prompt.kind, 'choice');
  assert.deepEqual(state.effects, []);
});

test('el parcial oculta resultados, admite variantes y se puede reiniciar', () => {
  let state = startMission('parcial');
  for (const [index, answer] of ['6', '3', '4', '0', 'C - A', 'A-B', '2', 'fin'].entries()) {
    assert.equal(state.stepIndex, index);
    assert.equal(state.hint, null);
    state = submitAnswer(answer);
    assert.equal(state.canAdvance, true);
    assert.equal(state.feedback, null);
    assert.deepEqual(state.results, []);
    state = nextStep();
  }

  assert.equal(state.phase, 'complete');
  assert.deepEqual(state.results.map(result => result.correct),
    [true, true, true, true, true, true, true, false]);
  assert.equal(state.results.at(-1).answer, 'fin');
  assert.equal(state.results.at(-1).expected, 'resumen');

  state = startMission('parcial');
  assert.equal(state.phase, 'question');
  assert.equal(state.stepIndex, 0);
  assert.deepEqual(state.results, []);
});

test('la interfaz recibe una copia del estado', () => {
  const state = startMission('registros');
  state.registers.t0 = 99;
  state.missions.pop();
  assert.equal(getState().registers.t0, 7);
  assert.equal(getState().missions.length, 6);
});
