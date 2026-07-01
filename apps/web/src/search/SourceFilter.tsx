export interface SourceFilterState {
  gutenberg: boolean;
  'standard-ebooks': boolean;
}

export function SourceFilter({
  state,
  onChange,
}: {
  readonly state: SourceFilterState;
  readonly onChange: (next: SourceFilterState) => void;
}) {
  return (
    <div className="flex gap-4 text-sm text-slate-600">
      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={state.gutenberg}
          onChange={(e) => onChange({ ...state, gutenberg: e.target.checked })}
        />
        <span>Gutenberg</span>
      </label>
      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={state['standard-ebooks']}
          onChange={(e) => onChange({ ...state, 'standard-ebooks': e.target.checked })}
        />
        <span>Standard Ebooks</span>
      </label>
    </div>
  );
}
