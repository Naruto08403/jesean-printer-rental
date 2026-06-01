import ExcelJS from "exceljs";
import path from "path";
import { fileURLToPath } from "url";

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "templates", "billing.xlsx"));
const sheet = wb.worksheets[0];

for (const entry of sheet._media) {
  if (entry.type !== "image" || entry.imageId !== 0) continue;
  const source = wb.getImage(0);
  console.log("repairing, source", source?.name);
  const newId = wb.addImage({ buffer: source.buffer, extension: source.extension ?? "png" });
  entry.imageId = newId;
  console.log("set to", newId, "now entry.imageId", entry.imageId);
}

for (const m of sheet._media) {
  console.log("after", m.imageId);
}

const buf = await wb.xlsx.writeBuffer();
const wb2 = new ExcelJS.Workbook();
await wb2.xlsx.load(buf);
const rels = await import("fs/promises").then((fs) =>
  fs.readFile(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "tmp-debug.zip"),
    "utf8"
  ).catch(() => null)
);

// quick check drawing
import fs from "fs/promises";
import { execSync } from "child_process";
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "tmp-debug.xlsx");
await fs.writeFile(out, Buffer.from(buf));
execSync(`powershell -Command "Copy-Item '${out}' '${out}.zip'; Expand-Archive '${out}.zip' '${out}-unzip' -Force"`, { stdio: "ignore" });
const drawing = await fs.readFile(path.join(out + "-unzip", "xl", "drawings", "drawing1.xml"), "utf8");
const relsXml = await fs.readFile(path.join(out + "-unzip", "xl", "drawings", "_rels", "drawing1.xml.rels"), "utf8");
console.log(relsXml);
const embeds = [...drawing.matchAll(/r:embed="(rId\d+)"/g)].map((m) => m[1]);
console.log("embeds", embeds);
