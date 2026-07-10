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

const catalog = [
  { name: "Replace Cartridge Magenta", price: 200 },
  { name: "Replace Cartridge Cyan", price: 200 },
  { name: "Recover Print Head", price: 250 },
  { name: "Labor", price: 200 },
  { name: "Reset Ink Pad", price: 150 },
  { name: "Scanner Repair", price: 200 },
  { name: "Sensor Flex Replacement", price: 200 },
];

const buf = await generateRepairBillingPdfFromTemplate({
  clientName: "CAMAYAHAN ELEMENTARY SCHOOL",
  issueDate: new Date("2026-07-08"),
  lines: [],
  repairs,
  diagnosisCatalog: catalog,
});

const out = path.join(root, "tmp-verify-repair-billing.pdf");
await fs.writeFile(out, buf);
console.log("wrote", out, "bytes", buf.length);
