import { formatCurrency } from "@/lib/utils";

interface SaleLine {
  id: string;
  saleId: string;
  productId: string | null;
  product?: { name: string } | null;
  name: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export function ReceiptTable({ lines }: { lines: SaleLine[] }) {
  return (
    <table className="mt-4 w-full border-collapse border border-black">

      <thead>

        <tr className="bg-green-300">

          <th className="border border-black p-2">
            Item Name
          </th>

          <th className="border border-black p-2">
            Description / Specification
          </th>

          <th className="border border-black p-2 text-center w-24">
            Pcs / Units
          </th>

          <th className="border border-black p-2 text-right w-32">
            Unit Price
          </th>

          <th className="border border-black p-2 text-right w-36">
            Total Price
          </th>

        </tr>

      </thead>

      <tbody>

        {lines.map((line) => (

          <tr key={line.id}>

            <td className="border border-black p-2">
              {line.product?.name ?? line.name}
            </td>

            <td className="border border-black p-2">
              {line.name}
            </td>

            <td className="border border-black p-2 text-center">
              {line.qty}
            </td>

            <td className="border border-black p-2 text-right">
              {formatCurrency(line.unitPrice)}
            </td>

            <td className="border border-black p-2 text-right">
              {formatCurrency(line.lineTotal)}
            </td>

          </tr>

        ))}

        {Array.from({
          length: Math.max(0, 12 - lines.length),
        }).map((_, i) => (

          <tr key={i}>

            <td className="border border-black h-9"></td>

            <td className="border border-black"></td>

            <td className="border border-black"></td>

            <td className="border border-black"></td>

            <td className="border border-black"></td>

          </tr>

        ))}

      </tbody>

    </table>
  );
}