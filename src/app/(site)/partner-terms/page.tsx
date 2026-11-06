import type { Metadata } from "next";
import { LegalPage } from "@/components/legal";
import { BRAND } from "@/lib/brand";
import { SEAT_PRICE_CENTS } from "@/lib/catalog";
import { formatNzd } from "@/lib/pricing/estimate";

export const metadata: Metadata = { title: "Partner terms", alternates: { canonical: "/partner-terms" } };

export default function PartnerTerms() {
  const overflow = formatNzd(Number(process.env.OVERFLOW_PRICE_CENTS ?? 2000) / 100);
  return (
    <LegalPage title="Partner terms" updated="6 November 2026">
      <h2>1. Seats</h2>
      <p>
        A seat gives your business access to quote requests for one service group in one area. There are at most 2 seats per area and service group. Seats are
        allocated at our discretion.
      </p>
      <h2>2. Fees</h2>
      <ul>
        <li>Seat fee: {formatNzd(SEAT_PRICE_CENTS.standard / 100)} per month per seat in standard areas and {formatNzd(SEAT_PRICE_CENTS.large / 100)} in larger areas (incl. GST), invoiced monthly in advance via Stripe.</li>
        <li>Founding partners receive a 60-day free trial on their initial seats.</li>
        <li>Overflow leads (requests from outside your seat areas) cost {overflow} each, charged only if you accept, added to your next invoice.</li>
        <li>Invoices are due within 7 days. If a seat is more than 7 days overdue we stop sending it leads until paid.</li>
      </ul>
      <h2>3. Cancellation</h2>
      <p>Either party may cancel a seat with 30 days&apos; written notice. Fees are not refunded for partial months.</p>
      <h2>4. Response expectations</h2>
      <ul>
        <li>Offers are open for 30 minutes (no offers are sent between 8pm and 7am). Accept only leads you can serve.</li>
        <li>Contact the customer promptly after accepting — we expect same-day contact during business hours.</li>
        <li>We monitor accept rates, response times and customer feedback. Partners with an accept rate under 50% or average response over 60 minutes may be reviewed.</li>
        <li>Tell us if a job booked when we ask — it helps us improve routing.</li>
      </ul>
      <h2>5. Use of leads</h2>
      <p>
        Customer details are provided for the sole purpose of quoting and performing the requested work. You must not resell, share or add customers to marketing
        lists without their separate consent, and you must handle their information in line with the Privacy Act 2020.
      </p>
      <h2>6. Insurance and compliance</h2>
      <p>
        You must hold current public liability insurance (minimum $1,000,000 recommended) and provide a certificate on request. Seats are paused automatically when
        insurance on file expires. You are responsible for your own pricing, work quality, health and safety, and compliance with the Consumer Guarantees Act and
        Fair Trading Act.
      </p>
      <h2>7. Suspension</h2>
      <p>
        We may suspend or remove a partner, without refund for the current period, for poor customer feedback, failing to contact customers, misuse of leads,
        lapsed insurance, non-payment, or conduct that harms customers or {BRAND.name}.
      </p>
      <h2>8. No guarantee of volume</h2>
      <p>We don&apos;t guarantee a number of leads or bookings.</p>
      <h2>9. General</h2>
      <p>These terms are governed by New Zealand law. We may update them with 30 days&apos; notice.</p>
    </LegalPage>
  );
}
