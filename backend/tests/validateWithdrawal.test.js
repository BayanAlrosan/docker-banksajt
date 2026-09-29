import { describe, expect, it } from "vitest";
import { validateWithdrawal } from "../src/validateWithdrawal.js";

describe("validateWithdrawal", () => {
  it("godkänner ett giltigt uttag", () => {
    expect(validateWithdrawal(100, 500)).toBe(true);
  });

  it("nekar uttag som är större än saldot", () => {
    expect(validateWithdrawal(600, 500)).toBe(false);
  });

  it("nekar noll och negativa belopp", () => {
    expect(validateWithdrawal(0, 500)).toBe(false);
    expect(validateWithdrawal(-100, 500)).toBe(false);
  });

  it("nekar NaN och Infinity", () => {
    expect(validateWithdrawal(NaN, 500)).toBe(false);
    expect(validateWithdrawal(Infinity, 500)).toBe(false);
  });
});
