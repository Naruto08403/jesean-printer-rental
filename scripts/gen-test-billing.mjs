import fs from "fs/promises";
import { createRequire } from "module";

// Use dynamic import for TS - run with: npx tsx scripts/gen-test-billing.mts
// This mjs duplicates minimal generate path
import ExcelJS from "exceljs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const TEMPLATE = path.join(root, "templates", "billing.xlsx");
const PAGE_LAST_ROW = 39;

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(TEMPLATE);
const sheet = wb.worksheets[0];
if (sheet.rowCount > PAGE_LAST_ROW) {
  sheet.spliceRows(PAGE_LAST_ROW + 1, sheet.rowCount - PAGE_LAST_ROW);
}
const out = path.join(root, "tmp-billing-generated.xlsx");
await wb.xlsx.writeBuffer().then((b) => fs.writeFile(out, Buffer.from(b)));
console.log("wrote", out, "images", sheet.getImages().length);
