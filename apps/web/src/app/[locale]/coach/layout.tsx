// Coach portal layout (authenticated)
export default function CoachLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-surface-dim)]">
      {/* TODO: sidebar navigation for coach portal */}
      <div className="mx-auto max-w-[var(--max-content-width)] px-4 py-8">
        {children}
      </div>
    </div>
  );
}
