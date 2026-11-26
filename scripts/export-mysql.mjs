import { cp, mkdir, access } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { checkMysqlOnly } from "./check-mysql-only.mjs";

const root = process.cwd();
const destination = process.argv[2] ? resolve(process.argv[2]) : null;
if (!destination || !relative(root, destination).startsWith("..")) {
  throw new Error("Usage: npm run export:mysql -- /absolute/path/outside-project/new-cbs-folder");
}
try {
  await access(destination);
  throw new Error("Destination already exists. Choose a new folder; existing files will never be overwritten.");
} catch (error) {
  if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") throw error;
}
await checkMysqlOnly(root);
const excluded = new Set([
  ".git", ".jj", ".lovable", ".oj-cache", "node_modules", "dist", "dist-ssr",
  ".output", ".tanstack", ".nitro", ".wrangler", ".vinxi", "supabase",
  "tsconfig.tsbuildinfo",
]);
await mkdir(destination, { recursive: true });
await cp(root, destination, {
  recursive: true,
  filter: (source) => {
    const parts = relative(root, source).split(/[\\/]/);
    if (parts.some((part) => excluded.has(part) || part === ".dev.vars" || part.startsWith(".env"))) return false;
    return !relative(root, source).replaceAll("\\", "/").startsWith("src/integrations/supabase");
  },
});
console.log(`MySQL-only source exported to ${destination}. Set your existing MySQL, CBS and senangPay environment settings before deployment. No environment files were copied.`);