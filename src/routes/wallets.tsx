import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { DataTable, PageHeader, StatCard, StatusPill, type Column } from "@/components/admin/primitives";
import { useTable } from "@/lib/queries";
import { amount, shortDate } from "@/lib/format";

export const Route = createFileRoute("/wallets")({
  head: () => ({
    meta: [
      { title: "Accounts & Wallets — CBS Core Ledger" },
      {
        name: "description",
        content: "Wallet balances, holds and pending amounts against their parent banking accounts.",
      },
      { property: "og:title", content: "Accounts & Wallets — CBS Core Ledger" },
      { property: "og:description", content: "Wallet balances, holds and parent accounts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WalletsPage,
});

type WalletRow = {
  wallet_number: string;
  currency: string;
  available_balance: string;
  pending_balance: string;
  held_balance: string;
  status: string;
  created_at: string;
  accounts: { account_number: string; account_type: string; parties: { display_name: string } | null } | null;
};

type AccountRow = {
  account_number: string;
  account_type: string;
  currency: string;
  status: string;
  opened_at: string;
  parties: { display_name: string; party_type: string } | null;
};

const walletColumns: Column<WalletRow>[] = [
  { header: "Wallet", cell: (r) => <span className="figure text-xs">{r.wallet_number}</span> },
  { header: "Holder", cell: (r) => r.accounts?.parties?.display_name ?? "—" },
  { header: "Account", cell: (r) => <span className="figure text-xs">{r.accounts?.account_number ?? "—"}</span> },
  { header: "Ccy", cell: (r) => <span className="figure">{r.currency}</span> },
  {
    header: "Available",
    align: "right",
    cell: (r) => <span className="figure text-credit">{amount(r.available_balance)}</span>,
  },
  { header: "Pending", align: "right", cell: (r) => <span className="figure">{amount(r.pending_balance)}</span> },
  {
    header: "Held",
    align: "right",
    cell: (r) => <span className="figure text-debit">{amount(r.held_balance)}</span>,
  },
  { header: "Status", cell: (r) => <StatusPill value={r.status} /> },
];

const accountColumns: Column<AccountRow>[] = [
  { header: "Account", cell: (r) => <span className="figure text-xs">{r.account_number}</span> },
  { header: "Type", cell: (r) => r.account_type },
  { header: "Party", cell: (r) => r.parties?.display_name ?? "—" },
  { header: "Party type", cell: (r) => r.parties?.party_type ?? "—" },
  { header: "Ccy", cell: (r) => <span className="figure">{r.currency}</span> },
  { header: "Status", cell: (r) => <StatusPill value={r.status} /> },
  { header: "Opened", align: "right", cell: (r) => shortDate(r.opened_at) },
];

function WalletsPage() {
  const wallets = useTable<WalletRow>("wallets", {
    select:
      "wallet_number,currency,available_balance,pending_balance,held_balance,status,created_at,accounts(account_number,account_type,parties(display_name))",
  });
  const accounts = useTable<AccountRow>("accounts", {
    select: "account_number,account_type,currency,status,opened_at,parties(display_name,party_type)",
  });

  const rows = wallets.data ?? [];
  const totals = rows.reduce(
    (acc, w) => ({
      available: acc.available + Number(w.available_balance),
      pending: acc.pending + Number(w.pending_balance),
      held: acc.held + Number(w.held_balance),
    }),
    { available: 0, pending: 0, held: 0 },
  );

  return (
    <AdminShell>
      <PageHeader
        title="Accounts & wallets"
        subtitle="Every wallet is backed by a banking account attached to a party in the registration hierarchy."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total available" value={amount(totals.available)} tone="credit" />
        <StatCard label="Total pending" value={amount(totals.pending)} />
        <StatCard label="Total held" value={amount(totals.held)} tone="debit" />
      </div>
      <section className="space-y-3">
        <h2 className="label-caps">Wallets</h2>
        <DataTable columns={walletColumns} rows={rows} loading={wallets.isLoading} empty="No wallets opened." />
      </section>
      <section className="space-y-3">
        <h2 className="label-caps">Accounts</h2>
        <DataTable
          columns={accountColumns}
          rows={accounts.data}
          loading={accounts.isLoading}
          empty="No accounts opened."
        />
      </section>
    </AdminShell>
  );
}
