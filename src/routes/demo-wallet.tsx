import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusPill } from "@/components/admin/primitives";
import { money, dateTime } from "@/lib/format";
import {
  addPendingReload,
  applyReloadStatus,
  loadDemoWallet,
  newDemoWallet,
  saveDemoWallet,
  type DemoWallet,
} from "@/lib/demo-wallet";
import { checkDemoReload, startDemoReload } from "@/lib/demo-wallet.functions";

export const Route = createFileRoute("/demo-wallet")({
  head: () => ({
    meta: [
      { title: "Demo Wallet · senangPay Sandbox — CBS Core Ledger" },
      { name: "description", content: "Reload a demo user's wallet through the senangPay sandbox and watch the balance update." },
      { property: "og:title", content: "Demo Wallet · senangPay Sandbox — CBS Core Ledger" },
      { property: "og:description", content: "Test senangPay sandbox wallet reloads with a demo user." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DemoWalletPage,
});

function DemoWalletPage() {
  const start = useServerFn(startDemoReload);
  const check = useServerFn(checkDemoReload);
  const [wallet, setWallet] = useState<DemoWallet | null>(null);
  const [amount, setAmount] = useState("10.00");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const update = useCallback((next: DemoWallet) => {
    saveDemoWallet(next);
    setWallet(next);
  }, []);

  const refreshPending = useCallback(
    async (current: DemoWallet) => {
      const pending = current.reloads.filter((r) => r.status === "PENDING");
      if (!pending.length) return;
      setChecking(true);
      let next = current;
      for (const r of pending) {
        try {
          const res = await check({ data: { invoice: r.invoice } });
          const before = next.balance;
          next = applyReloadStatus(next, r.invoice, res.status);
          if (next.balance !== before) setNotice({ ok: true, text: `Payment received. ${money(r.amount)} added to the wallet.` });
        } catch {
          /* try again later */
        }
      }
      update(next);
      setChecking(false);
    },
    [check, update],
  );

  useEffect(() => {
    const w = loadDemoWallet();
    setWallet(w);
    void refreshPending(w);
  }, [refreshPending]);

  async function reload() {
    if (!wallet) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await start({
        data: {
          amount: Number(amount),
          returnUrl: `${window.location.origin}/demo-wallet`,
          ...wallet.user,
        },
      });
      if (!res.ok) {
        setNotice({ ok: false, text: res.error });
        return;
      }
      update(
        addPendingReload(wallet, {
          invoice: res.invoice,
          amount: Number(amount),
          status: "PENDING",
          checkoutUrl: res.checkoutUrl,
          createdAt: new Date().toISOString(),
        }),
      );
      window.location.href = res.checkoutUrl;
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : "Could not start the reload." });
    } finally {
      setBusy(false);
    }
  }

  if (!wallet) return <div className="min-h-screen bg-background" />;

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="figure text-xs font-semibold tracking-tight text-primary">CBS · DEMO WALLET</p>
            <h1 className="mt-1 text-lg font-semibold">senangPay sandbox reload test</h1>
            <p className="text-xs text-muted-foreground">Saved in this browser. No real money moves.</p>
          </div>
          <Link to="/auth" className="text-xs text-muted-foreground hover:text-foreground">
            Staff sign in
          </Link>
        </div>

        <div className="panel grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Demo user</p>
            <p className="font-medium">{wallet.user.name}</p>
            <p className="text-xs text-muted-foreground">{wallet.user.email}</p>
            <p className="figure mt-2 text-xs">{wallet.walletNumber}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs text-muted-foreground">Available balance</p>
            <p className="figure text-3xl font-semibold" data-testid="demo-balance">
              {money(wallet.balance)}
            </p>
          </div>
        </div>

        <div className="panel space-y-3 p-5">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Reload with senangPay sandbox</h2>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount (MYR)</Label>
              <Input id="amount" type="number" min={1} max={1000} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-36" />
            </div>
            <Button onClick={reload} disabled={busy || Number(amount) < 1}>
              {busy ? "Opening senangPay…" : "Reload wallet"}
            </Button>
            <Button variant="outline" onClick={() => void refreshPending(wallet)} disabled={checking}>
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
              {checking ? "Checking…" : "Check payment status"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            You'll go to the senangPay sandbox page. Pay with any test method, then come back here. The balance goes up once senangPay confirms the payment.
          </p>
          {notice ? <p className={notice.ok ? "text-xs text-success" : "text-xs text-warning"}>{notice.text}</p> : null}
        </div>

        <div className="panel p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Reload history</h2>
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                if (confirm("Reset the demo wallet to zero and clear history?")) update(newDemoWallet());
              }}
            >
              Reset demo
            </button>
          </div>
          {wallet.reloads.length === 0 ? (
            <p className="text-xs text-muted-foreground">No reloads yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1.5">Reference</th>
                  <th>Date</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {wallet.reloads.map((r) => (
                  <tr key={r.invoice} className="border-t border-border">
                    <td className="figure py-2 text-xs">
                      {r.status === "PENDING" && r.checkoutUrl ? (
                        <a href={r.checkoutUrl} className="text-primary hover:underline">{r.invoice}</a>
                      ) : (
                        r.invoice
                      )}
                    </td>
                    <td className="text-xs">{dateTime(r.createdAt)}</td>
                    <td className="figure text-right">{money(r.amount)}</td>
                    <td className="text-right">
                      <StatusPill value={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
