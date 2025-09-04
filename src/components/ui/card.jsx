import React from 'react'

export function Card({ className = '', ...props }) {
  return <div className={['bg-white rounded-2xl border border-slate-200', className].join(' ')} {...props} />
}
export function CardContent({ className = '', ...props }) {
  return <div className={['p-4', className].join(' ')} {...props} />
}