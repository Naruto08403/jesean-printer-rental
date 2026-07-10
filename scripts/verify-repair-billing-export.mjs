import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const { generateRepairBillingExcelFromTemplate } = await import(
  "../src/lib/repair-billing-excel.ts"
);

const buf = await generateRepairBillingExcelFromTemplate({
  clientName: "AFTECH",
  issueDate: new Date("2025-06-01"),
  lines: [],
  repairs: [
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
      brand: "HP",
      serialNumber: "ABC123",
      problem: "Paper jam",
      diagnosis: null,
      totalAmount: 500,
    },
  ],
});

const out = path.join(root, "tmp-verify-repair-billing.xlsx");
await fs.writeFile(out, buf);

const zip = out + ".zip";
await fs.copyFile(out, zip);
const unzipDir = out + "-unzip";
execSync(`powershell -Expand-Archive -Path "${zip}" -DestinationPath "${unzipDir}" -Force`, {
  stdio: "ignore",
});

const drawing = await fs.readFile(
  path.join(unzipDir, "xl", "drawings", "drawing1.xml"),
  "utf8"
);
const srcRectCount = (drawing.match(/srcRect/g) || []).length;
const anchors = (drawing.match(/oneCellAnchor|twoCellAnchor/g) || []).length;

console.log("wrote", out, "bytes", buf.length);
console.log("drawing anchors", anchors, "srcRect", srcRectCount);
