import * as React from 'react'

export function Badge({ className = '', ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={`inline-flex items-center px-2 py-1 text-xs rounded-full bg-white/10 border border-white/10 ${className}`} {...props} />
}




















