'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Compass, User, TrendingUp, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [username, setUsername] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase
        .from('users')
        .select('username')
        .eq('id', user.id)
        .single()
      setUsername(data?.username ?? null)
    })
  }, [])

  const navItems = [
    { href: '/', icon: Home, label: 'Home' },
    { href: '/explore', icon: Compass, label: 'Explore' },
    ...(username ? [
      { href: '/connect-broker', icon: TrendingUp, label: 'Connect' },
      { href: `/profile/${username}`, icon: User, label: 'Profile' },
    ] : []),
  ]

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden md:flex flex-col fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 p-4 z-50">
        <Link href="/" className="flex items-center gap-2 mb-8 px-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <TrendingUp size={16} className="text-white" />
          </div>
          <span className="font-bold text-gray-900 text-lg">TruthTrade</span>
        </Link>
        <div className="space-y-1">
          {navItems.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl font-medium text-sm transition-colors ${
                pathname === href
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon size={20} />
              {label}
            </Link>
          ))}
        </div>
        {username ? (
          <div className="mt-auto">
            <button
              onClick={async () => {
                const supabase = createClient()
                await supabase.auth.signOut()
                setUsername(null)
                router.push('/login')
                router.refresh()
              }}
              className="flex items-center gap-3 px-3 py-3 rounded-xl font-medium text-sm text-gray-600 hover:bg-gray-100 w-full transition-colors"
            >
              <LogOut size={20} />
              Log out
            </button>
          </div>
        ) : (
          <div className="mt-auto space-y-2">
            <Link href="/login" className="block w-full text-center py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">
              Log in
            </Link>
            <Link href="/signup" className="block w-full text-center py-2.5 bg-indigo-600 rounded-xl text-sm font-medium text-white hover:bg-indigo-700">
              Sign up
            </Link>
          </div>
        )}
      </nav>

      {/* Mobile bottom bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around py-2 z-50">
        {navItems.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-0.5 px-4 py-1 text-xs font-medium transition-colors ${
              pathname === href ? 'text-indigo-600' : 'text-gray-500'
            }`}
          >
            <Icon size={22} />
            {label}
          </Link>
        ))}
        {username && (
          <button
            onClick={async () => {
              const supabase = createClient()
              await supabase.auth.signOut()
              setUsername(null)
              router.push('/login')
              router.refresh()
            }}
            className="flex flex-col items-center gap-0.5 px-4 py-1 text-xs font-medium text-gray-500 transition-colors"
          >
            <LogOut size={22} />
            Log out
          </button>
        )}
      </nav>
    </>
  )
}
