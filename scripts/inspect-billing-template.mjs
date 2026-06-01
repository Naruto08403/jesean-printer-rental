import ExcelJS from "exceljs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

async function inspect(file) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const s = wb.worksheets[0];
  console.log("\n===", path.basename(file), "===");
  console.log("rows", s.rowCount, "_rows", s._rows.length);
  console.log("images", s.getImages().length);
  for (const [i, img] of s.getImages().entries()) {
    const tl = img.range?.tl;
    const br = img.range?.br;
    console.log(
      "  img",
      i,
      "imageId",
      img.imageId,
      "tl row/col",
      tl?.nativeRow,
      tl?.nativeCol,
      "br",
      br?.nativeRow,
      br?.nativeCol,
      "editAs",
      img.range?.editAs
    );
  }
  console.log("media", wb.model.media?.length ?? 0);

  // protected / sheet protection
  console.log("sheetProtection", JSON.stringify(s.sheetProtection));
  console.log("properties", s.properties);

  for (const row of [11, 12, 18, 19, 31, 32, 38, 39]) {
    const r = s.getRow(row);
    const parts = [];
    r.eachCell({ includeEmpty: false }, (cell, col) => {
      if (col <= 5) parts.push(`${col}:${JSON.stringify(cell.value)?.slice(0, 40)}`);
    });
    if (parts.length) console.log("R" + row, parts.join(" | "));
  }
}

for (const f of ["templates/billing.xlsx", "Data/billing.xlsx"]) {
  const p = path.join(root, f);
  try {
    await inspect(p);
  } catch (e) {
    console.log(f, e.message);
  }
}
