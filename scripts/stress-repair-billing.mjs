import ExcelJS from "exceljs";
import { generateRepairBillingExcelFromTemplate } from "../src/lib/repair-billing-excel.ts";
import fs from "fs/promises";

function makeRepair(i) {
  return {
    brand: "EPSON",
    serialNumber: `SN000000${i}`,
    problem: `Problem ${i}`,
    diagnosis: "RECOVER PRINT HEAD, RESET INK PAD, LABOR",
    totalAmount: 650 + i,
  };
}

const repairs = Array.from({ length: 8 }, (_, i) => makeRepair(i));
const buf = await generateRepairBillingExcelFromTemplate({
  clientName: "CAMAYAHAN ELEMENTARY SCHOOL",
  issueDate: new Date("2026-07-08"),
  lines: [],
  repairs,
});

await fs.writeFile("tmp-stress-repair-billing.xlsx", buf);

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile("tmp-stress-repair-billing.xlsx");
const s = wb.worksheets[0];

console.log("line items expected", repairs.length * 3);
for (let r = 8; r <= 45; r++) {
  const a = s.getCell(`A${r}`).value;
  const c = s.getCell(`C${r}`).value;
  const i = s.getCell(`I${r}`).value;
  if (a || c || i) {
    console.log(r, "| A:", a, "| C:", c, "| I:", i);
  }
}
