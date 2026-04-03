'use client'

import { useEffect, useState } from 'react'
import { PantryItem } from '@/types'

const categoryEmoji: Record<string, string> = {
  'fresh-produce': '🥦',
  dairy: '🥛',
  'meat-fish': '🥩',
  bakery: '🍞',
  frozen: '🧊',
  drinks: '🥤',
  snacks: '🍿',
  cleaning: '🧹',
  'personal-care': '🧴',
  baby: '👶',
  other: '🛍️',
}

function daysAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function stockLevel(item: PantryItem): 'good' | 'low' | 'unknown' {
  if (!item.avg_days_between_purchase) return 'unknown'
  const days = daysAgo(item.last_purchased_at)
  const ratio = days / item.avg_days_between_purchase
  if (ratio > 0.8) return 'low'
  return 'good'
}

export default function PantryPage() {
  const [items, setItems] = useState<PantryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/pantry')
      .then(r => r.json())
      .then(data => {
        setItems(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const grouped = items.reduce<Record<string, PantryItem[]>>((acc, item) => {
    const cat = item.category
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {})

  if (loading) {
    return <div className="text-center py-16 text-gray-400">Loading pantry...</div>
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-5xl mb-4">🥫</p>
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Pantry is empty</h2>
        <p className="text-gray-500">Add some receipts and your pantry will fill up automatically</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-gray-800">Pantry</h2>
      <p className="text-sm text-gray-500 -mt-3">
        Estimated based on your purchase history
      </p>

      {Object.entries(grouped).map(([category, catItems]) => (
        <div key={category} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <span>{categoryEmoji[category] ?? '🛍️'}</span>
            <span className="font-semibold text-gray-700 capitalize">{category.replace('-', ' ')}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {catItems.map(item => {
              const level = stockLevel(item)
              const days = daysAgo(item.last_purchased_at)
              return (
                <div key={item.id} className="px-4 py-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-800">{item.name}</p>
                    <p className="text-xs text-gray-400">Last bought {days}d ago</p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${
                      level === 'low'
                        ? 'bg-orange-100 text-orange-700'
                        : level === 'good'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {level === 'low' ? 'Running low' : level === 'good' ? 'Stocked' : 'Unknown'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
