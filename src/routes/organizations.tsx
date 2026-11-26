import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { DataTable, PageHeader, StatusPill, type Column } from "@/components/admin/primitives";
import { useState } from "react";
import { useTable } from "@/lib/queries";
import { ProfileSheet, STATUS_OPTIONS, useDirectoryFilter, type FilterDef } from "@/components/admin/directory";
import { shortDate } from "@/lib/format";

export const Route = createFileRoute("/organizations")({
  head: () => ({
    meta: [
      { title: "Organizations — CBS Core Ledger" },
      {
        name: "description",
        content: "Registered institutions, their currency, timezone and operating status.",
      },
      { property: "og:title", content: "Organizations — CBS Core Ledger" },
      { property: "og:description", content: "Registered institutions and their operating status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrganizationsPage,
});

type Row = {
  id: string;
  code: string;
  name: string;
  legal_name: string | null;
  registration_number: string | null;
  email: string | null;
  currency: string;
  timezone: string;
  status: string;
  created_at: string;
};

const columns: Column<Row>[] = [
  { header: "Code", cell: (r) => <span className="figure text-xs">{r.code}</span> },
  {
    header: "Organization",
    cell: (r) => (
      <div>
        <p className="font-medium">{r.name}</p>
        <p className="text-xs text-muted-foreground">{r.legal_name ?? "—"}</p>
      </div>
    ),
  },
  { header: "Registration", cell: (r) => r.registration_number ?? "—" },
  { header: "Contact", cell: (r) => r.email ?? "—" },
  { header: "Currency", cell: (r) => <span className="figure">{r.currency}</span> },
  { header: "Timezone", cell: (r) => r.timezone },
  { header: "Status", cell: (r) => <StatusPill value={r.status} /> },
  { header: "Onboarded", align: "right", cell: (r) => shortDate(r.created_at) },
];

function OrganizationsPage() {
  const { data, isLoading } = useTable<Row>("organizations", { orderBy: "name", ascending: true });
  const [openId, setOpenId] = useState<string | null>(null);
  const { filtered, toolbar } = useDirectoryFilter(data, TEXT, FILTERS);
  return (
    <AdminShell>
      <PageHeader
        title="Organizations"
        subtitle="Top level of the registration hierarchy. Every cluster, user and merchant belongs to an organization."
      />
      {toolbar}
      <DataTable columns={columns} rows={filtered} onRowClick={(r) => setOpenId(r.id)} loading={isLoading} empty="No organizations registered." />
      <ProfileSheet kind="organization" id={openId} onClose={() => setOpenId(null)} onOpenUser={setOpenId} />
    </AdminShell>
  );
}

const TEXT = (r: Row) => `${r.name} ${r.code} ${r.legal_name ?? ""}`;
const FILTERS: FilterDef<Row>[] = [{ key: "status", label: "Statuses", options: STATUS_OPTIONS, get: (r) => r.status }];
