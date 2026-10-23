export default function AdherenceRing({ rate, size = 120, strokeWidth = 10, label = 'Kepatuhan' }) {
  const normalizedRate = rate === null || rate === undefined ? 0 : Math.min(100, Math.max(0, rate));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (normalizedRate / 100) * circumference;

  let colorClass = 'text-teal-600';
  let badgeColor = 'bg-teal-50 text-teal-800 border-teal-200';
  if (rate === null || rate === undefined) {
    colorClass = 'text-slate-300';
  } else if (normalizedRate >= 80) {
    colorClass = 'text-emerald-500';
    badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
  } else if (normalizedRate >= 60) {
    colorClass = 'text-amber-500';
    badgeColor = 'bg-amber-50 text-amber-800 border-amber-200';
  } else {
    colorClass = 'text-rose-500';
    badgeColor = 'bg-rose-50 text-rose-800 border-rose-200';
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className="text-slate-100"
            strokeWidth={strokeWidth}
            stroke="currentColor"
            fill="transparent"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className={`${colorClass} transition-all duration-700 ease-out`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            stroke="currentColor"
            fill="transparent"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {rate !== null && rate !== undefined ? `${Math.round(rate)}%` : '—'}
          </span>
          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
            {label}
          </span>
        </div>
      </div>
      {rate !== null && (
        <span className={`mt-2 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${badgeColor}`}>
          {normalizedRate >= 80 ? 'Sangat Baik' : normalizedRate >= 60 ? 'Cukup' : 'Perlu Perhatian'}
        </span>
      )}
    </div>
  );
}
