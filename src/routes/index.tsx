import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { DataTable, PageHeader, StatCard, StatusPill, type Column } from "@/components/admin/primitives";
import { useCount, useTable } from "@/lib/queries";
import { amount, dateTime } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Core Banking Dashboard — CBS Core Ledger" },
      {
        name: "description",
        content:
          "Live view of organizations, wallets, ledger balances and posted transactions across the CBS core banking platform.",
      },
      { property: "og:title", content: "Core Banking Dashboard — CBS Core Ledger" },
      {
        property: "og:description",
        content: "Live organizations, wallets, ledger and transaction activity.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

type Txn = {
  reference: string;
  transaction_type: string;
  status: string;
  amount: string;
  currency: string;
  created_at: string;
};

const columns: Column<Txn>[] = [
  { header: "Reference", cell: (r) => <span className="figure text-xs">{r.reference}</span> },
  { header: "Type", cell: (r) => r.transaction_type },
  { header: "Status", cell: (r) => <StatusPill value={r.status} /> },
  {
    header: "Amount",
    align: "right",
    cell: (r) => (
      <span className="figure">
        {r.currency} {amount(r.amount)}
      </span>
    ),
  },
  { header: "Posted", align: "right", cell: (r) => dateTime(r.created_at) },
];

function Dashboard() {
  const orgs = useCount("organizations");
  const users = useCount("users");
  const merchants = useCount("merchants");
  const txns = useCount("transactions");
  const wallets = useTable<{ available_balance: string; held_balance: string; currency: string }>(
    "wallets",
    { select: "available_balance,held_balance,currency" },
  );
  const recent = useTable<Txn>("transactions", {
    select: "reference,transaction_type,status,amount,currency,created_at",
    limit: 10,
  });

  const totalAvailable = (wallets.data ?? []).reduce((sum, w) => sum + Number(w.available_balance), 0);
  const totalHeld = (wallets.data ?? []).reduce((sum, w) => sum + Number(w.held_balance), 0);

  return (
    <AdminShell>
      <PageHeader
        title="Core banking dashboard"
        subtitle="Consolidated position across registration, wallet balances and the double-entry ledger."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Organizations" value={String(orgs.data ?? 0)} hint="Registered institutions" />
        <StatCard label="Users" value={String(users.data ?? 0)} hint="Wallet holders" />
        <StatCard label="Merchants" value={String(merchants.data ?? 0)} hint="Acquiring partners" />
        <StatCard label="Transactions" value={String(txns.data ?? 0)} hint="Ledger postings" tone="primary" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Available balance" value={amount(totalAvailable)} hint="Across all wallets" tone="credit" />
        <StatCard label="Held balance" value={amount(totalHeld)} hint="Authorised, not settled" tone="debit" />
      </div>
      <section className="space-y-3">
        <h2 className="label-caps">Recent postings</h2>
        <DataTable columns={columns} rows={recent.data} loading={recent.isLoading} />
      </section>
    </AdminShell>
  );
}
