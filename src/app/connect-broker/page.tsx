'use client'

import { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import { ShieldCheck, Key, AlertCircle, CheckCircle2, Plus, Trash2, User } from 'lucide-react'

interface BrokerConnection {
  id: string
  broker: string
  api_key: string | null
  created_at: string
  last_synced_at: string | null
}

type BrokerType = 'binance' | 'tradovate' | null

export default function ConnectBrokerPage() {
  const [connections, setConnections] = useState<BrokerConnection[]>([])
  const [selectedBroker, setSelectedBroker] = useState<BrokerType>(null)
  const [removing, setRemoving] = useState<string | null>(null)

  // Binance fields
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')

  // Tradovate fields
  const [tvUsername, setTvUsername] = useState('')
  const [tvPassword, setTvPassword] = useState('')
  const [tvDemo, setTvDemo] = useState(false)

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/broker/connect')
      .then(r => r.json())
      .then(setConnections)
      .catch(() => {})
  }, [])

  async function handleConnectBinance(e: React.FormEvent) {
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
      setMessage('Binance connected! Your trades will sync within 60 seconds.')
      setApiKey('')
      setApiSecret('')
      setSelectedBroker(null)
      refreshConnections()
    } else {
      setStatus('error')
      setMessage(data.error ?? 'Failed to connect.')
    }
  }

  async function handleConnectTradovate(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    const res = await fetch('/api/broker/tradovate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: tvUsername, password: tvPassword, demo: tvDemo }),
    })
    const data = await res.json()
    if (res.ok) {
      setStatus('success')
      setMessage('Tradovate connected! Your trades will sync within 60 seconds.')
      setTvUsername('')
      setTvPassword('')
      setSelectedBroker(null)
      refreshConnections()
    } else {
      setStatus('error')
      setMessage(data.error ?? 'Failed to connect.')
    }
  }

  async function refreshConnections() {
    const updated = await fetch('/api/broker/connect').then(r => r.json())
    setConnections(updated)
  }

  async function handleRemove(broker: string) {
    setRemoving(broker)
    const endpoint = broker === 'tradovate' ? '/api/broker/tradovate' : '/api/broker/connect'
    const res = await fetch(endpoint, { method: 'DELETE' })
    if (res.ok) {
      setConnections(c => c.filter(conn => conn.broker !== broker))
    }
    setRemoving(null)
  }

  const brokerIcon = (broker: string) => {
    if (broker === 'binance') return 'B'
    if (broker === 'tradovate') return 'T'
    return '?'
  }

  const brokerColor = (broker: string) => {
    if (broker === 'binance') return 'bg-yellow-100 text-yellow-700'
    if (broker === 'tradovate') return 'bg-blue-100 text-blue-700'
    return 'bg-gray-100 text-gray-700'
  }

  return (
    <div className="flex min-h-screen">
      <Navbar />
      <main className="flex-1 md:ml-64 pb-20 md:pb-0">
        <div className="max-w-lg mx-auto px-4 py-8">
          <h1 className="font-bold text-2xl text-gray-900 mb-6 text-center">Broker Connections</h1>

          {/* READ ONLY banner */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-8 flex items-start gap-3">
            <ShieldCheck className="text-emerald-600 flex-shrink-0 mt-0.5" size={24} />
            <div>
              <p className="font-semibold text-emerald-800 text-sm">Read-Only Access</p>
              <p className="text-emerald-700 text-sm mt-0.5">
                We can only read your trades. We can <strong>never</strong> place orders or move funds.
              </p>
            </div>
          </div>

          {/* Status messages */}
          {status === 'success' && (
            <div className="flex items-start gap-2 text-emerald-700 text-sm bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4">
              <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
              {message}
            </div>
          )}

          {/* Connected brokers */}
          {connections.length > 0 && (
            <div className="space-y-3 mb-6">
              {connections.map(conn => (
                <div key={conn.id} className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${brokerColor(conn.broker)}`}>
                      {brokerIcon(conn.broker)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 capitalize">{conn.broker}</p>
                      {conn.api_key && <p className="text-gray-400 text-xs font-mono">{conn.api_key}</p>}
                      <p className="text-gray-400 text-xs">
                        Connected {new Date(conn.created_at).toLocaleDateString()}
                        {conn.last_synced_at && ` · Last sync ${new Date(conn.last_synced_at).toLocaleString()}`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemove(conn.broker)}
                    disabled={removing === conn.broker}
                    className="text-red-400 hover:text-red-600 transition-colors p-2"
                    title="Remove broker"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Broker selection / forms */}
          {!selectedBroker ? (
            <div className="flex flex-col items-center">
              <p className="text-gray-500 text-sm mb-4">Choose a broker to connect:</p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setSelectedBroker('binance'); setStatus('idle'); setMessage('') }}
                  className="flex flex-col items-center gap-2 px-6 py-4 border-2 border-gray-200 rounded-2xl hover:border-yellow-400 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-700 font-bold text-lg">B</div>
                  <span className="font-semibold text-gray-900 text-sm">Binance</span>
                  <span className="text-gray-400 text-xs">Crypto</span>
                </button>
                <button
                  onClick={() => { setSelectedBroker('tradovate'); setStatus('idle'); setMessage('') }}
                  className="flex flex-col items-center gap-2 px-6 py-4 border-2 border-gray-200 rounded-2xl hover:border-blue-400 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg">T</div>
                  <span className="font-semibold text-gray-900 text-sm">Tradovate</span>
                  <span className="text-gray-400 text-xs">Futures</span>
                </button>
              </div>
              {connections.length === 0 && (
                <p className="text-gray-400 text-sm mt-4">No brokers connected yet</p>
              )}
            </div>
          ) : selectedBroker === 'binance' ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold text-gray-900">Connect Binance</h2>
                <button onClick={() => setSelectedBroker(null)} className="text-gray-400 hover:text-gray-600 text-sm">Cancel</button>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 space-y-2">
                <p className="font-semibold text-blue-800 text-xs">How to get your API keys:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs text-blue-700">
                  <li>Log in to Binance → Account → API Management</li>
                  <li>Click &quot;Create API&quot; and name it &quot;TruthTrade&quot;</li>
                  <li>Enable <strong>Read Only</strong> permissions only</li>
                  <li>Disable &quot;Enable Spot &amp; Margin Trading&quot; for safety</li>
                  <li>Copy the API Key and Secret below</li>
                </ol>
              </div>

              <form onSubmit={handleConnectBinance} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                    <Key size={14} /> API Key
                  </label>
                  <input type="text" value={apiKey} onChange={e => setApiKey(e.target.value)} required placeholder="Your Binance API Key"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                    <Key size={14} /> API Secret
                  </label>
                  <input type="password" value={apiSecret} onChange={e => setApiSecret(e.target.value)} required placeholder="Your Binance API Secret"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>

                {status === 'error' && (
                  <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl p-3">
                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />{message}
                  </div>
                )}

                <button type="submit" disabled={status === 'loading'}
                  className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-60 transition-colors">
                  {status === 'loading' ? 'Verifying & connecting...' : 'Connect Binance'}
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold text-gray-900">Connect Tradovate</h2>
                <button onClick={() => setSelectedBroker(null)} className="text-gray-400 hover:text-gray-600 text-sm">Cancel</button>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 space-y-2">
                <p className="font-semibold text-blue-800 text-xs">How to connect:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs text-blue-700">
                  <li>Use your Tradovate account username and password</li>
                  <li>We authenticate via Tradovate&apos;s official API</li>
                  <li>We can only <strong>read</strong> your trade history</li>
                  <li>Works with both live and demo accounts</li>
                </ol>
              </div>

              <form onSubmit={handleConnectTradovate} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                    <User size={14} /> Username
                  </label>
                  <input type="text" value={tvUsername} onChange={e => setTvUsername(e.target.value)} required placeholder="Your Tradovate username"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                    <Key size={14} /> Password
                  </label>
                  <input type="password" value={tvPassword} onChange={e => setTvPassword(e.target.value)} required placeholder="Your Tradovate password"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input type="checkbox" checked={tvDemo} onChange={e => setTvDemo(e.target.checked)} className="rounded border-gray-300" />
                  Demo account (paper trading)
                </label>

                {status === 'error' && (
                  <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl p-3">
                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />{message}
                  </div>
                )}

                <button type="submit" disabled={status === 'loading'}
                  className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-60 transition-colors">
                  {status === 'loading' ? 'Verifying & connecting...' : 'Connect Tradovate'}
                </button>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
