interface LogoProps {
  size?: number
  showWordmark?: boolean
  className?: string
}

export function BuildNBoostLogo({ size = 48, showWordmark = false, className = '' }: LogoProps) {
  const id = `grad-${size}`
  return (
    <div className={`inline-flex flex-col items-center gap-2 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="#06B6D4" />
            <stop offset="50%"  stopColor="#2563EB" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
        </defs>

        {/* Background rounded square */}
        <rect width="48" height="48" rx="12" fill={`url(#${id})`} />

        {/* Left B */}
        <path
          d="M10 11h9c3.3 0 6 2.7 6 6 0 1.6-.6 3-1.7 4.1C24.5 22.3 25 23.9 25 25.5 25 28.8 22.3 31.5 19 31.5H10V11z"
          fill="white"
          opacity="0.95"
        />
        <path
          d="M13.5 14.5h5c1.4 0 2.5 1.1 2.5 2.5S19.9 19.5 18.5 19.5h-5V14.5z
             M13.5 22.5h5.5c1.4 0 2.5 1.1 2.5 2.5S20.4 27.5 19 27.5h-5.5V22.5z"
          fill={`url(#${id})`}
        />

        {/* Right B (mirrored) */}
        <path
          d="M38 11h-9c-3.3 0-6 2.7-6 6 0 1.6.6 3 1.7 4.1C23.5 22.3 23 23.9 23 25.5 23 28.8 25.7 31.5 29 31.5H38V11z"
          fill="white"
          opacity="0.65"
        />
        <path
          d="M34.5 14.5h-5c-1.4 0-2.5 1.1-2.5 2.5s1.1 2.5 2.5 2.5h5V14.5z
             M34.5 22.5H29c-1.4 0-2.5 1.1-2.5 2.5S27.6 27.5 29 27.5h5.5V22.5z"
          fill={`url(#${id})`}
          opacity="0.8"
        />

        {/* Glow dot center */}
        <circle cx="24" cy="24" r="2.5" fill="white" opacity="0.3" />
      </svg>

      {showWordmark && (
        <span
          className="font-extrabold tracking-tight text-transparent bg-clip-text"
          style={{
            backgroundImage: 'linear-gradient(135deg, #06B6D4, #2563EB, #7C3AED)',
            fontSize: size * 0.35,
          }}
        >
          buildNboost
        </span>
      )}
    </div>
  )
}
