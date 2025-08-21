import * as React from 'react'

export function Dialog({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}

export function DialogTrigger({ asChild, children }: { asChild?: boolean; children: React.ReactNode }) {
  return <>{children}</>
}

export function DialogContent({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`p-4 rounded-md ${className}`}>{children}</div>
}

export function DialogHeader({ children }: { children: React.ReactNode }) {
  return <div className="mb-2">{children}</div>
}

export function DialogTitle({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`text-lg font-semibold ${className}`}>{children}</div>
}




















