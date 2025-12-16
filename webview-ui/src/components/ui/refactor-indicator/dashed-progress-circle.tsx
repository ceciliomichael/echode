import type { DashedProgressCircleProps } from './types';

/**
 * Custom dashed circle progress indicator
 * Shows progress by coloring individual dashes based on percentage
 */
export function DashedProgressCircle({ percent, color, size = 16 }: DashedProgressCircleProps) {
  const strokeWidth = 1.5;
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  
  // 8 dashes around the circle
  const dashCount = 8;
  const anglePerDash = 360 / dashCount;
  const dashArcAngle = anglePerDash * 0.6; // 60% of segment is dash
  
  // Generate dash arcs
  const dashes = [];
  for (let i = 0; i < dashCount; i++) {
    const startAngle = i * anglePerDash - 90; // Start from top
    const endAngle = startAngle + dashArcAngle;
    
    // Calculate if this dash should be filled based on percentage
    const dashMidpoint = (i + 0.5) / dashCount * 100;
    const isFilled = dashMidpoint <= percent;
    
    // Convert angles to radians
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    
    // Calculate arc points
    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);
    
    // Create arc path
    const path = `M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`;
    
    dashes.push(
      <path
        key={i}
        d={path}
        fill="none"
        stroke={isFilled ? color : 'currentColor'}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        opacity={isFilled ? 1 : 0.25}
      />
    );
  }
  
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
    >
      {dashes}
    </svg>
  );
}