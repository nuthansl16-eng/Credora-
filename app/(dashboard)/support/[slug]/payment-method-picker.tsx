"use client";

import { useState } from "react";
import { getPaymentMethodsForCheckout, type PaymentMethodId } from "@/lib/payments/payment-methods";

export function PaymentMethodPicker({ region, value, onChange }: { region: string; value: PaymentMethodId; onChange: (value: PaymentMethodId) => void }) {
  const provider = region.toUpperCase() === "IN" ? "razorpay" : "stripe";
  const methods = getPaymentMethodsForCheckout(region, provider);
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? methods : methods.slice(0, 8);

  return (
    <div className="mb-5 rounded-lg border p-4">
      <div className="mb-3">
        <p className="font-semibold">Payment method</p>
        <p className="text-xs text-muted-foreground">Available methods vary by country, currency, device and payment provider.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {shown.map((method) => (
          <button key={method.id} type="button" onClick={() => onChange(method.id)} className={`rounded-md border p-3 text-left text-sm ${value === method.id ? "border-primary ring-1 ring-primary" : ""}`}>
            <span className="font-medium">{method.label}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{method.description}</span>
          </button>
        ))}
      </div>
      {methods.length > 8 && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-3 text-xs font-medium text-primary">
          {expanded ? "Show fewer" : `Show all ${methods.length} methods`}
        </button>
      )}
    </div>
  );
}
