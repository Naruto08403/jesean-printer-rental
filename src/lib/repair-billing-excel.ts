import fs from "fs/promises";
import path from "path";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { formatCustomerDateLine } from "@/lib/rental-billing-shared";
import type { RepairBillingStatement } from "@/lib/repair-billing";
import {
  buildTemplateLineItems,
  repairBillingLineTotal,
  type RepairBillingRepairRecord,
  type RepairTemplateLineItem,
} from "@/lib/repair-billing-lines";

const TEMPLATE_PATH = path.join(process.cwd(), "templates", "repair.xlsx");

const BLOCK_ROW_OFFSET = 21;
const PAGE_LAST_ROW = 39;
const DEFAULT_LINE_CAPACITY = 7;

const TEMPLATE_PRESERVE_PREFIXES = ["xl/drawings/", "xl/media/"] as const;
const TEMPLATE_SHEET_RELS = "xl/worksheets/_rels/sheet1.xml.rels";

const ROW = {
  customer: 6,
  lineStart: 8,
  lineEnd: 14,
  total: 15,
  representative: 18,
} as const;

type LineRowStyles = {
  primary: CapturedRowStyles;
  continuation: CapturedRowStyles;
};

type CapturedRowStyles = {
  height?: number;
  cellStyles: Record<number, Partial<ExcelJS.Style>>;
};

function captureRowStyles(sheet: ExcelJS.Worksheet, rowNum: number): CapturedRowStyles {
  const cellStyles: Record<number, Partial<ExcelJS.Style>> = {};
  for (let col = 1; col <= 10; col++) {
    cellStyles[col] = structuredClone(sheet.getCell(rowNum, col).style ?? {});
  }
  return {
    height: sheet.getRow(rowNum).height,
    cellStyles,
  };
}

function captureLineRowStyles(sheet: ExcelJS.Worksheet, blockOffset: number): LineRowStyles {
  return {
    primary: captureRowStyles(sheet, ROW.lineStart + blockOffset),
    continuation: captureRowStyles(sheet, ROW.lineStart + 1 + blockOffset),
  };
}

function applyRowStyles(
  sheet: ExcelJS.Worksheet,
  rowNum: number,
  styles: CapturedRowStyles,
  columns: number[]
) {
  if (styles.height != null) {
    sheet.getRow(rowNum).height = styles.height;
  }
  for (const col of columns) {
    const style = styles.cellStyles[col];
    if (style) {
      sheet.getCell(rowNum, col).style = structuredClone(style);
    }
  }
}

function applyLineItemStyles(
  sheet: ExcelJS.Worksheet,
  rowNum: number,
  item: RepairTemplateLineItem,
  lineStyles: LineRowStyles
) {
  const styles = item.isPrimary ? lineStyles.primary : lineStyles.continuation;
  const columns = item.isPrimary ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] : [3, 4, 5, 6, 7, 8, 9, 10];
  applyRowStyles(sheet, rowNum, styles, columns);
}

function pruneRepairTemplateSheet(sheet: ExcelJS.Worksheet) {
  if (sheet.rowCount > PAGE_LAST_ROW) {
    sheet.spliceRows(PAGE_LAST_ROW + 1, sheet.rowCount - PAGE_LAST_ROW);
  }

  const rows = sheet as ExcelJS.Worksheet & { _rows: unknown[] };
  if (rows._rows.length > PAGE_LAST_ROW) {
    rows._rows.length = PAGE_LAST_ROW;
  }
}

function insertExtraLineRows(
  sheet: ExcelJS.Worksheet,
  blockOffset: number,
  lineCount: number
): number {
  const extra = Math.max(0, lineCount - DEFAULT_LINE_CAPACITY);
  if (extra === 0) return 0;

  const totalRow = ROW.total + blockOffset;
  sheet.spliceRows(totalRow, 0, ...new Array(extra).fill([]));
  return extra;
}

function clearLineArea(sheet: ExcelJS.Worksheet, lineStart: number, lineEnd: number) {
  for (let r = lineStart; r <= lineEnd; r++) {
    sheet.getCell(r, 1).value = null;
    sheet.getCell(r, 2).value = null;
    for (let c = 3; c <= 8; c++) sheet.getCell(r, c).value = null;
    sheet.getCell(r, 9).value = null;
    sheet.getCell(r, 10).value = null;
  }
}

function fillRepairBlock(
  sheet: ExcelJS.Worksheet,
  blockOffset: number,
  customerLine: string,
  representative: string,
  items: RepairTemplateLineItem[],
  extraRows: number,
  lineStyles: LineRowStyles
) {
  const customerRow = ROW.customer + blockOffset;
  const lineStart = ROW.lineStart + blockOffset;
  const lineEnd = ROW.lineEnd + blockOffset + extraRows;
  const totalRow = ROW.total + blockOffset + extraRows;
  const repRow = ROW.representative + blockOffset + extraRows;

  sheet.getCell(`A${customerRow}`).value = customerLine;

  clearLineArea(sheet, lineStart, lineEnd);

  items.forEach((item, i) => {
    const r = lineStart + i;

    if (item.unitLabel) {
      sheet.getCell(`A${r}`).value = item.unitLabel;
      sheet.getCell(`B${r}`).value = item.unitLabel;
    } else {
      sheet.getCell(`A${r}`).value = null;
      sheet.getCell(`B${r}`).value = null;
    }
    sheet.getCell(`C${r}`).value = item.description;
    if (item.amount != null) {
      sheet.getCell(`I${r}`).value = item.amount;
      sheet.getCell(`J${r}`).value = item.amount;
    } else {
      sheet.getCell(`I${r}`).value = null;
      sheet.getCell(`J${r}`).value = null;
    }

    applyLineItemStyles(sheet, r, item, lineStyles);
  });

  const total = repairBillingLineTotal(items);

  sheet.getCell(`C${totalRow}`).value = "TOTAL ";
  sheet.getCell(`I${totalRow}`).value = {
    formula: `SUM(I${lineStart}:I${lineEnd})`,
    result: total,
  };
  sheet.getCell(`J${totalRow}`).value = {
    formula: `SUM(J${lineStart}:J${lineEnd})`,
    result: total,
  };

  sheet.getCell(`A${repRow}`).value = representative;
}

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

export type RepairBillingExcelInput = RepairBillingStatement & {
  repairs: RepairBillingRepairRecord[];
  representativeName?: string;
};

export async function generateRepairBillingExcelFromTemplate(
  input: RepairBillingExcelInput
): Promise<Buffer> {
  const representative =
    input.representativeName ??
    process.env.BILLING_REPRESENTATIVE_NAME ??
    "SUNDAY SETH A. ATUEL";

  const customerLine = formatCustomerDateLine(input.clientName, input.issueDate);
  const lineItems = buildTemplateLineItems(input.repairs);

  const templateBytes = new Uint8Array(await fs.readFile(TEMPLATE_PATH));
  const templateBuffer = Buffer.from(templateBytes);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBytes as never);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("Repair billing template sheet not found");

  pruneRepairTemplateSheet(sheet);

  const block1Styles = captureLineRowStyles(sheet, 0);
  const block2Styles = captureLineRowStyles(sheet, BLOCK_ROW_OFFSET);

  const extra1 = insertExtraLineRows(sheet, 0, lineItems.length);
  const block2Offset = BLOCK_ROW_OFFSET + extra1;
  const extra2 = insertExtraLineRows(sheet, block2Offset, lineItems.length);

  fillRepairBlock(sheet, 0, customerLine, representative, lineItems, extra1, block1Styles);
  fillRepairBlock(
    sheet,
    block2Offset,
    customerLine,
    representative,
    lineItems,
    extra2,
    block2Styles
  );

  const generatedBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return preserveTemplateDrawings(templateBuffer, generatedBuffer);
}
