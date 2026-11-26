import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { DataTable, PageHeader, type Column } from "@/components/admin/primitives";
import { useTable } from "@/lib/queries";
import { dateTime } from "@/lib/format";

export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [
      { title: "Audit Trail — CBS Core Ledger" },
      {
        name: "description",
        content: "Append-only audit trail of every action recorded across the core banking platform.",
      },
      { property: "og:title", content: "Audit Trail — CBS Core Ledger" },
      { property: "og:description", content: "Append-only audit trail of platform actions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuditPage,
});

type Row = {
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: unknown;
  created_at: string;
};

const columns: Column<Row>[] = [
  { header: "When", cell: (r) => dateTime(r.created_at) },
  { header: "Action", cell: (r) => <span className="font-medium">{r.action}</span> },
  { header: "Entity", cell: (r) => r.entity_type ?? "—" },
  { header: "Entity ID", cell: (r) => <span className="figure text-xs">{r.entity_id ?? "—"}</span> },
  {
    header: "Metadata",
    cell: (r) => (
      <span className="figure text-xs text-muted-foreground">
        {r.metadata && Object.keys(r.metadata as object).length ? JSON.stringify(r.metadata) : "—"}
      </span>
    ),
  },
];

function AuditPage() {
  const { data, isLoading } = useTable<Row>("audit_logs", {
    select: "action,entity_type,entity_id,metadata,created_at",
    limit: 300,
  });
  return (
    <AdminShell>
      <PageHeader
        title="Audit trail"
        subtitle="Append-only record. Entries cannot be edited or deleted by any portal user."
      />
      <DataTable columns={columns} rows={data} loading={isLoading} empty="No audit events recorded." />
    </AdminShell>
  );
}
