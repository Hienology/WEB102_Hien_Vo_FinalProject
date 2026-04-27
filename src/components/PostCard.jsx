import { Link } from 'react-router-dom'
import { getMediaTypeFromUrl } from '../lib/media'

export default function PostCard({ post }) {
  const createdAt = new Date(post.created_at).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const postTags = Array.isArray(post.tags) ? post.tags : []
  const coverMedia = typeof post.image_url === 'string' && post.image_url.trim()
    ? post.image_url.trim()
    : null
  const coverMediaType = getMediaTypeFromUrl(coverMedia)
  const commentsCount = Number(post.commentsCount ?? post.comment_count ?? post.comments_count)
  const safeCommentsCount = Number.isFinite(commentsCount) && commentsCount >= 0
    ? commentsCount
    : 0

  return (
    <Link to={`/post/${post.id}`} className="block hover:no-underline">
      <div className="box content-panel post-card-shell hover:shadow-lg transition-shadow duration-200 cursor-pointer">
        <div className="post-card-cover" aria-hidden="true">
          {coverMedia ? (
            coverMediaType === 'video' ? (
              <video
                src={coverMedia}
                className="post-card-cover-image"
                muted
                playsInline
                preload="metadata"
              />
            ) : (
              <img src={coverMedia} alt="" className="post-card-cover-image" />
            )
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
            <span className="post-card-comments" aria-label={`${safeCommentsCount} comments`}>
              <span className="post-card-comment-icon" aria-hidden="true">
                <svg viewBox="0 0 20 20" className="post-card-comment-icon-svg" focusable="false">
                  <path d="M3 3.75A1.75 1.75 0 0 1 4.75 2h10.5A1.75 1.75 0 0 1 17 3.75v7.5A1.75 1.75 0 0 1 15.25 13H8.2l-3.6 3a.5.5 0 0 1-.82-.38V13.9A1.75 1.75 0 0 1 3 12.25v-8.5Z" />
                </svg>
              </span>
              <span className="post-card-comment-count text-gray-600">{safeCommentsCount}</span>
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
