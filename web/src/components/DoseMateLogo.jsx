import { useId } from 'react';

/**
 * DoseMate Rhythm Ring brand mark:
 * 270° adherence progress arc + on-time dose node + centered clinical cross.
 * Always keeps shrink-0 proportions so it never squishes inside flex headers.
 */
export function DoseMateMark({ className = 'w-9 h-9', inverted = false }) {
  const uid = useId();
  const ringGradId = `dm-ring-${uid}`;

  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      {!inverted && (
        <defs>
          <linearGradient id={ringGradId} x1="10" y1="54" x2="54" y2="10" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0F766E" />
            <stop offset="0.55" stopColor="#14B8A6" />
            <stop offset="1" stopColor="#38BDF8" />
          </linearGradient>
        </defs>
      )}
      <path
        d="M53.5 32A21.5 21.5 0 1 1 32 10.5"
        stroke={inverted ? '#FFFFFF' : `url(#${ringGradId})`}
        strokeWidth="7.2"
        strokeLinecap="round"
      />
      <circle cx="47.2" cy="16.8" r="5" fill={inverted ? '#5EEAD4' : '#0EA5E9'} />
      <rect x="29" y="22.5" width="6" height="19" rx="3" fill={inverted ? '#CCFBF1' : '#0F766E'} />
      <rect x="22.5" y="29" width="19" height="6" rx="3" fill={inverted ? '#CCFBF1' : '#0F766E'} />
    </svg>
  );
}

export default function DoseMateLogo({
  inverted = false,
  size = 'md',
  showSubtitle = false,
  subtitle = 'Your medication companion',
  centered = false,
}) {
  const sizes = {
    sm: { mark: 'w-8 h-8', title: 'text-lg', sub: 'text-[10px]' },
    md: { mark: 'w-9 h-9', title: 'text-xl', sub: 'text-[11px]' },
    lg: { mark: 'w-14 h-14', title: 'text-3xl', sub: 'text-xs' },
  };
  const s = sizes[size] || sizes.md;

  const wordmark = (
    <>
      <span className={inverted ? 'text-white' : 'text-slate-900'}>Dose</span>
      <span className={inverted ? 'text-teal-200' : 'text-teal-600'}>Mate</span>
    </>
  );

  if (centered) {
    return (
      <div className="flex flex-col items-center text-center">
        <DoseMateMark className={s.mark} inverted={inverted} />
        <span className={`font-extrabold tracking-tight mt-2 ${s.title}`}>
          {wordmark}
        </span>
        {showSubtitle && (
          <span className={`font-medium mt-0.5 ${s.sub} ${inverted ? 'text-teal-100' : 'text-slate-500'}`}>
            {subtitle}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 shrink-0">
      <DoseMateMark className={s.mark} inverted={inverted} />
      <div className="min-w-0 leading-tight">
        <span className={`block font-extrabold tracking-tight whitespace-nowrap ${s.title}`}>
          {wordmark}
        </span>
        {showSubtitle && (
          <span className={`block font-medium whitespace-nowrap ${s.sub} ${inverted ? 'text-teal-100/90' : 'text-slate-500'}`}>
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
