import test from 'node:test';
import assert from 'node:assert/strict';
import { kinship, inLaw, relate } from '../src/lib/kinship.mjs';

// convention kinship(stepsB, stepsA, sexOfA, lang, half): "A is <word> of B".
const row = (id, s, f, m, sp) => ({ id, s, f, m, sp: (sp || []).map((x) => ({ id: x })) });
test('direct line, both languages', () => {
  assert.equal(kinship(1, 0, 'm', 'nl'), 'vader');
  assert.equal(kinship(1, 0, 'f', 'nl'), 'moeder');
  assert.equal(kinship(1, 0, 'u', 'nl'), 'ouder');
  assert.equal(kinship(1, 0, 'm', 'en'), 'father');
  assert.equal(kinship(0, 1, 'm', 'nl'), 'zoon');
  assert.equal(kinship(0, 1, 'f', 'en'), 'daughter');
  assert.equal(kinship(2, 0, 'm', 'nl'), 'grootvader');
  assert.equal(kinship(2, 0, 'm', 'en'), 'grandfather');
  assert.equal(kinship(3, 0, 'm', 'nl'), 'overgrootvader');
  assert.equal(kinship(3, 0, 'm', 'en'), 'great-grandfather');
  assert.equal(kinship(4, 0, 'f', 'nl'), 'betovergrootmoeder');
  assert.equal(kinship(4, 0, 'm', 'en'), 'great-great-grandfather');
  assert.equal(kinship(5, 0, 'm', 'nl'), 'voorouder (5 stappen terug)');
  assert.equal(kinship(5, 0, 'm', 'en'), '3rd great-grandfather');
  assert.equal(kinship(0, 2, 'f', 'nl'), 'kleindochter');
  assert.equal(kinship(0, 3, 'm', 'en'), 'great-grandson');
});
test('siblings, uncles, nephews', () => {
  assert.equal(kinship(1, 1, 'm', 'nl'), 'broer');
  assert.equal(kinship(1, 1, 'f', 'en'), 'sister');
  assert.equal(kinship(1, 1, 'm', 'nl', true), 'halfbroer');
  assert.equal(kinship(1, 1, 'm', 'en', true), 'half-brother');
  assert.equal(kinship(2, 1, 'm', 'nl'), 'oom');
  assert.equal(kinship(2, 1, 'f', 'en'), 'aunt');
  assert.equal(kinship(3, 1, 'f', 'nl'), 'oudtante');
  assert.equal(kinship(3, 1, 'm', 'en'), 'great-uncle');
  assert.match(kinship(1, 2, 'm', 'nl'), /^neef/);
  assert.equal(kinship(1, 2, 'f', 'en'), 'niece');
});
test('cousins and removal', () => {
  assert.equal(kinship(2, 2, 'm', 'nl'), 'volle neef');
  assert.equal(kinship(2, 2, 'f', 'nl'), 'volle nicht');
  assert.equal(kinship(2, 2, 'm', 'en'), 'first cousin');
  assert.equal(kinship(3, 3, 'm', 'en'), 'second cousin');
  assert.equal(kinship(3, 3, 'f', 'nl'), 'achternicht');
  assert.equal(kinship(2, 3, 'm', 'en'), 'first cousin once removed');
  assert.equal(kinship(3, 2, 'm', 'en'), 'first cousin once removed');
  assert.equal(kinship(4, 2, 'm', 'en'), 'first cousin twice removed');
  assert.equal(kinship(3, 2, 'm', 'nl'), 'volle neef (één stap verschoven)');
  assert.equal(kinship(4, 2, 'f', 'nl'), 'volle nicht (2 stappen verschoven)');
  assert.ok(!/generatie/i.test(kinship(3, 2, 'm', 'nl')));
});
test('in-law words', () => {
  assert.equal(inLaw('spouseOfA', 0, 1, 'm', 'nl'), 'schoonzoon');
  assert.equal(inLaw('spouseOfA', 0, 1, 'f', 'en'), 'daughter-in-law');
  assert.equal(inLaw('spouseOfB', 1, 0, 'f', 'nl'), 'schoonmoeder');
  assert.equal(inLaw('spouseOfB', 1, 0, 'm', 'en'), 'father-in-law');
  assert.equal(inLaw('spouseOfA', 1, 1, 'm', 'nl'), 'zwager');
  assert.equal(inLaw('spouseOfA', 2, 1, 'f', 'nl'), 'aangetrouwde tante');
  assert.equal(inLaw('spouse', 0, 0, 'f', 'en'), 'wife');
});
test('relate() on a small graph', () => {
  const m = new Map([
    row('gf', 'm'), row('gm', 'f', null, null, ['gf']),
    row('dad', 'm', 'gf', 'gm', ['mum']), row('mum', 'f', null, null, ['dad']),
    row('unc', 'm', 'gf', 'gm', ['aunt']), row('aunt', 'f', null, null, ['unc']),
    row('kid', 'f', 'dad', 'mum'), row('cuz', 'm', 'unc', 'aunt'), row('half', 'm', 'dad', 'other'), row('other', 'f'),
    row('stranger', 'm'),
  ].map((r) => [r.id, r]));
  const w = (a, b, l = 'en') => relate(m, a, b, l).word;
  assert.equal(w('kid', 'cuz'), 'first cousin');
  assert.equal(w('dad', 'kid'), 'father');
  assert.equal(w('kid', 'dad'), 'daughter');
  assert.equal(w('half', 'kid'), 'half-brother');
  assert.equal(w('unc', 'kid'), 'uncle');
  assert.equal(w('kid', 'unc'), 'niece');
  assert.equal(w('mum', 'dad'), 'wife');
  assert.equal(w('aunt', 'kid'), 'aunt by marriage');        
  assert.equal(relate(m, 'aunt', 'kid', 'en').kind, 'marriage');
  assert.equal(w('mum', 'gf', 'nl'), 'schoondochter');
  assert.equal(w('gf', 'mum', 'nl'), 'schoonvader');
  assert.equal(relate(m, 'stranger', 'kid', 'en').kind, 'none');
  assert.equal(relate(m, 'kid', 'cuz', 'en').kind, 'blood');
});

// Regression Regression: a missing second parent is not proof of half-siblings.
test('regression: siblings with one parent unknown are not half-siblings', () => {
  const people = [
    { id: 'f' }, { id: 'm' }, { id: 'm2' },
    { id: 'a', s: 'm', f: 'f', m: 'm' },
    { id: 'b', s: 'f', f: 'f' }, // mother not on record
    { id: 'c', s: 'm', f: 'f', m: 'm2' }, // a real half-brother of a
  ];
  const byId = new Map(people.map((p) => [p.id, p]));
  assert.equal(relate(byId, 'a', 'b', 'nl').word, 'broer');
  assert.equal(relate(byId, 'a', 'c', 'nl').word, 'halfbroer');
});

// Regression Regression: the path search stopped after 12 steps and called connected people "not connected".
test('regression: long marriage/parent chains are still found', () => {
  // Two separate lines of 10 generations each, joined by one marriage at the top: A..B is 21 steps.
  const people = [];
  for (const side of ['x', 'y']) for (let i = 0; i <= 10; i++) people.push({ id: `${side}${i}`, f: i < 10 ? `${side}${i + 1}` : undefined, sp: [] });
  people.find((p) => p.id === 'x10').sp = [{ id: 'y10' }];
  const byId = new Map(people.map((p) => [p.id, p]));
  const r = relate(byId, 'x0', 'y0', 'en');
  assert.equal(r.kind, 'path');
  assert.equal(r.steps, 21);
});

test('regression: nephew line counts steps from the sibling', () => {
  assert.equal(kinship(1, 4, 'u', 'nl'), 'nakomeling van een broer of zus (3 stappen verder)');
});
