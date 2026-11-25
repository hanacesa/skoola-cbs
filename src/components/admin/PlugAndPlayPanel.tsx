import { useMemo, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FlaskConical, PlugZap } from "lucide-react";
import { StatusPill } from "@/components/admin/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useTable } from "@/lib/queries";
import { PROVIDER_TEMPLATES } from "@/lib/provider-templates";
import { createPaymentProvider } from "@/lib/providers.functions";
import { runTestPayment } from "@/lib/payment-test.functions";

type ProviderRow = { id: string; code: string; name: string; environment: string; status: string; enabled: boolean; priority: number };
type MethodRow = { provider_id: string; code: string; name: string };

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

type TestResult = Awaited<ReturnType<typeof runTestPayment>>;

export function PlugAndPlayPanel() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const qc = useQueryClient();
  const providers = useTable<ProviderRow>("payment_providers", {
    select: "id,code,name,environment,status,enabled,priority",
    orderBy: "priority",
    ascending: true,
  });
  const methods = useTable<MethodRow>("payment_methods", { select: "provider_id,code,name", orderBy: "code", ascending: true });

  // ---- Test payment ----
  const testFn = useServerFn(runTestPayment);
  const list = providers.data ?? [];
  const senang = list.find((p) => p.code === "SENANGPAY");
  const [providerId, setProviderId] = useState<string>("");
  const selectedId = providerId || senang?.id || list[0]?.id || "";
  const providerMethods = (methods.data ?? []).filter((m) => m.provider_id === selectedId);
  const [amount, setAmount] = useState("1.00");
  const [methodCode, setMethodCode] = useState("");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  async function runTest() {
    if (!selectedId) return;
    setTesting(true);
    setResult(null);
    try {
      setResult(await testFn({ data: { providerId: selectedId, amount: Number(amount), methodCode: methodCode || providerMethods[0]?.code || "" } }));
    } catch (e) {
      setResult({ ok: false, reference: "", error: e instanceof Error ? e.message : "Test failed." });
    } finally {
      setTesting(false);
    }
  }

  // ---- Universal plug & play connect (one form for every provider) ----
  const connectFn = useServerFn(createPaymentProvider);
  const base = useMemo(() => PROVIDER_TEMPLATES.find((t) => t.code === "CUSTOM")!, []);
  const [env, setEnv] = useState<"sandbox" | "production">("sandbox");
  const [connecting, setConnecting] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  async function connect(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const v = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const name = (v["name"] ?? "").trim();
    const slug = name.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 32) || "PROVIDER";
    const authType = (v["authType"] || "BEARER") as "BEARER" | "HEADER_KEY" | "BASIC" | "SIGNATURE";
    const chargePath = (v["chargePath"] ?? "").trim() || base.operations.charge.path;
    const methods = (v["methods"] ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter((x) => x.length >= 2)
      .map((x) => ({ code: x.toUpperCase().replace(/[^A-Z0-9]+/g, "_"), name: x }));
    setConnecting(true);
    setNotice(null);
    try {
      const res = await connectFn({
        data: {
          code: `${slug}_${env === "sandbox" ? "SBX" : "LIVE"}`,
          name,
          providerType: "PAYMENT_GATEWAY",
          environment: env,
          enabled: true,
          priority: 20,
          baseUrl: (v["baseUrl"] ?? "").trim(),
          authType,
          authHeader: authType === "HEADER_KEY" ? (v["authHeader"] || "X-API-Key") : "Authorization",
          authCredentialKey: "api_key",
          operations: { ...base.operations, charge: { method: "POST", path: chargePath } },
          methods,
          credentials: [
            { key: "client_id", label: "Client ID", type: "text", required: false, secret: false, value: v["clientId"] ?? "" },
            { key: "api_key", label: "API Key", type: "password", required: true, secret: true, value: v["apiKey"] ?? "" },
          ],
          fieldMapping: JSON.stringify(base.fieldMapping),
          signature: authType === "SIGNATURE" ? JSON.stringify({ algorithm: "HMAC-SHA256", secret_credential: "api_key" }) : "",
        },
      });
      setNotice({ ok: true, text: `${name} connected (${res.environment}). Pick it in the test bench and press "Send test payment".` });
      form.reset();
      await qc.invalidateQueries({ queryKey: ["table"] });
      setProviderId(res.id);
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : "Could not connect provider." });
    } finally {
      setConnecting(false);
    }
  }

  return (
    <>
      {!isAdmin ? (
        <div className="mb-4 rounded-md border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          Administrator access is required to connect providers and send test payments.
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="panel space-y-4 p-5">
          <div>
            <p className="label-caps">Sandbox test bench</p>
            <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold">
              <FlaskConical className="size-4" /> Send test payment
            </h2>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prov">Provider</Label>
            <select id="prov" className={selectClass} value={selectedId} onChange={(e) => { setProviderId(e.target.value); setMethodCode(""); }}>
              {list.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.environment} {p.code === "SENANGPAY" ? "(example)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amt">Amount (MYR)</Label>
              <Input id="amt" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mth">Method</Label>
              <select id="mth" className={selectClass} value={methodCode} onChange={(e) => setMethodCode(e.target.value)}>
                {providerMethods.length === 0 ? <option value="">Default</option> : null}
                {providerMethods.map((m) => (
                  <option key={m.code} value={m.code}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>
          <Button onClick={() => void runTest()} disabled={!isAdmin || testing || !selectedId}>
            {testing ? "Sending…" : "Send test payment"}
          </Button>

          {result ? (
            result.ok ? (
              <div className="space-y-2 rounded-md border border-border p-3 text-sm">
                <div className="flex items-center gap-2">
                  <StatusPill value={result.status} /> {result.simulated ? <span className="text-xs text-muted-foreground">simulated</span> : null}
                </div>
                <p>Reference: <span className="figure">{result.reference}</span></p>
                <p>Provider ref: <span className="figure">{result.providerReference || "—"}</span></p>
                {result.checkoutUrl ? (
                  <a className="text-primary underline" href={result.checkoutUrl} target="_blank" rel="noreferrer">Open checkout page</a>
                ) : null}
                <Textarea readOnly value={result.raw} rows={6} className="figure text-xs" />
              </div>
            ) : (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{result.error}</div>
            )
          ) : null}
        </section>

        <section className="panel p-5">
          <p className="label-caps">Plug & play connect</p>
          <h2 className="mt-1 mb-4 flex items-center gap-2 text-lg font-semibold">
            <PlugZap className="size-4" /> Connect any provider API or sandbox
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            One form for every payment provider. Enter the provider's API address, Client ID and API Key — it connects
            automatically and is ready for wallet transactions.
          </p>
          <form onSubmit={connect} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pp_name">Provider name *</Label>
                <Input id="pp_name" name="name" required minLength={2} placeholder="e.g. Stripe, Billplz, iPay88" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pp_env">Environment</Label>
                <select id="pp_env" className={selectClass} value={env} onChange={(e) => setEnv(e.target.value as "sandbox" | "production")}>
                  <option value="sandbox">Sandbox</option>
                  <option value="production">Production (live)</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pp_url">API base URL {env === "production" ? "*" : ""}</Label>
              <Input
                id="pp_url"
                name="baseUrl"
                type="url"
                required={env === "production"}
                placeholder={env === "sandbox" ? "https://sandbox.provider.com (empty = simulated)" : "https://api.provider.com"}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pp_client">Client ID / Merchant ID</Label>
                <Input id="pp_client" name="clientId" autoComplete="off" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pp_key">API Key / Secret Key *</Label>
                <Input id="pp_key" name="apiKey" type="password" required autoComplete="new-password" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pp_auth">How the key is sent</Label>
                <select id="pp_auth" name="authType" className={selectClass} defaultValue="BEARER">
                  <option value="BEARER">Bearer token (most providers)</option>
                  <option value="HEADER_KEY">API key header</option>
                  <option value="BASIC">Basic (Client ID + Key)</option>
                  <option value="SIGNATURE">Signed request (HMAC)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pp_path">Payment endpoint path</Label>
                <Input id="pp_path" name="chargePath" placeholder={base.operations.charge.path} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pp_methods">Payment methods (comma separated)</Label>
              <Input id="pp_methods" name="methods" defaultValue="Card, FPX" />
            </div>
            <p className="text-xs text-muted-foreground">Keys are encrypted before saving and never shown again in the browser.</p>
            <Button type="submit" disabled={!isAdmin || connecting}>{connecting ? "Connecting…" : "Connect provider"}</Button>
            {notice ? (
              <p className={notice.ok ? "text-sm text-success" : "text-sm text-destructive"}>{notice.text}</p>
            ) : null}
          </form>
        </section>
      </div>
    </>
  );
}
