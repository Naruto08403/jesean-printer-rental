import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import ExcelJS from "exceljs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATE = path.join(root, "templates", "billing.xlsx");

function inspect(label, fileOrBuffer) {
  return (async () => {
    const wb = new ExcelJS.Workbook();
    if (Buffer.isBuffer(fileOrBuffer)) {
      await wb.xlsx.load(fileOrBuffer);
    } else {
      await wb.xlsx.readFile(fileOrBuffer);
    }
    const s = wb.worksheets[0];
    console.log(`\n=== ${label} ===`);
    console.log("images", s.getImages().length, "media", wb.model.media?.length);
    for (const [i, img] of s.getImages().entries()) {
      console.log(
        `  ${i}: imageId=${img.imageId} row=${img.range?.tl?.nativeRow} col=${img.range?.tl?.nativeCol} br=${img.range?.br?.nativeRow}`
      );
    }
  })();
}

// Mirror generateClientBillingExcel exactly
const PAGE_LAST_ROW = 39;
const BLOCK_ROW_OFFSET = 20;
const COPIES_PER_PAGE = 2;
const ROW = {
  customer: 7,
  unit: 9,
  monthStart: 10,
  monthEnd: 15,
  total: 16,
  representative: 18,
};

function fillBillingBlock(sheet, blockOffset, data) {
  const customerRow = ROW.customer + blockOffset;
  const unitRow = ROW.unit + blockOffset;
  const totalRow = ROW.total + blockOffset;
  const repRow = ROW.representative + blockOffset;

  sheet.getCell(`A${customerRow}`).value = data.customerLine;
  sheet.getCell(`A${unitRow}`).value = data.unitDescription;
  sheet.getCell(`C${unitRow}`).value = "UNLIMITED PRINTING SERVICES ";

  for (let row = ROW.monthStart; row <= ROW.monthEnd; row++) {
    const r = row + blockOffset;
    sheet.getCell(`C${r}`).value = null;
    sheet.getCell(`I${r}`).value = null;
    sheet.getCell(`J${r}`).value = null;
  }

  data.months.forEach((month, i) => {
    const row = ROW.monthStart + blockOffset + i;
    sheet.getCell(`C${row}`).value = month.label;
    sheet.getCell(`I${row}`).value = month.amount;
    sheet.getCell(`J${row}`).value = month.amount;
  });

  const firstMonthRow = ROW.monthStart + blockOffset;
  const lastMonthRow = ROW.monthStart + blockOffset + data.months.length - 1;

  sheet.getCell(`C${totalRow}`).value = "TOTAL ";
  sheet.getCell(`I${totalRow}`).value = {
    formula: `SUM(I${firstMonthRow}:I${lastMonthRow})`,
    result: data.total,
  };
  sheet.getCell(`J${totalRow}`).value = {
    formula: `SUM(J${firstMonthRow}:J${lastMonthRow})`,
    result: data.total,
  };

  sheet.getCell(`A${repRow}`).value = data.representative;
}

function pruneBillingTemplateSheet(sheet) {
  if (sheet.rowCount > PAGE_LAST_ROW) {
    sheet.spliceRows(PAGE_LAST_ROW + 1, sheet.rowCount - PAGE_LAST_ROW);
  }
  if (sheet._rows.length > PAGE_LAST_ROW) {
    sheet._rows.length = PAGE_LAST_ROW;
  }
}

const data = {
  customerLine: "CUSTOMER: TEST CLIENT",
  unitDescription: "1 HP Printer",
  representative: "SUNDAY SETH A. ATUEL",
  months: [
    { label: "MONTH OF JANUARY", amount: 5000 },
    { label: "MONTH OF FEBRUARY", amount: 5000 },
  ],
  total: 10000,
};

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(TEMPLATE);
const sheet = wb.worksheets[0];
await inspect("template before", TEMPLATE);

// repair (same as app)
for (const entry of sheet._media) {
  if (entry.type !== "image" || entry.imageId !== 0) continue;
  const source = wb.getImage(0);
  if (source?.buffer) {
    entry.imageId = wb.addImage({ buffer: source.buffer, extension: source.extension ?? "png" });
  }
}

pruneBillingTemplateSheet(sheet);
await inspect("after repair+prune", TEMPLATE);

for (let copy = 0; copy < COPIES_PER_PAGE; copy++) {
  fillBillingBlock(sheet, copy * BLOCK_ROW_OFFSET, data);
}

const buffer = await wb.xlsx.writeBuffer();
const outPath = path.join(root, "tmp-billing-export.xlsx");
await fs.writeFile(outPath, Buffer.from(buffer));

await inspect("after writeBuffer", Buffer.from(buffer));
await inspect("saved file", outPath);

// unzip and count drawing anchors
import { execSync } from "child_process";
const zip = path.join(root, "tmp-export.zip");
await fs.copyFile(outPath, zip);
try {
  execSync(
    `powershell -Command "Expand-Archive -Path '${zip.replace(/'/g, "''")}' -DestinationPath '${path.join(root, "tmp-export-unzip").replace(/'/g, "''")}' -Force"`,
    { stdio: "inherit" }
  );
  const drawing = await fs.readFile(
    path.join(root, "tmp-export-unzip", "xl", "drawings", "drawing1.xml"),
    "utf8"
  );
  const anchors = (drawing.match(/oneCellAnchor|twoCellAnchor/g) || []).length;
  console.log("\ndrawing anchors in XML:", anchors);
  console.log("media files:", (await fs.readdir(path.join(root, "tmp-export-unzip", "xl", "media"))).join(", "));
} catch (e) {
  console.log("unzip skip", e.message);
}
