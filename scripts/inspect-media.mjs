import ExcelJS from "exceljs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(path.join(root, "templates", "billing.xlsx"));

console.log("workbook.media length", wb.media?.length ?? wb.model?.media?.length);
const media = wb.media ?? wb.model.media;
media?.forEach((m, i) => {
  console.log("media", i, m.name, m.extension, m.type, "buffer?", !!m.buffer);
});

const sheet = wb.worksheets[0];
for (const img of sheet.getImages()) {
  console.log("img imageId", img.imageId, "->", media?.[img.imageId]?.name);
}
