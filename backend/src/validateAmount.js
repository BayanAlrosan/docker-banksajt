export function validateAmount(amount) {
  const value = Number(amount);
  return Number.isFinite(value) && value > 0;
}
