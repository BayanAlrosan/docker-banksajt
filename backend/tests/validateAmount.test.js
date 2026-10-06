import { describe, expect, it } from "vitest";
import { validateAmount } from "../src/validateAmount.js";

describe("validateAmount", () => {
  it("godkänner ett giltigt belopp", () => {
    expect(validateAmount(100)).toBe(true);
  });

  it("nekar noll", () => {
    expect(validateAmount(0)).toBe(false);
  });

  it("nekar negativa belopp", () => {
    expect(validateAmount(-50)).toBe(false);
  });

  it("nekar NaN och Infinity", () => {
    expect(validateAmount(NaN)).toBe(false);
    expect(validateAmount(Infinity)).toBe(false);
  });
});
