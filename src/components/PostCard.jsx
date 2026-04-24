import { Link } from 'react-router-dom'

export default function PostCard({ post }) {
  const createdAt = new Date(post.created_at).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <Link to={`/post/${post.id}`} className="block hover:no-underline">
      <div className="box hover:shadow-lg transition-shadow duration-200 cursor-pointer border-l-4 border-rose-400">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="title is-5 mb-1 truncate text-gray-800">{post.title}</h2>
            <p className="text-sm text-gray-500">{createdAt}</p>
          </div>
          <div className="flex flex-col items-center shrink-0">
            <span className="text-rose-500 text-2xl">▲</span>
            <span className="font-bold text-gray-700">{post.upvotes ?? 0}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
