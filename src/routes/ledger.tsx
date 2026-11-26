import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { DataTable, PageHeader, StatCard, StatusPill, type Column } from "@/components/admin/primitives";
import { useTable } from "@/lib/queries";
import { amount, dateTime } from "@/lib/format";

export const Route = createFileRoute("/ledger")({
  head: () => ({
    meta: [
      { title: "General Ledger — CBS Core Ledger" },
      {
        name: "description",
        content: "Chart of accounts and double-entry ledger lines with debit and credit totals.",
      },
      { property: "og:title", content: "General Ledger — CBS Core Ledger" },
      { property: "og:description", content: "Chart of accounts and double-entry ledger lines." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LedgerPage,
});

type AccountRow = {
  code: string;
  name: string;
  account_class: string;
  normal_balance: string;
  currency: string;
  status: string;
};

type EntryRow = {
  direction: string;
  amount: string;
  currency: string;
  created_at: string;
  ledger_accounts: { code: string; name: string } | null;
  transactions: { reference: string; status: string } | null;
};

const accountColumns: Column<AccountRow>[] = [
  { header: "Code", cell: (r) => <span className="figure text-xs">{r.code}</span> },
  { header: "Account", cell: (r) => <span className="font-medium">{r.name}</span> },
  { header: "Class", cell: (r) => r.account_class },
  {
    header: "Normal balance",
    cell: (r) => (
      <span className={r.normal_balance === "CREDIT" ? "text-credit" : "text-debit"}>{r.normal_balance}</span>
    ),
  },
  { header: "Ccy", cell: (r) => <span className="figure">{r.currency}</span> },
  { header: "Status", cell: (r) => <StatusPill value={r.status} /> },
];

const entryColumns: Column<EntryRow>[] = [
  {
    header: "Transaction",
    cell: (r) => <span className="figure text-xs">{r.transactions?.reference ?? "—"}</span>,
  },
  {
    header: "Ledger account",
    cell: (r) => (
      <div>
        <p className="font-medium">{r.ledger_accounts?.name ?? "—"}</p>
        <p className="figure text-xs text-muted-foreground">{r.ledger_accounts?.code ?? ""}</p>
      </div>
    ),
  },
  {
    header: "Dr",
    align: "right",
    cell: (r) => (
      <span className="figure text-debit">{r.direction === "DEBIT" ? amount(r.amount) : "—"}</span>
    ),
  },
  {
    header: "Cr",
    align: "right",
    cell: (r) => (
      <span className="figure text-credit">{r.direction === "CREDIT" ? amount(r.amount) : "—"}</span>
    ),
  },
  { header: "Ccy", cell: (r) => <span className="figure">{r.currency}</span> },
  { header: "Posted", align: "right", cell: (r) => dateTime(r.created_at) },
];

function LedgerPage() {
  const accounts = useTable<AccountRow>("ledger_accounts", {
    select: "code,name,account_class,normal_balance,currency,status",
    orderBy: "code",
    ascending: true,
  });
  const entries = useTable<EntryRow>("ledger_entries", {
    select:
      "direction,amount,currency,created_at,ledger_accounts(code,name),transactions(reference,status)",
    limit: 300,
  });

  const rows = entries.data ?? [];
  const debits = rows.filter((e) => e.direction === "DEBIT").reduce((s, e) => s + Number(e.amount), 0);
  const credits = rows.filter((e) => e.direction === "CREDIT").reduce((s, e) => s + Number(e.amount), 0);

  return (
    <AdminShell>
      <PageHeader
        title="General ledger"
        subtitle="Every posting is balanced: total debits must always equal total credits."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total debits" value={amount(debits)} tone="debit" />
        <StatCard label="Total credits" value={amount(credits)} tone="credit" />
        <StatCard
          label="Out of balance"
          value={amount(debits - credits)}
          hint={debits === credits ? "Ledger is balanced" : "Investigate immediately"}
          tone={debits === credits ? "primary" : "debit"}
        />
      </div>
      <section className="space-y-3">
        <h2 className="label-caps">Chart of accounts</h2>
        <DataTable columns={accountColumns} rows={accounts.data} loading={accounts.isLoading} />
      </section>
      <section className="space-y-3">
        <h2 className="label-caps">Ledger entries</h2>
        <DataTable columns={entryColumns} rows={rows} loading={entries.isLoading} empty="No entries posted." />
      </section>
    </AdminShell>
  );
}
