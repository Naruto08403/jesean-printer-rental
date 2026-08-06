export default function Loading() {
    return (
      <div className="min-h-screen bg-slate-100 py-8">
        <div className="mx-auto max-w-5xl rounded-lg border bg-white p-8 shadow animate-pulse">
  
          {/* Print Button */}
          <div className="mb-6 flex justify-center">
            <div className="h-10 w-40 rounded bg-slate-200"></div>
          </div>
  
          {/* Header */}
          <div className="flex gap-4">
  
            <div className="h-24 w-24 rounded bg-slate-200"></div>
  
            <div className="flex-1 space-y-3">
  
              <div className="mx-auto h-7 w-96 rounded bg-slate-200"></div>
  
              <div className="mx-auto h-4 w-72 rounded bg-slate-200"></div>
  
              <div className="mx-auto h-4 w-56 rounded bg-slate-200"></div>
  
              <div className="mx-auto mt-6 h-8 w-64 rounded bg-slate-200"></div>
  
            </div>
  
          </div>
  
          {/* Customer */}
          <div className="mt-8 flex justify-between">
  
            <div className="h-5 w-72 rounded bg-slate-200"></div>
  
            <div className="h-5 w-40 rounded bg-slate-200"></div>
  
          </div>
  
          {/* Table */}
          <div className="mt-6 overflow-hidden rounded border">
  
            {/* Header */}
            <div className="grid grid-cols-5 bg-slate-200">
              <div className="h-10 border-r"></div>
              <div className="border-r"></div>
              <div className="border-r"></div>
              <div className="border-r"></div>
              <div></div>
            </div>
  
            {/* Rows */}
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-5 border-t"
              >
                <div className="h-10 border-r bg-slate-100"></div>
                <div className="border-r bg-slate-100"></div>
                <div className="border-r bg-slate-100"></div>
                <div className="border-r bg-slate-100"></div>
                <div className="bg-slate-100"></div>
              </div>
            ))}
  
          </div>
  
          {/* Total */}
          <div className="mt-6 flex justify-end">
            <div className="h-8 w-56 rounded bg-slate-200"></div>
          </div>
  
          {/* Signature */}
          <div className="mt-24">
            <div className="h-4 w-32 rounded bg-slate-200"></div>
            <div className="mt-12 h-px w-72 bg-slate-300"></div>
          </div>
  
        </div>
      </div>
    );
  }