/**
 * Demo wallet kept in the browser's localStorage, so senangPay sandbox reloads
 * can be tested without the MySQL database running.
 * Only call these from event handlers / useEffect (browser only).
 */
export type DemoReload = {
  invoice: string;
  amount: number;
  status: "PENDING" | "SUCCESS" | "FAILED";
  checkoutUrl: string | null;
  createdAt: string;
  completedAt?: string;
};

export type DemoWallet = {
  user: { name: string; email: string; phone: string };
  walletNumber: string;
  currency: "MYR";
  balance: number;
  reloads: DemoReload[];
};

export const DEMO_STORAGE_KEY = "cbs-demo-wallet-v1";

export function newDemoWallet(): DemoWallet {
  return {
    user: { name: "Demo User", email: "demo.user@cbs.local", phone: "60123456789" },
    walletNumber: "WAL-DEMO-0001",
    currency: "MYR",
    balance: 0,
    reloads: [],
  };
}

export function loadDemoWallet(): DemoWallet {
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as DemoWallet;
  } catch {
    /* corrupted — start fresh */
  }
  const fresh = newDemoWallet();
  saveDemoWallet(fresh);
  return fresh;
}

export function saveDemoWallet(wallet: DemoWallet) {
  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(wallet));
}

export function addPendingReload(wallet: DemoWallet, reload: DemoReload): DemoWallet {
  return { ...wallet, reloads: [reload, ...wallet.reloads.filter((r) => r.invoice !== reload.invoice)] };
}

/**
 * Apply the provider's answer for a reload. The balance is credited only once,
 * the first time a reload turns SUCCESS.
 */
export function applyReloadStatus(
  wallet: DemoWallet,
  invoice: string,
  status: DemoReload["status"],
  now = new Date().toISOString(),
): DemoWallet {
  const reload = wallet.reloads.find((r) => r.invoice === invoice);
  if (!reload || reload.status !== "PENDING" || status === "PENDING") return wallet;
  const credit = status === "SUCCESS" ? reload.amount : 0;
  return {
    ...wallet,
    balance: Math.round((wallet.balance + credit) * 100) / 100,
    reloads: wallet.reloads.map((r) => (r.invoice === invoice ? { ...r, status, completedAt: now } : r)),
  };
}
