import { useMemo, useState, useEffect } from "react";
import { BillModal } from "./BillModal";

const LS = {
  counter: "elite3d:billCounter",
  electricity: "elite3d:electricityRate",
  singlePrice: "elite3d:singlePrice",
  spoolPrices: "elite3d:spoolPrices",
  profit: "elite3d:profitPercent",
};

function nextBillNo(n: number) {
  return `E3D-${String(n).padStart(3, "0")}`;
}

function readLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(key);
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
function writeLS(key: string, val: unknown) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ }
}

type MaterialKey = "PLA" | "PLA_PRO" | "TPU" | "ABS" | "PETG";

const materials: Record<MaterialKey, { price: number; multiplier: number; label: string }> = {
  PLA: { price: 800, multiplier: 1.0, label: "PLA" },
  PLA_PRO: { price: 1000, multiplier: 1.1, label: "PLA Pro" },
  TPU: { price: 1500, multiplier: 1.3, label: "TPU" },
  ABS: { price: 900, multiplier: 1.2, label: "ABS" },
  PETG: { price: 1100, multiplier: 1.15, label: "PETG" },
};

const PRINTER_KWH = 0.095;
const TIME_RATE = 20;
const MACHINE_RATE = 10;

const SPOOL_COLORS = ["bg-spool-1", "bg-spool-2", "bg-spool-3", "bg-spool-4"];
const SPOOL_NAMES = ["Spool 1", "Spool 2", "Spool 3", "Spool 4"];

type Spool = { material: MaterialKey; price: number };
type Mode = "single" | "ams";
type PricingMode = "retail" | "wholesale";

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    const start = display;
    const diff = value - start;
    if (diff === 0) return;
    const duration = 350;
    const startTime = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - startTime) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(start + diff * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <>₹{display.toLocaleString("en-IN")}</>;
}

function NumberField({
  label,
  value,
  onChange,
  min = 0,
  step = 1,
  suffix,
  helper,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
  suffix?: string;
  helper?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground/90">{label}</span>
      <div className="relative">
        <input
          type="number"
          value={Number.isFinite(value) ? value : ""}
          min={min}
          step={step}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            onChange(Number.isFinite(v) && v >= min ? v : min);
          }}
          className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {helper && <p className="mt-1.5 text-xs text-muted-foreground">{helper}</p>}
    </label>
  );
}

function MaterialSelect({
  value,
  onChange,
}: {
  value: MaterialKey;
  onChange: (m: MaterialKey) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as MaterialKey)}
      className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
    >
      {(Object.keys(materials) as MaterialKey[]).map((k) => (
        <option key={k} value={k}>
          {materials[k].label}
        </option>
      ))}
    </select>
  );
}

export function PricingCalculator() {
  const [mode, setMode] = useState<Mode>("single");
  const [weight, setWeight] = useState(50);
  const [hours, setHours] = useState(2);
  const [minutes, setMinutes] = useState(0);

  const [singleMaterial, setSingleMaterial] = useState<MaterialKey>("PLA");
  const [singlePrice, setSinglePrice] = useState<number>(() =>
    readLS(LS.singlePrice, materials.PLA.price)
  );

  const [spools, setSpools] = useState<Spool[]>(() => {
    const saved = readLS<Spool[] | null>(LS.spoolPrices, null);
    if (saved && saved.length === 4) return saved;
    return [
      { material: "PLA", price: materials.PLA.price },
      { material: "PLA", price: materials.PLA.price },
      { material: "PLA", price: materials.PLA.price },
      { material: "PLA", price: materials.PLA.price },
    ];
  });

  const [electricityRate, setElectricityRate] = useState<number>(() =>
    readLS(LS.electricity, 5.5)
  );
  const [electricityOpen, setElectricityOpen] = useState(false);

  const [pricingMode, setPricingMode] = useState<PricingMode>("retail");
  const [profitPercent, setProfitPercent] = useState<number>(() =>
    readLS(LS.profit, 30)
  );
  const [billOpen, setBillOpen] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [billCounter, setBillCounter] = useState<number>(() =>
    readLS(LS.counter, 1)
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  // Persist settings
  useEffect(() => { writeLS(LS.electricity, electricityRate); }, [electricityRate]);
  useEffect(() => { writeLS(LS.singlePrice, singlePrice); }, [singlePrice]);
  useEffect(() => { writeLS(LS.spoolPrices, spools); }, [spools]);
  useEffect(() => { writeLS(LS.profit, profitPercent); }, [profitPercent]);
  useEffect(() => { writeLS(LS.counter, billCounter); }, [billCounter]);

  const updateSingleMaterial = (m: MaterialKey) => {
    setSingleMaterial(m);
    setSinglePrice(materials[m].price);
  };

  const updateSpoolMaterial = (i: number, m: MaterialKey) => {
    setSpools((prev) =>
      prev.map((s, idx) => (idx === i ? { material: m, price: materials[m].price } : s))
    );
  };
  const updateSpoolPrice = (i: number, p: number) => {
    setSpools((prev) => prev.map((s, idx) => (idx === i ? { ...s, price: p } : s)));
  };

  const totalMinutes = Math.max(0, (hours || 0) * 60 + (minutes || 0));

  const breakdown = useMemo(() => {
    const w = Math.max(1, weight || 0);
    const t = Math.max(1, totalMinutes) / 60;

    let materialCost = 0;
    let adjTime = t;
    let multiplier = 1;

    if (mode === "single") {
      materialCost = (w / 1000) * singlePrice;
      adjTime = t;
      multiplier = materials[singleMaterial].multiplier;
    } else {
      const raw = spools.reduce((sum, s) => sum + (w / 4 / 1000) * s.price, 0);
      materialCost = raw * 1.3;
      adjTime = t * 1.25;
      multiplier =
        spools.reduce((sum, s) => sum + materials[s.material].multiplier, 0) / 4;
    }

    const operationCost = adjTime * (TIME_RATE + MACHINE_RATE);
    const electricityCost = adjTime * PRINTER_KWH * electricityRate;
    const baseCost = (materialCost + operationCost + electricityCost) * multiplier;

    const margin = pricingMode === "retail" ? 1.5 : 1 + (profitPercent || 0) / 100;
    const finalPrice = Math.round(baseCost * margin);

    return {
      materialCost: Math.round(materialCost),
      operationCost: Math.round(operationCost),
      electricityCost: Math.round(electricityCost),
      baseCost: Math.round(baseCost),
      finalPrice,
    };
  }, [mode, weight, totalMinutes, singleMaterial, singlePrice, spools, electricityRate, pricingMode, profitPercent]);

  const billNo = nextBillNo(billCounter);

  const handleGenerateBill = () => {
    if ((weight || 0) <= 0) return setValidationError("Please enter weight (grams).");
    if (totalMinutes <= 0) return setValidationError("Please enter print time (hours or minutes).");
    if (breakdown.finalPrice <= 0) return setValidationError("Final price must be greater than zero.");
    if (!customerName.trim()) return setValidationError("Customer name is required.");
    setValidationError(null);
    setBillOpen(true);
  };

  const handleBillClose = () => {
    setBillOpen(false);
    // Increment counter after a bill was opened (one-shot per generation)
    setBillCounter((c) => c + 1);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/60 bg-gradient-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
              <span className="text-gradient-gold">Elite</span>{" "}
              <span className="text-foreground">3D</span>
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground md:text-sm">
              Precision Printing. Perfect Pricing.
            </p>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground md:flex">
            <span className="h-2 w-2 rounded-full bg-primary shadow-gold" />
            Bambu Lab A1 AMS
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-5 py-8 lg:grid-cols-[1fr_380px]">
        {/* Inputs */}
        <section className="space-y-6">
          {/* Print type */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Print Type
            </h2>
            <div className="relative grid grid-cols-2 rounded-xl border border-border bg-input p-1">
              <span
                className={`absolute inset-y-1 w-[calc(50%-4px)] rounded-lg bg-gradient-gold transition-all duration-300 ${
                  mode === "single" ? "left-1" : "left-[calc(50%+0px)]"
                }`}
              />
              {(["single", "ams"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`relative z-10 rounded-lg py-2.5 text-sm font-semibold transition ${
                    mode === m ? "text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  {m === "single" ? "Single Colour" : "AMS Multi Colour"}
                </button>
              ))}
            </div>
          </div>

          {/* Print details */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Print Details
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <NumberField
                label="Weight"
                value={weight}
                onChange={setWeight}
                min={1}
                step={1}
                suffix="g"
              />
              <NumberField
                label="Hours"
                value={hours}
                onChange={(v) => setHours(Math.max(0, Math.min(99, Math.floor(v))))}
                min={0}
                step={1}
                suffix="hrs"
              />
              <NumberField
                label="Minutes"
                value={minutes}
                onChange={(v) => setMinutes(Math.max(0, Math.min(59, Math.floor(v))))}
                min={0}
                step={1}
                suffix="min"
              />
            </div>
          </div>

          {/* Material */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {mode === "single" ? "Material" : "AMS Spools (4)"}
            </h2>

            {mode === "single" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Material</span>
                  <MaterialSelect value={singleMaterial} onChange={updateSingleMaterial} />
                </label>
                <NumberField
                  label="Filament Price"
                  value={singlePrice}
                  onChange={setSinglePrice}
                  min={0}
                  step={10}
                  suffix="₹/kg"
                />
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {spools.map((s, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-border bg-input/40 p-4"
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <span className={`h-3 w-3 rounded-full ${SPOOL_COLORS[i]}`} />
                      <span className="text-sm font-semibold">{SPOOL_NAMES[i]}</span>
                    </div>
                    <div className="space-y-2.5">
                      <MaterialSelect
                        value={s.material}
                        onChange={(m) => updateSpoolMaterial(i, m)}
                      />
                      <div className="relative">
                        <input
                          type="number"
                          value={s.price}
                          min={0}
                          step={10}
                          onChange={(e) =>
                            updateSpoolPrice(i, Math.max(0, parseFloat(e.target.value) || 0))
                          }
                          className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          ₹/kg
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Electricity */}
          <div className="rounded-2xl border border-border bg-card shadow-card">
            <button
              onClick={() => setElectricityOpen((v) => !v)}
              className="flex w-full items-center justify-between p-5 text-left"
            >
              <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                ⚙️ Electricity Settings
              </span>
              <span
                className={`text-muted-foreground transition-transform ${
                  electricityOpen ? "rotate-180" : ""
                }`}
              >
                ▾
              </span>
            </button>
            {electricityOpen && (
              <div className="border-t border-border px-5 pb-5 pt-4">
                <NumberField
                  label="Electricity Rate (₹ per unit / kWh)"
                  value={electricityRate}
                  onChange={setElectricityRate}
                  min={0}
                  step={0.1}
                  suffix="₹/kWh"
                  helper="Update this after measuring with your energy meter for exact pricing"
                />
              </div>
            )}
          </div>

          {/* Pricing mode */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Pricing Mode
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {(["retail", "wholesale"] as PricingMode[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPricingMode(p)}
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold capitalize transition ${
                    pricingMode === p
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-input text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p}
                  <span className="mt-0.5 block text-[11px] font-normal opacity-70">
                    {p === "retail" ? "Fixed 50% margin" : "Custom profit %"}
                  </span>
                </button>
              ))}
            </div>
            {pricingMode === "wholesale" && (
              <div className="mt-4">
                <NumberField
                  label="Profit %"
                  value={profitPercent}
                  onChange={setProfitPercent}
                  min={0}
                  step={1}
                  suffix="%"
                />
              </div>
            )}
          </div>
        </section>

        {/* Results */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="overflow-hidden rounded-2xl border border-border bg-gradient-surface shadow-card">
            <div className="border-b border-border bg-card/50 p-5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Estimated Price
              </p>
              <p className="mt-1 text-4xl font-extrabold text-gradient-gold md:text-5xl">
                <AnimatedNumber value={breakdown.finalPrice} />
              </p>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                {pricingMode === "retail"
                  ? "Retail · 50% margin"
                  : `Wholesale · ${profitPercent || 0}% margin`}
              </div>
            </div>
            <div className="space-y-2 p-5">
              {[
                { label: "Material Cost", v: breakdown.materialCost },
                { label: "Operation Cost", v: breakdown.operationCost },
                { label: "Electricity Cost", v: breakdown.electricityCost },
              ].map((r) => (
                <div
                  key={r.label}
                  className="flex items-center justify-between rounded-lg bg-card/60 px-4 py-2.5 text-sm"
                >
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="font-semibold tabular-nums">
                    ₹{r.v.toLocaleString("en-IN")}
                  </span>
                </div>
              ))}
              <div className="mt-2 flex items-center justify-between rounded-lg border border-border bg-input/40 px-4 py-3">
                <span className="text-sm font-medium">Base Cost (before profit)</span>
                <span className="font-bold tabular-nums">
                  ₹{breakdown.baseCost.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="mt-3 space-y-2 rounded-xl border border-border bg-card/40 p-3">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Customer Name *
                  </span>
                  <input
                    type="text"
                    value={customerName}
                    maxLength={60}
                    placeholder="e.g. Ravi Kumar"
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Phone (optional)
                  </span>
                  <input
                    type="tel"
                    value={customerPhone}
                    maxLength={20}
                    placeholder="e.g. 98765 43210"
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                  />
                </label>
                <p className="text-[11px] text-muted-foreground">
                  Next Bill: <span className="font-mono text-foreground">{billNo}</span>
                </p>
              </div>
              {validationError && (
                <p className="mt-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {validationError}
                </p>
              )}
              <button
                onClick={handleGenerateBill}
                className="mt-3 w-full rounded-xl bg-gradient-gold px-4 py-3 text-sm font-bold text-primary-foreground shadow-gold transition hover:opacity-95 active:scale-[0.99]"
              >
                🧾 Generate Bill / PDF
              </button>
            </div>
          </div>
        </aside>
      </main>

      <BillModal
        open={billOpen}
        onClose={handleBillClose}
        billNo={billNo}
        customerName={customerName}
        customerPhone={customerPhone}
        mode={mode}
        weight={Math.max(1, weight || 0)}
        hours={hours}
        minutes={minutes}
        singleMaterialLabel={materials[singleMaterial].label}
        singlePrice={singlePrice}
        spools={spools.map((s) => ({ material: materials[s.material].label, price: s.price }))}
        breakdown={breakdown}
        pricingMode={pricingMode}
        profitPercent={pricingMode === "retail" ? 50 : profitPercent}
      />

      <footer className="mt-8 border-t border-border/60 bg-card/30">
        <div className="mx-auto max-w-6xl px-5 py-6 text-center">
          <p className="text-sm font-medium">
            Elite 3D © 2025 · Powered by Bambu Lab A1 AMS
          </p>
          <p className="mt-1 text-xs italic text-muted-foreground">
            Built for precision. Priced for profit.
          </p>
        </div>
      </footer>
    </div>
  );
}
