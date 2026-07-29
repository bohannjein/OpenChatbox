/** Section wrapper — consistent divider + spacing; first section has no border. */
export function Section({ children }: { children: React.ReactNode }) {
  return (
    <section className="border-t border-border-light pt-6 first:border-0 first:pt-0 dark:border-border-dark">
      {children}
    </section>
  );
}

/** Heading for a section that used to carry its own <h3> inside a panel. */
export function SectionTitle({
  title,
  hint,
}: {
  title: string;
  hint?: React.ReactNode;
}) {
  return (
    <>
      <h4 className="font-medium">{title}</h4>
      {hint && <p className="mb-3 text-sm text-neutral-500">{hint}</p>}
    </>
  );
}
