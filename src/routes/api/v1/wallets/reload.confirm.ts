import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireCbsApiClient, requireWalletOwnership } from "@/lib/cbs-api.functions";
import { apiError, confirmReload, intentByReference } from "@/lib/wallet-reload.server";

/** POST /api/v1/wallets/reload/confirm — check with the provider and credit the wallet once paid. */
export const Route = createFileRoute("/api/v1/wallets/reload/confirm")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const caller = requireCbsApiClient(request);
          const parsed = z
            .object({ reference: z.string().trim().min(1).max(60) })
            .safeParse(await request.json().catch(() => ({})));
          if (!parsed.success) return Response.json({ success: false, message: "reference is required." }, { status: 400 });
          const intent = await intentByReference(parsed.data.reference);
          if (caller.type === "USER") requireWalletOwnership(caller, intent.wallet_number);
          const result = await confirmReload(parsed.data.reference, caller.type === "USER" ? caller.userId : null);
          const { one } = await import("@/lib/mysql.server");
          const w = await one<{ available_balance: string; currency: string }>(
            "SELECT available_balance, currency FROM wallets WHERE id = ?",
            [intent.wallet_id],
          );
          return Response.json({
            success: true,
            ...result,
            walletNumber: intent.wallet_number,
            availableBalance: Number(w?.available_balance ?? 0),
            currency: w?.currency ?? intent.currency,
          });
        } catch (error) {
          return apiError(error);
        }
      },
    },
  },
});
