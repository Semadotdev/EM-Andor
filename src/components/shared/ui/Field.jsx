export const inputClass =
  'w-full rounded-md border border-mist bg-white px-4 py-3 text-sm text-ink placeholder:text-ink/40 transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'

const labelClass = 'mb-1.5 block text-sm font-semibold text-brand-deep'

export function FieldError({ children, className = '' }) {
  if (!children) return null
  return (
    <p role="alert" className={`mt-1.5 text-xs font-medium text-red-600 ${className}`.trim()}>
      {children}
    </p>
  )
}

function FieldLabel({ label, id }) {
  if (!label) return null
  return (
    <label htmlFor={id} className={labelClass}>
      {label}
    </label>
  )
}

export function Input({ label, id, error, className = '', suffix, ...rest }) {
  const input = (
    <input
      id={id}
      aria-invalid={error ? true : undefined}
      className={[inputClass, suffix ? 'pr-16' : '', className].filter(Boolean).join(' ')}
      {...rest}
    />
  )

  return (
    <div>
      <FieldLabel label={label} id={id} />
      {suffix ? (
        <div className="relative">
          {input}
          <div className="absolute inset-y-0 right-3 flex items-center">{suffix}</div>
        </div>
      ) : (
        input
      )}
      <FieldError>{error}</FieldError>
    </div>
  )
}

export function Select({ label, id, error, className = '', children, ...rest }) {
  return (
    <div>
      <FieldLabel label={label} id={id} />
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        className={`${inputClass} ${className}`.trim()}
        {...rest}
      >
        {children}
      </select>
      <FieldError>{error}</FieldError>
    </div>
  )
}

export function Textarea({ label, id, error, className = '', ...rest }) {
  return (
    <div>
      <FieldLabel label={label} id={id} />
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        className={`${inputClass} ${className}`.trim()}
        {...rest}
      />
      <FieldError>{error}</FieldError>
    </div>
  )
}

export function Checkbox({ label, id, error, className = '', ...rest }) {
  return (
    <div>
      <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium text-ink/70">
        <input
          id={id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          className={`size-4 rounded border-mist text-brand focus:ring-2 focus:ring-brand/20 ${className}`.trim()}
          {...rest}
        />
        {label}
      </label>
      <FieldError>{error}</FieldError>
    </div>
  )
}
