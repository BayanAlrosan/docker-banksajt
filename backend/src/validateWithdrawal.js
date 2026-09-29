import { validateAmount } from "./validateAmount.js";

export function validateWithdrawal(amount, balance) {
  const value = Number(amount);
  const currentBalance = Number(balance);

  return (
    validateAmount(value) &&
    Number.isFinite(currentBalance) &&
    value <= currentBalance
  );
}
