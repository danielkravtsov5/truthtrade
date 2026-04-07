import Navbar from '@/components/Navbar'
import Feed from '@/components/Feed'

export default function HomePage() {
  return (
    <div className="flex min-h-screen">
      <Navbar />
      <main className="flex-1 md:ml-64 pb-20 md:pb-0">
        <div className="max-w-xl mx-auto px-4 py-4">
          <h1 className="font-bold text-xl text-gray-900 mb-4">Home</h1>
          <Feed type="explore" />
        </div>
      </main>
    </div>
  )
}
