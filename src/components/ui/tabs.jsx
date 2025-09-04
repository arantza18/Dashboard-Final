import React, { useState } from 'react'

export function Tabs({ defaultValue, children }) {
  const [value, setValue] = useState(defaultValue)
  return <div data-tabs data-value={value}>{React.Children.map(children, c => React.cloneElement(c, { value, setValue }))}</div>
}

export function TabsList({ children, value, setValue, className='' }) {
  return <div className={['inline-flex rounded-xl bg-slate-100 p-1', className].join(' ')}>
    {React.Children.map(children, c => React.cloneElement(c, { value, setValue }))}
  </div>
}

export function TabsTrigger({ value: tabValue, children, value, setValue }) {
  const active = tabValue === value
  return <button onClick={() => setValue(tabValue)} className={['px-3 py-1 rounded-lg text-sm', active? 'bg-white shadow':'text-slate-600'].join(' ')}>{children}</button>
}

export function TabsContent({ value: tabValue, children, value, className='' }) {
  if (tabValue !== value) return null
  return <div className={className}>{children}</div>
}