import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <p className="text-6xl text-surface-300 mb-4">🔍</p>
      <h2 className="text-xl font-bold text-surface-800">Page Not Found</h2>
      <p className="text-sm text-surface-500 mt-2">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link
        to="/"
        className="mt-6 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
      >
        Back to Dashboard
      </Link>
    </div>
  )
}
