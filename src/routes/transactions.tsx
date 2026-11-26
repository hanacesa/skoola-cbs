import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { DataTable, PageHeader, StatusPill, type Column } from "@/components/admin/primitives";
import { useTable } from "@/lib/queries";
import { amount, dateTime } from "@/lib/format";

export const Route = createFileRoute("/transactions")({
  head: () => ({
    meta: [
      { title: "Transactions — CBS Core Ledger" },
      {
        name: "description",
        content: "Posted, pending and reversed transactions with references, amounts and descriptions.",
      },
      { property: "og:title", content: "Transactions — CBS Core Ledger" },
      { property: "og:description", content: "Posted, pending and reversed transaction history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TransactionsPage,
});

type Row = {
  reference: string;
  transaction_type: string;
  status: string;
  amount: string;
  currency: string;
  description: string | null;
  posted_at: string | null;
  created_at: string;
  organizations: { name: string } | null;
};

const columns: Column<Row>[] = [
  { header: "Reference", cell: (r) => <span className="figure text-xs">{r.reference}</span> },
  { header: "Type", cell: (r) => r.transaction_type },
  {
    header: "Description",
    cell: (r) => <span className="text-muted-foreground">{r.description ?? "—"}</span>,
  },
  { header: "Organization", cell: (r) => r.organizations?.name ?? "—" },
  {
    header: "Amount",
    align: "right",
    cell: (r) => (
      <span className="figure">
        {r.currency} {amount(r.amount)}
      </span>
    ),
  },
  { header: "Status", cell: (r) => <StatusPill value={r.status} /> },
  { header: "Posted", align: "right", cell: (r) => dateTime(r.posted_at ?? r.created_at) },
];

function TransactionsPage() {
  const { data, isLoading } = useTable<Row>("transactions", {
    select:
      "reference,transaction_type,status,amount,currency,description,posted_at,created_at,organizations(name)",
    limit: 300,
  });
  return (
    <AdminShell>
      <PageHeader
        title="Transactions"
        subtitle="Immutable transaction register. Corrections are made by posting a reversal, never by editing."
      />
      <DataTable columns={columns} rows={data} loading={isLoading} empty="No transactions posted." />
    </AdminShell>
  );
}
