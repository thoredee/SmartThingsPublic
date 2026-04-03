'use client'

import { useEffect, useState } from 'react'
import { Receipt } from '@/types'

interface SpendByCategory {
  category: string
  total: number
}

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

export default function Dashboard() {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/receipts')
      .then(r => r.json())
      .then(data => {
        setReceipts(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const totalThisMonth = receipts
    .filter(r => {
      const d = new Date(r.purchase_date)
      const now = new Date()
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((sum, r) => sum + r.total_amount, 0)

  const totalAllTime = receipts.reduce((sum, r) => sum + r.total_amount, 0)

  const spendByCategory: SpendByCategory[] = Object.values(
    receipts
      .flatMap(r => r.items ?? [])
      .reduce<Record<string, SpendByCategory>>((acc, item) => {
        if (!acc[item.category]) acc[item.category] = { category: item.category, total: 0 }
        acc[item.category].total += item.total_price
        return acc
      }, {})
  ).sort((a, b) => b.total - a.total)

  const recentReceipts = receipts.slice(0, 5)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        Loading your grocery data...
      </div>
    )
  }

  if (receipts.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-5xl mb-4">🧾</p>
        <h2 className="text-xl font-semibold text-gray-700 mb-2">No receipts yet</h2>
        <p className="text-gray-500 mb-6">Add your first Tesco receipt to get started</p>
        <a
          href="/receipts"
          className="inline-block bg-blue-700 text-white px-6 py-3 rounded-xl font-medium"
        >
          Add Receipt
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Spend summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">This month</p>
          <p className="text-2xl font-bold text-blue-700">£{totalThisMonth.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">All time</p>
          <p className="text-2xl font-bold text-gray-800">£{totalAllTime.toFixed(2)}</p>
        </div>
      </div>

      {/* Spend by category */}
      {spendByCategory.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-700 mb-3">Spend by category</h2>
          <div className="space-y-2">
            {spendByCategory.map(({ category, total }) => {
              const pct = (total / totalAllTime) * 100
              return (
                <div key={category}>
                  <div className="flex justify-between text-sm mb-0.5">
                    <span className="text-gray-600">
                      {categoryEmoji[category] ?? '🛍️'} {category.replace('-', ' ')}
                    </span>
                    <span className="font-medium">£{total.toFixed(2)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent receipts */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <h2 className="font-semibold text-gray-700 mb-3">Recent shops</h2>
        <div className="space-y-3">
          {recentReceipts.map(receipt => (
            <div key={receipt.id} className="flex justify-between items-center">
              <div>
                <p className="font-medium text-gray-800">{receipt.store}</p>
                <p className="text-xs text-gray-400">
                  {new Date(receipt.purchase_date).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <p className="font-semibold text-gray-700">£{receipt.total_amount.toFixed(2)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
