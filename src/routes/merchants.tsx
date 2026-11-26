import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { DataTable, PageHeader, StatusPill, type Column } from "@/components/admin/primitives";
import { useState } from "react";
import { useTable } from "@/lib/queries";
import { ProfileSheet, STATUS_OPTIONS, useDirectoryFilter, type FilterDef } from "@/components/admin/directory";
import { shortDate } from "@/lib/format";

export const Route = createFileRoute("/merchants")({
  head: () => ({
    meta: [
      { title: "Merchants — CBS Core Ledger" },
      {
        name: "description",
        content: "Acquiring merchants with settlement cycles, registration details and status.",
      },
      { property: "og:title", content: "Merchants — CBS Core Ledger" },
      { property: "og:description", content: "Acquiring merchants and their settlement cycles." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MerchantsPage,
});

type PartyRow = {
  accounts: { account_number: string; account_type: string; wallets: { wallet_number: string }[] | null }[] | null;
};

type Row = {
  id: string;
  merchant_code: string;
  business_name: string;
  legal_name: string | null;
  registration_number: string | null;
  email: string | null;
  mobile: string | null;
  settlement_cycle: string;
  status: string;
  created_at: string;
  clusters: { name: string } | null;
  parties: PartyRow[] | null;
};

function AccountCell({ parties }: { parties: PartyRow[] | null }) {
  const accounts = (parties ?? []).flatMap((p) => p.accounts ?? []);
  if (!accounts.length) return <span className="text-muted-foreground">Not assigned</span>;
  return (
    <div className="space-y-1">
      {accounts.map((a) => (
        <div key={a.account_number}>
          <p className="figure text-xs">{a.account_number}</p>
          <p className="text-[11px] text-muted-foreground">
            {a.account_type}
            {a.wallets?.length ? ` · ${a.wallets[0]!.wallet_number}` : ""}
          </p>
        </div>
      ))}
    </div>
  );
}

const columns: Column<Row>[] = [
  { header: "Code", cell: (r) => <span className="figure text-xs">{r.merchant_code}</span> },
  { header: "Account no.", cell: (r) => <AccountCell parties={r.parties} /> },
  {
    header: "Merchant",
    cell: (r) => (
      <div>
        <p className="font-medium">{r.business_name}</p>
        <p className="text-xs text-muted-foreground">{r.legal_name ?? "—"}</p>
      </div>
    ),
  },
  { header: "Registration", cell: (r) => r.registration_number ?? "—" },
  {
    header: "Contact",
    cell: (r) => (
      <div>
        <p>{r.email ?? "—"}</p>
        <p className="figure text-xs text-muted-foreground">{r.mobile ?? "—"}</p>
      </div>
    ),
  },
  { header: "Cluster", cell: (r) => r.clusters?.name ?? "—" },
  { header: "Settlement", cell: (r) => r.settlement_cycle },
  { header: "Status", cell: (r) => <StatusPill value={r.status} /> },
  { header: "Onboarded", align: "right", cell: (r) => shortDate(r.created_at) },
];

function MerchantsPage() {
  const { data, isLoading } = useTable<Row>("merchants", {
    select:
      "id,merchant_code,business_name,legal_name,registration_number,email,mobile,settlement_cycle,status,created_at,clusters(name),parties(accounts(account_number,account_type,wallets(wallet_number)))",
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const { filtered, toolbar } = useDirectoryFilter(data, TEXT, FILTERS);
  return (
    <AdminShell>
      <PageHeader title="Merchants" subtitle="Businesses accepting payments and receiving settlement from the platform." />
      {toolbar}
      <DataTable columns={columns} rows={filtered} onRowClick={(r) => setOpenId(r.id)} loading={isLoading} empty="No merchants registered." />
      <ProfileSheet kind="merchant" id={openId} onClose={() => setOpenId(null)} onOpenUser={setOpenId} />
    </AdminShell>
  );
}

const TEXT = (r: Row) => `${r.business_name} ${r.merchant_code} ${r.legal_name ?? ""} ${r.email ?? ""}`;
const FILTERS: FilterDef<Row>[] = [{ key: "status", label: "Statuses", options: STATUS_OPTIONS, get: (r) => r.status }];
