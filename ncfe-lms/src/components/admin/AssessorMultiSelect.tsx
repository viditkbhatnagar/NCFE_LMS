'use client';

interface AssessorOption {
  _id: string;
  name?: string;
  email?: string;
}

interface AssessorMultiSelectProps {
  options: AssessorOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  label?: string;
  hint?: string;
  /** Compact height for use inside a modal. */
  maxHeightClass?: string;
}

/**
 * A checkbox checklist for assigning multiple assessors to an enrolment.
 * The first ticked assessor becomes the lead (server derives assessorId from
 * assessorIds[0]); a small "Lead" badge marks it so admins know who that is.
 */
export default function AssessorMultiSelect({
  options,
  selected,
  onChange,
  label = 'Assessors',
  hint = 'Tick one or more assessors. The first selected is the lead. All assigned assessors can see and work with this learner.',
  maxHeightClass = 'max-h-44',
}: AssessorMultiSelectProps) {
  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const leadId = selected[0];

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-500 mb-2">{hint}</p>}
      {options.length === 0 ? (
        <p className="text-xs text-gray-400">No assessors found.</p>
      ) : (
        <div className={`${maxHeightClass} overflow-y-auto border border-gray-200 rounded-[6px] divide-y divide-gray-100`}>
          {options.map((a) => {
            const checked = selected.includes(a._id);
            return (
              <label
                key={a._id}
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(a._id)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/50"
                />
                <span className="text-gray-900">{a.name}</span>
                {a.email && <span className="text-gray-400 text-xs">{a.email}</span>}
                {checked && a._id === leadId && (
                  <span className="ml-auto inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-primary/10 text-primary">
                    Lead
                  </span>
                )}
              </label>
            );
          })}
        </div>
      )}
      {selected.length > 0 && (
        <p className="text-xs text-gray-400 mt-1">
          {selected.length} assessor{selected.length === 1 ? '' : 's'} selected
        </p>
      )}
    </div>
  );
}
