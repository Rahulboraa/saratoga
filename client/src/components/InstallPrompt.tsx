import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'sv_install_dismissed'

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY)) return
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  if (!deferred) return null

  return (
    <div className="fixed inset-x-3 bottom-16 z-50 mb-[env(safe-area-inset-bottom)] flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-lg md:hidden">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-[12px] font-bold text-primary-foreground">
        SV
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold">Install Saratoga app</div>
        <div className="text-[11px] text-muted-foreground">Home screen se seedha kholo</div>
      </div>
      <Button
        size="sm"
        onClick={async () => {
          await deferred.prompt()
          setDeferred(null)
        }}
      >
        Install
      </Button>
      <button
        type="button"
        className="p-1 text-muted-foreground"
        aria-label="Dismiss install prompt"
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, '1')
          setDeferred(null)
        }}
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
