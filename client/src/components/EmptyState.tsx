export default function EmptyState({ icon = '📭', message }: { icon?: string; message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
      <div className="text-3xl">{icon}</div>
      <p className="text-sm">{message}</p>
    </div>
  )
}
