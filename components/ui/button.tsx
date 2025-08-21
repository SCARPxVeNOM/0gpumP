import * as React from 'react'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { 
  variant?: 'default' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({ className = '', variant = 'default', size = 'md', ...props }: ButtonProps) {
  const variantClass = variant === 'secondary' ? 'bg-white/10 hover:bg-white/20' : 'bg-indigo-600 hover:bg-indigo-500'
  const sizeClass = size === 'sm' ? 'px-2 py-1 text-xs' : size === 'lg' ? 'px-4 py-3 text-base' : 'px-3 py-2 text-sm'
  
  return (
    <button
      className={`${sizeClass} font-medium rounded-md transition ${variantClass} ${className}`}
      {...props}
    />
  )
}










