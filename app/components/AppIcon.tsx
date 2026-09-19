import React from "react";

interface AppIconProps {
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

export function AppIcon({ size = 32, className, style }: AppIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle", ...style }}
      aria-label="ThermoSlip Order Print Icon"
    >
      <defs>
        <filter id="appIconSoftShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="8" dy="16" stdDeviation="20" floodColor="#0F172A" floodOpacity="0.08" />
        </filter>
        <radialGradient id="appIconBgGlow" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#F8FAFC" />
        </radialGradient>
      </defs>

      <rect width="512" height="512" rx="112" fill="url(#appIconBgGlow)" />
      <rect width="512" height="512" rx="112" stroke="#F1F5F9" strokeWidth="8" />

      <g transform="translate(256, 256) rotate(20) translate(-256, -256)">
        <rect x="70" y="190" width="180" height="40" rx="20" fill="#FF3366" />
        <rect x="110" y="250" width="140" height="40" rx="20" fill="#FFB320" />
        <rect x="150" y="310" width="100" height="40" rx="20" fill="#00D2FF" />

        <g filter="url(#appIconSoftShadow)">
          <rect x="230" y="90" width="200" height="280" rx="24" fill="#FFFFFF" />
          <rect x="260" y="130" width="24" height="64" rx="8" fill="#1E293B" />
          <rect x="296" y="130" width="12" height="64" rx="6" fill="#1E293B" />
          <rect x="320" y="130" width="32" height="64" rx="8" fill="#1E293B" />
          <rect x="364" y="130" width="12" height="64" rx="6" fill="#1E293B" />
          <rect x="388" y="130" width="12" height="64" rx="6" fill="#1E293B" />
          <rect x="260" y="230" width="140" height="20" rx="10" fill="#E2E8F0" />
          <rect x="260" y="266" width="90" height="20" rx="10" fill="#E2E8F0" />
          <circle cx="386" cy="276" r="14" fill="#10B981" />
        </g>
      </g>

      <path d="M 120 70 L 126 84 L 140 90 L 126 96 L 120 110 L 114 96 L 100 90 L 114 84 Z" fill="#FFB320" />
      <path d="M 410 390 L 414 400 L 424 404 L 414 408 L 410 418 L 406 408 L 396 404 L 406 400 Z" fill="#00D2FF" />
    </svg>
  );
}
