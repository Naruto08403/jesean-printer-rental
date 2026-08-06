import Image from "next/image";
import { format } from "date-fns";

export function ReceiptHeader({ sale }: any) {
  return (
    <>
      {/* Top line */}
      <div className="mb-6 border-t-2 border-green-700"></div>

      {/* Company Header */}
      <div className="flex justify-center">
  <div>

    <h1 className="text-4xl font-bold uppercase text-slate-900">
      JESEAN PRINTER & COMPUTER SPECIALISTS
    </h1>

    <div className="mt-2 flex items-center gap-4">

      <Image
        src="/logo.png"
        alt="Logo"
        width={95}
        height={95}
        className="object-contain"
      />

      <div>
        <p className="text-xl">
          Durano Street, Brgy. Diego Silang, Butuan City
        </p>

        <p className="text-xl">
          Contact No. 09100037442
        </p>
      </div>

    </div>

  </div>
</div>

<h2 className="mt-6 text-center text-5xl font-bold uppercase">
  DELIVERY RECEIPT
</h2>

      {/* Customer / Date */}
      <div className="mt-8 flex justify-between border-b border-slate-400 pb-2">

        <div>
          <span className="font-semibold">CUSTOMER :</span>{" "}
          <span>{sale.client?.name ?? "Walk-in Customer"}</span>
        </div>

        <div>
          <span className="font-semibold">DATE :</span>{" "}
          <span>{format(sale.createdAt, "MM/dd/yyyy")}</span>
        </div>

      </div>
    </>
  );
}