import fs from "fs/promises";
import path from "path";
import {
  PDFDocument,
  PDFForm,
  StandardFonts,
  TextAlignment,
  rgb,
  type PDFPage,
  type PDFFont,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
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

/** Legal 8.5×13 in at 72 dpi */
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 936;

const MARGIN_X = 36;
const MARGIN_TOP = 36;
const MARGIN_BOTTOM = 24;
const TABLE_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

const COL_UNIT = 118;
const COL_PRICE = 88;
const COL_DESC = TABLE_WIDTH - COL_UNIT - COL_PRICE;

const ROW_HEIGHT = 16;
const DESC_LINE_HEIGHT = 10;
const TABLE_HEADER_HEIGHT = 18;

const COMPANY_HEADER_HEIGHT = 70;
const SECTION_TITLE_HEIGHT = 22;
const SECTION_CUSTOMER_HEIGHT = 10;
const SECTION_GAP = 6;
const FOOTER_BLOCK_HEIGHT = 118;
const COMBINED_DIVIDER_HEIGHT = 12;

const COLOR_HEADER_FILL = rgb(0.718, 0.835, 0.714);
const COLOR_BORDER = rgb(0.45, 0.55, 0.45);
const COLOR_TEXT = rgb(0.1, 0.1, 0.1);

const LOGO_PATH = path.join(process.cwd(), "public", "images", "logo.png");
const MIN_ROWS_SEPARATE = 5;

export type RepairBillingPdfInput = RepairBillingStatement & {
  repairs: RepairBillingRepairRecord[];
  diagnosisCatalog?: DiagnosisPriceEntry[];
  billingStatementItems?: RepairTemplateLineItem[];
  jobOrderItems?: RepairTemplateLineItem[];
  representativeName?: string;
  documentTitle?: string;
};

type Fonts = {
  regular: PDFFont;
  bold: PDFFont;
};

type FieldCounter = {
  prefix: string;
  price: number;
  total: number;
};

function formatPrice(amount: number) {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
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

function tableBodyHeight(items: RepairTemplateLineItem[]) {
  return (
    TABLE_HEADER_HEIGHT +
    items.reduce((height, item) => height + itemRowHeight(item), 0) +
    TABLE_HEADER_HEIGHT
  );
}

function fullSectionHeight(items: RepairTemplateLineItem[]) {
  return (
    COMPANY_HEADER_HEIGHT +
    SECTION_TITLE_HEIGHT +
    SECTION_CUSTOMER_HEIGHT +
    SECTION_GAP +
    tableBodyHeight(items) +
    8 +
    FOOTER_BLOCK_HEIGHT
  );
}

function canCombineOnSinglePage(
  billingItems: RepairTemplateLineItem[],
  jobOrderItems: RepairTemplateLineItem[]
) {
  const available = PAGE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM;
  const needed =
    fullSectionHeight(billingItems) +
    COMBINED_DIVIDER_HEIGHT +
    fullSectionHeight(jobOrderItems);
  return needed <= available;
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

async function drawCompanyHeader(
  pdf: PDFDocument,
  page: PDFPage,
  fonts: Fonts,
  topY: number
) {
  const logoBytes = await fs.readFile(LOGO_PATH);
  const logo = await pdf.embedPng(logoBytes);

  const logoWidth = 72;
  const logoHeight = 52;
  const logoY = topY - logoHeight;

  page.drawImage(logo, {
    x: 140,
    y: logoY - 30,
    width: logoWidth,
    height: logoHeight,
  });

  drawCenteredText(
    page,
    "JESEAN PRINTER & COMPUTER SPECIALISTS",
    0,
    PAGE_WIDTH,
    topY - 18,
    fonts.bold,
    14
  );
  drawCenteredText(
    page,
    "Durano Street, Brgy. Diego Silang, Butuan City",
    0,
    PAGE_WIDTH,
    topY - 34,
    fonts.regular,
    9
  );
  drawCenteredText(
    page,
    "Contact No. 09100037442",
    0,
    PAGE_WIDTH,
    topY - 48,
    fonts.regular,
    9
  );

  return topY - COMPANY_HEADER_HEIGHT;
}

function drawSectionTitle(page: PDFPage, title: string, y: number, fonts: Fonts) {
  drawCenteredText(page, title, MARGIN_X, TABLE_WIDTH, y, fonts.bold, 15);
  return y - SECTION_TITLE_HEIGHT;
}

function drawCustomerLine(
  page: PDFPage,
  clientName: string,
  issueDate: Date,
  fonts: Fonts,
  y: number
) {
  page.drawText(`CUSTOMER: ${clientName.toUpperCase()}`, {
    x: MARGIN_X,
    y,
    size: 10,
    font: fonts.regular,
    color: COLOR_TEXT,
  });
  drawRightText(
    page,
    `DATE:${formatIssueDate(issueDate)}`,
    MARGIN_X,
    TABLE_WIDTH,
    y,
    fonts.regular,
    10
  );
  return y - SECTION_CUSTOMER_HEIGHT;
}

function addPriceField(
  form: PDFForm,
  page: PDFPage,
  name: string,
  value: number | null,
  x: number,
  y: number,
  width: number,
  height: number,
  fontSize = 8
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
    textColor: rgb(0, 0, 0),
  });
  field.setFontSize(fontSize);
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

  const labelY = y - 8;
  drawCenteredText(page, "UNIT", MARGIN_X, COL_UNIT, labelY, fonts.bold, 9);
  drawCenteredText(page, "Description", MARGIN_X + COL_UNIT, COL_DESC, labelY, fonts.bold, 9);
  drawCenteredText(page, "Price", MARGIN_X + COL_UNIT + COL_DESC, COL_PRICE, labelY, fonts.bold, 9);

  return y - TABLE_HEADER_HEIGHT;
}

function drawTableRow(
  page: PDFPage,
  item: RepairTemplateLineItem,
  fonts: Fonts,
  y: number,
  form: PDFForm,
  fields: FieldCounter,
  pageIndex: number,
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
  descLines.forEach((line, lineIndex) => {
    const desc = truncateText(line, fonts.regular, 8, COL_DESC - 8);
    drawCenteredText(
      page,
      desc,
      MARGIN_X + COL_UNIT,
      COL_DESC,
      descTopY - lineIndex * DESC_LINE_HEIGHT,
      fonts.regular,
      8
    );
  });

  if (item.amount != null) {
    fields.price += 1;
    addPriceField(
      form,
      page,
      `${fields.prefix}_p${pageIndex}_r${rowIndex}_price_${fields.price}`,
      item.amount,
      MARGIN_X + COL_UNIT + COL_DESC + 2,
      rowBottom + 2,
      COL_PRICE - 4,
      rowHeight - 4
    );
  }

  return y - rowHeight;
}

function drawTotalRow(
  page: PDFPage,
  fonts: Fonts,
  y: number,
  total: number,
  form: PDFForm,
  fields: FieldCounter,
  pageIndex: number
) {
  page.drawRectangle({
    x: MARGIN_X,
    y: y - 11,
    width: TABLE_WIDTH,
    height: TABLE_HEADER_HEIGHT,
    color: COLOR_HEADER_FILL,
    borderColor: COLOR_BORDER,
    borderWidth: 0.75,
  });

  const labelY = y - 8;
  drawCenteredText(page, "TOTAL", MARGIN_X + COL_UNIT, COL_DESC, labelY, fonts.bold, 9);

  fields.total += 1;
  addPriceField(
    form,
    page,
    `${fields.prefix}_p${pageIndex}_total_${fields.total}`,
    total,
    MARGIN_X + COL_UNIT + COL_DESC + 2,
    labelY,
    COL_PRICE - 4,
    14,
    9
  );

  return y - TABLE_HEADER_HEIGHT;
}

function drawFooterBlock(page: PDFPage, fonts: Fonts, y: number, representative: string) {
  page.drawText("Received the above unit in good order and condition.", {
    x: MARGIN_X + 180,
    y,
    size: 8,
    font: fonts.regular,
    color: COLOR_TEXT,
  });

  const sigY = y - 80;

  page.drawText(representative, {
    x: MARGIN_X + 8,
    y: sigY + 8,
    size: 9,
    font: fonts.bold,
    color: COLOR_TEXT,
  });
  page.drawLine({
    start: { x: MARGIN_X + 8, y: sigY + 6 },
    end: { x: MARGIN_X + 118, y: sigY + 6 },
    thickness: 0.5,
    color: COLOR_TEXT,
  });
  page.drawText("JESEAN Representative", {
    x: MARGIN_X + 8,
    y: sigY - 6,
    size: 8,
    font: fonts.regular,
    color: COLOR_TEXT,
  });

  page.drawText("Received by:", {
    x: MARGIN_X + TABLE_WIDTH - 150,
    y: sigY + 54,
    size: 8,
    font: fonts.regular,
    color: COLOR_TEXT,
  });
  page.drawLine({
    start: { x: MARGIN_X + TABLE_WIDTH - 170, y: sigY + 12 },
    end: { x: MARGIN_X + TABLE_WIDTH - 8, y: sigY + 12 },
    color: COLOR_TEXT,
    thickness: 0.5,
  });
  page.drawText("Signature over Printed Name", {
    x: MARGIN_X + TABLE_WIDTH - 168,
    y: sigY - 2,
    size: 7,
    font: fonts.regular,
    color: COLOR_TEXT,
  });

  return sigY - FOOTER_BLOCK_HEIGHT + 80;
}

function drawSectionDivider(page: PDFPage, y: number) {
  page.drawLine({
    start: { x: MARGIN_X, y },
    end: { x: MARGIN_X + TABLE_WIDTH, y },
    color: COLOR_BORDER,
    thickness: 1,
  });
}

async function drawDocumentSection(
  pdf: PDFDocument,
  page: PDFPage,
  fonts: Fonts,
  form: PDFForm,
  fields: FieldCounter,
  pageIndex: number,
  startY: number,
  input: {
    clientName: string;
    issueDate: Date;
    documentTitle: string;
    items: RepairTemplateLineItem[];
    total: number;
    representative: string;
    includeCompanyHeader: boolean;
  }
) {
  let y = startY;

  if (input.includeCompanyHeader) {
    y = await drawCompanyHeader(pdf, page, fonts, y);
    y -= SECTION_GAP;
  }

  y = drawSectionTitle(page, input.documentTitle, y, fonts);
  y = drawCustomerLine(page, input.clientName, input.issueDate, fonts, y);
  y -= SECTION_GAP;
  y = drawTableHeader(page, fonts, y);

  for (let i = 0; i < input.items.length; i++) {
    y = drawTableRow(page, input.items[i]!, fonts, y, form, fields, pageIndex, i);
  }

  y -= 4;
  y = drawTotalRow(page, fonts, y, input.total, form, fields, pageIndex);
  y = drawFooterBlock(page, fonts, y - 28, input.representative);

  return y;
}

async function buildPdf(
  input: RepairBillingPdfInput,
  billingItems: RepairTemplateLineItem[],
  jobOrderItems: RepairTemplateLineItem[],
  billingTotal: number,
  jobOrderTotal: number,
  combined: boolean
) {
  const representative =
    input.representativeName ??
    process.env.BILLING_REPRESENTATIVE_NAME ??
    "SUNDAY SETH A. ATUEL";

  const billingTitle = input.documentTitle ?? "BILLING STATEMENT";

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  const fonts: Fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };

  const form = pdf.getForm();

  if (combined) {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let y = PAGE_HEIGHT - MARGIN_TOP;

    const billingFields: FieldCounter = { prefix: "billing", price: 0, total: 0 };
    y = await drawDocumentSection(pdf, page, fonts, form, billingFields, 0, y, {
      clientName: input.clientName,
      issueDate: input.issueDate,
      documentTitle: billingTitle,
      items: billingItems,
      total: billingTotal,
      representative,
      includeCompanyHeader: true,
    });

    const CENTER_Y = PAGE_HEIGHT / 2;

    drawSectionDivider(page, CENTER_Y);

    // Start Job Order below the center line
    y = CENTER_Y - COMBINED_DIVIDER_HEIGHT - SECTION_GAP;

    const jobFields: FieldCounter = { prefix: "joborder", price: 0, total: 0 };
    await drawDocumentSection(pdf, page, fonts, form, jobFields, 0, y, {
      clientName: input.clientName,
      issueDate: input.issueDate,
      documentTitle: "JOB ORDER",
      items: jobOrderItems,
      total: jobOrderTotal,
      representative,
      includeCompanyHeader: true,
    });
  } else {
    const billingPage = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const billingFields: FieldCounter = { prefix: "billing", price: 0, total: 0 };
    await drawDocumentSection(
      pdf,
      billingPage,
      fonts,
      form,
      billingFields,
      0,
      PAGE_HEIGHT - MARGIN_TOP,
      {
        clientName: input.clientName,
        issueDate: input.issueDate,
        documentTitle: billingTitle,
        items: billingItems,
        total: billingTotal,
        representative,
        includeCompanyHeader: true,
      }
    );

    const jobPage = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const jobFields: FieldCounter = { prefix: "joborder", price: 0, total: 0 };
    await drawDocumentSection(
      pdf,
      jobPage,
      fonts,
      form,
      jobFields,
      0,
      PAGE_HEIGHT - MARGIN_TOP,
      {
        clientName: input.clientName,
        issueDate: input.issueDate,
        documentTitle: "JOB ORDER",
        items: jobOrderItems,
        total: jobOrderTotal,
        representative,
        includeCompanyHeader: true,
      }
    );
  }

  form.updateFieldAppearances(fonts.regular);
  return Buffer.from(await pdf.save());
}

export async function generateRepairBillingPdfFromTemplate(
  input: RepairBillingPdfInput
): Promise<Buffer> {
  return generateRepairBillingPdf(input);
}

export async function generateRepairBillingPdf(
  input: RepairBillingPdfInput
): Promise<Buffer> {
  const catalog = input.diagnosisCatalog ?? [];

  const billingBase = input.billingStatementItems?.length
    ? input.billingStatementItems
    : buildBillingStatementLineItems(input.repairs);

  const jobOrderBase = input.jobOrderItems?.length
    ? input.jobOrderItems
    : buildJobOrderLineItems(input.repairs, catalog);

  const billingTotal = repairBillingLineTotal(billingBase);
  const jobOrderTotal = repairBillingLineTotal(jobOrderBase);

  const billingItems = padLineItems(billingBase, MIN_ROWS_SEPARATE);
const jobOrderItems = padLineItems(jobOrderBase, MIN_ROWS_SEPARATE);

const useCombinedPage = canCombineOnSinglePage(
    billingItems,
    jobOrderItems
);

if (useCombinedPage) {
    return buildPdf(
        input,
        billingItems,
        jobOrderItems,
        billingTotal,
        jobOrderTotal,
        true
    );
}

return buildPdf(
    input,
    billingItems,
    jobOrderItems,
    billingTotal,
    jobOrderTotal,
    false
);

  // return buildPdf(input, billingItems, jobOrderItems, billingTotal, jobOrderTotal, false);
}
