export function Card({ as: Tag = 'div', className = '', children, ...props }) {
  return (
    <Tag
      className={[
        'grain-free rounded-2xl border border-line bg-surface shadow-[var(--shadow-soft)]',
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({ eyebrow, title, action, className = '' }) {
  return (
    <div className={['flex items-start justify-between gap-4', className].join(' ')}>
      <div>
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h2 className="text-lg font-semibold text-ink sm:text-xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}
