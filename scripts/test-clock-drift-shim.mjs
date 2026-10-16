// Loaded with `node --import` into every Vitest worker by
// scripts/test-clock-drift.mjs. Moves the wall clock by CLOCK_SHIFT_DAYS
// so `new Date()` and `Date.now()` read a different day. Dates built from
// explicit values (new Date('2026-10-16')) are untouched, and a test that
// freezes its clock with vi.setSystemTime still gets exactly that time.
const days = Number(process.env.CLOCK_SHIFT_DAYS || 0);

if (Number.isFinite(days) && days !== 0) {
  const RealDate = globalThis.Date;
  const offset = days * 86400000;
  class ShiftedDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(RealDate.now() + offset);
      else super(...args);
    }
    static now() {
      return RealDate.now() + offset;
    }
  }
  globalThis.Date = ShiftedDate;
}
