import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { generateRepairBillingPdfFromTemplate } = await import("../src/lib/repair-billing-pdf.ts");

const repairs = [
  {
    brand: "EPSON",
    serialNumber: "X9LV474419",
    problem: "Cartridge issue",
    diagnosis: "REPLACE CARTRIDGE MAGENTA AND CYAN, RECOVER PRINT HEAD, LABOR",
    totalAmount: 650,
  },
  {
    brand: "EPSON",
    serialNumber: "X5NY104948",
    problem: "Print head",
    diagnosis: "RECOVER PRINT HEAD, RESET INK PAD, LABOR",
    totalAmount: 850,
  },
  {
    brand: "EPSON",
    serialNumber: "X5EN028842",
    problem: "Ink pad",
    diagnosis: "RECOVER PRINT HEAD, RESET INK PAD, LABOR",
    totalAmount: 750,
  },
  {
    brand: "EPSON",
    serialNumber: "X8HV104948",
    problem: "Scanner",
    diagnosis: "SCANNER REPAIR, SENSOR FLEX REPLACEMENT, RESET INK PAD, LABOR",
    totalAmount: 750,
  },
  {
    brand: "EPSON",
    serialNumber: "XAGMO42371",
    problem: "Sensor",
    diagnosis: "SCANNER REPAIR, SENSOR FLEX REPLACEMENT, RESET INK PAD, LABOR",
    totalAmount: 1150,
  },
];

const buf = await generateRepairBillingPdfFromTemplate({
  clientName: "CAMAYAHAN ELEMENTARY SCHOOL",
  issueDate: new Date("2026-07-08"),
  lines: [],
  repairs,
});

const out = path.join(root, "tmp-verify-repair-billing.pdf");
await fs.writeFile(out, buf);
console.log("wrote", out, "bytes", buf.length);
