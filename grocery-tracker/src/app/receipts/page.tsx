'use client'

import { useState, useRef } from 'react'
import { ParsedReceipt } from '@/types'

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

type Step = 'capture' | 'preview' | 'review' | 'saving' | 'saved'

export default function ReceiptsPage() {
  const [step, setStep] = useState<Step>('capture')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParsedReceipt | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return
    setFile(selected)
    setPreviewUrl(URL.createObjectURL(selected))
    setStep('preview')
    setError(null)
  }

  async function parseReceipt() {
    if (!file) return
    setParsing(true)
    setError(null)

    const form = new FormData()
    form.append('receipt', file)

    const res = await fetch('/api/parse-receipt', { method: 'POST', body: form })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Failed to read receipt')
      setParsing(false)
      return
    }

    setParsed(data)
    setStep('review')
    setParsing(false)
  }

  async function saveReceipt() {
    if (!parsed) return
    setStep('saving')

    const res = await fetch('/api/receipts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
    })

    if (res.ok) {
      setStep('saved')
    } else {
      setError('Failed to save receipt')
      setStep('review')
    }
  }

  function reset() {
    setStep('capture')
    setFile(null)
    setPreviewUrl(null)
    setParsed(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (step === 'saved') {
    return (
      <div className="text-center py-16">
        <p className="text-5xl mb-4">✅</p>
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Receipt saved!</h2>
        <p className="text-gray-500 mb-6">
          {parsed?.items.length} items added from {parsed?.store}
        </p>
        <button
          onClick={reset}
          className="bg-blue-700 text-white px-6 py-3 rounded-xl font-medium"
        >
          Add Another Receipt
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-gray-800">Add Receipt</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Capture */}
      {step === 'capture' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
          <p className="text-5xl mb-4">📷</p>
          <p className="text-gray-600 mb-6">Take a photo of your Tesco receipt or upload one from your camera roll</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
            id="receipt-input"
          />
          <label
            htmlFor="receipt-input"
            className="inline-block bg-blue-700 text-white px-8 py-3 rounded-xl font-medium cursor-pointer"
          >
            Take Photo / Choose Image
          </label>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 'preview' && previewUrl && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
            <img src={previewUrl} alt="Receipt preview" className="w-full object-contain max-h-96" />
          </div>
          <div className="flex gap-3">
            <button
              onClick={reset}
              className="flex-1 border border-gray-300 text-gray-700 px-4 py-3 rounded-xl font-medium"
            >
              Retake
            </button>
            <button
              onClick={parseReceipt}
              disabled={parsing}
              className="flex-1 bg-blue-700 text-white px-4 py-3 rounded-xl font-medium disabled:opacity-60"
            >
              {parsing ? 'Reading receipt...' : 'Read Receipt'}
            </button>
          </div>
          {parsing && (
            <p className="text-center text-sm text-gray-500">
              Claude is reading your receipt — this takes a few seconds
            </p>
          )}
        </div>
      )}

      {/* Step 3: Review */}
      {step === 'review' && parsed && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-1">
              <div>
                <p className="font-bold text-gray-800 text-lg">{parsed.store}</p>
                <p className="text-sm text-gray-500">
                  {new Date(parsed.purchase_date).toLocaleDateString('en-GB', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <p className="text-xl font-bold text-blue-700">£{parsed.total_amount.toFixed(2)}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="font-semibold text-gray-700">{parsed.items.length} items</p>
            </div>
            <div className="divide-y divide-gray-50">
              {parsed.items.map((item, i) => (
                <div key={i} className="px-4 py-3 flex justify-between items-center">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg flex-shrink-0">{categoryEmoji[item.category] ?? '🛍️'}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                      <p className="text-xs text-gray-400">
                        {item.quantity > 1 ? `${item.quantity} × £${item.unit_price.toFixed(2)}` : item.category.replace('-', ' ')}
                      </p>
                    </div>
                  </div>
                  <p className="font-medium text-gray-700 ml-2 flex-shrink-0">
                    £{item.total_price.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={reset}
              className="flex-1 border border-gray-300 text-gray-700 px-4 py-3 rounded-xl font-medium"
            >
              Discard
            </button>
            <button
              onClick={saveReceipt}
              className="flex-1 bg-blue-700 text-white px-4 py-3 rounded-xl font-medium"
            >
              Save Receipt
            </button>
          </div>
        </div>
      )}

      {step === 'saving' && (
        <div className="text-center py-12 text-gray-500">Saving receipt...</div>
      )}
    </div>
  )
}
