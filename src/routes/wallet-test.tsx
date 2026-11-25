import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ExternalLink, RefreshCw } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { DataTable, PageHeader, StatusPill, type Column } from "@/components/admin/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  confirmWalletTestReload,
  loadWalletTestBench,
  startWalletTestReload,
  type TestReload,
} from "@/lib/wallet-test.functions";
import { amount, dateTime } from "@/lib/format";

export const Route = createFileRoute("/wallet-test")({
  validateSearch: (s: Record<string, unknown>) => ({
    reference: typeof s["reference"] === "string" ? (s["reference"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Wallet Reload Test · Sandbox — CBS Core Ledger" },
      { name: "description", content: "Reload any existing CBS user's wallet through a sandbox payment provider and watch the balance update." },
      { property: "og:title", content: "Wallet Reload Test · Sandbox — CBS Core Ledger" },
      { property: "og:description", content: "Test wallet reloads for real CBS users with any switched-on sandbox provider." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WalletTestPage,
});

function WalletTestPage() {
  const qc = useQueryClient();
  const { reference: returnedRef } = Route.useSearch();
  const load = useServerFn(loadWalletTestBench);
  const start = useServerFn(startWalletTestReload);
  const confirm = useServerFn(confirmWalletTestReload);
  const bench = useQuery({ queryKey: ["wallet-test"], queryFn: () => load() });
  const [walletNumber, setWalletNumber] = useState("");
  const [providerCode, setProviderCode] = useState("DEFAULT");
  const [value, setValue] = useState("10.00");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);
  const checkedReturn = useRef(false);

  const wallets = bench.data?.wallets ?? [];
  const providers = bench.data?.providers ?? [];
  const selected = wallets.find((w) => w.wallet_number === walletNumber) ?? null;

  useEffect(() => {
    if (!walletNumber && wallets[0]) setWalletNumber(wallets[0].wallet_number);
  }, [wallets, walletNumber]);

  async function check(reference: string, quiet = false) {
    setChecking(reference);
    try {
      const res = await confirm({ data: { reference } });
      if (res.status === "SUCCEEDED") {
        toast.success(`${reference} paid. ${res.walletNumber} balance is now ${res.currency} ${amount(res.availableBalance)}`);
      } else if (res.status === "FAILED") {
        toast.error(`${reference} failed or expired. Balance not changed.`);
      } else if (!quiet) {
        toast.message(`${reference} is still waiting for payment.`);
      }
      await qc.invalidateQueries({ queryKey: ["wallet-test"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not check the payment.");
    } finally {
      setChecking(null);
    }
  }

  // Coming back from the provider's payment page: check that reload straight away.
  useEffect(() => {
    if (returnedRef && !checkedReturn.current && bench.data) {
      checkedReturn.current = true;
      void check(returnedRef);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnedRef, bench.data]);

  async function reload() {
    const n = Number(value);
    if (!selected) {
      toast.error("Pick a wallet first.");
      return;
    }
    if (!(n >= 1)) {
      toast.error("Enter at least 1.00.");
      return;
    }
    setBusy(true);
    try {
      const res = await start({
        data: { walletNumber: selected.wallet_number, amount: n, providerCode, returnUrl: `${window.location.origin}/wallet-test` },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      await qc.invalidateQueries({ queryKey: ["wallet-test"] });
      if (res.status === "SUCCEEDED") {
        toast.success(`${res.provider.name} settled instantly. Balance updated.`);
      } else if (res.checkoutUrl) {
        toast.success(`Opening ${res.provider.name} payment page for ${res.reference}`);
        window.location.href = res.checkoutUrl;
      } else {
        toast.message(`Reload ${res.reference} created. Press Check payment once paid.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start the reload.");
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<TestReload>[] = [
    { header: "Reference", cell: (r) => <span className="figure text-xs">{r.reference}</span> },
    { header: "Wallet", cell: (r) => <span className="text-xs"><span className="figure">{r.wallet_number}</span> · {r.holder}</span> },
    { header: "Provider", cell: (r) => <span className="figure text-xs">{r.provider_code}</span> },
    { header: "Amount", align: "right", cell: (r) => <span className="figure">{r.currency} {amount(r.amount)}</span> },
    { header: "Status", cell: (r) => <StatusPill value={r.status} /> },
    { header: "Created", cell: (r) => <span className="text-xs">{dateTime(r.created_at)}</span> },
    {
      header: "",
      cell: (r) =>
        r.status === "PENDING" ? (
          <div className="flex justify-end gap-2">
            {r.checkout_url ? (
              <Button asChild size="sm" variant="outline">
                <a href={r.checkout_url}>Pay <ExternalLink className="ml-1 h-3 w-3" /></a>
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" disabled={checking === r.reference} onClick={() => check(r.reference)}>
              <RefreshCw className="mr-1 h-3 w-3" /> Check payment
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <AdminShell>
      <PageHeader
        title="Wallet reload test (sandbox)"
        subtitle="Reload any existing CBS user's wallet through a switched-on provider. Same steps as the Wallet API reload, so the balance updates the same way."
      />

      {bench.error ? (
        <div className="rounded-md border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          {(bench.error as Error).message}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="panel p-4">
          <p className="label-caps mb-2">CBS wallets</p>
          <ul className="max-h-[420px] divide-y divide-border overflow-y-auto">
            {bench.isLoading ? <li className="py-3 text-sm text-muted-foreground">Loading…</li> : null}
            {!bench.isLoading && wallets.length === 0 ? <li className="py-3 text-sm text-muted-foreground">No active wallets.</li> : null}
            {wallets.map((w) => (
              <li key={w.wallet_number}>
                <button
                  type="button"
                  onClick={() => setWalletNumber(w.wallet_number)}
                  className={`flex w-full items-center justify-between gap-3 px-2 py-2.5 text-left text-sm hover:bg-accent/50 ${w.wallet_number === walletNumber ? "bg-accent" : ""}`}
                >
                  <span>
                    <span className="font-medium">{w.holder}</span>
                    {w.user_code ? <span className="ml-2 label-caps">{w.user_code}</span> : null}
                    <span className="block figure text-xs text-muted-foreground">{w.wallet_number}</span>
                  </span>
                  <span className="figure text-xs">{w.currency} {amount(w.available_balance)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel space-y-4 p-5">
          {selected ? (
            <div>
              <p className="label-caps">{selected.user_code ?? "Wallet"} · {selected.wallet_number}</p>
              <p className="text-lg font-semibold">{selected.holder}</p>
              <div className="mt-3 rounded-md border border-border p-4">
                <p className="label-caps">Available balance</p>
                <p className="figure text-2xl font-semibold">{selected.currency} {amount(selected.available_balance)}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Pick a wallet from the list.</p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="provider">Payment provider</Label>
            <select
              id="provider"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={providerCode}
              onChange={(e) => setProviderCode(e.target.value)}
            >
              <option value="DEFAULT">Default (first switched-on: {providers[0]?.code ?? "none"})</option>
              {providers.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name} · {p.environment}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="amt">Amount</Label>
            <Input id="amt" type="number" min="1" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <Button className="w-full" disabled={busy || !selected} onClick={reload}>
            {busy ? "Opening payment…" : "Reload wallet"}
          </Button>
          <p className="text-xs text-muted-foreground">
            You'll go to the provider's sandbox payment page. After paying you come back here and the payment is checked
            automatically. The balance goes up once, only when the provider says it's paid.
          </p>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent reloads</h2>
          <Button size="sm" variant="ghost" onClick={() => qc.invalidateQueries({ queryKey: ["wallet-test"] })}>
            <RefreshCw className="mr-1 h-3 w-3" /> Refresh
          </Button>
        </div>
        <DataTable columns={columns} rows={bench.data?.reloads ?? []} loading={bench.isLoading} empty="No reloads yet." />
      </div>
    </AdminShell>
  );
}
