"use client";

import type { FormEvent } from "react";
import { inventoryVehicles } from "../data";
import { trackEvent } from "../lib/analytics";

type Mode = "apply" | "test-drive" | "contact";

export default function LeadRequestForm({ mode, selectedVehicle }: { mode: Mode; selectedVehicle?: string }) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const requestName = mode === "apply" ? "pre-approval" : mode === "test-drive" ? "test drive" : "contact";
    const details = Object.entries(data).map(([key, value]) => `${key}: ${String(value)}`).join("\n");
    const message = `WDCC ${requestName} request\n${details}`;
    const separator = /iPhone|iPad/i.test(navigator.userAgent) ? "&" : "?";

    trackEvent("lead_submit", { requestType: requestName });
    window.location.href = `sms:+18135164752${separator}body=${encodeURIComponent(message)}`;
  };

  return (
    <form className="lead-request-form" onSubmit={submit}>
      <div className="form-row">
        <label>Full name<input name="name" autoComplete="name" required placeholder="Your name" /></label>
        <label>Phone<input name="phone" type="tel" autoComplete="tel" required placeholder="(813) 516-4752" /></label>
      </div>
      <label>Email<input name="email" type="email" autoComplete="email" required placeholder="you@email.com" /></label>
      {mode !== "contact" && (
        <label>Vehicle
          <select name="vehicle" defaultValue={selectedVehicle || "Help me choose"}>
            <option>Help me choose</option>
            {inventoryVehicles.map((vehicle) => {
              const label = `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}`.trim();
              return <option key={vehicle.id} value={vehicle.slug}>{label}</option>;
            })}
          </select>
        </label>
      )}
      {mode === "apply" && (
        <div className="form-row">
          <label>Monthly income range<select name="incomeRange" required defaultValue=""><option value="" disabled>Select range</option><option>$2,000–$3,499</option><option>$3,500–$4,999</option><option>$5,000+</option></select></label>
          <label>Available down payment<select name="availableDownPayment" required defaultValue=""><option value="" disabled>Select amount</option><option>Under $1,000</option><option>$1,000–$1,999</option><option>$2,000+</option></select></label>
        </div>
      )}
      {mode === "test-drive" && <label>Preferred date and time<input name="preferredTime" type="datetime-local" required /></label>}
      {mode === "contact" && <label>What can we help with?<textarea name="message" rows={5} required placeholder="Tell Sean what you need…" /></label>}
      <label className="consent"><input type="checkbox" required /> I agree WDCC may contact me about this request. Message and data rates may apply.</label>
      <button className="btn btn-primary" type="submit">Continue to text Sean →</button>
      <p className="form-privacy-note">This form prepares a text on your phone. WDCC analytics never receives the personal details you enter here.</p>
    </form>
  );
}
