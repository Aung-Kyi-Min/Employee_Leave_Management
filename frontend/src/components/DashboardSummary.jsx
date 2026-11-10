export default function DashboardSummary({ label, metrics }) {
  return (
    <section className="summary dashboard-summary" aria-label={label}>
      {metrics.map(({ title, value, note }) => (
        <article key={title}>
          <span>{title}</span>
          <strong>{value}</strong>
          <small>{note}</small>
        </article>
      ))}
    </section>
  )
}
