import React from 'react'

export function Select({ value, onValueChange, children }) {
  return <div data-select>{children({ value, onValueChange })}</div>
}

export function SelectTrigger({ children }) { return <div>{children}</div> }
export function SelectValue({ placeholder }) { return <span className="text-slate-500">{placeholder}</span> }
export function SelectContent({ children }) { return <div className="mt-1">{children}</div> }
export function SelectItem({ value, children, onChange }) {
  return <div className="px-3 py-2 rounded-lg hover:bg-slate-100 cursor-pointer" onClick={() => onChange?.(value)}>{children}</div>
}