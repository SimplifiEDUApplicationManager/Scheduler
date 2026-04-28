// Token verification page — confirm design tokens match the prototype.
// Visit /dev/tokens while running `npm run dev`.
// This file is dev-only and will be removed before production.

const swatches = [
  // Brand
  { label: 'brand-primary', bg: 'bg-brand-primary', hex: '#6bb3a6' },
  { label: 'brand-primary-deep', bg: 'bg-brand-primary-deep', hex: '#3f9c8b' },
  { label: 'brand-primary-ink', bg: 'bg-brand-primary-ink', hex: '#2b7265' },
  { label: 'brand-cream', bg: 'bg-brand-cream', hex: '#ffe8bc' },
  { label: 'brand-ink', bg: 'bg-brand-ink', hex: '#162033' },
  // Teal scale
  { label: 'brand-teal-50', bg: 'bg-brand-teal-50', hex: '#e8f4f1' },
  { label: 'brand-teal-100', bg: 'bg-brand-teal-100', hex: '#cfe9e2' },
  { label: 'brand-teal-200', bg: 'bg-brand-teal-200', hex: '#a8d6cb' },
  { label: 'brand-teal-300', bg: 'bg-brand-teal-300', hex: '#7fc1b2' },
  { label: 'brand-teal-400', bg: 'bg-brand-teal-400', hex: '#6bb3a6' },
  { label: 'brand-teal-500', bg: 'bg-brand-teal-500', hex: '#3f9c8b' },
  { label: 'brand-teal-600', bg: 'bg-brand-teal-600', hex: '#2b7265' },
  { label: 'brand-teal-700', bg: 'bg-brand-teal-700', hex: '#1f5349' },
  // Surfaces
  { label: 'surface-1', bg: 'bg-surface-1 border border-border-default', hex: '#ffffff' },
  { label: 'surface-2', bg: 'bg-surface-2', hex: '#fafafa' },
  { label: 'surface-3', bg: 'bg-surface-3', hex: '#f5f5f5' },
  { label: 'surface-brand', bg: 'bg-surface-brand', hex: '#e8f4f1' },
  { label: 'surface-cream', bg: 'bg-surface-cream', hex: '#fff7e6' },
  // Status
  { label: 'success', bg: 'bg-success', hex: '#22c55e' },
  { label: 'warning', bg: 'bg-warning', hex: '#f59e0b' },
  { label: 'danger', bg: 'bg-danger', hex: '#dc2626' },
  { label: 'info', bg: 'bg-info', hex: '#0ea5e9' },
];

const radiusExamples = [
  { label: 'rounded-xs (4px)', cls: 'rounded-xs' },
  { label: 'rounded-sm (6px)', cls: 'rounded-sm' },
  { label: 'rounded-md (8px)', cls: 'rounded-md' },
  { label: 'rounded-lg (12px)', cls: 'rounded-lg' },
  { label: 'rounded-xl (16px)', cls: 'rounded-xl' },
  { label: 'rounded-2xl (20px)', cls: 'rounded-2xl' },
  { label: 'rounded-pill (999px)', cls: 'rounded-pill' },
];

export default function TokensPage() {
  return (
    <div className="min-h-screen bg-surface-2 p-10 font-sans">
      <h1 className="text-h1 font-bold text-fg-1 mb-2">Design Token Verification</h1>
      <p className="text-body text-fg-3 mb-10">
        Confirm every swatch matches <code>tokens.css</code> from the prototype.
      </p>

      {/* Color swatches */}
      <section className="mb-12">
        <h2 className="text-h3 font-semibold text-fg-1 mb-4">Colors</h2>
        <div className="grid grid-cols-4 gap-3">
          {swatches.map(({ label, bg, hex }) => (
            <div key={label} className="flex flex-col gap-1">
              <div className={`h-14 w-full rounded-md ${bg}`} />
              <span className="text-xs text-fg-2 font-medium">{label}</span>
              <span className="text-xxs text-fg-muted font-mono">{hex}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Border radius */}
      <section className="mb-12">
        <h2 className="text-h3 font-semibold text-fg-1 mb-4">Border Radius</h2>
        <div className="flex flex-wrap gap-4">
          {radiusExamples.map(({ label, cls }) => (
            <div key={cls} className="flex flex-col items-center gap-2">
              <div className={`h-16 w-16 bg-brand-teal-400 ${cls}`} />
              <span className="text-xxs text-fg-3 text-center">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Typography */}
      <section className="mb-12">
        <h2 className="text-h3 font-semibold text-fg-1 mb-4">Typography</h2>
        <div className="space-y-2">
          {(
            [
              ['text-display', 'Display (56px)'],
              ['text-h1', 'Heading 1 (40px)'],
              ['text-h2', 'Heading 2 (30px)'],
              ['text-h3', 'Heading 3 (22px)'],
              ['text-h4', 'Heading 4 (18px)'],
              ['text-body-lg', 'Body Large (16px)'],
              ['text-body', 'Body (14px)'],
              ['text-sm', 'Small (13px)'],
              ['text-xs', 'Extra Small (12px)'],
              ['text-xxs', 'Double Extra Small (11px)'],
            ] as [string, string][]
          ).map(([cls, label]) => (
            <p key={cls} className={`${cls} text-fg-1`}>
              {label}
            </p>
          ))}
        </div>
      </section>

      {/* Shadows */}
      <section className="mb-12">
        <h2 className="text-h3 font-semibold text-fg-1 mb-4">Shadows</h2>
        <div className="flex flex-wrap gap-6">
          {(['shadow-xs', 'shadow-sm', 'shadow-md', 'shadow-lg', 'shadow-xl', 'shadow-brand'] as const).map(
            (s) => (
              <div
                key={s}
                className={`h-16 w-32 bg-surface-1 rounded-md flex items-center justify-center ${s}`}
              >
                <span className="text-xxs text-fg-3">{s}</span>
              </div>
            ),
          )}
        </div>
      </section>
    </div>
  );
}
