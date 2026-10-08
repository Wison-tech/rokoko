type P = { className?: string };

export const CartIcon = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L20.5 8H6.2" />
    <circle cx="10" cy="20" r="1.4" />
    <circle cx="17" cy="20" r="1.4" />
  </svg>
);

export const CloseIcon = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const SearchIcon = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const ArrowDownIcon = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3v18M5 14l7 7 7-7" />
  </svg>
);

export const BackIcon = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M15 5l-7 7 7 7" />
  </svg>
);

export const HeartIcon = ({ className, filled }: P & { filled?: boolean }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true" style={filled ? { fill: 'currentColor' } : undefined}>
    <path d="M12 20s-7-4.4-9.2-9A5.2 5.2 0 0 1 12 6.1 5.2 5.2 0 0 1 21.2 11C19 15.6 12 20 12 20Z" />
  </svg>
);

export const ShareIcon = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
  </svg>
);

export const RepeatIcon = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 12a8 8 0 0 1 13.7-5.6L20 9M20 4v5h-5M20 12a8 8 0 0 1-13.7 5.6L4 15M4 20v-5h5" />
  </svg>
);

export const CheckIcon = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

export const WhatsAppIcon = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true" style={{ fill: 'currentColor', stroke: 'none' }}>
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.5-.3Z" />
  </svg>
);
