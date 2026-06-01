import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// dynamic import ts module
const { generateClientBillingExcel } = await import("../src/lib/rental-billing-excel.ts");

const buf = await generateClientBillingExcel({
  clientName: "Test Client",
  issueDate: new Date("2025-06-01"),
  year: 2025,
  startMonth: 0,
  endMonth: 1,
  rentals: [
    {
      status: "ACTIVE",
      ratePerPeriod: 5000,
      paymentSchedule: "MONTHLY",
      printer: { brand: "HP", model: "L120", status: "RENTED", price: null },
    },
  ],
});

const out = path.join(root, "tmp-verify-billing.xlsx");
await fs.writeFile(out, buf);

const zip = out + ".zip";
await fs.copyFile(out, zip);
const unzipDir = out + "-unzip";
execSync(`powershell -Expand-Archive -Path "${zip}" -DestinationPath "${unzipDir}" -Force`, {
  stdio: "ignore",
});

const drawing = await fs.readFile(path.join(unzipDir, "xl", "drawings", "drawing1.xml"), "utf8");
const srcRectCount = (drawing.match(/srcRect/g) || []).length;
const anchors = (drawing.match(/oneCellAnchor|twoCellAnchor/g) || []).length;
const rels = await fs.readFile(
  path.join(unzipDir, "xl", "drawings", "_rels", "drawing1.xml.rels"),
  "utf8"
);

console.log("anchors", anchors, "srcRect tags", srcRectCount);
console.log("rels", rels.replace(/\s+/g, " ").trim());
console.log("OK:", srcRectCount >= 2 && anchors === 4 ? "signatures preserved" : "FAILED");
