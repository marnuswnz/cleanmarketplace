import type { Metadata } from "next";
import { LegalPage } from "@/components/legal";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "Terms of use", alternates: { canonical: "/terms" } };

export default function Terms() {
  return (
    <LegalPage title="Terms of use" updated="6 November 2026">
      <h2>Our role</h2>
      <p>
        {BRAND.name} is an introduction service. We are not a cleaning company and we are not a party to any agreement between you and a business. Partner businesses
        are independent: <strong>they quote, perform and are responsible for the work</strong>, including its quality, safety, and any guarantees.
      </p>
      <h2>Prices are estimates</h2>
      <p>
        Prices shown on this site are indicative estimates in NZD including GST, based on the details you provide and typical local prices. They are not offers or
        quotes. The final price is set by the business, which may need more information or to inspect the property.
      </p>
      <h2>Your request</h2>
      <ul>
        <li>Your request is sent to up to 2 businesses per service type. We can&apos;t guarantee a business will be available.</li>
        <li>Please give accurate details and only submit genuine requests. We may remove requests that look like spam.</li>
        <li>Our service is free for customers. You pay the business directly.</li>
      </ul>
      <h2>Consumer law</h2>
      <p>
        Nothing in these terms limits your rights under the Consumer Guarantees Act 1993 or the Fair Trading Act 1986. Your rights in relation to the cleaning work are
        against the business that does it.
      </p>
      <h2>Liability</h2>
      <p>
        To the extent permitted by law, we are not liable for the acts or omissions of partner businesses, and our total liability to you in connection with our
        service is limited to $100.
      </p>
      <h2>Complaints</h2>
      <p>
        If something goes wrong with a business we introduced, tell us at <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a> — we take feedback seriously
        and may suspend businesses that don&apos;t meet our standards.
      </p>
      <p>These terms are governed by New Zealand law.</p>
    </LegalPage>
  );
}
