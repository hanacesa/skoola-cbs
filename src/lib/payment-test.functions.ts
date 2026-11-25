import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Admin-only: send a test charge through any connected provider (sandbox or live). No ledger posting. */
export const runTestPayment = createServerFn({ method: "POST" })
  .inputValidator((input: { providerId: string; amount: number; methodCode?: string }) =>
    z
      .object({
        providerId: z.string().uuid(),
        amount: z.number().min(0.01).max(100000),
        methodCode: z.string().trim().max(40).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const m = await import("./mysql.server");
    const staff = await m.requireAdmin();
    const { createProviderCharge } = await import("./payment-gateway.server");
    const provider = await m.one("SELECT * FROM payment_providers WHERE id = ?", [data.providerId]);
    if (!provider) throw new Error("Provider not found.");
    const reference = m.makeReference("TEST");
    try {
      const result = await createProviderCharge(provider as never, {
        reference,
        amount: data.amount,
        currency: String((provider as { currency?: string }).currency ?? "MYR"),
        methodCode: data.methodCode || null,
        description: "CBS plug-and-play test payment",
      });
      await m.audit(staff.id, "TEST_PAYMENT", "payment_providers", data.providerId, { reference, status: result.status });
      return {
        ok: true as const,
        reference,
        status: result.status,
        checkoutUrl: result.checkoutUrl,
        providerReference: result.providerReference,
        simulated: result.simulated,
        raw: JSON.stringify(result.raw ?? null, null, 2).slice(0, 4000),
      };
    } catch (error) {
      return { ok: false as const, reference, error: error instanceof Error ? error.message : "Test payment failed." };
    }
  });
