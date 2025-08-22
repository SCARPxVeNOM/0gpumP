import * as React from 'react'

type Props = { checked: boolean; onCheckedChange: (v: boolean) => void } & React.HTMLAttributes<HTMLButtonElement>

export function Switch({ checked, onCheckedChange }: Props) {
  return (
    <button
      onClick={() => onCheckedChange(!checked)}
      className={`w-10 h-6 rounded-full relative nb-press ${checked ? 'bg-indigo-600' : 'bg-white/10 border border-white/10'}`}
    >
      <span className={`absolute top-0.5 transition ${checked ? 'left-5' : 'left-0.5'} inline-block w-5 h-5 bg-white rounded-full`} />
    </button>
  )
}




















