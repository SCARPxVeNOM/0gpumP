import * as React from 'react'

type Props = { value: number } & React.HTMLAttributes<HTMLDivElement>

export function Progress({ value, className = '' }: Props) {
  return (
    <div className={`w-full bg-white/10 rounded ${className}`}>
      <div className="h-full bg-indigo-500 rounded" style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: '100%' }} />
    </div>
  )
}




















