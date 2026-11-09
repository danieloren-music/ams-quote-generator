export default function ComingSoon({ title, step }: { title: string; step: string }) {
  return (
    <section className="rounded-lg border border-dashed border-line bg-white p-10 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-ink/60">ייבנה ב{step}</p>
    </section>
  );
}
