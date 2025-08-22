import * as React from 'react'

type LinkButtonProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'primary' | 'secondary' | 'danger'
}

export function LinkButton({ className = '', size = 'md', variant = 'primary', ...props }: LinkButtonProps) {
  const padding = size === 'sm' ? 'px-3 py-2' : size === 'lg' ? 'px-6 py-3' : 'px-4 py-2.5'
  const bg =
    variant === 'secondary'
      ? 'bg-white text-black'
      : variant === 'danger'
      ? 'bg-red-400 text-black'
      : 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'

  return (
    <a
      className={`inline-flex items-center justify-center ${padding} nb-border nb-shadow-sm rounded-md font-bold tracking-tight nb-press ${bg} ${className}`}
      {...props}
    />
  )
}


