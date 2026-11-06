import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Container({ className, ...p }: ComponentProps<"div">) {
  return <div className={cx("mx-auto w-full max-w-6xl px-4 sm:px-6", className)} {...p} />;
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg" | "sm";

const btn = (variant: Variant, size: Size) =>
  cx(
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none",
    size === "lg" && "min-h-12 px-6 text-base",
    size === "md" && "min-h-11 px-5 text-[15px]",
    size === "sm" && "min-h-9 px-3 text-sm",
    variant === "primary" && "bg-brand text-brand-ink hover:bg-brand-2",
    variant === "secondary" && "border border-line bg-surface text-ink hover:bg-surface-2",
    variant === "ghost" && "text-brand hover:bg-brand-soft",
    variant === "danger" && "bg-danger text-white hover:opacity-90",
  );

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...p
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={cx(btn(variant, size), className)} {...p} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...p
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={cx(btn(variant, size), className)} {...p} />;
}

export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div className={cx("rounded-card border border-line bg-surface p-5 shadow-card sm:p-6", className)} {...p} />;
}

export function Badge({
  tone = "neutral",
  className,
  ...p
}: ComponentProps<"span"> & { tone?: "neutral" | "ok" | "warn" | "danger" | "brand" }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        tone === "neutral" && "bg-surface-2 text-ink-2",
        tone === "ok" && "bg-ok-soft text-ok",
        tone === "brand" && "bg-brand-soft text-brand-2",
        tone === "warn" && "bg-warn-soft text-warn",
        tone === "danger" && "bg-danger-soft text-danger",
        className,
      )}
      {...p}
    />
  );
}

export function Alert({ tone = "neutral", children, className }: { tone?: "neutral" | "ok" | "warn" | "danger"; children: ReactNode; className?: string }) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cx(
        "rounded-xl border px-4 py-3 text-sm",
        tone === "neutral" && "border-line bg-surface-2 text-ink-2",
        tone === "ok" && "border-transparent bg-ok-soft text-ok",
        tone === "warn" && "border-transparent bg-warn-soft text-warn",
        tone === "danger" && "border-transparent bg-danger-soft text-danger",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && (
        <p className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

const inputCls =
  "block w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[16px] text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

export function Input({ className, ...p }: ComponentProps<"input">) {
  return <input className={cx(inputCls, className)} {...p} />;
}
export function Select({ className, ...p }: ComponentProps<"select">) {
  return <select className={cx(inputCls, "appearance-auto", className)} {...p} />;
}
export function Textarea({ className, ...p }: ComponentProps<"textarea">) {
  return <textarea className={cx(inputCls, "min-h-24", className)} {...p} />;
}

export function SectionHeading({ eyebrow, title, intro, className }: { eyebrow?: string; title: ReactNode; intro?: ReactNode; className?: string }) {
  return (
    <div className={cx("max-w-2xl", className)}>
      {eyebrow && <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand">{eyebrow}</p>}
      <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h2>
      {intro && <p className="mt-3 text-ink-2">{intro}</p>}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function EstimateNote({ className }: { className?: string }) {
  return (
    <p className={cx("text-xs text-muted", className)}>
      Prices are estimates only (NZD incl. GST). The business that contacts you confirms the final price, does the work and is
      responsible for it.
    </p>
  );
}

export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
