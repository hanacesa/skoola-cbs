import { readdir, readFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

export async function checkMysqlOnly(root) {
  const violations = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name);
      const name = relative(root, path).replaceAll("\\", "/");
      // Editor-managed scaffolding is excluded, never imported by CBS.
      if (name === "src/integrations/supabase") continue;
      if (entry.isDirectory()) await walk(path);
      else if (/\.[cm]?[jt]sx?$/.test(entry.name) && !/\.(test|spec)\.[jt]sx?$/.test(entry.name)) {
        const source = await readFile(path, "utf8");
        if (/@supabase\/|integrations\/supabase|attachSupabaseAuth|requireSupabaseAuth|(?:VITE_)?SUPABASE_(?:URL|PUBLISHABLE_KEY|SERVICE_ROLE_KEY)/.test(source)) {
          violations.push(name);
        }
      }
    }
  }
  await walk(resolve(root, "src"));
  if (violations.length) throw new Error(`CBS must use MySQL only. Remove Cloud dependencies from: ${violations.join(", ")}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await checkMysqlOnly(process.cwd());
  console.log("CBS MySQL-only check passed.");
}