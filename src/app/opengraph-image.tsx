import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";

export const alt = "Cleaning quotes from local Christchurch pros";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0f6b4f", color: "white", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ fontSize: 36, fontWeight: 700, display: "flex" }}>{BRAND.name}</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.05 }}>Cleaning quotes from local pros.</div>
          <div style={{ fontSize: 34, marginTop: 24, opacity: 0.9 }}>Instant estimate · Max 2 businesses · Christchurch</div>
        </div>
      </div>
    ),
    size,
  );
}
