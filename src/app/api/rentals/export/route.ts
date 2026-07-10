import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

import { prisma } from "@/lib/prisma";
import {
  buildClientAnnualRows,
  isFutureMonth,
} from "@/lib/rental-annual";

function peso(value: number) {
  return Number(value.toFixed(2));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const year =
    Number(searchParams.get("year")) || new Date().getFullYear();

  const rentals = await prisma.rental.findMany({
    include: {
      client: true,
      printer: true,
      payments: true,
      pausePeriods: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const rows = buildClientAnnualRows(rentals, year);

  const workbook = new ExcelJS.Workbook();

  workbook.creator = "Printer Rental System";
  workbook.company = "Printer Rental System";
  workbook.created = new Date();

  const ws = workbook.addWorksheet(`Rentals ${year}`);

  ws.views = [
    {
      state: "frozen",
      xSplit: 2,
      ySplit: 1,
    },
  ];

  ws.columns = [
    { header: "Client", key: "client", width: 35 },
    { header: "Units", key: "units", width: 10 },

    { header: "Jan", key: "m0", width: 15 },
    { header: "Feb", key: "m1", width: 15 },
    { header: "Mar", key: "m2", width: 15 },
    { header: "Apr", key: "m3", width: 15 },
    { header: "May", key: "m4", width: 15 },
    { header: "Jun", key: "m5", width: 15 },
    { header: "Jul", key: "m6", width: 15 },
    { header: "Aug", key: "m7", width: 15 },
    { header: "Sep", key: "m8", width: 15 },
    { header: "Oct", key: "m9", width: 15 },
    { header: "Nov", key: "m10", width: 15 },
    { header: "Dec", key: "m11", width: 15 },

    { header: "Total", key: "total", width: 18 },
    { header: "Status", key: "status", width: 15 },
  ];

  const header = ws.getRow(1);

  header.height = 24;

  header.eachCell((cell) => {
    cell.font = {
      bold: true,
      color: {
        argb: "FFFFFFFF",
      },
    };

    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: "1E40AF",
      },
    };

    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    cell.border = {
      top: {
        style: "thin",
      },
      bottom: {
        style: "thin",
      },
      left: {
        style: "thin",
      },
      right: {
        style: "thin",
      },
    };
  });

  const monthTotals = Array(12).fill(0);

  let totalUnits = 0;
  let grandTotal = 0;

  for (const row of rows) {
    totalUnits += row.unitCount;
    grandTotal += row.yearPaid;

    const excelRow: Record<string, unknown> = {
      client: row.clientName,
      units: row.unitCount,
      total: peso(row.yearPaid),
      status: row.status,
    };

    row.months.forEach((cell, index) => {
      monthTotals[index] += cell.paid;

      if (cell.state === "out") {
        excelRow[`m${index}`] = "-";
        return;
      }

      if (isFutureMonth(year, cell.month)) {
        excelRow[`m${index}`] = "-";
        return;
      }

      if (cell.state === "paused") {
        excelRow[`m${index}`] =
          cell.paid > 0
            ? peso(cell.paid)
            : "Pause";
        return;
      }

      if (cell.state === "stopped") {
        excelRow[`m${index}`] =
          cell.paid > 0
            ? peso(cell.paid)
            : "Stop";
        return;
      }

      if (cell.state === "running") {
        excelRow[`m${index}`] =
          cell.paid > 0
            ? peso(cell.paid)
            : "Run";
        return;
      }

      if (cell.paid > 0) {
        excelRow[`m${index}`] = peso(cell.paid);
        return;
      }

      if (cell.expected != null) {
        excelRow[`m${index}`] =
          `Due ${peso(cell.expected)}`;
        return;
      }

      excelRow[`m${index}`] = "-";
    });

    const added = ws.addRow(excelRow);
    added.eachCell((cell, col) => {
        cell.border = {
          top: { style: "thin", color: { argb: "DDDDDD" } },
          bottom: { style: "thin", color: { argb: "DDDDDD" } },
          left: { style: "thin", color: { argb: "DDDDDD" } },
          right: { style: "thin", color: { argb: "DDDDDD" } },
        };
  
        if (col === 1) {
          cell.font = {
            bold: true,
          };
        }
  
        if (col >= 3 && col <= 14) {
          const month = row.months[col - 3];
  
          cell.alignment = {
            horizontal: "center",
            vertical: "middle",
          };
  
          if (month.paid > 0) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: {
                argb: "C6EFCE",
              },
            };
  
            cell.font = {
              color: {
                argb: "006100",
              },
              bold: true,
            };
          } else if (month.state === "expected") {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: {
                argb: "FFC7CE",
              },
            };
  
            cell.font = {
              color: {
                argb: "9C0006",
              },
              bold: true,
            };
          } else if (
            month.state === "paused" ||
            month.state === "stopped"
          ) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: {
                argb: "FFF2CC",
              },
            };
  
            cell.font = {
              color: {
                argb: "7F6000",
              },
              bold: true,
            };
          } else if (
            month.state === "running"
          ) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: {
                argb: "D9EAD3",
              },
            };
  
            cell.font = {
              color: {
                argb: "274E13",
              },
            };
          } else {
            cell.font = {
              color: {
                argb: "808080",
              },
            };
          }
        }
  
        if (col === 15) {
          cell.numFmt = '#,##0.00';
          cell.font = {
            bold: true,
          };
        }
      });
    }
  
    const totalRow = ws.addRow({
      client: "TOTAL",
      units: totalUnits,
      m0: peso(monthTotals[0]),
      m1: peso(monthTotals[1]),
      m2: peso(monthTotals[2]),
      m3: peso(monthTotals[3]),
      m4: peso(monthTotals[4]),
      m5: peso(monthTotals[5]),
      m6: peso(monthTotals[6]),
      m7: peso(monthTotals[7]),
      m8: peso(monthTotals[8]),
      m9: peso(monthTotals[9]),
      m10: peso(monthTotals[10]),
      m11: peso(monthTotals[11]),
      total: peso(grandTotal),
      status: "",
    });
  
    totalRow.eachCell((cell) => {
      cell.font = {
        bold: true,
      };
  
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: "D9EAD3",
        },
      };
  
      cell.border = {
        top: { style: "medium" },
        bottom: { style: "medium" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
  
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
      };
    });
  
    ws.autoFilter = {
      from: {
        row: 1,
        column: 1,
      },
      to: {
        row: 1,
        column: 16,
      },
    };
  
    const buffer = await workbook.xlsx.writeBuffer();
  
    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=Rental-Annual-${year}.xlsx`,
      },
    });
  }