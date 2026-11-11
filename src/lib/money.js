// One way to show money everywhere it appears.
//
//   formatMoney(34975)        -> "$34,975"
//   formatMoney(12.5)         -> "$12.50"
//   formatMoney(-7280.37)     -> "-$7,280.37"
//   formatMoney(40, { symbol: '£' }) -> "£40"
//
// Thousands separators always. Cents only when the amount has them, so a
// ledger keeps its precision and a round total does not trail ".00".
// Anything that is not a number reads as zero, which matches how the
// business pages already treated a blank amount.
export function formatMoney(amount, { symbol = '$' } = {}) {
  const value = Number(amount);
  const safe = Number.isFinite(value) ? value : 0;
  const cents = Math.round(Math.abs(safe) * 100);
  const whole = cents % 100 === 0;
  const text = (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  });
  return `${safe < 0 && cents !== 0 ? '-' : ''}${symbol}${text}`;
}
