import { ImageResponse } from "next/og";

export const dynamic = "force-static";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #34B7A7, #0A625A)",
          borderRadius: 40,
        }}
      >
        <div style={{ display: "flex", color: "white", fontSize: 96, fontWeight: 700, fontFamily: "sans-serif" }}>T</div>
      </div>
    ),
    { width: 192, height: 192 }
  );
}
