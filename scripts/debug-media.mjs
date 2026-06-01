import ExcelJS from "exceljs";
import path from "path";
import { fileURLToPath } from "url";

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "templates", "billing.xlsx"));
const sheet = wb.worksheets[0];
console.log("_media", sheet._media?.length);
for (const m of sheet._media) {
  console.log("entry", m.type, "imageId", m.imageId, "model", m.model?.imageId);
}
