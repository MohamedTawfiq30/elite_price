import { createFileRoute } from "@tanstack/react-router";
import { PricingCalculator } from "@/components/PricingCalculator";

export const Route = createFileRoute("/")({
  component: PricingCalculator,
  head: () => ({
    meta: [
      { title: "Elite 3D — Precision Printing. Perfect Pricing." },
      {
        name: "description",
        content:
          "Elite 3D pricing calculator for Bambu Lab A1 AMS prints. Real-time, profit-safe estimates in ₹.",
      },
      { property: "og:title", content: "Elite 3D — 3D Print Pricing Calculator" },
      {
        property: "og:description",
        content: "Accurate Bambu Lab A1 AMS print pricing in real time.",
      },
    ],
  }),
});
