import Feed from '@/components/Feed'

export default function HomePage() {
  return (
    <div className="max-w-xl mx-auto px-4 py-4">
      <h1 className="font-bold text-xl text-gray-900 mb-4">Home</h1>
      <Feed type="explore" />
    </div>
  )
}
