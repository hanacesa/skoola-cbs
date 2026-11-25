import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { PageHeader } from "@/components/admin/primitives";
import { PlugAndPlayPanel } from "@/components/admin/PlugAndPlayPanel";

export const Route = createFileRoute("/payment-test")({
  head: () => ({
    meta: [
      { title: "Plug & Play Payment Test — CBS Core Ledger" },
      { name: "description", content: "Connect any payment provider with its keys and send a test payment." },
      { property: "og:title", content: "Plug & Play Payment Test — CBS Core Ledger" },
      { property: "og:description", content: "Connect a payment API by entering its keys, then test it instantly." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaymentTestPage,
});

function PaymentTestPage() {
  return (
    <AdminShell>
      <PageHeader title="Plug & play payment test" subtitle="Connect any provider by entering its keys, then send a test payment." />
      <PlugAndPlayPanel />
    </AdminShell>
  );
}
