import * as React from 'react'

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...rest } = props
  return (
    <input
      className={`w-full px-4 py-2.5 bg-[hsl(var(--card))] text-[hsl(var(--card-foreground))] nb-border rounded-md outline-none focus:-translate-x-0.5 focus:-translate-y-0.5 transition-transform ${className}`}
      {...rest}
    />
  )
}




















