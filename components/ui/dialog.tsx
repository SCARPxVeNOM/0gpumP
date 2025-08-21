import * as React from 'react'

export function Dialog({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}

export function DialogTrigger({ asChild, children }: { asChild?: boolean; children: React.ReactNode }) {
  return <>{children}</>
}

export function DialogContent({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`p-5 nb-border nb-shadow rounded-lg bg-[hsl(var(--card))] text-[hsl(var(--card-foreground))] ${className}`}>{children}</div>
}

export function DialogHeader({ children }: { children: React.ReactNode }) {
  return <div className="mb-2">{children}</div>
}

export function DialogTitle({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`text-xl font-extrabold ${className}`}>{children}</div>
}




















