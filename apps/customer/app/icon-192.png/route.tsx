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
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* T letterform */}
          <rect x="24" y="24" width="72" height="14" rx="4" fill="white"/>
          <rect x="48" y="38" width="24" height="60" rx="4" fill="white"/>
          {/* Forward arrow chevron */}
          <path d="M66 58 L82 70 L66 82" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.4"/>
        </svg>
      </div>
    ),
    { width: 192, height: 192 }
  );
}
