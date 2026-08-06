"use client";

import { ReceiptHeader } from "./receipt-header";
import { ReceiptTable } from "./receipt-table";
import { ReceiptFooter } from "./receipt-footer";
import { formatCurrency } from "@/lib/utils";

export function DeliveryReceipt({ sale }: any) {
  return (
    <>
      <style>{`
      @media print{

        body{
          background:white;
        }

        .no-print{
          display:none;
        }

        .receipt{
          width:210mm;
          min-height:297mm;
          margin:0 auto;
          padding:10mm;
          box-shadow:none;
        }

      }
      `}</style>

      <div className="flex justify-center mb-5 no-print">
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
        >
          Print
        </button>
      </div>

      <div className="receipt bg-white shadow-lg border p-8">

        <ReceiptHeader sale={sale} />

        <ReceiptTable lines={sale.lines} />

        <div className="mt-4 flex justify-end">
          <table>
            <tbody>
              <tr className="font-bold text-lg">
                <td className="pr-8">TOTAL</td>
                <td>{formatCurrency(sale.totalAmount)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <ReceiptFooter />

      </div>
    </>
  );
}