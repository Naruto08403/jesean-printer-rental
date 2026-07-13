import { PrismaClient } from "@prisma/client";
import {
  PDFDocument,
  StandardFonts,
  TextAlignment,
  rgb,
} from "pdf-lib";
import fs from "fs/promises";

const prisma = new PrismaClient();

async function generateDiagnosisPdf() {
  const diagnosisOptions = await prisma.repairDiagnosisOption.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]); // Letter

  const form = pdf.getForm();

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

  const COLOR_HEADER_FILL = rgb(0.718, 0.835, 0.714);
  const COLOR_BORDER = rgb(0.45, 0.55, 0.45);
  const COLOR_TEXT = rgb(0.1, 0.1, 0.1);

  const START_X = 50;
  const START_Y = 740;

  const NAME_WIDTH = 380;
  const PRICE_WIDTH = 120;
  const ROW_HEIGHT = 24;

  let y = START_Y;

  // Title
  page.drawText("DIAGNOSIS PRICE LIST", {
    x: 180,
    y: y + 20,
    size: 16,
    font: boldFont,
    color: COLOR_TEXT,
  });

  // Header
  page.drawRectangle({
    x: START_X,
    y: y - ROW_HEIGHT,
    width: NAME_WIDTH + PRICE_WIDTH,
    height: ROW_HEIGHT,
    color: COLOR_HEADER_FILL,
    borderColor: COLOR_BORDER,
    borderWidth: 1,
  });

  page.drawText("NAME", {
    x: START_X + 10,
    y: y - 16,
    size: 10,
    font: boldFont,
    color: COLOR_TEXT,
  });

  page.drawText("PRICE", {
    x: START_X + NAME_WIDTH + 35,
    y: y - 16,
    size: 10,
    font: boldFont,
    color: COLOR_TEXT,
  });

  y -= ROW_HEIGHT;

  for (const item of diagnosisOptions) {
    // New page if needed
    if (y < 80) {
      y = START_Y;

      const newPage = pdf.addPage([612, 792]);

      page.drawText(""); // keep TS happy if strict
    }

    page.drawRectangle({
      x: START_X,
      y: y - ROW_HEIGHT,
      width: NAME_WIDTH + PRICE_WIDTH,
      height: ROW_HEIGHT,
      borderColor: COLOR_BORDER,
      borderWidth: 0.5,
    });

    page.drawLine({
      start: {
        x: START_X + NAME_WIDTH,
        y: y - ROW_HEIGHT,
      },
      end: {
        x: START_X + NAME_WIDTH,
        y: y,
      },
      thickness: 0.5,
      color: COLOR_BORDER,
    });

    page.drawText(item.name, {
      x: START_X + 8,
      y: y - 16,
      size: 9,
      font,
      color: COLOR_TEXT,
    });

    const field = form.createTextField(
      `diagnosis_price_${item.id}`
    );

    field.setAlignment(TextAlignment.Center);
    field.setText(item.price.toFixed(0));

    field.addToPage(page, {
      x: START_X + NAME_WIDTH + 2,
      y: y - ROW_HEIGHT + 2,
      width: PRICE_WIDTH - 4,
      height: ROW_HEIGHT - 4,
      borderWidth: 0,
    });

    field.setFontSize(9);

    y -= ROW_HEIGHT;
  }

  const pdfBytes = await pdf.save();

  await fs.writeFile("diagnosis.pdf", pdfBytes);

  console.log(
    `diagnosis.pdf generated with ${diagnosisOptions.length} records`
  );
}

generateDiagnosisPdf()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });