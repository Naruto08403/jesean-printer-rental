import {
    AlignmentType,
    BorderStyle,
    Document,
   HeadingLevel,
    ImageRun,
    Packer,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
  } from "docx";
  
  import fs from "fs/promises";
  import path from "path";
  
  import type { RepairBillingPdfInput } from "./repair-billing-pdf";
  import { repairBillingLineTotal } from "@/lib/repair-billing-lines";
  
  function money(value: number) {
    return value.toLocaleString("en-US");
  }
  
  function formatDate(d: Date) {
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  }
  
  export async function generateRepairBillingDocx(
    input: RepairBillingPdfInput
  ): Promise<Buffer> {
    const logo = await fs.readFile(
      path.join(process.cwd(), "public/images/logo.png")
    );
  
    const billingItems =
      input.billingStatementItems ?? [];
  
    const total = repairBillingLineTotal(billingItems);
  
    const table = new Table({
      width: {
        size: 100,
        type: WidthType.PERCENTAGE,
      },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: "UNIT", bold: true })],
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: "DESCRIPTION", bold: true })],
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: "PRICE", bold: true })],
                }),
              ],
            }),
          ],
        }),
  
        ...billingItems.map(
          (item) =>
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      text: item.unitLabel ?? "",
                    }),
                  ],
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      text: item.description,
                    }),
                  ],
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.RIGHT,
                      text:
                        item.amount != null
                          ? money(item.amount)
                          : "",
                    }),
                  ],
                }),
              ],
            })
        ),
  
        new TableRow({
          children: [
            new TableCell({
              columnSpan: 2,
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: "TOTAL",
                      bold: true,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: money(total),
                      bold: true,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });
  
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                    type: "png",
                    data: logo,
                    transformation: {
                      width: 70,
                      height: 70,
                    },
                  })
              ],
            }),
  
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: "JESEAN PRINTER & COMPUTER SPECIALISTS",
                  bold: true,
                }),
              ],
            }),
  
            new Paragraph({
              alignment: AlignmentType.CENTER,
              text: "Durano Street, Brgy. Diego Silang, Butuan City",
            }),
  
            new Paragraph({
              alignment: AlignmentType.CENTER,
              text: "Contact No. 09100037442",
            }),
  
            new Paragraph(""),
  
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              alignment: AlignmentType.CENTER,
              text: input.documentTitle ?? "BILLING STATEMENT",
            }),
  
            new Paragraph({
              children: [
                new TextRun({
                  text: `Customer: ${input.clientName}`,
                  bold: true,
                }),
                new TextRun({
                  text: `     Date: ${formatDate(input.issueDate)}`,
                }),
              ],
            }),
  
            table,
  
            new Paragraph(""),
            new Paragraph("Received the above unit in good order and condition."),
            new Paragraph(""),
  
            new Paragraph({
              text:
                input.representativeName ??
                "SUNDAY SETH A. ATUEL",
            }),
  
            new Paragraph("JESEAN Representative"),
  
            new Paragraph(""),
  
            new Paragraph(
              "______________________________________________"
            ),
  
            new Paragraph("Signature over Printed Name"),
          ],
        },
      ],
    });
  
    return Buffer.from(await Packer.toBuffer(doc));
  }