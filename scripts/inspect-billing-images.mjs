import ExcelJS from "exceljs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

async function inspect(file) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const s = wb.worksheets[0];
  console.log("\n===", path.basename(file), "===");
  console.log("rows", s.rowCount);
  console.log("images", s.getImages().length);
  for (const [i, img] of s.getImages().entries()) {
    const r = img.range;
    const tl = r?.tl;
    const br = r?.br;
    console.log(
      "  img",
      i,
      "tl",
      tl?.nativeRow,
      tl?.nativeCol,
      "br",
      br?.nativeRow,
      br?.nativeCol
    );
  }
  console.log("media", wb.model.media?.length ?? 0);
}

const template = path.join(root, "templates", "billing.xlsx");
await inspect(template);

// simulate generation (splice only)
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(template);
const sheet = wb.worksheets[0];
const PAGE_LAST_ROW = 39;
if (sheet.rowCount > PAGE_LAST_ROW) {
  sheet.spliceRows(PAGE_LAST_ROW + 1, sheet.rowCount - PAGE_LAST_ROW);
}
const out = path.join(root, "tmp-billing-test.xlsx");
await wb.xlsx.writeFile(out);
await inspect(out);

