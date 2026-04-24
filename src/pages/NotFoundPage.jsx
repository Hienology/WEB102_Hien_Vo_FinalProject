import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-md text-center">
      <div className="box">
        <p className="text-6xl mb-4">🎾</p>
        <h1 className="title is-3 text-gray-800">404 – Page Not Found</h1>
        <p className="text-gray-500 mb-6">
          The page you're looking for doesn't exist or the ball is out of bounds.
        </p>
        <Link to="/" className="button is-success">
          Return to Home
        </Link>
      </div>
    </div>
  )
}
