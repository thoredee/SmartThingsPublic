'use client'

import { useEffect, useState } from 'react'
import { ShoppingListItem } from '@/types'

export default function ShoppingListPage() {
  const [items, setItems] = useState<ShoppingListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newItem, setNewItem] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    fetchList()
  }, [])

  async function fetchList() {
    const res = await fetch('/api/shopping-list')
    const data = await res.json()
    setItems(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault()
    if (!newItem.trim()) return
    setAdding(true)

    await fetch('/api/shopping-list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newItem.trim(), quantity: 1 }),
    })

    setNewItem('')
    setAdding(false)
    fetchList()
  }

  async function toggleItem(id: string, checked: boolean) {
    setItems(prev =>
      prev.map(item => (item.id === id ? { ...item, is_checked: checked } : item))
    )
    await fetch(`/api/shopping-list/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_checked: checked }),
    })
  }

  async function clearChecked() {
    await fetch('/api/shopping-list/checked', { method: 'DELETE' })
    fetchList()
  }

  const unchecked = items.filter(i => !i.is_checked)
  const checked = items.filter(i => i.is_checked)

  if (loading) {
    return <div className="text-center py-16 text-gray-400">Loading shopping list...</div>
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">Shopping List</h2>
        {checked.length > 0 && (
          <button
            onClick={clearChecked}
            className="text-sm text-red-500"
          >
            Clear done ({checked.length})
          </button>
        )}
      </div>

      {/* Add item */}
      <form onSubmit={addItem} className="flex gap-2">
        <input
          type="text"
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          placeholder="Add an item..."
          className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={adding || !newItem.trim()}
          className="bg-blue-700 text-white px-4 py-3 rounded-xl font-medium disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {items.length === 0 && (
        <div className="text-center py-12">
          <p className="text-5xl mb-4">🛒</p>
          <p className="text-gray-500">Your shopping list is empty</p>
          <p className="text-sm text-gray-400 mt-1">Add items above, or they&apos;ll appear automatically when things run low</p>
        </div>
      )}

      {/* Unchecked items */}
      {unchecked.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-50">
            {unchecked.map(item => (
              <label key={item.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => toggleItem(item.id, true)}
                  className="w-5 h-5 rounded border-gray-300 accent-blue-700"
                />
                <span className="text-gray-800">{item.name}</span>
                {item.quantity > 1 && (
                  <span className="ml-auto text-sm text-gray-400">×{item.quantity}</span>
                )}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Checked items */}
      {checked.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden opacity-60">
          <div className="divide-y divide-gray-50">
            {checked.map(item => (
              <label key={item.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={true}
                  onChange={() => toggleItem(item.id, false)}
                  className="w-5 h-5 rounded border-gray-300 accent-blue-700"
                />
                <span className="text-gray-500 line-through">{item.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
