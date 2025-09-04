import React from 'react'

export function Input({ className = '', ...props }) {
  return <input className={['w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-slate-200', className].join(' ')} {...props} />
}