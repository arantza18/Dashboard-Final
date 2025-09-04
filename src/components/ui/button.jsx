import React from 'react'

export function Button({ className = '', variant = 'default', size = 'md', ...props }) {
  const base = 'inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring disabled:opacity-50 disabled:pointer-events-none transition'
  const variants = {
    default: 'bg-slate-900 text-white hover:bg-slate-800',
    secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-900',
    outline: 'border border-slate-300 hover:bg-slate-50 text-slate-900 bg-white'
  }
  return <button className={[base, variants[variant] || variants.default, className].join(' ')} {...props} />
}