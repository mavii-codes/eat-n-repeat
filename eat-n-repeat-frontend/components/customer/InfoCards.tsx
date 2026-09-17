const infoCards = [
  {
    icon: (
      <svg className="w-5 h-5 text-[#B91C1C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    label: 'READY IN',
    value: '20–30 min',
  },
  {
    icon: (
      <svg className="w-5 h-5 text-[#B91C1C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10m0 0a1 1 0 001 1h1m-1-1h12m0 0a1 1 0 001-1V7m0 10V9a1 1 0 00-1-1h-1m1 10H7m10 0v-2a1 1 0 00-1-1h-2m-4 0H9" />
      </svg>
    ),
    label: 'FREE DELIVERY',
    value: 'over ₱599',
  },
  {
    icon: (
      <svg className="w-5 h-5 text-[#B91C1C]" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
    label: 'RATED',
    value: '4.9 / 5.0',
  },
  {
    icon: (
      <svg className="w-5 h-5 text-[#B91C1C]" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    ),
    label: 'LOVED BY',
    value: '12k+ locals',
  },
];

export function InfoCards() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 w-full max-w-full">
      {infoCards.map((card) => (
        <div
          key={card.label}
          className="flex items-center gap-2.5 sm:gap-3.5 bg-white rounded-xl sm:rounded-2xl border border-[#F3E5D8] p-2.5 sm:px-4 sm:py-3.5 shadow-2xs hover:shadow-md transition-all duration-200 min-w-0"
        >
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0 shadow-2xs">
            {card.icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] sm:text-[11px] font-black text-stone-500 uppercase tracking-wider truncate">
              {card.label}
            </p>
            <p className="text-[11px] sm:text-sm font-extrabold text-[#451a03] truncate">
              {card.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
