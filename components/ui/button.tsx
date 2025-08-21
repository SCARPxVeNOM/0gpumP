import * as React from 'react'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({ className = '', variant = 'primary', size = 'md', ...props }: ButtonProps) {
  const bg =
    variant === 'secondary'
      ? 'bg-white text-black'
      : variant === 'danger'
      ? 'bg-red-400 text-black'
      : 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'

  const padding = size === 'sm' ? 'px-3 py-2' : size === 'lg' ? 'px-6 py-3' : 'px-4 py-2.5'

  return (
    <button
      className={`inline-flex items-center justify-center ${padding} nb-border nb-shadow-sm rounded-md font-bold tracking-tight transition-transform active:translate-x-0 active:translate-y-0 hover:-translate-x-0.5 hover:-translate-y-0.5 ${bg} ${className}`}
      {...props}
    />
  )
}










