// The logo is white ink on a solid black square. Instead of pasting the image
// (which shows the black box), we use it as a *luminance mask* over an ink-
// colored box: bright pixels (the ink) become opaque, black becomes truly
// transparent. Soft brush edges keep their natural feathering.

export function Mark({
  size = 120,
  className = "",
}: {
  size?: number;
  className?: string;
  /** kept for call-site compatibility; no longer needed */
  priority?: boolean;
}) {
  return (
    <span
      role="img"
      aria-label="OBLX.INK"
      className={`mark ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
