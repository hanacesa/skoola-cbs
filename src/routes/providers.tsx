import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { TestTube2 } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { DataTable, PageHeader, StatusPill, type Column } from "@/components/admin/primitives";
import { Button } from "@/components/ui/button";
import { useAuth, useRoles } from "@/hooks/useAuth";
import { useTable } from "@/lib/queries";
import { setProviderEnabled, testPaymentProvider } from "@/lib/providers.functions";
import { cn } from "@/lib/utils";
import { PlugAndPlayPanel } from "@/components/admin/PlugAndPlayPanel";

export const Route = createFileRoute("/providers")({
  head: () => ({
    meta: [
      { title: "Plug and Play API and Sandbox — CBS Core Ledger" },
      {
        name: "description",
        content: "Connect any payment provider API or sandbox, set routing priority and manage payment methods.",
      },
      { property: "og:title", content: "Plug and Play API and Sandbox — CBS Core Ledger" },
      { property: "og:description", content: "Connect payment provider APIs and sandboxes for wallet reloads." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProvidersPage,
});

type ProviderRow = {
  id: string;
  code: string;
  name: string;
  priority: number;
  enabled: boolean;
  environment: string;
  status: string;
  api_base_url: string | null;
  sandbox_base_url: string | null;
  auth_type: string;
  credential_secret_name: string | null;
  notes: string | null;
};

type MethodRow = {
  code: string;
  name: string;
  enabled: boolean;
  payment_providers: { name: string } | null;
};

const methodColumns: Column<MethodRow>[] = [
  { header: "Code", cell: (r) => <span className="figure text-xs">{r.code}</span> },
  { header: "Method", cell: (r) => <span className="font-medium">{r.name}</span> },
  { header: "Provider", cell: (r) => r.payment_providers?.name ?? "—" },
  { header: "Enabled", cell: (r) => <StatusPill value={r.enabled ? "ACTIVE" : "SUSPENDED"} /> },
];

function ProvidersPage() {
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const { user } = useAuth();
  const { data: roles } = useRoles(user?.id);
  const isAdmin = roles?.includes("admin") ?? false;

  const testProvider = useServerFn(testPaymentProvider);
  const toggleProvider = useServerFn(setProviderEnabled);
  const [busyId, setBusyId] = useState<string | null>(null);

  const providers = useTable<ProviderRow>("payment_providers", {
    select:
      "id,code,name,priority,enabled,environment,status,api_base_url,sandbox_base_url,auth_type,credential_secret_name,notes",
    orderBy: "priority",
    ascending: true,
  });
  const methods = useTable<MethodRow>("payment_methods", {
    select: "code,name,enabled,payment_providers(name)",
    orderBy: "code",
    ascending: true,
  });

  const senang = (providers.data ?? []).find((p) => p.code.toUpperCase().includes("SENANG") || p.name.toLowerCase().includes("senang"));

  async function runTest(providerId: string) {
    setNotice(null);
    try {
      const result = await testProvider({ data: { providerId } });
      setNotice({
        tone: result.reachable ? "success" : "error",
        text: `Connection check: ${result.detail}`,
      });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Connection check failed." });
    }
  }

  async function toggle(r: ProviderRow) {
    const on = !Number(r.enabled);
    setBusyId(r.id);
    setNotice(null);
    try {
      await toggleProvider({ data: { providerId: r.id, enabled: on } });
      await providers.refetch();
      setNotice({ tone: "success", text: `${r.name} switched ${on ? "ON" : "OFF"}.` });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not switch provider." });
    } finally {
      setBusyId(null);
    }
  }

  const activeProvider = (providers.data ?? []).find((p) => Number(p.enabled) && p.status === "ACTIVE");

  const providerColumns: Column<ProviderRow>[] = [
    { header: "Code", cell: (r) => <span className="figure text-xs">{r.code}</span> },
    { header: "Provider", cell: (r) => <span className="font-medium">{r.name}</span> },
    { header: "Priority", align: "right", cell: (r) => <span className="figure">{r.priority}</span> },
    { header: "Environment", cell: (r) => r.environment },
    {
      header: "Endpoint",
      cell: (r) => (
        <span className="text-xs text-muted-foreground">
          {r.api_base_url ?? r.sandbox_base_url ?? "simulated locally"}
        </span>
      ),
    },
    { header: "Auth", cell: (r) => <span className="text-xs">{r.auth_type}</span> },
    {
      header: "Key name",
      cell: (r) => <span className="figure text-xs text-muted-foreground">{r.credential_secret_name ?? "—"}</span>,
    },
    {
      header: "On / Off",
      cell: (r) => {
        const on = Boolean(Number(r.enabled)) && r.status === "ACTIVE";
        return (
          <Button
            type="button"
            size="sm"
            variant={on ? "default" : "outline"}
            disabled={!isAdmin || busyId === r.id}
            aria-label={`Switch ${r.name} ${on ? "off" : "on"}`}
            onClick={() => void toggle(r)}
          >
            {busyId === r.id ? "…" : on ? "ON" : "OFF"}
          </Button>
        );
      },
    },
    {
      header: "Wallet uses",
      cell: (r) => (activeProvider?.id === r.id ? <StatusPill value="ACTIVE" /> : <span className="text-xs text-muted-foreground">—</span>),
    },
    { header: "Status", cell: (r) => <StatusPill value={r.status} /> },
    {
      header: "Check",
      cell: (r) => (
        <Button type="button" variant="ghost" size="sm" onClick={() => void runTest(r.id)}>
          <TestTube2 className="size-4" /> Test
        </Button>
      ),
    },
  ];

  return (
    <AdminShell>
      <section className="panel border-primary/40 bg-primary/5 p-5 sm:p-6">
        <p className="label-caps text-primary">Payment providers</p>
        <h1 className="mt-1 text-2xl font-bold tracking-wide sm:text-3xl">PLUG AND PLAY API AND SANDBOX</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Connect any payment provider by choosing it, switching Sandbox or Production, and entering its Client ID and API key.
          Keys are encrypted automatically and the provider is ready for wallet transactions straight away.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md border border-border bg-background/60 p-3 text-sm">
          <span className="font-semibold">senangPay sandbox</span>
          {senang ? (
            <>
              <StatusPill value={senang.status} />
              <span className="figure text-xs text-muted-foreground">{senang.code} · {senang.environment} · {senang.sandbox_base_url ?? senang.api_base_url ?? "—"}</span>
              <span className="text-xs text-muted-foreground">Existing setup kept as-is.</span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">{providers.isLoading ? "Checking…" : "Not found in providers list yet."}</span>
          )}
        </div>
      </section>

      <PlugAndPlayPanel />

      {notice ? (
        <div
          className={cn(
            "rounded-md border p-3 text-sm",
            notice.tone === "success"
              ? "border-success/30 bg-success/10 text-success"
              : "border-destructive/30 bg-destructive/10 text-destructive",
          )}
        >
          {notice.text}
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="label-caps">Providers</h2>
        <DataTable columns={providerColumns} rows={providers.data} loading={providers.isLoading} empty="No providers connected yet." />
      </section>
      <section className="space-y-3">
        <h2 className="label-caps">Payment methods</h2>
        <DataTable columns={methodColumns} rows={methods.data} loading={methods.isLoading} empty="No payment methods yet." />
      </section>
    </AdminShell>
  );
}
