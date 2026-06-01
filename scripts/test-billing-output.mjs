import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import ExcelJS from "exceljs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// Minimal inline: read template, prune, write (mirrors app)
const TEMPLATE = path.join(root, "templates", "billing.xlsx");
const PAGE_LAST_ROW = 39;
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(TEMPLATE);
const sheet = wb.worksheets[0];
if (sheet.rowCount > PAGE_LAST_ROW) {
  sheet.spliceRows(PAGE_LAST_ROW + 1, sheet.rowCount - PAGE_LAST_ROW);
}
if (sheet._rows.length > PAGE_LAST_ROW) sheet._rows.length = PAGE_LAST_ROW;

const out = path.join(root, "tmp-billing-out.xlsx");
await wb.xlsx.writeFile(out);

const wb2 = new ExcelJS.Workbook();
await wb2.xlsx.readFile(out);
const s2 = wb2.worksheets[0];
console.log("output images", s2.getImages().length);
console.log("sheetProtection", s2.sheetProtection);
for (const img of s2.getImages()) {
  console.log("  row", img.range?.tl?.nativeRow, "col", img.range?.tl?.nativeCol);
}
