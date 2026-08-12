/**
 * Lakshya means "the target". The mark is concentric rings with an arrow
 * already in the centre — the plan working, rather than the goal being distant.
 */
export function Logo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="14.5" fill="none" stroke="var(--ink)" strokeWidth="1.6" />
      <circle cx="16" cy="16" r="9.5" fill="none" stroke="var(--ink)" strokeWidth="1.3" opacity="0.55" />
      <circle cx="16" cy="16" r="4.5" fill="var(--saffron)" />
      <path
        d="M16 16 L27 5"
        stroke="var(--ink)"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M22.5 5.2 L27 5 L26.8 9.5" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
