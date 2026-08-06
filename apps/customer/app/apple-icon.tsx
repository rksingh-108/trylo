import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
        }}
      >
        <div style={{ display: "flex", color: "white", fontSize: 92, fontWeight: 700, fontFamily: "sans-serif" }}>T</div>
      </div>
    ),
    { ...size }
  );
}
