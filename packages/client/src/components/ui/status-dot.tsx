interface StatusDotProps {
  color: string;
  size?: number;
  glow?: boolean;
  label?: string;
}

export function StatusDot({ color, size = 8, glow = false, label }: StatusDotProps) {
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
        boxShadow: glow ? `0 0 4px ${color}40` : undefined,
      }}
    />
  );
}
