import ExcelJS from "exceljs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "templates", "repair.xlsx");

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(file);
const s = wb.worksheets[0];
console.log("sheet", s.name, "rows", s.rowCount, "images", s.getImages().length);

for (let r = 1; r <= Math.min(s.rowCount, 100); r++) {
  const row = s.getRow(r);
  const parts = [];
  row.eachCell({ includeEmpty: false }, (cell, col) => {
    const v = cell.value;
    let text;
    if (v && typeof v === "object" && "formula" in v) text = "F:" + v.formula;
    else text = JSON.stringify(v)?.slice(0, 80);
    parts.push(`${String.fromCharCode(64 + col)}${r}:${text}`);
  });
  if (parts.length) console.log(parts.join(" | "));
}
