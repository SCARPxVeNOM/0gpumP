import * as React from 'react'

export function Tabs({ children }: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return <div>{children}</div>
}

export function TabsList({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`flex gap-2 ${className}`} {...props} />
}

export function TabsTrigger({ className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`px-3 py-1 rounded-md bg-white/10 nb-press ${className}`} {...props} />
}

export function TabsContent({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={className} {...props} />
}




















