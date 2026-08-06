import fs from "fs/promises";
import type {
    Sale,
    SaleLine,
    Client,
    InventoryProduct,
  } from "@prisma/client";
  
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

/* =========================================================
   PAGE SETTINGS
========================================================= */

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 936;

const MARGIN_X = 36;
const MARGIN_TOP = 36;
const MARGIN_BOTTOM = 24;

const TABLE_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

/* =========================================================
   TABLE COLUMNS
========================================================= */

const COL_ITEM = 120;
const COL_DESC = 220;
const COL_QTY = 60;
const COL_UNIT = 70;
const COL_TOTAL = TABLE_WIDTH - COL_ITEM - COL_DESC - COL_QTY - COL_UNIT;

const X_ITEM = MARGIN_X;
const X_DESC = X_ITEM + COL_ITEM;
const X_QTY = X_DESC + COL_DESC;
const X_UNIT = X_QTY + COL_QTY;
const X_TOTAL = X_UNIT + COL_UNIT;

/* =========================================================
   LAYOUT
========================================================= */

const ROW_HEIGHT = 18;
const TABLE_HEADER_HEIGHT = 18;

const COMPANY_HEADER_HEIGHT = 70;
const SECTION_TITLE_HEIGHT = 22;
const SECTION_CUSTOMER_HEIGHT = 12;
const FOOTER_BLOCK_HEIGHT = 120;

/* =========================================================
   COLORS
========================================================= */

const COLOR_HEADER_FILL = rgb(
  138 / 255,
  190 / 255,
  63 / 255
);

const COLOR_BORDER = rgb(
  0.45,
  0.55,
  0.45
);

const COLOR_TEXT = rgb(
  0.10,
  0.10,
  0.10
);

/* =========================================================
   LOGO
========================================================= */

const LOGO_PATH = path.join(
  process.cwd(),
  "public",
  "images",
  "logo.png"
);

/* =========================================================
   TYPES
========================================================= */

export type DeliveryReceiptLine = {
  itemName: string;
  description: string;
  qty: number;
  unitPrice: number;
  totalPrice: number;
};

export type DeliveryReceiptInput = {
  customer: string;
  issueDate: Date;
  items: DeliveryReceiptLine[];
  representativeName?: string;
};

/* =========================================================
   FONTS
========================================================= */

type Fonts = {
  regular: PDFFont;
  bold: PDFFont;
};

/* =========================================================
   HELPERS
========================================================= */

function formatMoney(amount: number) {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatDate(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

/* =========================================================
   TEXT HELPERS
========================================================= */

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
  const textWidth = font.widthOfTextAtSize(
    text,
    size
  );

  page.drawText(text, {
    x: x + (width - textWidth) / 2,
    y,
    size,
    font,
    color,
  });
}

function wrapText(
    text: string,
    font: PDFFont,
    size: number,
    maxWidth: number
  ): string[] {
    if (!text) return [""];
  
    const words = text.split(/\s+/);
    const lines: string[] = [];
  
    let current = "";
  
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
  
      if (font.widthOfTextAtSize(test, size) <= maxWidth) {
        current = test;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
  
    if (current) lines.push(current);
  
    return lines;
  }

function drawRightText(
  page: PDFPage,
  text: string,
  x: number,
  width: number,
  y: number,
  font: PDFFont,
  size: number
) {
  const textWidth = font.widthOfTextAtSize(
    text,
    size
  );

  page.drawText(text, {
    x: x + width - textWidth - 4,
    y,
    size,
    font,
    color: COLOR_TEXT,
  });
}

/* =========================================================
   COMPANY HEADER
========================================================= */

async function drawCompanyHeader(
  pdf: PDFDocument,
  page: PDFPage,
  fonts: Fonts,
  topY: number
) {
  const logoBytes = await fs.readFile(LOGO_PATH);

  const logo = await pdf.embedPng(
    logoBytes
  );

  page.drawImage(logo, {
    x: 140,
    y: topY - 102,
    width: 72,
    height: 72,
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

/* =========================================================
   DOCUMENT TITLE
========================================================= */

function drawTitle(
  page: PDFPage,
  fonts: Fonts,
  y: number
) {
  drawCenteredText(
    page,
    "DELIVERY RECEIPT",
    MARGIN_X,
    TABLE_WIDTH,
    y,
    fonts.bold,
    16
  );

  return y - SECTION_TITLE_HEIGHT;
}

/* =========================================================
   CUSTOMER INFO
========================================================= */

function drawCustomerLine(
  page: PDFPage,
  fonts: Fonts,
  customer: string,
  issueDate: Date,
  y: number
) {
  page.drawText(
    `CUSTOMER : ${customer.toUpperCase()}`,
    {
      x: MARGIN_X,
      y,
      size: 10,
      font: fonts.regular,
      color: COLOR_TEXT,
    }
  );

  drawRightText(
    page,
    formatDate(issueDate),
    MARGIN_X,
    TABLE_WIDTH,
    y,
    fonts.regular,
    10
  );

  return y - SECTION_CUSTOMER_HEIGHT;
}

/* =========================================================
   PDF FIELD
========================================================= */

function addPriceField(
  form: PDFForm,
  page: PDFPage,
  name: string,
  value: number,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const field = form.createTextField(
    name
  );

  field.setAlignment(
    TextAlignment.Center
  );

  field.setText(
    formatMoney(value)
  );

  field.addToPage(page, {
    x,
    y,
    width,
    height,
    borderWidth: 0,
  });

  field.setFontSize(8);
}

function drawTableHeader(
    page: PDFPage,
    fonts: Fonts,
    y: number
  ) {
    // Background
    page.drawRectangle({
      x: MARGIN_X,
      y: y - TABLE_HEADER_HEIGHT + 1,
      width: TABLE_WIDTH,
      height: TABLE_HEADER_HEIGHT,
      color: COLOR_HEADER_FILL,
      borderColor: COLOR_BORDER,
      borderWidth: 0.75,
    });
  
    // Vertical lines
    page.drawLine({
      start: { x: X_DESC, y: y - TABLE_HEADER_HEIGHT + 1 },
      end: { x: X_DESC, y: y + 1 },
      thickness: 0.5,
      color: COLOR_BORDER,
    });
  
    page.drawLine({
      start: { x: X_QTY, y: y - TABLE_HEADER_HEIGHT + 1 },
      end: { x: X_QTY, y: y + 1 },
      thickness: 0.5,
      color: COLOR_BORDER,
    });
  
    page.drawLine({
      start: { x: X_UNIT, y: y - TABLE_HEADER_HEIGHT + 1 },
      end: { x: X_UNIT, y: y + 1 },
      thickness: 0.5,
      color: COLOR_BORDER,
    });
  
    page.drawLine({
      start: { x: X_TOTAL, y: y - TABLE_HEADER_HEIGHT + 1 },
      end: { x: X_TOTAL, y: y + 1 },
      thickness: 0.5,
      color: COLOR_BORDER,
    });
  
    const labelY = y - 8;
  
    drawCenteredText(
      page,
      "ITEM NAME",
      X_ITEM,
      COL_ITEM,
      labelY,
      fonts.bold,
      8
    );
  
    drawCenteredText(
      page,
      "DESCRIPTION / SPECIFICATION",
      X_DESC,
      COL_DESC,
      labelY,
      fonts.bold,
      8
    );
  
    drawCenteredText(
      page,
      "QTY",
      X_QTY,
      COL_QTY,
      labelY,
      fonts.bold,
      8
    );
  
    drawCenteredText(
      page,
      "UNIT PRICE",
      X_UNIT,
      COL_UNIT,
      labelY,
      fonts.bold,
      8
    );
  
    drawCenteredText(
      page,
      "TOTAL",
      X_TOTAL,
      COL_TOTAL,
      labelY,
      fonts.bold,
      8
    );
  
    return y - TABLE_HEADER_HEIGHT;
  }

  function drawTableRow(
    page: PDFPage,
    item: DeliveryReceiptLine,
    fonts: Fonts,
    y: number,
    form: PDFForm,
    rowIndex: number
  ) {
    const descLines = wrapText(
      item.description,
      fonts.regular,
      8,
      COL_DESC - 8
    );
  
    const rows = Math.max(1, descLines.length);
    const totalHeight = rows * ROW_HEIGHT;
    const rowBottom = y - totalHeight;
  
    // =====================================================
    // OUTER BORDER
    // =====================================================
  
    page.drawRectangle({
      x: MARGIN_X,
      y: rowBottom,
      width: TABLE_WIDTH,
      height: totalHeight,
      borderColor: COLOR_BORDER,
      borderWidth: 0.5,
    });
  
    // =====================================================
    // COLUMN LINES
    // =====================================================
  
    page.drawLine({
      start: { x: X_DESC, y: rowBottom },
      end: { x: X_DESC, y: y },
      color: COLOR_BORDER,
      thickness: 0.5,
    });
  
    page.drawLine({
      start: { x: X_QTY, y: rowBottom },
      end: { x: X_QTY, y: y },
      color: COLOR_BORDER,
      thickness: 0.5,
    });
  
    page.drawLine({
      start: { x: X_UNIT, y: rowBottom },
      end: { x: X_UNIT, y: y },
      color: COLOR_BORDER,
      thickness: 0.5,
    });
  
    page.drawLine({
      start: { x: X_TOTAL, y: rowBottom },
      end: { x: X_TOTAL, y: y },
      color: COLOR_BORDER,
      thickness: 0.5,
    });
  
    // =====================================================
    // DESCRIPTION INTERNAL LINES
    // =====================================================
  
    for (let i = 1; i < rows; i++) {
      const yy = y - i * ROW_HEIGHT;
  
      page.drawLine({
        start: { x: X_DESC, y: yy },
        end: { x: X_QTY, y: yy },
        color: COLOR_BORDER,
        thickness: 0.5,
      });
    }
  
    const centerY = rowBottom + totalHeight / 2 - 4;
  
    // =====================================================
    // ITEM NAME
    // =====================================================
  
    drawCenteredText(
      page,
      item.itemName,
      X_ITEM,
      COL_ITEM,
      centerY,
      fonts.regular,
      8
    );
  
    // =====================================================
    // DESCRIPTION
    // =====================================================
  
    descLines.forEach((line, index) => {
      drawCenteredText(
        page,
        line,
        X_DESC,
        COL_DESC,
        y - ROW_HEIGHT / 2 - 3 - index * ROW_HEIGHT,
        fonts.regular,
        8
      );
    });
  
    // =====================================================
    // QUANTITY
    // =====================================================
  
    drawCenteredText(
      page,
      String(item.qty),
      X_QTY,
      COL_QTY,
      centerY,
      fonts.regular,
      8
    );
  
    // =====================================================
    // UNIT PRICE
    // =====================================================
  
    addPriceField(
      form,
      page,
      `unit_${rowIndex}`,
      item.unitPrice,
      X_UNIT + 2,
      rowBottom + 2,
      COL_UNIT - 4,
      totalHeight - 4
    );
  
    // =====================================================
    // TOTAL PRICE
    // =====================================================
  
    addPriceField(
      form,
      page,
      `total_${rowIndex}`,
      item.totalPrice,
      X_TOTAL + 2,
      rowBottom + 2,
      COL_TOTAL - 4,
      totalHeight - 4
    );
  
    return y - totalHeight;
  }

  function drawTotalRow(
    page: PDFPage,
    fonts: Fonts,
    form: PDFForm,
    y: number,
    total: number
  ) {
    // ==========================================
    // Green Background
    // ==========================================
  
    page.drawRectangle({
      x: MARGIN_X,
      y: y - TABLE_HEADER_HEIGHT + 1,
      width: TABLE_WIDTH,
      height: TABLE_HEADER_HEIGHT,
      color: COLOR_HEADER_FILL,
      borderColor: COLOR_BORDER,
      borderWidth: 0.75,
    });
  
    // ==========================================
    // Divider before TOTAL column
    // ==========================================
  
    page.drawLine({
      start: {
        x: X_TOTAL,
        y: y - TABLE_HEADER_HEIGHT + 1,
      },
      end: {
        x: X_TOTAL,
        y: y + 1,
      },
      color: COLOR_BORDER,
      thickness: 0.5,
    });
  
    const labelY = y - 8;
  
    // ==========================================
    // TOTAL Label
    // ==========================================
  
    drawCenteredText(
      page,
      "TOTAL",
      X_ITEM,
      COL_ITEM + COL_DESC + COL_QTY + COL_UNIT,
      labelY,
      fonts.bold,
      9
    );
  
    // ==========================================
    // Total Amount
    // ==========================================
  
    addPriceField(
      form,
      page,
      "grand_total",
      total,
      X_TOTAL + 2,
      y - TABLE_HEADER_HEIGHT + 3,
      COL_TOTAL - 4,
      TABLE_HEADER_HEIGHT - 6
    );
  
    return y - TABLE_HEADER_HEIGHT;
  }

  function drawFooterBlock(
    page: PDFPage,
    fonts: Fonts,
    y: number,
    representative: string
  ) {
    // =====================================================
    // Acknowledgement
    // =====================================================
  
    page.drawText(
      "Received the above items in good order and condition.",
      {
        x: MARGIN_X + 145,
        y,
        size: 8,
        font: fonts.regular,
        color: COLOR_TEXT,
      }
    );
  
    const sigY = y - 78;
  
    // =====================================================
    // JESEAN REPRESENTATIVE
    // =====================================================
  
    page.drawText(representative, {
      x: MARGIN_X + 10,
      y: sigY + 10,
      size: 9,
      font: fonts.bold,
      color: COLOR_TEXT,
    });
  
    page.drawLine({
      start: {
        x: MARGIN_X + 8,
        y: sigY + 8,
      },
      end: {
        x: MARGIN_X + 145,
        y: sigY + 8,
      },
      thickness: 0.5,
      color: COLOR_TEXT,
    });
  
    drawCenteredText(
      page,
      "JESEAN Representative",
      MARGIN_X,
      155,
      sigY - 6,
      fonts.regular,
      8
    );
  
    // =====================================================
    // RECEIVED BY
    // =====================================================
  
    page.drawText(
      "Received by:",
      {
        x: PAGE_WIDTH - 175,
        y: sigY + 50,
        size: 8,
        font: fonts.regular,
        color: COLOR_TEXT,
      }
    );
  
    page.drawLine({
      start: {
        x: PAGE_WIDTH - 205,
        y: sigY + 12,
      },
      end: {
        x: PAGE_WIDTH - 40,
        y: sigY + 12,
      },
      thickness: 0.5,
      color: COLOR_TEXT,
    });
  
    drawCenteredText(
      page,
      "Signature over Printed Name",
      PAGE_WIDTH - 220,
      180,
      sigY - 2,
      fonts.regular,
      7
    );
  
    // =====================================================
    // OPTIONAL DATE LINE
    // =====================================================
  
    page.drawText(
      "Date:",
      {
        x: PAGE_WIDTH - 175,
        y: sigY - 32,
        size: 8,
        font: fonts.regular,
        color: COLOR_TEXT,
      }
    );
  
    page.drawLine({
      start: {
        x: PAGE_WIDTH - 145,
        y: sigY - 30,
      },
      end: {
        x: PAGE_WIDTH - 40,
        y: sigY - 30,
      },
      thickness: 0.5,
      color: COLOR_TEXT,
    });
  
    return sigY - FOOTER_BLOCK_HEIGHT + 80;
  }

  async function drawDeliverySection(
    pdf: PDFDocument,
    page: PDFPage,
    fonts: Fonts,
    form: PDFForm,
    startY: number,
    input: {
      customer: string;
      issueDate: Date;
      items: DeliveryReceiptLine[];
      representative: string;
    }
  ) {
    let y = startY;
  
    // ============================================
    // Company Header
    // ============================================
  
    y = await drawCompanyHeader(
      pdf,
      page,
      fonts,
      y
    );
  
    // ============================================
    // Title
    // ============================================
  
    y -= 4;
  
    y = drawTitle(
      page,
      fonts,
      y
    );
  
    // ============================================
    // Customer
    // ============================================
  
    y = drawCustomerLine(
      page,
      fonts,
      input.customer,
      input.issueDate,
      y
    );
  
    y -= 8;
  
    // ============================================
    // Table Header
    // ============================================
  
    y = drawTableHeader(
      page,
      fonts,
      y
    );
  
    // ============================================
    // Table Rows
    // ============================================
  
    let grandTotal = 0;
  
    input.items.forEach((item, index) => {
  
      grandTotal += item.totalPrice;
  
      y = drawTableRow(
        page,
        item,
        fonts,
        y,
        form,
        index
      );
  
    });
  
    // ============================================
    // Blank Rows
    // ============================================
  
    const MIN_ROWS = 12;
  
    if (input.items.length < MIN_ROWS) {
  
      for (
        let i = input.items.length;
        i < MIN_ROWS;
        i++
      ) {
  
        const rowBottom = y - ROW_HEIGHT;
  
        page.drawRectangle({
          x: MARGIN_X,
          y: rowBottom,
          width: TABLE_WIDTH,
          height: ROW_HEIGHT,
          borderColor: COLOR_BORDER,
          borderWidth: 0.5,
        });
  
        page.drawLine({
          start: { x: X_DESC, y: rowBottom },
          end: { x: X_DESC, y },
          color: COLOR_BORDER,
          thickness: 0.5,
        });
  
        page.drawLine({
          start: { x: X_QTY, y: rowBottom },
          end: { x: X_QTY, y },
          color: COLOR_BORDER,
          thickness: 0.5,
        });
  
        page.drawLine({
          start: { x: X_UNIT, y: rowBottom },
          end: { x: X_UNIT, y },
          color: COLOR_BORDER,
          thickness: 0.5,
        });
  
        page.drawLine({
          start: { x: X_TOTAL, y: rowBottom },
          end: { x: X_TOTAL, y },
          color: COLOR_BORDER,
          thickness: 0.5,
        });
  
        y -= ROW_HEIGHT;
  
      }
  
    }
  
    // ============================================
    // Total
    // ============================================
  
    y -= 4;
  
    y = drawTotalRow(
      page,
      fonts,
      form,
      y,
      grandTotal
    );
  
    // ============================================
    // Footer
    // ============================================
  
    y -= 28;
  
    drawFooterBlock(
      page,
      fonts,
      y,
      input.representative
    );
  }
  async function buildPdf(
    input: DeliveryReceiptInput
  ): Promise<Buffer> {
    const representative =
      input.representativeName ??
      process.env.BILLING_REPRESENTATIVE_NAME ??
      "SUNDAY SETH A. ATUEL";
  
    const pdf = await PDFDocument.create();
    pdf.setTitle("Delivery Receipt");
    pdf.setSubject("Delivery Receipt");
    pdf.setAuthor("JESEAN Printer & Computer Specialists");
    pdf.setCreator("JESEAN Sales System");
    

  
    pdf.registerFontkit(fontkit);
  
    const fonts: Fonts = {
      regular: await pdf.embedFont(
        StandardFonts.Helvetica
      ),
      bold: await pdf.embedFont(
        StandardFonts.HelveticaBold
      ),
    };
  
    const form = pdf.getForm();
  
    const page = pdf.addPage([
      PAGE_WIDTH,
      PAGE_HEIGHT,
    ]);
  
    await drawDeliverySection(
      pdf,
      page,
      fonts,
      form,
      PAGE_HEIGHT - MARGIN_TOP,
      {
        customer: input.customer,
        issueDate: input.issueDate,
        items: input.items,
        representative,
      }
    );
  
    form.updateFieldAppearances(
      fonts.regular
    );
  
    const pdfBytes = await pdf.save();
  
    return Buffer.from(pdfBytes);
  }

  export async function generateDeliveryReceiptPdf(
    sale: Sale & {
      client: Client | null;
      lines: (SaleLine & {
        product: InventoryProduct | null;
      })[];
    }
  ): Promise<Buffer> {
    const items: DeliveryReceiptLine[] = sale.lines.map((line) => ({
      itemName: line.product?.name ?? line.name,
    
      description: [
        line.product?.brand,
        line.product?.model,
        line.product?.color,
      ]
        .filter(Boolean)
        .join(" • "),
    
      qty: line.qty,
      unitPrice: line.unitPrice,
      totalPrice: line.lineTotal,
    }));
  
    return buildPdf({
      customer: sale.client?.name ?? "Walk-in Customer",
      issueDate: sale.createdAt,
      items,
    });
  }