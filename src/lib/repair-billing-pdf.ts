import fs from "fs/promises";
import path from "path";
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import { formatCustomerDateLine } from "@/lib/rental-billing-shared";
import type { RepairBillingStatement } from "@/lib/repair-billing";
import {
  buildTemplateLineItems,
  repairBillingLineTotal,
  type RepairBillingRepairRecord,
  type RepairTemplateLineItem,
} from "@/lib/repair-billing-lines";

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
const TABLE_HEADER_HEIGHT = 18;

/** Space reserved at bottom for total + received note + signatures. */
const FOOTER_BLOCK_HEIGHT = 118;

const COLOR_HEADER_FILL = rgb(0.718, 0.835, 0.714);
const COLOR_BORDER = rgb(0.45, 0.55, 0.45);
const COLOR_TEXT = rgb(0.1, 0.1, 0.1);

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

function drawTableRow(
  page: PDFPage,
  item: RepairTemplateLineItem,
  fonts: Fonts,
  y: number
) {
  const rowBottom = y - ROW_HEIGHT + 2;
  page.drawRectangle({
    x: MARGIN_X,
    y: rowBottom,
    width: TABLE_WIDTH,
    height: ROW_HEIGHT,
    borderColor: COLOR_BORDER,
    borderWidth: 0.5,
  });

  page.drawLine({
    start: { x: MARGIN_X + COL_UNIT, y: rowBottom },
    end: { x: MARGIN_X + COL_UNIT, y: rowBottom + ROW_HEIGHT },
    color: COLOR_BORDER,
    thickness: 0.5,
  });
  page.drawLine({
    start: { x: MARGIN_X + COL_UNIT + COL_DESC, y: rowBottom },
    end: { x: MARGIN_X + COL_UNIT + COL_DESC, y: rowBottom + ROW_HEIGHT },
    color: COLOR_BORDER,
    thickness: 0.5,
  });

  const textY = y - 11;
  if (item.unitLabel) {
    const unit = truncateText(item.unitLabel, fonts.regular, 8, COL_UNIT - 8);
    drawCenteredText(page, unit, MARGIN_X, COL_UNIT, textY, fonts.regular, 8);
  }
  const desc = truncateText(item.description, fonts.regular, 8, COL_DESC - 8);
  drawCenteredText(page, desc, MARGIN_X + COL_UNIT, COL_DESC, textY, fonts.regular, 8);
  if (item.amount != null) {
    drawCenteredText(
      page,
      formatPrice(item.amount),
      MARGIN_X + COL_UNIT + COL_DESC,
      COL_PRICE,
      textY,
      fonts.regular,
      8
    );
  }
}

function drawTotalRow(page: PDFPage, fonts: Fonts, y: number, total: number) {
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
  drawCenteredText(
    page,
    formatPrice(total),
    MARGIN_X + COL_UNIT + COL_DESC,
    COL_PRICE,
    y,
    fonts.bold,
    9
  );
}

function drawFooterBlock(page: PDFPage, fonts: Fonts, y: number, representative: string) {
  page.drawText("Received the above unit in good order and condition.", {
    x: MARGIN_X + 180,
    y: y ,
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
      y: y + 8 - 2, // distance below text
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

function paginateItems(items: RepairTemplateLineItem[], rowsPerPage: number) {
  const pages: RepairTemplateLineItem[][] = [];
  for (let i = 0; i < items.length; i += rowsPerPage) {
    pages.push(items.slice(i, i + rowsPerPage));
  }
  return pages.length > 0 ? pages : [[]];
}

function bodyBounds(): PageLayout {
  const bodyTopY = HEADER_BOTTOM_Y - 24;
  const bodyBottomY = FOOTER_BLOCK_HEIGHT + TABLE_HEADER_HEIGHT + 8;
  return { bodyTopY, bodyBottomY };
}

function rowsPerPage(layout: PageLayout) {
  return Math.floor((layout.bodyTopY - layout.bodyBottomY) / ROW_HEIGHT);
}

async function createStatementPage(
  pdf: PDFDocument,
  templateDoc: PDFDocument,
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
  const page = pdf.getPages()[pdf.getPageCount() - 1]!;

  clearDynamicArea(page);

  const layout = bodyBounds();
  let y = layout.bodyTopY;

  if (input.showContinued) {
    drawCenteredText(
      page,
      `${input.documentTitle} (continued)`,
      MARGIN_X,
      TABLE_WIDTH,
      y + 10,
      fonts.bold,
      10
    );
    y -= 8;
  }

  drawCustomerLine(page, input.clientName, input.issueDate, fonts, y);
  y -= 18;
  drawTableHeader(page, fonts, y);
  y -= ROW_HEIGHT;

  for (const item of input.pageItems) {
    drawTableRow(page, item, fonts, y);
    y -= ROW_HEIGHT;
  }

  if (input.isLastPage) {
    y -= 4;
    drawTotalRow(page, fonts, y, input.pageTotal);
    drawFooterBlock(page, fonts, y - 28, input.representative);
  }
}

export async function generateRepairBillingPdfFromTemplate(
  input: RepairBillingPdfInput
): Promise<Buffer> {
  const representative =
    input.representativeName ??
    process.env.BILLING_REPRESENTATIVE_NAME ??
    "SUNDAY SETH A. ATUEL";

  const documentTitle = input.documentTitle ?? "BILLING STATEMENT";
  const lineItems = buildTemplateLineItems(input.repairs);
  const MIN_ROWS = 5;

  while (lineItems.length < MIN_ROWS) {
    lineItems.push({
      unitLabel: "",
      description: "",
      amount: null,
    } as RepairTemplateLineItem);
  }
  const grandTotal = repairBillingLineTotal(lineItems);

  const templateBytes = await fs.readFile(TEMPLATE_PATH);
  const templateDoc = await PDFDocument.load(templateBytes);
  const pdf = await PDFDocument.create();

  const fonts: Fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };

  const layout = bodyBounds();
  const pages = paginateItems(lineItems, rowsPerPage(layout));

  for (let i = 0; i < pages.length; i++) {
    await createStatementPage(pdf, templateDoc, fonts, {
      clientName: input.clientName,
      issueDate: input.issueDate,
      representative,
      documentTitle,
      pageItems: pages[i]!,
      pageTotal: grandTotal,
      isLastPage: i === pages.length - 1,
      showContinued: i > 0,
    });
  }

  // Job order copy on its own page(s), matching prior Excel behavior.
  const jobOrderPages = paginateItems(lineItems, rowsPerPage(layout));
  for (let i = 0; i < jobOrderPages.length; i++) {
    await createStatementPage(pdf, templateDoc, fonts, {
      clientName: input.clientName,
      issueDate: input.issueDate,
      representative,
      documentTitle: "JOB ORDER",
      pageItems: jobOrderPages[i]!,
      pageTotal: grandTotal,
      isLastPage: i === jobOrderPages.length - 1,
      showContinued: i > 0,
    });
  }

  return Buffer.from(await pdf.save());
}

export async function generateRepairBillingPdf(
  input: RepairBillingPdfInput
): Promise<Buffer> {
  return generateRepairBillingPdfFromTemplate(input);
}
