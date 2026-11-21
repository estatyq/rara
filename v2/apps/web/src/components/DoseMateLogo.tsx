export function DoseMateMark({ className = 'w-9 h-9', inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={`shrink-0 ${className}`} aria-hidden="true">
      {inverted ? (
        <>
          <path
            d="M32 56C32 56 8 40.8 8 22.8C8 14.6 14.5 8 22.5 8C27.2 8 30.8 10.4 32 13.7C33.2 10.4 36.8 8 41.5 8C49.5 8 56 14.6 56 22.8C56 40.8 32 56 32 56Z"
            fill="#FFFFFF"
          />
          <g transform="rotate(-45 32 30)">
            <rect x="21" y="24" width="22" height="12" rx="6" fill="#0F766E" />
            <path d="M32 24H37C40.314 24 43 26.686 43 30C43 33.314 40.314 36 37 36H32V24Z" fill="#5EEAD4" />
          </g>
        </>
      ) : (
        <>
          <path
            d="M32 56C32 56 8 40.8 8 22.8C8 14.6 14.5 8 22.5 8C27.2 8 30.8 10.4 32 13.7C33.2 10.4 36.8 8 41.5 8C49.5 8 56 14.6 56 22.8C56 40.8 32 56 32 56Z"
            fill="#0D9488"
          />
          <g transform="rotate(-45 32 30)">
            <rect x="21" y="24" width="22" height="12" rx="6" fill="#FFFFFF" />
            <path d="M32 24H37C40.314 24 43 26.686 43 30C43 33.314 40.314 36 37 36H32V24Z" fill="#99F6E4" />
          </g>
        </>
      )}
    </svg>
  );
}

export default function DoseMateLogo({
  inverted = false,
  size = 'md',
  showSubtitle = false,
  centered = false,
}: {
  inverted?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  centered?: boolean;
}) {
  const s =
    size === 'lg'
      ? { mark: 'w-14 h-14', title: 'text-3xl', sub: 'text-xs' }
      : size === 'sm'
      ? { mark: 'w-8 h-8', title: 'text-lg', sub: 'text-[10px]' }
      : { mark: 'w-9 h-9', title: 'text-xl', sub: 'text-[11px]' };

  if (centered) {
    return (
      <div className="flex flex-col items-center text-center">
        <DoseMateMark className={s.mark} inverted={inverted} />
        <span className={`font-extrabold tracking-tight mt-2 ${s.title} ${inverted ? 'text-white' : 'text-teal-800'}`}>
          DoseMate
        </span>
        {showSubtitle && (
          <span className={`font-medium mt-0.5 ${s.sub} ${inverted ? 'text-teal-100' : 'text-slate-500'}`}>
            Your medication companion
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 shrink-0">
      <DoseMateMark className={s.mark} inverted={inverted} />
      <div className="leading-tight">
        <span className={`block font-extrabold tracking-tight whitespace-nowrap ${s.title} ${inverted ? 'text-white' : 'text-teal-900'}`}>
          DoseMate
        </span>
        {showSubtitle && (
          <span className={`block font-medium whitespace-nowrap ${s.sub} ${inverted ? 'text-teal-100/90' : 'text-slate-500'}`}>
            Your medication companion
          </span>
        )}
      </div>
    </div>
  );
}
