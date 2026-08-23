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
          background: "linear-gradient(135deg, #FF9A42, #F06000)",
          borderRadius: 40,
        }}
      >
        <div style={{ display: "flex", color: "white", fontSize: 96, fontWeight: 700, fontFamily: "sans-serif" }}>T</div>
      </div>
    ),
    { width: 192, height: 192 }
  );
}
