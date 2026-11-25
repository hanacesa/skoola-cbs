import { createFileRoute } from "@tanstack/react-router";

import { requireCbsApiClient } from "@/lib/cbs-api.functions";
import { apiError } from "@/lib/wallet-reload.server";

/** GET /api/v1/payment-providers — switched-on providers; the first one is the default for reloads. */
export const Route = createFileRoute("/api/v1/payment-providers")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          requireCbsApiClient(request);
          const { query } = await import("@/lib/mysql.server");
          const providers = await query<{ id: string; code: string; name: string; environment: string; priority: number; currency: string }>(
            `SELECT id, code, name, environment, priority, currency FROM payment_providers
              WHERE enabled = 1 AND status = 'ACTIVE' ORDER BY priority ASC, created_at ASC`,
          );
          const methods = await query<{ provider_id: string; code: string; name: string }>(
            "SELECT provider_id, code, name FROM payment_methods WHERE enabled = 1",
          ).catch(() => [] as { provider_id: string; code: string; name: string }[]);
          return Response.json({
            success: true,
            defaultProviderCode: providers[0]?.code ?? null,
            providers: providers.map((p, i) => ({
              code: p.code,
              name: p.name,
              environment: p.environment,
              priority: p.priority,
              currency: p.currency,
              isDefault: i === 0,
              methods: methods.filter((m) => m.provider_id === p.id).map((m) => ({ code: m.code, name: m.name })),
            })),
          });
        } catch (error) {
          return apiError(error);
        }
      },
    },
  },
});
