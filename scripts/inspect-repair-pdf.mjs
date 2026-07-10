import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { PDFDocument } from "pdf-lib";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "templates", "repair_template.pdf");
const bytes = await fs.readFile(file);
const pdf = await PDFDocument.load(bytes);

console.log("pages", pdf.getPageCount());
for (let i = 0; i < pdf.getPageCount(); i++) {
  const page = pdf.getPage(i);
  const { width, height } = page.getSize();
  console.log(`page ${i + 1}: ${width} x ${height}`);
}
