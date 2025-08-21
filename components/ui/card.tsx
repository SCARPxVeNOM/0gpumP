import * as React from 'react'

type Props = React.HTMLAttributes<HTMLDivElement>

export function Card({ className = '', ...props }: Props) {
  return <div className={`bg-white/5 border border-white/10 ${className}`} {...props} />
}

export function CardHeader({ className = '', ...props }: Props) {
  return <div className={`px-4 py-3 ${className}`} {...props} />
}

export function CardTitle({ className = '', ...props }: Props) {
  return <div className={`text-lg font-semibold ${className}`} {...props} />
}

export function CardDescription({ className = '', ...props }: Props) {
  return <div className={`text-sm text-muted-foreground ${className}`} {...props} />
}

export function CardContent({ className = '', ...props }: Props) {
  return <div className={`px-4 pb-4 ${className}`} {...props} />
}










