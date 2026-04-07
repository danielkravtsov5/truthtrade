'use client'

import { useState } from 'react'
import Navbar from '@/components/Navbar'
import { ShieldCheck, Key, AlertCircle, CheckCircle2 } from 'lucide-react'

export default function ConnectBrokerPage() {
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')

    const res = await fetch('/api/broker/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, api_secret: apiSecret }),
    })

    const data = await res.json()

    if (res.ok) {
      setStatus('success')
      setMessage('Binance connected! Your trades will auto-post within 60 seconds.')
      setApiKey('')
      setApiSecret('')
    } else {
      setStatus('error')
      setMessage(data.error ?? 'Failed to connect. Check your API keys.')
    }
  }

  return (
    <div className="flex min-h-screen">
      <Navbar />
      <main className="flex-1 md:ml-64 pb-20 md:pb-0">
        <div className="max-w-lg mx-auto px-4 py-8">
          <h1 className="font-bold text-2xl text-gray-900 mb-2">Connect Binance</h1>
          <p className="text-gray-500 text-sm mb-8">
            Link your Binance account to auto-post your real trades. We only need read-only access — we cannot place or cancel orders.
          </p>

          {/* Steps */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 space-y-3">
            <p className="font-semibold text-blue-800 text-sm">How to get your API keys:</p>
            <ol className="list-decimal list-inside space-y-1.5 text-sm text-blue-700">
              <li>Log in to Binance → Account → API Management</li>
              <li>Click &quot;Create API&quot; and name it &quot;TruthTrade&quot;</li>
              <li>Enable <strong>Read Only</strong> permissions only</li>
              <li>Disable &quot;Enable Spot &amp; Margin Trading&quot; for safety</li>
              <li>Copy the API Key and Secret below</li>
            </ol>
          </div>

          <form onSubmit={handleConnect} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                <Key size={14} /> API Key
              </label>
              <input
                type="text"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                required
                placeholder="Your Binance API Key"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                <Key size={14} /> API Secret
              </label>
              <input
                type="password"
                value={apiSecret}
                onChange={e => setApiSecret(e.target.value)}
                required
                placeholder="Your Binance API Secret"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {status === 'error' && (
              <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl p-3">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                {message}
              </div>
            )}
            {status === 'success' && (
              <div className="flex items-start gap-2 text-emerald-700 text-sm bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {status === 'loading' ? 'Verifying & connecting...' : 'Connect Binance'}
            </button>
          </form>

          {/* Security note */}
          <div className="mt-6 flex items-start gap-2 text-gray-400 text-xs">
            <ShieldCheck size={14} className="mt-0.5 flex-shrink-0" />
            <span>
              Your API keys are encrypted and stored securely. We use read-only permissions and can never trade on your behalf.
            </span>
          </div>
        </div>
      </main>
    </div>
  )
}
