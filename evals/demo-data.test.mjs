import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const people = JSON.parse(fs.readFileSync('data/demo/people.json', 'utf8'));
const by = new Map(people.map(p => [p.id, p]));

test('the demo pedigree spans six generations', () => {
  const depth = (id, seen = new Set()) => {
    if (!id) return 0;
    assert.ok(!seen.has(id), `pedigree cycle: ${id}`);
    const p = by.get(id);
    return 1 + Math.max(...[p.father, p.mother].map(q => depth(q, new Set([...seen, id]))));
  };
  assert.equal(depth('jade-van-aliquam'), 6);
});

test('fictional family has consistent relationships and sourced facts', () => {
  assert.ok(people.length >= 50 && people.length <= 70);
  assert.equal(by.size, people.length);
  for (const p of people) {
    assert.ok(p.sources?.length, p.id);
    assert.ok(['documented','probable','family-story','uncertain'].includes(p.confidence), p.id);
    assert.equal(new Set(p.spouses.map(s => s.id)).size, p.spouses.length, `${p.id}: duplicate spouse`);
    for (const s of p.spouses) {
      assert.ok(by.has(s.id), `${p.id}: missing spouse`);
      assert.ok(by.get(s.id).spouses.some(q => q.id === p.id), `${p.id}: spouse does not link back`);
    }
    for (const par of [p.father, p.mother].filter(Boolean)) {
      assert.ok(by.has(par), `${p.id}: missing parent`);
      const age = Number(p.birth?.date?.slice(0,4)) - Number(by.get(par).birth?.date?.slice(0,4));
      assert.ok(age >= 16 && age <= 60, `${p.id}: implausible parent age ${age}`);
    }
  }
});
