import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireCbsApiClient, requireWalletOwnership } from "@/lib/cbs-api.functions";
import { apiError, startReload } from "@/lib/wallet-reload.server";

const Body = z.object({
  walletNumber: z.string().trim().min(1).max(40).optional(),
  amount: z.coerce.number().positive().max(100000),
  providerCode: z.string().trim().max(40).optional(),
  methodCode: z.string().trim().max(40).optional(),
  reference: z.string().trim().regex(/^[A-Za-z0-9-]{6,60}$/).optional(),
  description: z.string().trim().max(200).optional(),
  returnUrl: z.string().url().max(500).optional(),
});

/** POST /api/v1/wallets/reload — open a top-up with the chosen (or default) provider. */
export const Route = createFileRoute("/api/v1/wallets/reload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const caller = requireCbsApiClient(request);
          const parsed = Body.safeParse(await request.json().catch(() => ({})));
          if (!parsed.success) {
            return Response.json({ success: false, message: parsed.error.issues[0]?.message ?? "Invalid body." }, { status: 400 });
          }
          const body = parsed.data;
          const walletNumber = body.walletNumber ?? (caller.type === "USER" ? caller.walletNumber : null);
          if (!walletNumber) return Response.json({ success: false, message: "walletNumber is required." }, { status: 400 });
          if (caller.type === "USER") requireWalletOwnership(caller, walletNumber);

          const result = await startReload({
            walletNumber,
            amount: body.amount,
            providerCode: body.providerCode ?? null,
            methodCode: body.methodCode ?? null,
            reference: body.reference ?? null,
            description: body.description ?? null,
            returnUrl: body.returnUrl ?? null,
            actorId: caller.type === "USER" ? caller.userId : null,
          });
          return Response.json({ success: true, ...result }, { status: 201 });
        } catch (error) {
          return apiError(error);
        }
      },
    },
  },
});
