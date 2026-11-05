'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

export function DeskDialog({ open, onClose, busy = false, label, className = '', children }: {
  open: boolean; onClose: () => void; busy?: boolean; label: string; className?: string; children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!open || !dialog) return
    const scrollY = window.scrollY
    const previous = { position: document.body.style.position, top: document.body.style.top, width: document.body.style.width }
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    dialog.showModal()
    return () => {
      dialog.close()
      Object.assign(document.body.style, previous)
      window.scrollTo(0, scrollY)
    }
  }, [open])

  return <dialog ref={ref} aria-label={label} aria-busy={busy} className={`desk-dialog ${className}`}
    onCancel={event => { event.preventDefault(); if (!busy) onClose() }}
    onClick={event => { if (event.target === event.currentTarget && !busy) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose() } }}>
    {children}
  </dialog>
}

export function OrderTicketFrame({ open, onClose, busy, children }: {
  open: boolean; onClose: () => void; busy: boolean; children: ReactNode
}) {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const media = window.matchMedia('(max-width: 850px)')
    const update = () => setMobile(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return mobile ? <DeskDialog open={open} onClose={onClose} busy={busy} label="Order ticket" className="panel ticket ticket-sheet">{children}</DeskDialog>
    : <section className="panel ticket">{children}</section>
}
