'use client';

interface PlanSectionProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export default function PlanSection({ label, value, onChange }: PlanSectionProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</h3>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        placeholder={`Enter ${label.toLowerCase()}...`}
        className="w-full border border-gray-200 rounded-[6px] px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
      />
    </div>
  );
}
