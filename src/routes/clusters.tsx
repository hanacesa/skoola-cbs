import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { DataTable, PageHeader, StatusPill, type Column } from "@/components/admin/primitives";
import { useState } from "react";
import { useTable } from "@/lib/queries";
import { ProfileSheet, STATUS_OPTIONS, useDirectoryFilter, type FilterDef } from "@/components/admin/directory";
import { shortDate } from "@/lib/format";

export const Route = createFileRoute("/clusters")({
  head: () => ({
    meta: [
      { title: "Clusters — CBS Core Ledger" },
      {
        name: "description",
        content: "Regional clusters grouping users and merchants beneath each organization.",
      },
      { property: "og:title", content: "Clusters — CBS Core Ledger" },
      { property: "og:description", content: "Regional clusters beneath each organization." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClustersPage,
});

type Row = {
  id: string;
  code: string;
  name: string;
  region: string | null;
  status: string;
  created_at: string;
  organizations: { name: string } | null;
};

const columns: Column<Row>[] = [
  { header: "Code", cell: (r) => <span className="figure text-xs">{r.code}</span> },
  { header: "Cluster", cell: (r) => <span className="font-medium">{r.name}</span> },
  { header: "Organization", cell: (r) => r.organizations?.name ?? "—" },
  { header: "Region", cell: (r) => r.region ?? "—" },
  { header: "Status", cell: (r) => <StatusPill value={r.status} /> },
  { header: "Created", align: "right", cell: (r) => shortDate(r.created_at) },
];

function ClustersPage() {
  const { data, isLoading } = useTable<Row>("clusters", {
    select: "id,code,name,region,status,created_at,organizations(name)",
    orderBy: "code",
    ascending: true,
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const { filtered, toolbar } = useDirectoryFilter(data, TEXT, FILTERS);
  return (
    <AdminShell>
      <PageHeader title="Clusters" subtitle="Operational groupings used for regional reporting and settlement routing." />
      {toolbar}
      <DataTable columns={columns} rows={filtered} onRowClick={(r) => setOpenId(r.id)} loading={isLoading} empty="No clusters defined." />
      <ProfileSheet kind="cluster" id={openId} onClose={() => setOpenId(null)} onOpenUser={setOpenId} />
    </AdminShell>
  );
}

const TEXT = (r: Row) => `${r.name} ${r.code} ${r.organizations?.name ?? ""} ${r.region ?? ""}`;
const FILTERS: FilterDef<Row>[] = [{ key: "status", label: "Statuses", options: STATUS_OPTIONS, get: (r) => r.status }];
