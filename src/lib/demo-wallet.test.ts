import { describe, expect, it } from "vitest";
import { addPendingReload, applyReloadStatus, newDemoWallet } from "./demo-wallet";

const pending = { invoice: "DEMO-1", amount: 50, status: "PENDING" as const, checkoutUrl: null, createdAt: "2026-01-01" };

describe("demo wallet reloads", () => {
  it("credits the balance when senangPay reports SUCCESS", () => {
    const w = applyReloadStatus(addPendingReload(newDemoWallet(), pending), "DEMO-1", "SUCCESS");
    expect(w.balance).toBe(50);
  });
  it("credits only once for the same reload", () => {
    let w = applyReloadStatus(addPendingReload(newDemoWallet(), pending), "DEMO-1", "SUCCESS");
    w = applyReloadStatus(w, "DEMO-1", "SUCCESS");
    expect(w.balance).toBe(50);
  });
  it("does not credit a failed reload", () => {
    const w = applyReloadStatus(addPendingReload(newDemoWallet(), pending), "DEMO-1", "FAILED");
    expect(w.balance).toBe(0);
  });
});
