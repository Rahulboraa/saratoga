import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    listeners.forEach((fn) => fn())
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    listeners.forEach((fn) => fn())
  })
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true)
  )
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

export default function InstallButton() {
  const [, force] = useState(0)

  useEffect(() => {
    const fn = () => force((n) => n + 1)
    listeners.add(fn)
    return () => { listeners.delete(fn) }
  }, [])

  if (isStandalone()) return null
  if (!deferredPrompt && !isIos()) return null

  return (
    <Button
      variant="outline"
      size="sm"
      className="shrink-0 md:hidden"
      onClick={async () => {
        if (deferredPrompt) {
          await deferredPrompt.prompt()
          deferredPrompt = null
          force((n) => n + 1)
        } else {
          toast('Tap the Share button, then "Add to Home Screen"', { icon: '📲', duration: 5000 })
        }
      }}
    >
      <Download className="size-5" /> Install
    </Button>
  )
}
