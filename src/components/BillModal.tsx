import { useState } from "react";
import jsPDF from "jspdf";

export type BillSpool = { material: string; price: number };

type Props = {
  open: boolean;
  onClose: () => void;
  billNo: string;
  customerName: string;
  customerPhone: string;
  mode: "single" | "ams";
  weight: number;
  hours: number;
  minutes: number;
  singleMaterialLabel: string;
  singlePrice: number;
  spools: BillSpool[];
  breakdown: {
    materialCost: number;
    operationCost: number;
    electricityCost: number;
    baseCost: number;
    finalPrice: number;
  };
  pricingMode: "retail" | "wholesale";
  profitPercent: number;
};

function inr(n: number) {
  return `INR  ${Math.round(n).toLocaleString("en-IN")}`;
}

function todayStr() {
  return new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function BillModal(props: Props) {
  const {
    open, onClose, billNo, customerName, customerPhone, mode, weight,
    hours, minutes, singleMaterialLabel, singlePrice, spools, breakdown,
    pricingMode, profitPercent,
  } = props;

  const [generating, setGenerating] = useState(false);

  if (!open) return null;

  const date = todayStr();
  const timeLabel = `${hours} hrs ${String(minutes).padStart(2, "0")} min`;

  const buildPdf = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const M = 40;
    let y = 50;

    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.setTextColor(20, 20, 30);
    doc.text("Elite 3D", M, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(140, 110, 30);
    doc.text("Precision Printing. Perfect Pricing.", M, y + 16);
    doc.setTextColor(90, 90, 90);
    doc.text("Bambu Lab A1 AMS  ·  Tamil Nadu, India", M, y + 30);

    // Invoice title (right)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(20, 20, 30);
    doc.text("INVOICE", pageW - M, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    doc.text(`Bill No: ${billNo}`, pageW - M, y + 16, { align: "right" });
    doc.text(`Date: ${date}`, pageW - M, y + 30, { align: "right" });

    y += 56;
    doc.setDrawColor(200, 200, 200);
    doc.line(M, y, pageW - M, y);
    y += 22;

    // Bill To
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 30);
    doc.text("Bill To:", M, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text(customerName || "—", M, y + 16);
    if (customerPhone) doc.text(`Phone: ${customerPhone}`, M, y + 30);

    y += customerPhone ? 50 : 36;

    // Job details table
    const drawRow = (label: string, value: string, opts?: { header?: boolean; total?: boolean }) => {
      const rowH = 22;
      if (opts?.header) {
        doc.setFillColor(235, 235, 240);
        doc.rect(M, y, pageW - 2 * M, rowH, "F");
        doc.setFont("helvetica", "bold");
        doc.setTextColor(40, 40, 50);
      } else if (opts?.total) {
        doc.setFillColor(20, 20, 30);
        doc.rect(M, y, pageW - 2 * M, rowH + 4, "F");
        doc.setFont("helvetica", "bold");
        doc.setTextColor(245, 200, 90);
        doc.setFontSize(12);
      } else {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(50, 50, 50);
        doc.setFontSize(10);
      }
      doc.text(label, M + 10, y + (opts?.total ? 18 : 15));
      doc.text(value, pageW - M - 10, y + (opts?.total ? 18 : 15), { align: "right" });
      doc.setDrawColor(220, 220, 220);
      if (!opts?.total) doc.line(M, y + rowH, pageW - M, y + rowH);
      y += opts?.total ? rowH + 8 : rowH;
      doc.setFontSize(10);
    };

    doc.setFontSize(10);
    drawRow("Description", "Details", { header: true });
    drawRow("Print Type", mode === "single" ? "Single Colour" : "AMS Multi Colour (4 spools)");
    drawRow("Weight", `${weight} g`);
    drawRow("Print Time", timeLabel);

    if (mode === "single") {
      drawRow("Material", singleMaterialLabel);
    } else {
      spools.forEach((s, i) => {
        drawRow(`Spool ${i + 1}`, s.material);
      });
    }

    y += 14;
    drawRow("TOTAL PRICE", inr(breakdown.finalPrice), { total: true });

    // Footer
    y = doc.internal.pageSize.getHeight() - 80;
    doc.setDrawColor(220, 220, 220);
    doc.line(M, y, pageW - M, y);
    y += 18;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 30);
    doc.text("Thank you for choosing Elite 3D!", pageW / 2, y, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text("For queries contact: Elite 3D, Tamil Nadu, India", pageW / 2, y + 14, { align: "center" });
    doc.text("This is a computer generated bill.", pageW / 2, y + 28, { align: "center" });

    return doc;
  };

  const handleDownload = () => {
    setGenerating(true);
    try {
      const doc = buildPdf();
      doc.save(`Elite3D-${billNo}.pdf`);
    } finally {
      setGenerating(false);
    }
  };

  const handleOpenInTab = () => {
    const doc = buildPdf();
    const url = doc.output("bloburl");
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-gradient-surface shadow-card"
      >
        <div className="border-b border-border bg-card/60 p-5 text-center">
          <h2 className="text-2xl font-extrabold tracking-tight">
            <span className="text-gradient-gold">Elite</span> 3D
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Invoice Preview · {billNo}
          </p>
        </div>

        <div className="space-y-3 p-5 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Customer</span>
            <span className="font-medium text-foreground">{customerName || "—"}</span>
          </div>
          {customerPhone && (
            <div className="flex justify-between text-muted-foreground">
              <span>Phone</span>
              <span className="font-medium text-foreground">{customerPhone}</span>
            </div>
          )}
          <div className="flex justify-between text-muted-foreground">
            <span>Date</span>
            <span className="font-medium text-foreground">{date}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Print</span>
            <span className="font-medium text-foreground">
              {mode === "single" ? "Single Colour" : "AMS (4 spools)"} · {weight}g · {timeLabel}
            </span>
          </div>

          <div className="rounded-xl border border-primary/40 bg-primary/10 p-5 text-center">
            <p className="text-xs uppercase tracking-wider text-primary/80">Total</p>
            <p className="mt-1 text-4xl font-extrabold text-gradient-gold">
              INR {Math.round(breakdown.finalPrice).toLocaleString("en-IN")}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 border-t border-border bg-card/40 p-4">
          <button
            onClick={handleOpenInTab}
            className="rounded-lg border border-border bg-input px-3 py-2 text-sm font-medium hover:border-primary hover:text-primary"
          >
            Open
          </button>
          <button
            onClick={handleDownload}
            disabled={generating}
            className="rounded-lg bg-gradient-gold px-3 py-2 text-sm font-semibold text-primary-foreground shadow-gold disabled:opacity-60"
          >
            {generating ? "..." : "Download PDF"}
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-border bg-input px-3 py-2 text-sm font-medium hover:border-primary hover:text-primary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
