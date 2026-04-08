'use client'

import { useState, useEffect } from 'react'
import { ShieldCheck, Key, AlertCircle, CheckCircle2, Trash2, User, Lock } from 'lucide-react'

interface BrokerConnection {
  id: string
  broker: string
  api_key: string | null
  created_at: string
  last_synced_at: string | null
}

type BrokerType = 'binance' | 'tradovate' | 'bybit' | 'kraken' | 'okx' | 'alpaca' | 'oanda' | 'coinbase' | null

function BrokerLogo({ broker, size = 40 }: { broker: string; size?: number }) {
  const logos: Record<string, string> = {
    binance: '/brokers/binance.svg',
    bybit: '/brokers/bybit.svg',
    kraken: '/brokers/kraken.svg',
    okx: '/brokers/okx.svg',
    coinbase: '/brokers/coinbase.svg',
    alpaca: '/brokers/alpaca.svg',
    tradovate: '/brokers/tradovate.svg',
    oanda: '/brokers/oanda.svg',
  }

  const src = logos[broker]
  if (src) {
    return <img src={src} alt={`${broker} logo`} width={size} height={size} className="rounded-lg" />
  }

  return (
    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center font-bold text-xs text-gray-700">
      ?
    </div>
  )
}

const BROKERS = [
  { id: 'binance' as const, name: 'Binance', category: 'Crypto', color: 'bg-yellow-100 text-yellow-700', letter: 'B' },
  { id: 'bybit' as const, name: 'Bybit', category: 'Crypto', color: 'bg-orange-100 text-orange-700', letter: 'By' },
  { id: 'kraken' as const, name: 'Kraken', category: 'Crypto', color: 'bg-purple-100 text-purple-700', letter: 'K' },
  { id: 'okx' as const, name: 'OKX', category: 'Crypto', color: 'bg-gray-100 text-gray-700', letter: 'O' },
  { id: 'coinbase' as const, name: 'Coinbase', category: 'Crypto', color: 'bg-blue-100 text-blue-700', letter: 'C' },
  { id: 'alpaca' as const, name: 'Alpaca', category: 'US Stocks', color: 'bg-green-100 text-green-700', letter: 'A' },
  { id: 'tradovate' as const, name: 'Tradovate', category: 'Futures', color: 'bg-sky-100 text-sky-700', letter: 'T' },
  { id: 'oanda' as const, name: 'OANDA', category: 'Forex', color: 'bg-teal-100 text-teal-700', letter: 'Oa' },
]

export default function ConnectBrokerPage() {
  const [connections, setConnections] = useState<BrokerConnection[]>([])
  const [selectedBroker, setSelectedBroker] = useState<BrokerType>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  // Form fields
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState('')
  const [keyName, setKeyName] = useState('')
  const [privateKey, setPrivateKey] = useState('')
  const [paper, setPaper] = useState(false)

  useEffect(() => {
    fetch('/api/broker/connect')
      .then(r => r.json())
      .then(setConnections)
      .catch(() => {})
  }, [])

  function resetForm() {
    setApiKey(''); setApiSecret(''); setPassphrase('')
    setUsername(''); setPassword(''); setToken('')
    setKeyName(''); setPrivateKey(''); setPaper(false)
  }

  async function refreshConnections() {
    const updated = await fetch('/api/broker/connect').then(r => r.json())
    setConnections(updated)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')

    let endpoint = ''
    let body: Record<string, unknown> = {}

    switch (selectedBroker) {
      case 'binance':
        endpoint = '/api/broker/connect'
        body = { api_key: apiKey, api_secret: apiSecret }
        break
      case 'bybit':
        endpoint = '/api/broker/bybit'
        body = { api_key: apiKey, api_secret: apiSecret }
        break
      case 'kraken':
        endpoint = '/api/broker/kraken'
        body = { api_key: apiKey, api_secret: apiSecret }
        break
      case 'okx':
        endpoint = '/api/broker/okx'
        body = { api_key: apiKey, api_secret: apiSecret, passphrase }
        break
      case 'alpaca':
        endpoint = '/api/broker/alpaca'
        body = { api_key: apiKey, api_secret: apiSecret, paper }
        break
      case 'tradovate':
        endpoint = '/api/broker/tradovate'
        body = { username, password, demo: paper }
        break
      case 'oanda':
        endpoint = '/api/broker/oanda'
        body = { token, practice: paper }
        break
      case 'coinbase':
        endpoint = '/api/broker/coinbase'
        body = { key_name: keyName, private_key: privateKey }
        break
      default:
        return
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()

    if (res.ok) {
      setStatus('success')
      const brokerName = BROKERS.find(b => b.id === selectedBroker)?.name ?? selectedBroker
      setMessage(`${brokerName} connected! Your trades will sync within 60 seconds.`)
      resetForm()
      setSelectedBroker(null)
      refreshConnections()
    } else {
      setStatus('error')
      setMessage(data.error ?? 'Failed to connect.')
    }
  }

  async function handleRemove(broker: string) {
    setRemoving(broker)
    const endpointMap: Record<string, string> = {
      binance: '/api/broker/connect',
      tradovate: '/api/broker/tradovate',
      bybit: '/api/broker/bybit',
      kraken: '/api/broker/kraken',
      okx: '/api/broker/okx',
      alpaca: '/api/broker/alpaca',
      oanda: '/api/broker/oanda',
      coinbase: '/api/broker/coinbase',
    }
    const res = await fetch(endpointMap[broker] ?? `/api/broker/${broker}`, { method: 'DELETE' })
    if (res.ok) {
      setConnections(c => c.filter(conn => conn.broker !== broker))
    }
    setRemoving(null)
  }

  const getBrokerInfo = (id: string) => BROKERS.find(b => b.id === id)

  function renderForm() {
    if (!selectedBroker) return null

    const broker = getBrokerInfo(selectedBroker)
    if (!broker) return null

    // API Key + Secret brokers (Binance, Bybit, Kraken)
    if (['binance', 'bybit', 'kraken'].includes(selectedBroker)) {
      const instructions: Record<string, { steps: string[]; permission: string }> = {
        binance: {
          steps: [
            'Log in to Binance → Account → API Management',
            'Click "Create API" → choose <strong>System generated</strong> → name it "TruthTrade"',
            'Enable Read Only permissions only',
            'Disable "Enable Spot & Margin Trading" for safety',
            'Copy the API Key and Secret below',
          ],
          permission: 'Read Only',
        },
        bybit: {
          steps: [
            'Log in to Bybit → Account → API Management',
            'Click "Create New Key" (requires 2FA)',
            'Select "Read-Only" permissions',
            'Copy the API Key and Secret below',
          ],
          permission: 'Read-Only',
        },
        kraken: {
          steps: [
            'Log in to Kraken → Settings → API',
            'Click "Generate Key"',
            'Enable only "Query closed orders & trades"',
            'Copy the API Key and Private Key below',
          ],
          permission: 'Query closed orders & trades',
        },
      }

      const info = instructions[selectedBroker]

      return (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 space-y-2">
            <p className="font-semibold text-blue-800 text-xs">How to get your API keys:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs text-blue-700">
              {info.steps.map((step, i) => <li key={i} dangerouslySetInnerHTML={{ __html: step }} />)}
            </ol>
            <p className="text-xs text-blue-600 mt-1">Required permission: <strong>{info.permission}</strong></p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
              <Key size={14} /> API Key
            </label>
            <input type="text" value={apiKey} onChange={e => setApiKey(e.target.value)} required
              placeholder={`Your ${broker.name} API Key`}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
              <Key size={14} /> {selectedBroker === 'kraken' ? 'Private Key' : 'API Secret'}
            </label>
            <input type="password" value={apiSecret} onChange={e => setApiSecret(e.target.value)} required
              placeholder={`Your ${broker.name} ${selectedBroker === 'kraken' ? 'Private Key' : 'API Secret'}`}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          {renderError()}
          {renderSubmitButton()}
        </form>
      )
    }

    // OKX: API Key + Secret + Passphrase
    if (selectedBroker === 'okx') {
      return (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 space-y-2">
            <p className="font-semibold text-blue-800 text-xs">How to get your API keys:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs text-blue-700">
              <li>Log in to OKX → My Account → APIs</li>
              <li>Click &quot;Create V5 API key&quot;</li>
              <li>Set a passphrase and select <strong>Read Only</strong> permissions</li>
              <li>Copy the API Key, Secret, and Passphrase below</li>
            </ol>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
              <Key size={14} /> API Key
            </label>
            <input type="text" value={apiKey} onChange={e => setApiKey(e.target.value)} required placeholder="Your OKX API Key"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
              <Key size={14} /> API Secret
            </label>
            <input type="password" value={apiSecret} onChange={e => setApiSecret(e.target.value)} required placeholder="Your OKX API Secret"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
              <Lock size={14} /> Passphrase
            </label>
            <input type="password" value={passphrase} onChange={e => setPassphrase(e.target.value)} required placeholder="Your OKX API Passphrase"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          {renderError()}
          {renderSubmitButton()}
        </form>
      )
    }

    // Alpaca: API Key + Secret + Paper toggle
    if (selectedBroker === 'alpaca') {
      return (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 space-y-2">
            <p className="font-semibold text-blue-800 text-xs">How to get your API keys:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs text-blue-700">
              <li>Log in to app.alpaca.markets</li>
              <li>Select Live or Paper account</li>
              <li>Find &quot;API Keys&quot; in the sidebar and click &quot;Generate New Keys&quot;</li>
              <li>Copy the Key ID and Secret below (secret shown only once!)</li>
            </ol>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
              <Key size={14} /> API Key ID
            </label>
            <input type="text" value={apiKey} onChange={e => setApiKey(e.target.value)} required placeholder="Your Alpaca Key ID"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
              <Key size={14} /> Secret Key
            </label>
            <input type="password" value={apiSecret} onChange={e => setApiSecret(e.target.value)} required placeholder="Your Alpaca Secret Key"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={paper} onChange={e => setPaper(e.target.checked)} className="rounded border-gray-300" />
            Paper trading account
          </label>

          {renderError()}
          {renderSubmitButton()}
        </form>
      )
    }

    // Tradovate: Username + Password + Demo toggle
    if (selectedBroker === 'tradovate') {
      return (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 space-y-2">
            <p className="font-semibold text-blue-800 text-xs">How to connect:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs text-blue-700">
              <li>Use your Tradovate account username and password</li>
              <li>We authenticate via Tradovate&apos;s official API</li>
              <li>We can only <strong>read</strong> your trade history</li>
              <li>Works with both live and demo accounts</li>
            </ol>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
              <User size={14} /> Username
            </label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} required placeholder="Your Tradovate username"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
              <Key size={14} /> Password
            </label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Your Tradovate password"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={paper} onChange={e => setPaper(e.target.checked)} className="rounded border-gray-300" />
            Demo account (paper trading)
          </label>

          {renderError()}
          {renderSubmitButton()}
        </form>
      )
    }

    // OANDA: Token + Practice toggle
    if (selectedBroker === 'oanda') {
      return (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 space-y-2">
            <p className="font-semibold text-blue-800 text-xs">How to get your API token:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs text-blue-700">
              <li>Log in to fxTrade → My Account → My Services</li>
              <li>Click &quot;Manage API Access&quot;</li>
              <li>Generate a Personal Access Token</li>
              <li>Copy the token below (OANDA won&apos;t show it again!)</li>
            </ol>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
              <Key size={14} /> API Token
            </label>
            <input type="password" value={token} onChange={e => setToken(e.target.value)} required placeholder="Your OANDA Personal Access Token"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={paper} onChange={e => setPaper(e.target.checked)} className="rounded border-gray-300" />
            Practice account (demo)
          </label>

          {renderError()}
          {renderSubmitButton()}
        </form>
      )
    }

    // Coinbase: Key Name + Private Key (PEM)
    if (selectedBroker === 'coinbase') {
      return (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 space-y-2">
            <p className="font-semibold text-blue-800 text-xs">How to get your API keys:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs text-blue-700">
              <li>Go to cdp.coinbase.com and log in with your Coinbase account</li>
              <li>Navigate to Access → API Keys</li>
              <li>Click &quot;Create API Key&quot; → select &quot;Secret API Keys&quot;</li>
              <li>Set <strong>View</strong> permissions only</li>
              <li>Download the JSON file — it contains your key name and private key</li>
            </ol>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
              <Key size={14} /> CDP Key Name
            </label>
            <input type="text" value={keyName} onChange={e => setKeyName(e.target.value)} required
              placeholder="organizations/xxx/apiKeys/xxx"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
              <Key size={14} /> Private Key (PEM)
            </label>
            <textarea value={privateKey} onChange={e => setPrivateKey(e.target.value)} required
              placeholder="-----BEGIN EC PRIVATE KEY-----&#10;...&#10;-----END EC PRIVATE KEY-----"
              rows={4}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          {renderError()}
          {renderSubmitButton()}
        </form>
      )
    }

    return null
  }

  function renderError() {
    if (status !== 'error') return null
    return (
      <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl p-3">
        <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />{message}
      </div>
    )
  }

  function renderSubmitButton() {
    const broker = getBrokerInfo(selectedBroker!)
    return (
      <button type="submit" disabled={status === 'loading'}
        className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-60 transition-colors">
        {status === 'loading' ? 'Verifying & connecting...' : `Connect ${broker?.name}`}
      </button>
    )
  }

  return (
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
              {connections.map(conn => {
                const info = getBrokerInfo(conn.broker)
                return (
                  <div key={conn.id} className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <BrokerLogo broker={conn.broker} />
                      <div>
                        <p className="font-semibold text-gray-900">{info?.name ?? conn.broker}</p>
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
                )
              })}
            </div>
          )}

          {/* Broker selection / forms */}
          {!selectedBroker ? (
            <div className="flex flex-col items-center">
              <p className="text-gray-500 text-sm mb-4">Choose a broker to connect:</p>

              {/* Group by category */}
              {['Crypto', 'US Stocks', 'Futures', 'Forex'].map(category => {
                const brokers = BROKERS.filter(b => b.category === category)
                return (
                  <div key={category} className="w-full mb-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{category}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {brokers.map(broker => (
                        <button
                          key={broker.id}
                          onClick={() => { setSelectedBroker(broker.id); setStatus('idle'); setMessage(''); resetForm() }}
                          className="flex flex-col items-center gap-1.5 px-4 py-3 border-2 border-gray-200 rounded-2xl hover:border-indigo-400 transition-colors"
                        >
                          <BrokerLogo broker={broker.id} />
                          <span className="font-semibold text-gray-900 text-sm">{broker.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}

              {connections.length === 0 && (
                <p className="text-gray-400 text-sm mt-2">No brokers connected yet</p>
              )}
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold text-gray-900">Connect {getBrokerInfo(selectedBroker)?.name}</h2>
                <button onClick={() => { setSelectedBroker(null); resetForm() }} className="text-gray-400 hover:text-gray-600 text-sm">Cancel</button>
              </div>
              {renderForm()}
            </div>
          )}
    </div>
  )
}
