export default function ChatbotIcon({ size = 20, className = '', style = {} }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {/* Antenna */}
      <line x1="12" y1="2" x2="12" y2="5" />
      <circle cx="12" cy="2" r="1" fill="currentColor" />
      {/* Robot Face Box */}
      <rect x="4" y="5" width="16" height="13" rx="3" />
      {/* Ears / Side Pins */}
      <line x1="1.5" y1="11.5" x2="4" y2="11.5" />
      <line x1="20" y1="11.5" x2="22.5" y2="11.5" />
      {/* Eyes */}
      <circle cx="8.5" cy="10.5" r="1.3" fill="currentColor" />
      <circle cx="15.5" cy="10.5" r="1.3" fill="currentColor" />
      {/* Mouth / Smile */}
      <path d="M9 14.5c1 .9 2 .9 3 .9s2 0 3-.9" />
    </svg>
  );
}
