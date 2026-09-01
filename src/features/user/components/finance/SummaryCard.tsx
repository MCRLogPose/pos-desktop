import React from 'react';

export interface SummaryRow {
  label: string;
  value: string;
  valueClass?: string;
  hint?: string;
}

interface SummaryCardProps {
  title: string;
  icon?: React.ReactNode;
  accentClass?: string;
  rows: SummaryRow[];
  footer?: SummaryRow;
}

const SummaryCard = ({ title, icon, accentClass = 'bg-slate-100 text-slate-600', rows, footer }: SummaryCardProps) => {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex items-center gap-2.5">
        {icon && <div className={`p-2 rounded-xl ${accentClass}`}>{icon}</div>}
        <h3 className="font-bold text-gray-900 text-sm">{title}</h3>
      </div>
      <div className="p-4">
        <ul className="space-y-3">
          {rows.map(row => (
            <li key={row.label} className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-500 flex items-center gap-1.5">
                {row.label}
                {row.hint && <span className="text-[10px] text-gray-400 font-medium">{row.hint}</span>}
              </span>
              <span className={`text-sm font-bold tabular-nums ${row.valueClass ?? 'text-gray-900'}`}>
                {row.value}
              </span>
            </li>
          ))}
        </ul>
        {footer && (
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">{footer.label}</span>
            <span className={`text-lg font-black tabular-nums ${footer.valueClass ?? 'text-slate-900'}`}>
              {footer.value}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default SummaryCard;