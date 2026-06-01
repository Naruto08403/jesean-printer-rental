import ExcelJS from "exceljs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatePath = path.join(__dirname, "..", "templates", "billing.xlsx");
const PAGE_LAST_ROW = 39;

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(templatePath);
const sheet = wb.worksheets[0];

if (sheet.rowCount > PAGE_LAST_ROW) {
  sheet.spliceRows(PAGE_LAST_ROW + 1, sheet.rowCount - PAGE_LAST_ROW);
}
if (sheet._rows.length > PAGE_LAST_ROW) {
  sheet._rows.length = PAGE_LAST_ROW;
}

await wb.xlsx.writeFile(templatePath);
console.log("Updated", templatePath, "images kept:", sheet.getImages().length);
