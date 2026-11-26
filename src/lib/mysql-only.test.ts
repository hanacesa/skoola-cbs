import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkMysqlOnly } from "../../scripts/check-mysql-only.mjs";

describe("MySQL-only CBS deployment", () => {
  it("has no Cloud imports or environment requirements in application code", async () => {
    await expect(checkMysqlOnly(process.cwd())).resolves.toBeUndefined();
  });

  it("rejects a Cloud authentication middleware added to CBS startup", async () => {
    const root = await mkdtemp(join(tmpdir(), "cbs-mysql-test-"));
    try {
      await mkdir(join(root, "src"));
      await writeFile(join(root, "src/start.ts"), 'import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";');
      await expect(checkMysqlOnly(root)).rejects.toThrow("src/start.ts");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});