import { BRAND } from "@/lib/brand";
import { SERVICE_BY_CODE, type ServiceCode } from "@/lib/catalog";
import { formatNzd } from "@/lib/pricing/estimate";

export interface Rendered {
  sms?: string;
  email?: { subject: string; html: string; text: string };
}

const OPT_OUT_SMS = "Reply STOP to opt out.";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Build a plain, accessible transactional email from text lines. */
function email(subject: string, lines: (string | { label: string; href: string })[], footer?: string) {
  const html = `<!doctype html><html><body style="margin:0;background:#f5f7f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#13201b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:12px;padding:28px" cellpadding="0" cellspacing="0"><tr><td>
<p style="font-weight:700;font-size:18px;margin:0 0 18px">${esc(BRAND.name)}</p>
${lines
  .map((l) =>
    typeof l === "string"
      ? `<p style="font-size:15px;line-height:1.55;margin:0 0 12px">${esc(l)}</p>`
      : `<p style="margin:20px 0"><a href="${esc(l.href)}" style="background:#0f6b4f;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;display:inline-block">${esc(l.label)}</a></p>`,
  )
  .join("\n")}
<p style="font-size:12px;color:#5b6b64;margin:24px 0 0">${esc(footer ?? `You're receiving this because of a quote request on ${BRAND.name}. To stop these emails, reply "unsubscribe".`)}</p>
</td></tr></table></td></tr></table></body></html>`;
  const text = lines.map((l) => (typeof l === "string" ? l : `${l.label}: ${l.href}`)).join("\n\n");
  return { subject, html, text };
}

export const serviceList = (codes: string[]) =>
  codes.map((c) => SERVICE_BY_CODE[c as ServiceCode]?.short ?? c).join(", ");

const range = (lowCents: number | null, highCents: number | null) =>
  lowCents && highCents ? `${formatNzd(lowCents / 100)}–${formatNzd(highCents / 100)} (estimate)` : "on quote";

export interface OfferTemplateInput {
  businessName: string;
  refCode: string;
  suburb: string;
  services: string[];
  estLowCents: number | null;
  estHighCents: number | null;
  preferredDate: string | null;
  flexible: boolean;
  ttlMinutes: number;
  link: string;
  kind: "seat" | "overflow";
  overflowPriceCents: number;
}

export function partnerOffer(i: OfferTemplateInput): Rendered {
  const when = i.preferredDate ? `${i.preferredDate}${i.flexible ? " (flexible)" : ""}` : "flexible";
  const fee = i.kind === "overflow" ? ` Overflow lead: ${formatNzd(i.overflowPriceCents / 100)} if accepted.` : "";
  return {
    sms: `${BRAND.name}: New lead ${i.refCode} — ${serviceList(i.services)} in ${i.suburb}, ${range(i.estLowCents, i.estHighCents)}, ${when}.${fee} Accept within ${i.ttlMinutes} min: ${i.link} ${OPT_OUT_SMS}`,
    email: email(
      `New lead in ${i.suburb}: ${serviceList(i.services)} (${i.refCode})`,
      [
        `Hi ${i.businessName},`,
        `A customer in ${i.suburb} wants a quote for ${serviceList(i.services)}.`,
        `Indicative estimate: ${range(i.estLowCents, i.estHighCents)}. Preferred date: ${when}.`,
        i.kind === "overflow"
          ? `This is an overflow lead from outside your seat area. If you accept, ${formatNzd(i.overflowPriceCents / 100)} + GST is added to your next invoice.`
          : `This lead is included in your seat.`,
        `This offer expires in ${i.ttlMinutes} minutes. Customer contact details are shown once you accept. The customer is sent to at most 2 businesses.`,
        { label: "View and accept", href: i.link },
      ],
      `You receive lead alerts as a ${BRAND.name} partner. Manage notifications from your dashboard or reply STOP to SMS.`,
    ),
  };
}

export interface AcceptedTemplateInput {
  businessName: string;
  refCode: string;
  suburb: string;
  services: string[];
  customerName: string;
  customerMobile: string;
  customerEmail: string | null;
  notes: string | null;
  preferredDate: string | null;
  estLowCents: number | null;
  estHighCents: number | null;
  link: string;
}

export function partnerAccepted(i: AcceptedTemplateInput): Rendered {
  return {
    sms: `${BRAND.name}: Lead ${i.refCode} is yours. Call ${i.customerName} on ${i.customerMobile} now — they're expecting you. Details: ${i.link}`,
    email: email(`Lead ${i.refCode}: contact ${i.customerName}`, [
      `You accepted lead ${i.refCode}. Please contact the customer as soon as possible — fast responses win more jobs.`,
      `Customer: ${i.customerName}`,
      `Mobile: ${i.customerMobile}`,
      ...(i.customerEmail ? [`Email: ${i.customerEmail}`] : []),
      `Suburb: ${i.suburb}`,
      `Services: ${serviceList(i.services)}`,
      `Our estimate shown to the customer: ${range(i.estLowCents, i.estHighCents)}. You set your own price.`,
      ...(i.preferredDate ? [`Preferred date: ${i.preferredDate}`] : []),
      ...(i.notes ? [`Notes: ${i.notes}`] : []),
      { label: "Open lead", href: i.link },
    ]),
  };
}

export function customerPartnerAssigned(i: { businessName: string; refCode: string; customerName: string; services: string[] }): Rendered {
  return {
    sms: `${BRAND.name}: ${i.businessName} will contact you shortly about your ${serviceList(i.services)} quote (${i.refCode}). ${OPT_OUT_SMS}`,
    email: email(`${i.businessName} will contact you shortly`, [
      `Hi ${i.customerName},`,
      `${i.businessName} has picked up your quote request (${i.refCode}) for ${serviceList(i.services)} and will contact you shortly.`,
      `${i.businessName} is an independent business: they will confirm the price, carry out and are responsible for the work. Our price was an estimate only.`,
      `You'll hear from no more than 2 businesses for each type of service.`,
    ]),
  };
}

export function customerLeadReceived(i: { customerName: string; refCode: string; deferred: boolean; link: string }): Rendered {
  return {
    email: email(`We've got your quote request (${i.refCode})`, [
      `Hi ${i.customerName},`,
      i.deferred
        ? `Thanks — we'll send your request to local businesses from 7am and let you know who will be in touch.`
        : `Thanks — we're sending your request to up to 2 local businesses now and will let you know who will be in touch.`,
      `Reference: ${i.refCode}`,
      { label: "View your request", href: i.link },
    ]),
  };
}

export function customerFindingBusiness(i: { customerName: string; refCode: string }): Rendered {
  return {
    sms: `${BRAND.name}: We're still finding an available business for your request ${i.refCode} and will be in touch soon. ${OPT_OUT_SMS}`,
    email: email(`Still finding a business for ${i.refCode}`, [
      `Hi ${i.customerName},`,
      `We haven't been able to match your request with an available business yet. Our team has been alerted and will follow up shortly.`,
    ]),
  };
}

export function customerFeedbackRequest(i: { refCode: string; link: string }): Rendered {
  return {
    sms: `${BRAND.name}: Did a business contact you about ${i.refCode}? 30-second feedback helps keep our partners great: ${i.link} ${OPT_OUT_SMS}`,
  };
}

export function partnerOutcomePrompt(i: { refCode: string; bookedLink: string; notBookedLink: string; detailLink: string }): Rendered {
  return {
    sms: `${BRAND.name}: Did lead ${i.refCode} book? Booked: ${i.bookedLink} Not booked: ${i.notBookedLink}`,
    email: email(`Did ${i.refCode} book?`, [
      `Quick one — did lead ${i.refCode} turn into a job? One tap:`,
      { label: "Yes, booked", href: i.bookedLink },
      { label: "No, not booked", href: i.notBookedLink },
      `Or add the job value on the lead page: ${i.detailLink}`,
    ]),
  };
}

export function insuranceReminder(i: { businessName: string; days: number; expiry: string; link: string }): Rendered {
  return {
    sms: `${BRAND.name}: Your public liability insurance on file expires ${i.expiry} (${i.days} days). Upload your renewal to keep receiving leads: ${i.link}`,
    email: email(`Insurance expires in ${i.days} days`, [
      `Hi ${i.businessName},`,
      `The public liability insurance we have on file expires on ${i.expiry}. Seats are paused automatically at expiry, so please upload your renewal certificate.`,
      { label: "Upload renewal", href: i.link },
    ]),
  };
}

export function partnerApproved(i: { businessName: string; loginLink: string }): Rendered {
  return {
    email: email(`You're approved on ${BRAND.name}`, [
      `Hi ${i.businessName},`,
      `Your partner application has been approved. Sign in with this email address to see your seats, leads and billing.`,
      { label: "Sign in", href: i.loginLink },
    ]),
  };
}

export function applicationReceived(i: { contactName: string }): Rendered {
  return {
    email: email(`Thanks for applying to ${BRAND.name}`, [
      `Hi ${i.contactName},`,
      `We've received your application. We check NZBN, insurance and reviews for every partner, and will be in touch within 2 business days.`,
    ]),
  };
}

export function adminAlert(subject: string, lines: string[], link?: string): Rendered {
  return { email: email(`[${BRAND.name} admin] ${subject}`, [...lines, ...(link ? [{ label: "Open in admin", href: link }] : [])], "Admin alert.") };
}
