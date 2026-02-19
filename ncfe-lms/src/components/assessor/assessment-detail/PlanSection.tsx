'use client';

interface PlanSectionProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

export default function PlanSection({ label, value, onChange, readOnly = false }: PlanSectionProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</h3>
      <textarea
        value={value}
        onChange={(e) => !readOnly && onChange(e.target.value)}
        readOnly={readOnly}
        rows={4}
        placeholder={readOnly ? '' : `Enter ${label.toLowerCase()}...`}
        className={`w-full border border-gray-200 rounded-[6px] px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 resize-y ${
          readOnly
            ? 'bg-gray-50 cursor-default focus:outline-none'
            : 'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'
        }`}
      />
    </div>
  );
}
