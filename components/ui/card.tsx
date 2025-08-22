import * as React from 'react'

type Props = React.HTMLAttributes<HTMLDivElement>

export function Card({ className = '', ...props }: Props) {
  return <div className={`bg-[hsl(var(--card))] text-[hsl(var(--card-foreground))] nb-border nb-shadow rounded-lg nb-press ${className}`} {...props} />
}

export function CardHeader({ className = '', ...props }: Props) {
  return <div className={`px-5 py-4 border-b-2 border-black ${className}`} {...props} />
}

export function CardTitle({ className = '', ...props }: Props) {
  return <div className={`text-xl font-extrabold ${className}`} {...props} />
}

export function CardDescription({ className = '', ...props }: Props) {
  return <div className={`text-sm opacity-80 ${className}`} {...props} />
}

export function CardContent({ className = '', ...props }: Props) {
  return <div className={`px-5 pb-5 ${className}`} {...props} />
}










