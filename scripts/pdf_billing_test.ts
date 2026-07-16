import fs from "fs/promises";
import path from "path";

import {
  PDFDocument,
  PDFPage,
  PDFFont,
  StandardFonts,
  rgb,
} from "pdf-lib";

import fontkit from "@pdf-lib/fontkit";

// Legal Size (8.5 × 13 inches)
export const PAGE_WIDTH = 612;
export const PAGE_HEIGHT = 936;
const CENTER_Y = PAGE_HEIGHT / 2; // 468

// Margins
export const MARGIN_LEFT = 30;
export const MARGIN_RIGHT = 30;
export const MARGIN_TOP = 80;
export const MARGIN_BOTTOM = 25;

// Table
export const TABLE_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

export const COL_UNIT = 160;
export const COL_DESC = 290;
export const COL_PRICE = TABLE_WIDTH - COL_UNIT - COL_DESC;

export const ROW_HEIGHT = 18;
export const TABLE_HEADER_HEIGHT = 20;

export const MARGIN_X = 36;
export const COLOR_HEADER_FILL = rgb(0.718, 0.835, 0.714);
// Colors
export const COLOR_TEXT = rgb(0, 0, 0);
export const COLOR_BORDER = rgb(0.45, 0.55, 0.45);
export const COLOR_HEADER = rgb(0.72, 0.84, 0.72);

// Logo
export const LOGO_PATH = path.join(
  process.cwd(),
  "public",
  "images",
  "logo.png"
);

export interface Fonts {
    regular: PDFFont;
    bold: PDFFont;
  }


  function centerText(
    page: PDFPage,
    text: string,
    x: number,
    width: number,
    y: number,
    font: PDFFont,
    size: number
  ) {
    const textWidth = font.widthOfTextAtSize(text, size);
  
    page.drawText(text, {
      x: x + (width - textWidth) / 2,
      y,
      size,
      font,
      color: COLOR_TEXT,
    });
  }
  
  function rightText(
    page: PDFPage,
    text: string,
    x: number,
    y: number,
    width: number,
    font: PDFFont,
    size: number
  ) {
    const w = font.widthOfTextAtSize(text, size);
  
    page.drawText(text, {
      x: x + width - w,
      y,
      size,
      font,
      color: COLOR_TEXT,
    });
  }

  export async function drawHeader(
    pdf: PDFDocument,
    page: PDFPage,
    fonts: Fonts,
    top: number
  ): Promise<number> {
    const logoBytes = await fs.readFile(LOGO_PATH);
    const logo = await pdf.embedPng(logoBytes);
  
    const logoWidth = 100;
    const logoHeight = 70;
  
    page.drawImage(logo, {
      x: 100,
      y: top - logoHeight,
      width: logoWidth,
      height: logoHeight,
    });
  
    centerText(
      page,
      "JESEAN PRINTER & COMPUTER SPECIALISTS",
      0,
      PAGE_WIDTH,
      top + 20,
      fonts.bold,
      15
    );
  
    centerText(
      page,
      "Durano Street, Brgy. Diego Silang, Butuan City",
      0,
      PAGE_WIDTH,
      top + 6,
      fonts.regular,
      10
    );
  
    centerText(
      page,
      "Contact No. 09100037442",
      0,
      PAGE_WIDTH,
      top - 8,
      fonts.regular,
      10
    );
  
    return top - 35;
  }
  
  function drawTitle(
    page: PDFPage,
    title: string,
    y: number,
    fonts: Fonts
  ) {
    centerText(
      page,
      title,
      0,
      PAGE_WIDTH,
      y,
      fonts.bold,
      17
    );
  }

  function drawCustomerInfo(
    page: PDFPage,
    customer: string,
    issueDate: Date,
    y: number,
    fonts: Fonts
  ) {
    page.drawText(`CUSTOMER: ${customer}`, {
      x: MARGIN_X,
      y,
      size: 10,
      font: fonts.regular,
      color: COLOR_TEXT,
    });
  
    const date = `DATE: ${issueDate.getMonth() + 1}/${issueDate.getDate()}/${issueDate.getFullYear()}`;
  
    const w = fonts.regular.widthOfTextAtSize(date, 10);
  
    page.drawText(date, {
      x: PAGE_WIDTH - MARGIN_X - w,
      y,
      size: 10,
      font: fonts.regular,
      color: COLOR_TEXT,
    });
  }

  function drawTable(
    page: PDFPage,
    startY: number,
    fonts: Fonts
  ) : Promise<number> {
    let y = startY;
  
    // Header
    page.drawRectangle({
      x: MARGIN_X,
      y: y - TABLE_HEADER_HEIGHT,
      width: TABLE_WIDTH,
      height: TABLE_HEADER_HEIGHT,
      color: COLOR_HEADER_FILL,
      borderColor: COLOR_BORDER,
      borderWidth: 1,
    });
    centerText(page, "UNIT", MARGIN_X, COL_UNIT, y - 13, fonts.bold, 9);

    centerText(page, "Description", MARGIN_X + COL_UNIT, COL_DESC, y - 13, fonts.bold, 9);
    
    centerText(page, "Price", MARGIN_X + COL_UNIT + COL_DESC, COL_PRICE, y - 13, fonts.bold, 9);
    
   
    y -= TABLE_HEADER_HEIGHT;
  
    // Empty rows
    for (let i = 0; i < 5; i++) {
      page.drawRectangle({
        x: MARGIN_X,
        y: y - ROW_HEIGHT,
        width: TABLE_WIDTH,
        height: ROW_HEIGHT,
        borderColor: COLOR_BORDER,
        borderWidth: .5,
      });
  
      page.drawLine({
        start: {
          x: MARGIN_X + COL_UNIT,
          y: y - ROW_HEIGHT
        },
        end: {
          x: MARGIN_X + COL_UNIT,
          y
        },
        thickness: .5,
        color: COLOR_BORDER,
      });
  
      page.drawLine({
        start: {
          x: MARGIN_X + COL_UNIT + COL_DESC,
          y: y - ROW_HEIGHT
        },
        end: {
          x: MARGIN_X + COL_UNIT + COL_DESC,
          y
        },
        thickness: .5,
        color: COLOR_BORDER,
      });
  
      y -= ROW_HEIGHT;
    }
  
    // Total Row
    page.drawRectangle({
      x: MARGIN_X,
      y: y - TABLE_HEADER_HEIGHT,
      width: TABLE_WIDTH,
      height: TABLE_HEADER_HEIGHT,
      color: COLOR_HEADER_FILL,
      borderColor: COLOR_BORDER,
      borderWidth: 1,
    });
  
    centerText(page, "TOTAL", MARGIN_X, TABLE_WIDTH, y - 13, fonts.bold, 10);
    return Promise.resolve(y - 20);
}

  function drawFooter(
    page: PDFPage,
    representative: string,
    startY: number,
    fonts: Fonts
  ) : Promise<number> {
    page.drawText(
      "Received the above unit in good order and condition.",
      {
        x: 190,
        y: startY,
        size: 8,
        font: fonts.regular,
      }
    );
  
    const sigY = startY - 70;
  
    page.drawText(representative, {
      x: 45,
      y: sigY,
      size: 9,
      font: fonts.bold,
    });
  
    page.drawLine({
      start: { x: 45, y: sigY - 2 },
      end: { x: 150, y: sigY - 2 },
      thickness: .5,
    });
  
    page.drawText("JESEAN Representative", {
      x: 45,
      y: sigY - 18,
      size: 8,
      font: fonts.regular,
    });
  
    page.drawText("Received by:", {
      x: 420,
      y: sigY + 40,
      size: 8,
      font: fonts.regular,
    });
  
    page.drawLine({
      start: { x: 400, y: sigY },
      end: { x: 570, y: sigY },
      thickness: .5,
    });
  
    page.drawText("Signature over Printed Name", {
      x: 400,
      y: sigY - 14,
      size: 7,
      font: fonts.regular,
    });
    return Promise.resolve(sigY - 18);
  }

  export async function generateRepairBillingPdf() {
    const pdf = await PDFDocument.create();
  
    pdf.registerFontkit(fontkit);
  
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  
    const fonts: Fonts = {
      regular: await pdf.embedFont(StandardFonts.Helvetica),
      bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    };
  
    //--------------------------------------------------
    // HEADER
    //--------------------------------------------------
    let billingY = await drawHeader(
        pdf,
        page,
        fonts,
        PAGE_HEIGHT - MARGIN_TOP
    );
    
    drawTitle(page, "BILLING STATEMENT", billingY, fonts);
    
    billingY -= 20;
    
    drawCustomerInfo(
        page,
        "SAMPLE CUSTOMER",
        new Date(),
        billingY,
        fonts
    );
    
    billingY -= 5;
    
    billingY = await drawTable(page, billingY, fonts);
    
    billingY = await drawFooter(page, "SUNDAY SETH A. ATUEL", billingY-20, fonts);
    
    page.drawLine({
        start: { x: 45, y: CENTER_Y },
        end: { x: 570, y: CENTER_Y },
        thickness: 1,
      });
    //--------------------------------------------------
    // JOB ORDER
    //--------------------------------------------------
    let jobY = CENTER_Y - MARGIN_TOP;

    jobY = await drawHeader(
        pdf,
        page,
        fonts,
        jobY
    );

    drawTitle(page, "JOB ORDER", jobY, fonts);

    jobY -= 20;

    drawCustomerInfo(
        page,
        "SAMPLE CUSTOMER",
        new Date(),
        jobY,
        fonts
    );

    jobY -= 5;

    jobY = await drawTable(page, jobY, fonts);

    jobY = await drawFooter(page, "SUNDAY SETH A. ATUEL", jobY-20, fonts);
    return Buffer.from(await pdf.save());
}



async function main() {
    try {
      const pdf = await generateRepairBillingPdf();
  
      const output = path.join(
        process.cwd(),
        "repair-billing-test.pdf"
      );
  
      await fs.writeFile(output, pdf);
  
      console.log("✅ PDF generated successfully!");
      console.log(`Saved to: ${output}`);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  }
  
  main();
 