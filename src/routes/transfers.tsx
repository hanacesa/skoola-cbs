import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { DataTable, PageHeader, StatusPill, type Column } from "@/components/admin/primitives";
import { useTable } from "@/lib/queries";
import { amount, dateTime } from "@/lib/format";

export const Route = createFileRoute("/transfers")({
  head: () => ({
    meta: [
      { title: "Wallet Transfers — CBS Core Ledger" },
      {
        name: "description",
        content: "Wallet-to-wallet transfers with source, destination, amount and settlement status.",
      },
      { property: "og:title", content: "Wallet Transfers — CBS Core Ledger" },
      { property: "og:description", content: "Wallet-to-wallet transfers and settlement status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TransfersPage,
});

type Row = {
  reference: string;
  amount: string;
  currency: string;
  status: string;
  note: string | null;
  created_at: string;
  from_wallet: { wallet_number: string } | null;
  to_wallet: { wallet_number: string } | null;
};

const columns: Column<Row>[] = [
  { header: "Reference", cell: (r) => <span className="figure text-xs">{r.reference}</span> },
  {
    header: "From",
    cell: (r) => <span className="figure text-xs text-debit">{r.from_wallet?.wallet_number ?? "—"}</span>,
  },
  {
    header: "To",
    cell: (r) => <span className="figure text-xs text-credit">{r.to_wallet?.wallet_number ?? "—"}</span>,
  },
  {
    header: "Amount",
    align: "right",
    cell: (r) => (
      <span className="figure">
        {r.currency} {amount(r.amount)}
      </span>
    ),
  },
  { header: "Note", cell: (r) => <span className="text-muted-foreground">{r.note ?? "—"}</span> },
  { header: "Status", cell: (r) => <StatusPill value={r.status} /> },
  { header: "Created", align: "right", cell: (r) => dateTime(r.created_at) },
];

function TransfersPage() {
  const { data, isLoading } = useTable<Row>("transfers", {
    select:
      "reference,amount,currency,status,note,created_at,from_wallet:from_wallet_id(wallet_number),to_wallet:to_wallet_id(wallet_number)",
  });
  return (
    <AdminShell>
      <PageHeader
        title="Wallet transfers"
        subtitle="Each transfer posts a balanced pair of ledger entries and moves wallet balances atomically."
      />
      <DataTable columns={columns} rows={data} loading={isLoading} empty="No transfers recorded." />
    </AdminShell>
  );
}
