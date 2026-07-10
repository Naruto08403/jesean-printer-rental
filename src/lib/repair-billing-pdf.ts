import fs from "fs/promises";
import path from "path";
import { TextAlignment, PDFForm, PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import type { RepairBillingStatement } from "@/lib/repair-billing";
import {
  buildBillingStatementLineItems,
  buildJobOrderLineItems,
  padLineItems,
  repairBillingLineTotal,
  type DiagnosisPriceEntry,
  type RepairBillingRepairRecord,
  type RepairTemplateLineItem,
} from "@/lib/repair-billing-lines";
import fontkit from "@pdf-lib/fontkit";
const TEMPLATE_PATH = path.join(process.cwd(), "templates", "repair_template.pdf");

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;

/** Keep template header (logo, company info, title). Content below is redrawn. */
const HEADER_BOTTOM_Y = 660;

const MARGIN_X = 36;
const TABLE_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const COL_UNIT = 118;
const COL_PRICE = 88;
const COL_DESC = TABLE_WIDTH - COL_UNIT - COL_PRICE;

const ROW_HEIGHT = 16;
const DESC_LINE_HEIGHT = 10;
const TABLE_HEADER_HEIGHT = 18;

/** Space reserved at bottom for total + received note + signatures. */
const FOOTER_BLOCK_HEIGHT = 118;

const COLOR_HEADER_FILL = rgb(0.718, 0.835, 0.714);
const COLOR_BORDER = rgb(0.45, 0.55, 0.45);
const COLOR_TEXT = rgb(0.1, 0.1, 0.1);
let index = 0;
let totalIndex = 0;

const MIN_ROWS = 5;

type Fonts = {
  regular: PDFFont;
  bold: PDFFont;
};

type PageLayout = {
  bodyTopY: number;
  bodyBottomY: number;
};

export type RepairBillingPdfInput = RepairBillingStatement & {
  repairs: RepairBillingRepairRecord[];
  diagnosisCatalog?: DiagnosisPriceEntry[];
  billingStatementItems?: RepairTemplateLineItem[];
  jobOrderItems?: RepairTemplateLineItem[];
  representativeName?: string;
  documentTitle?: string;
};

function formatPrice(amount: number) {
  return amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatIssueDate(d: Date) {
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

function truncateText(text: string, font: PDFFont, size: number, maxWidth: number) {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let trimmed = text;
  while (trimmed.length > 1 && font.widthOfTextAtSize(`${trimmed}…`, size) > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}…`;
}

function itemRowHeight(item: RepairTemplateLineItem) {
  const lineCount = Math.max(1, item.description.split("\n").length);
  return ROW_HEIGHT + (lineCount - 1) * DESC_LINE_HEIGHT;
}

function drawCenteredText(
  page: PDFPage,
  text: string,
  x: number,
  width: number,
  y: number,
  font: PDFFont,
  size: number,
  color = COLOR_TEXT
) {
  const textWidth = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: x + (width - textWidth) / 2,
    y,
    size,
    font,
    color,
  });
}

function drawRightText(
  page: PDFPage,
  text: string,
  x: number,
  width: number,
  y: number,
  font: PDFFont,
  size: number,
  color = COLOR_TEXT
) {
  const textWidth = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: x + width - textWidth - 4,
    y,
    size,
    font,
    color,
  });
}

function clearDynamicArea(page: PDFPage) {
  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: HEADER_BOTTOM_Y,
    color: rgb(1, 1, 1),
  });
}

function drawCustomerLine(
  page: PDFPage,
  clientName: string,
  issueDate: Date,
  fonts: Fonts,
  y: number
) {
  const customer = `CUSTOMER: ${clientName.toUpperCase()}`;
  const date = `DATE:${formatIssueDate(issueDate)}`;
  page.drawText(customer, { x: MARGIN_X, y, size: 10, font: fonts.regular, color: COLOR_TEXT });
  drawRightText(page, date, MARGIN_X, TABLE_WIDTH, y, fonts.regular, 10);
}

function drawTableHeader(page: PDFPage, fonts: Fonts, y: number) {
  page.drawRectangle({
    x: MARGIN_X,
    y: y - 15,
    width: TABLE_WIDTH,
    height: TABLE_HEADER_HEIGHT,
    color: COLOR_HEADER_FILL,
    borderColor: COLOR_BORDER,
    borderWidth: 0.75,
  });
  y -= 8;

  drawCenteredText(page, "UNIT", MARGIN_X, COL_UNIT, y, fonts.bold, 9);
  drawCenteredText(page, "Description", MARGIN_X + COL_UNIT, COL_DESC, y, fonts.bold, 9);
  drawCenteredText(page, "Price", MARGIN_X + COL_UNIT + COL_DESC, COL_PRICE, y, fonts.bold, 9);
}
function addPriceField(
  form: PDFForm,
  page: PDFPage,
  name: string,
  value: number | null,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const field = form.createTextField(name);
  field.setAlignment(TextAlignment.Center);
  field.setText(value != null ? formatPrice(value) : "");

  field.addToPage(page, {
    x,
    y,
    width,
    height,
    borderWidth: 0,
  });

  field.setFontSize(8);
}

function drawTableRow(
  page: PDFPage,
  item: RepairTemplateLineItem,
  fonts: Fonts,
  y: number,
  form: PDFForm,
  rowIndex: number
) {
  const descLines = item.description ? item.description.split("\n") : [""];
  const rowHeight = itemRowHeight(item);
  const rowBottom = y - rowHeight + 2;

  page.drawRectangle({
    x: MARGIN_X,
    y: rowBottom,
    width: TABLE_WIDTH,
    height: rowHeight,
    borderColor: COLOR_BORDER,
    borderWidth: 0.5,
  });

  page.drawLine({
    start: { x: MARGIN_X + COL_UNIT, y: rowBottom },
    end: { x: MARGIN_X + COL_UNIT, y: rowBottom + rowHeight },
    color: COLOR_BORDER,
    thickness: 0.5,
  });
  page.drawLine({
    start: { x: MARGIN_X + COL_UNIT + COL_DESC, y: rowBottom },
    end: { x: MARGIN_X + COL_UNIT + COL_DESC, y: rowBottom + rowHeight },
    color: COLOR_BORDER,
    thickness: 0.5,
  });

  const midY = rowBottom + rowHeight / 2 - 3;
  if (item.unitLabel) {
    const unit = truncateText(item.unitLabel, fonts.regular, 8, COL_UNIT - 8);
    drawCenteredText(page, unit, MARGIN_X, COL_UNIT, midY, fonts.regular, 8);
  }

  const descTopY = y - 11;
  descLines.forEach((line, index) => {
    const desc = truncateText(line, fonts.regular, 8, COL_DESC - 8);
    drawCenteredText(
      page,
      desc,
      MARGIN_X + COL_UNIT,
      COL_DESC,
      descTopY - index * DESC_LINE_HEIGHT,
      fonts.regular,
      8
    );
  });

  if (item.amount != null) {
    // drawCenteredText(
    //   page,
    //   formatPrice(item.amount),
    //   MARGIN_X + COL_UNIT + COL_DESC,
    //   COL_PRICE,
    //   midY,
    //   fonts.regular,
    //   8
    // );
    index++;

    addPriceField(
      form,
      page,
      `price_${index}`,
      item.amount,
      MARGIN_X + COL_UNIT + COL_DESC + 2,
      rowBottom + 2,
      COL_PRICE - 4,
      rowHeight - 4
  );
  }
}
function documentHeight(items: RepairTemplateLineItem[]) {
  return (
      TABLE_HEADER_HEIGHT +
      items.reduce((h, item) => h + itemRowHeight(item), 0) +
      TABLE_HEADER_HEIGHT + // total row
      FOOTER_BLOCK_HEIGHT
  );
}

function drawTotalRow(page: PDFPage, fonts: Fonts, y: number, total: number, form: PDFForm) {
  page.drawRectangle({
    x: MARGIN_X,
    y: y - 11,
    width: TABLE_WIDTH,
    height: TABLE_HEADER_HEIGHT,
    color: COLOR_HEADER_FILL,
    borderColor: COLOR_BORDER,
    borderWidth: 0.75,
  });
  y -= 8;
  drawCenteredText(page, "TOTAL", MARGIN_X + COL_UNIT, COL_DESC, y, fonts.bold, 9);
//   drawCenteredText(
//     page,
//     formatPrice(total),
//     MARGIN_X + COL_UNIT + COL_DESC,
//     COL_PRICE,
//     y,
//     fonts.bold,
//     9
//   );
  totalIndex++;
  const totalField = form.createTextField(`grand_total_${totalIndex}`);
  totalField.setAlignment(TextAlignment.Center);

totalField.setText(formatPrice(total));

totalField.addToPage(page, {
    x: MARGIN_X + COL_UNIT + COL_DESC + 2,
    y: y ,
    width: COL_PRICE - 4,
    height: 14,
    borderWidth: 0,
    backgroundColor: COLOR_HEADER_FILL
});

totalField.setFontSize(9);
}

function drawFooterBlock(page: PDFPage, fonts: Fonts, y: number, representative: string) {
  page.drawText("Received the above unit in good order and condition.", {
    x: MARGIN_X + 180,
    y: y,
    size: 8,
    font: fonts.regular,
    color: COLOR_TEXT,
  });
  y -= 80;

  page.drawText(representative, {
    x: MARGIN_X + 8,
    y: y + 8,
    size: 9,
    font: fonts.bold,
    color: COLOR_TEXT,
  });
  page.drawLine({
    start: {
      x: MARGIN_X + 8,
      y: y + 8 - 2,
    },
    end: {
      x: MARGIN_X + 8 + 110,
      y: y + 8 - 2,
    },
    thickness: 0.5,
    color: COLOR_TEXT,
  });
  page.drawText("JESEAN Representative", {
    x: MARGIN_X + 8,
    y: y - 6,
    size: 8,
    font: fonts.regular,
    color: COLOR_TEXT,
  });

  page.drawText("Received by:", {
    x: MARGIN_X + TABLE_WIDTH - 150,
    y: y + 54,
    size: 8,
    font: fonts.regular,
    color: COLOR_TEXT,
  });
  page.drawLine({
    start: { x: MARGIN_X + TABLE_WIDTH - 170, y: y + 12 },
    end: { x: MARGIN_X + TABLE_WIDTH - 8, y: y + 12 },
    color: COLOR_TEXT,
    thickness: 0.5,
  });
  page.drawText("Signature over Printed Name", {
    x: MARGIN_X + TABLE_WIDTH - 168,
    y: y - 2,
    size: 7,
    font: fonts.regular,
    color: COLOR_TEXT,
  });
}

function bodyBounds(): PageLayout {
  const bodyTopY = HEADER_BOTTOM_Y - 24;
  const bodyBottomY = FOOTER_BLOCK_HEIGHT + TABLE_HEADER_HEIGHT + 8;
  return { bodyTopY, bodyBottomY };
}

function availableBodyHeight(layout: PageLayout) {
  return layout.bodyTopY - layout.bodyBottomY;
}

function paginateItems(items: RepairTemplateLineItem[], maxHeight: number) {
  const pages: RepairTemplateLineItem[][] = [];
  let current: RepairTemplateLineItem[] = [];
  let used = 0;

  for (const item of items) {
    const height = itemRowHeight(item);
    if (current.length > 0 && used + height > maxHeight) {
      pages.push(current);
      current = [item];
      used = height;
      continue;
    }
    current.push(item);
    used += height;
  }

  if (current.length > 0) pages.push(current);
  return pages.length > 0 ? pages : [[]];
}

async function createStatementPage(
  pdf: PDFDocument,
  templateDoc: PDFDocument,
  form: PDFForm,
  fonts: Fonts,
  input: {
    clientName: string;
    issueDate: Date;
    representative: string;
    documentTitle: string;
    pageItems: RepairTemplateLineItem[];
    pageTotal: number;
    isLastPage: boolean;
    showContinued: boolean;
  }
) {
  const [templatePage] = await pdf.copyPages(templateDoc, [0]);
  pdf.addPage(templatePage);
  pdf.registerFontkit(fontkit);

  const centuryBytes = await fs.readFile(
    path.join(process.cwd(), "fonts", "CenturyGothic-Bold.ttf")
  );

  const centuryBold = await pdf.embedFont(centuryBytes);
  const page = pdf.getPages()[pdf.getPageCount() - 1]!;

  clearDynamicArea(page);

  const layout = bodyBounds();
  let y = layout.bodyTopY;

  // if (input.showContinued) {
  //   drawCenteredText(
  //     page,
  //     `${input.documentTitle} (continued)`,
  //     MARGIN_X,
  //     TABLE_WIDTH,
  //     y + 10,
  //     fonts.bold,
  //     10
  //   );
  //   y -= 8;
  // }
  const title = input.showContinued
  ? `${input.documentTitle} (continued)`
  : input.documentTitle;

  drawCenteredText(
    page,
    title,
    MARGIN_X,
    TABLE_WIDTH,
    y + 10,
    centuryBold,
  15
  );

  y -= 8;

  drawCustomerLine(page, input.clientName, input.issueDate, fonts, y);
  y -= 18;
  drawTableHeader(page, fonts, y);
  y -= ROW_HEIGHT;

  for (let i = 0; i < input.pageItems.length; i++) {
    const item = input.pageItems[i];
    drawTableRow(page, item, fonts, y, form, i);
    y -= itemRowHeight(item);
  }

  if (input.isLastPage) {
    y -= 4;
    drawTotalRow(page, fonts, y, input.pageTotal, form);
    drawFooterBlock(page, fonts, y - 28, input.representative);
  }
}

async function appendDocumentPages(
  pdf: PDFDocument,
  templateDoc: PDFDocument,
  form: PDFForm,
  fonts: Fonts,
  input: {
    clientName: string;
    issueDate: Date;
    representative: string;
    documentTitle: string;
    lineItems: RepairTemplateLineItem[];
    pageTotal: number;
  }
) {
  const layout = bodyBounds();
  const pages = paginateItems(input.lineItems, availableBodyHeight(layout));

  for (let i = 0; i < pages.length; i++) {
    await createStatementPage(pdf, templateDoc, form, fonts, {
      clientName: input.clientName,
      issueDate: input.issueDate,
      representative: input.representative,
      documentTitle: input.documentTitle,
      pageItems: pages[i]!,
      pageTotal: input.pageTotal,
      isLastPage: i === pages.length - 1,
      showContinued: i > 0,
    });
  }
}

export async function generateRepairBillingPdfFromTemplate(
  input: RepairBillingPdfInput
): Promise<Buffer> {
  const representative =
    input.representativeName ??
    process.env.BILLING_REPRESENTATIVE_NAME ??
    "SUNDAY SETH A. ATUEL";

  const catalog = input.diagnosisCatalog ?? [];
  const billingBase = input.billingStatementItems?.length
    ? input.billingStatementItems
    : buildBillingStatementLineItems(input.repairs);
  const jobOrderBase = input.jobOrderItems?.length
    ? input.jobOrderItems
    : buildJobOrderLineItems(input.repairs, catalog);

  const billingLineItems = padLineItems(billingBase, MIN_ROWS);
  const jobOrderLineItems = padLineItems(jobOrderBase, MIN_ROWS);

  const billingTotal = repairBillingLineTotal(billingBase);
  const jobOrderTotal = repairBillingLineTotal(jobOrderBase);

  const templateBytes = await fs.readFile(TEMPLATE_PATH);
  const templateDoc = await PDFDocument.load(templateBytes);
  const pdf = await PDFDocument.create();
  

  
  const form = pdf.getForm();

  const fonts: Fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };

  await appendDocumentPages(pdf, templateDoc, form, fonts, {
    clientName: input.clientName,
    issueDate: input.issueDate,
    representative,
    documentTitle: input.documentTitle ?? "BILLING STATEMENT",
    lineItems: billingLineItems,
    pageTotal: billingTotal,
  });

  await appendDocumentPages(pdf, templateDoc, form, fonts, {
    clientName: input.clientName,
    issueDate: input.issueDate,
    representative,
    documentTitle: "JOB ORDER",
    lineItems: jobOrderLineItems,
    pageTotal: jobOrderTotal,
  });

  return Buffer.from(await pdf.save());
}

export async function generateRepairBillingPdf(
  input: RepairBillingPdfInput
): Promise<Buffer> {
  return generateRepairBillingPdfFromTemplate(input);
}
