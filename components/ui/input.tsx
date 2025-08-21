import * as React from 'react'

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...rest } = props
  return <input className={`w-full px-3 py-2 bg-white/10 border border-white/10 rounded-md outline-none ${className}`} {...rest} />
}




















