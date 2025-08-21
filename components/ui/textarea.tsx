import * as React from 'react'

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = '', ...rest } = props
  return <textarea className={`w-full px-3 py-2 bg-white/10 border border-white/10 rounded-md outline-none ${className}`} {...rest} />
}




















