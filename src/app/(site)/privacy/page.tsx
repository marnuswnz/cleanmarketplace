import type { Metadata } from "next";
import { LegalPage } from "@/components/legal";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "Privacy policy", alternates: { canonical: "/privacy" } };

export default function Privacy() {
  return (
    <LegalPage title="Privacy policy" updated="6 November 2026">
      <p>
        {BRAND.legalEntity} (&quot;{BRAND.name}&quot;, &quot;we&quot;) runs a quote-matching service that connects people in Christchurch with independent cleaning
        businesses. This policy explains how we handle personal information under the Privacy Act 2020.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li>Quote requests: your name, mobile number, email (optional), suburb, the services and job details you enter, preferred date, notes and any photos you upload.</li>
        <li>Feedback you give us about a business.</li>
        <li>Technical data: a hashed IP address, browser type, and marketing source (e.g. UTM tags) for fraud prevention and to measure our advertising.</li>
        <li>For partner businesses: business and contact details, NZBN, insurance documents, billing details (processed by Stripe) and lead activity.</li>
      </ul>
      <h2>Why we collect it</h2>
      <ul>
        <li>To give you a price estimate and pass your request to <strong>up to 2 businesses per service type</strong> that cover your suburb, so they can contact you.</li>
        <li>To tell you which business will contact you, ask for feedback, and keep partner quality high.</li>
        <li>To prevent spam and abuse, and to operate, bill and improve the service.</li>
      </ul>
      <h2>Who we share it with</h2>
      <p>
        With your consent, we share your contact and job details only with partner businesses that accept your request — never more than 2 per service type. Before a
        business accepts, it sees only your suburb and job details, not your contact details. We also use service providers to run the service (Supabase for hosting
        and storage, Twilio/ClickSend for SMS, Resend for email, Stripe for partner billing, Cloudflare for spam protection, and privacy-friendly analytics). Some of
        these providers store data outside New Zealand with comparable safeguards. We do not sell personal information.
      </p>
      <h2>How long we keep it</h2>
      <p>
        We delete customer contact details, notes and photos 18 months after your request is closed. We keep de-identified job information (suburb, services,
        estimate) for statistics. Partner records are kept for the life of the partnership plus 7 years for tax purposes.
      </p>
      <h2>Your rights</h2>
      <p>
        You can ask to access or correct your personal information, or ask us to delete it, by emailing <a href={`mailto:${BRAND.privacyEmail}`}>{BRAND.privacyEmail}</a>.
        We&apos;ll respond within 20 working days. You can opt out of our messages at any time by replying STOP to an SMS or &quot;unsubscribe&quot; to an email. If
        you&apos;re not happy with our response you can complain to the Office of the Privacy Commissioner (privacy.org.nz).
      </p>
      <h2>Partner businesses</h2>
      <p>
        Once a business accepts your request it receives your details to provide its own quote and services, and is responsible for handling them under the Privacy
        Act 2020. Our partner terms prohibit reselling or sharing leads.
      </p>
      <h2>Contact</h2>
      <p>
        Privacy officer: <a href={`mailto:${BRAND.privacyEmail}`}>{BRAND.privacyEmail}</a>
      </p>
    </LegalPage>
  );
}
