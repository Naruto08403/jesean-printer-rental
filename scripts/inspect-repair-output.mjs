import ExcelJS from "exceljs";

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile("tmp-verify-repair-billing.xlsx");
const s = wb.worksheets[0];

console.log("Billing block rows:");
for (let r = 8; r <= 25; r++) {
  const c = s.getCell(`C${r}`).value;
  const a = s.getCell(`A${r}`).value;
  const i = s.getCell(`I${r}`).value;
  if (c || a || i) console.log(r, "A:", a, "| C:", c, "| I:", i);
}
