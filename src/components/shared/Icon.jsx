export default function Icon({ name, className = 'size-6' }) {
  const common = {
    className,
    'aria-hidden': 'true',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    viewBox: '0 0 24 24',
  }

  const icons = {
    residential: (
      <svg {...common}>
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5.5 9.8V20h13V9.8" />
        <path d="M9.5 20v-6h5v6" />
        <path d="M12 4v-1.6" />
      </svg>
    ),
    commercial: (
      <svg {...common}>
        <rect x="4" y="4" width="16" height="16" rx="1" />
        <path d="M8 8h.01M12 8h.01M16 8h.01M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" />
      </svg>
    ),
    renovation: (
      <svg {...common}>
        <path d="M14.5 5.5 18 2l4 4-12 12-5 1 1-5L14.5 5.5Z" />
        <path d="m14 8 2 2" />
        <path d="M3 21h18" />
      </svg>
    ),
    design: (
      <svg {...common}>
        <path d="M9 3h6v6H9z" />
        <path d="M3 12h18" />
        <path d="M5 15h14v6H5z" />
        <path d="M9 3H5v9M15 3h4v9M5 15v-3h14v3" />
      </svg>
    ),
    quality: (
      <svg {...common}>
        <path d="M12 2.5 14.8 8l6 .9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 8.9l6-.9L12 2.5Z" />
      </svg>
    ),
    professional: (
      <svg {...common}>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c.6-3.4 3.4-5.5 7-5.5s6.4 2.1 7 5.5" />
      </svg>
    ),
    reliable: (
      <svg {...common}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="m8.5 12 2.5 2.5 4.5-5" />
      </svg>
    ),
    client: (
      <svg {...common}>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M3 20c.6-3.2 3.2-5 6-5s5.4 1.8 6 5" />
        <path d="M16 6.2a3.2 3.2 0 0 1 0 3.6M18 14.5c1.6.8 2.5 2.3 2.7 4.5" />
      </svg>
    ),
    detail: (
      <svg {...common}>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3" />
      </svg>
    ),
    safety: (
      <svg {...common}>
        <path d="M12 3 4.5 6v5.5c0 4.4 3 8.2 7.5 9.5 4.5-1.3 7.5-5.1 7.5-9.5V6L12 3Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
    phone: (
      <svg {...common}>
        <path d="M5 4h4l1.5 4.5-2.2 1.7a12 12 0 0 0 5.5 5.5l1.7-2.2L20 15v4a1.5 1.5 0 0 1-1.7 1.5C10.5 19.6 4.4 13.5 3.5 5.7A1.5 1.5 0 0 1 5 4Z" />
      </svg>
    ),
    mail: (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m4 7 8 6 8-6" />
      </svg>
    ),
    pin: (
      <svg {...common}>
        <path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11Z" />
        <circle cx="12" cy="10" r="2.6" />
      </svg>
    ),
    'arrow-right': (
      <svg {...common}>
        <path d="M4 12h16M14 6l6 6-6 6" />
      </svg>
    ),
    'arrow-up-right': (
      <svg {...common}>
        <path d="M7 17 17 7M8 7h9v9" />
      </svg>
    ),
    facebook: (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
        <path d="M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.6 1.6-1.6h1.4V4.8c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.4-3.7 3.8V11H8.2v3h2.4v7h2.9Z" />
      </svg>
    ),
    instagram: (
      <svg {...common}>
        <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17" cy="7" r="1.1" fill="currentColor" stroke="none" />
      </svg>
    ),
    linkedin: (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
        <path d="M6.6 8.4H3.8V20h2.8V8.4ZM5.2 7.2a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2ZM20.2 13.6c0-3-1.6-4.5-3.8-4.5-1.7 0-2.6 1-3 1.7V8.4h-2.8V20h2.8v-6.3c0-1.2.7-2.2 1.9-2.2 1.2 0 1.9.9 1.9 2.2V20h2.8v-6.4h.2Z" />
      </svg>
    ),
  }

  return icons[name] ?? null
}
