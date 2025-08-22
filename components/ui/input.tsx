import * as React from 'react'

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...rest } = props
  return (
    <input
      className={`w-full px-4 py-2.5 bg-[hsl(var(--card))] text-[hsl(var(--card-foreground))] nb-border rounded-md outline-none nb-press ${className}`}
      {...rest}
    />
  )
}




















