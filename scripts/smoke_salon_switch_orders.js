/**
 * Smoke: salon switch keeps past orders (same user_id, original order.salon_id).
 * Run: node scripts/smoke_salon_switch_orders.js
 */
const fs = require('fs');
const path = require('path');

const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/seed.json'), 'utf8'));
const db = JSON.parse(JSON.stringify(seed));

const user = db.users.find((u) => u.id === 1);
if (!user) throw new Error('user 1 missing');
const before = db.orders
  .filter((o) => o.user_id === user.id)
  .map((o) => ({ id: o.id, salon_id: o.salon_id }));
if (!before.length) throw new Error('user 1 has no orders in seed');

const fromSalon = user.current_salon_id;
const toSalon = db.salons.find((s) => s.id !== fromSalon);
const designer = db.designers.find((d) => d.salon_id === toSalon.id && d.status === 'ACTIVE');
if (!toSalon || !designer) throw new Error('target salon/designer missing');

user.previous_salon_id = user.current_salon_id;
user.current_salon_id = toSalon.id;
user.mapped_designer_id = designer.id;

const after = db.orders.filter((o) => o.user_id === user.id);
if (after.length !== before.length) {
  throw new Error(`order count changed ${before.length} -> ${after.length}`);
}
for (const row of before) {
  const kept = after.find((o) => o.id === row.id);
  if (!kept || kept.salon_id !== row.salon_id) {
    throw new Error(`order ${row.id} salon mutated`);
  }
}

console.log('OK: switched', fromSalon, '->', toSalon.id, 'kept', after.length, 'orders');
