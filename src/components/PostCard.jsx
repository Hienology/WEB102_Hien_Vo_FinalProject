import { Link } from 'react-router-dom'

export default function PostCard({ post }) {
  const createdAt = new Date(post.created_at).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const postTags = Array.isArray(post.tags) ? post.tags : []
  const coverImage = typeof post.image_url === 'string' && post.image_url.trim()
    ? post.image_url.trim()
    : null

  return (
    <Link to={`/post/${post.id}`} className="block hover:no-underline">
      <div className="box content-panel post-card-shell hover:shadow-lg transition-shadow duration-200 cursor-pointer">
        <div className="post-card-cover" aria-hidden="true">
          {coverImage ? (
            <img src={coverImage} alt="" className="post-card-cover-image" />
          ) : (
            <div className="post-card-cover-fallback">🎾</div>
          )}
        </div>

        <div className="post-card-body">
          <div className="post-card-main">
            <h2 className="title is-5 mb-1 truncate text-gray-800">{post.title}</h2>
            <p className="text-sm text-gray-500">{createdAt}</p>
            {postTags.length > 0 && (
              <div className="tags mt-3 post-card-tags">
                {postTags.slice(0, 3).map((tag, index) => (
                  <span
                    key={`${post.id}-${tag}-${index}`}
                    className="tag is-success is-light is-rounded"
                  >
                    #{tag}
                  </span>
                ))}
                {postTags.length > 3 && (
                  <span className="tag is-light is-rounded">+{postTags.length - 3}</span>
                )}
              </div>
            )}
          </div>

          <div className="post-card-votes">
            <span className="text-rose-500 text-2xl">▲</span>
            <span className="font-bold text-gray-700">{post.upvotes ?? 0}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
