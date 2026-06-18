import fs from "fs/promises";
import path from "path";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import {
  prepareBillingStatement,
  type GenerateBillingInput,
} from "@/lib/rental-billing-shared";

export type { BillingRentalUnit, GenerateBillingInput } from "@/lib/rental-billing-shared";
export {
  buildUnitDescription,
  formatMonthsCoveredLabel,
  billingDownloadFilename,
} from "@/lib/rental-billing-shared";

const TEMPLATE_PATH = path.join(process.cwd(), "templates", "billing.xlsx");

const BLOCK_ROW_OFFSET = 20;
const COPIES_PER_PAGE = 2;
const PAGE_LAST_ROW = 39;

const TEMPLATE_PRESERVE_PREFIXES = ["xl/drawings/", "xl/media/"] as const;
const TEMPLATE_SHEET_RELS = "xl/worksheets/_rels/sheet1.xml.rels";

const ROW = {
  customer: 7,
  unit: 9,
  monthStart: 10,
  monthEnd: 15,
  total: 16,
  representative: 18,
} as const;

function fillBillingBlock(
  sheet: ExcelJS.Worksheet,
  blockOffset: number,
  data: ReturnType<typeof prepareBillingStatement>
) {
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

/** Trim stacked duplicate pages in older templates (708-row copies). */
function pruneBillingTemplateSheet(sheet: ExcelJS.Worksheet) {
  if (sheet.rowCount > PAGE_LAST_ROW) {
    sheet.spliceRows(PAGE_LAST_ROW + 1, sheet.rowCount - PAGE_LAST_ROW);
  }

  const rows = sheet as ExcelJS.Worksheet & { _rows: unknown[] };
  if (rows._rows.length > PAGE_LAST_ROW) {
    rows._rows.length = PAGE_LAST_ROW;
  }
}

/**
 * ExcelJS rewrites drawings and drops signature crops (srcRect) / breaks imageId 0.
 * Copy the template's drawing + media XML from the original file into the filled workbook.
 */
async function preserveTemplateDrawings(
  templateBuffer: Buffer,
  generatedBuffer: Buffer
): Promise<Buffer> {
  const [templateZip, outZip] = await Promise.all([
    JSZip.loadAsync(templateBuffer),
    JSZip.loadAsync(generatedBuffer),
  ]);

  for (const [filePath, file] of Object.entries(templateZip.files)) {
    if (file.dir) continue;
    if (!TEMPLATE_PRESERVE_PREFIXES.some((prefix) => filePath.startsWith(prefix))) continue;
    outZip.file(filePath, await file.async("nodebuffer"));
  }

  const sheetRels = templateZip.file(TEMPLATE_SHEET_RELS);
  if (sheetRels) {
    outZip.file(TEMPLATE_SHEET_RELS, await sheetRels.async("nodebuffer"));
  }

  return Buffer.from(
    await outZip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" })
  );
}

export async function generateClientBillingExcel(input: GenerateBillingInput): Promise<Buffer> {
  const statement = prepareBillingStatement(input);
  const templateBytes = new Uint8Array(await fs.readFile(TEMPLATE_PATH));
  const templateBuffer = Buffer.from(templateBytes);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBytes);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("Billing template sheet not found");

  pruneBillingTemplateSheet(sheet);

  for (let copy = 0; copy < COPIES_PER_PAGE; copy++) {
    fillBillingBlock(sheet, copy * BLOCK_ROW_OFFSET, statement);
  }

  const generatedBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return preserveTemplateDrawings(templateBuffer, generatedBuffer);
}

