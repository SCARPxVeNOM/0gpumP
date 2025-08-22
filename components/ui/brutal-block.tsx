import * as React from 'react'

type Size = 'sm' | 'md' | 'lg'
type Tone = 'primary' | 'secondary' | 'danger' | 'neutral'

export type BrutalBlockProps<E extends React.ElementType = 'div'> = {
  as?: E
  size?: Size
  tone?: Tone
  className?: string
} & Omit<React.ComponentProps<E>, 'as' | 'size' | 'className'>

export function BrutalBlock<E extends React.ElementType = 'div'>({
  as,
  size = 'md',
  tone = 'neutral',
  className = '',
  ...props
}: BrutalBlockProps<E>) {
  const Component = (as || 'div') as React.ElementType

  const padding = size === 'sm' ? 'px-3 py-2' : size === 'lg' ? 'px-6 py-4' : 'px-4 py-3'

  const toneClasses =
    tone === 'primary'
      ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
      : tone === 'secondary'
      ? 'bg-white text-black'
      : tone === 'danger'
      ? 'bg-red-400 text-black'
      : 'bg-sky-100 text-slate-900'

  return (
    <Component
      className={`nb-border nb-shadow rounded-md ${padding} ${toneClasses} ${className}`}
      {...(props as any)}
    />
  )
}


