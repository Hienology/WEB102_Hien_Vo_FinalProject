import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { getUserId } from '../lib/auth'
import Spinner from '../components/Spinner'

export default function PostDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const userId = getUserId()

  const [post, setPost] = useState(null)
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [upvoting, setUpvoting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)

      const [postRes, commentsRes] = await Promise.all([
        supabase.from('posts').select('*').eq('id', id).single(),
        supabase
          .from('comments')
          .select('*')
          .eq('post_id', id)
          .order('created_at', { ascending: true }),
      ])

      if (postRes.error || !postRes.data) {
        setError('Post not found.')
      } else {
        setPost(postRes.data)
        setComments(commentsRes.data || [])
      }
      setLoading(false)
    }
    fetchData()
  }, [id])

  async function handleUpvote() {
    if (upvoting || !post) return
    setUpvoting(true)

    const { data, error: upvoteError } = await supabase
      .from('posts')
      .update({ upvotes: (post.upvotes ?? 0) + 1 })
      .eq('id', id)
      .select('upvotes')
      .single()

    if (!upvoteError && data) {
      setPost((prev) => ({ ...prev, upvotes: data.upvotes }))
    }
    setUpvoting(false)
  }

  async function handleAddComment(e) {
    e.preventDefault()
    if (!commentText.trim()) return
    setSubmittingComment(true)

    const { data, error: commentError } = await supabase
      .from('comments')
      .insert({
        post_id: id,
        content: commentText.trim(),
        author_id: userId,
      })
      .select('*')
      .single()

    if (!commentError && data) {
      setComments((prev) => [...prev, data])
      setCommentText('')
    }
    setSubmittingComment(false)
  }

  async function handleDelete() {
    if (!window.confirm('Are you sure you want to delete this post? All comments will also be deleted.')) return

    const { error: deleteError } = await supabase
      .from('posts')
      .delete()
      .eq('id', id)

    if (deleteError) {
      alert('Failed to delete post: ' + deleteError.message)
    } else {
      navigate('/')
    }
  }

  if (loading) return <Spinner />

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="notification is-danger is-light">{error}</div>
        <Link to="/" className="button is-light mt-4">Back to Home</Link>
      </div>
    )
  }

  const isAuthor = post.author_id === userId
  const postTags = Array.isArray(post.tags) ? post.tags : []
  const createdAt = new Date(post.created_at).toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const hasEditedAt = Boolean(post.edited_at)
  const editedAt = hasEditedAt
    ? new Date(post.edited_at).toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    : null

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Back link */}
      <Link to="/" className="button is-light is-small mb-6">
        ← Back to Home
      </Link>

      {/* Post card */}
      <div className="box content-panel mb-6 border-l-4 border-emerald-500">
        <div className="flex justify-between items-start gap-4 mb-4">
          <h1 className="title is-3 text-gray-800 mb-0">{post.title}</h1>
          {isAuthor && (
            <div className="flex gap-2 shrink-0">
              <Link
                to={`/edit/${post.id}`}
                className="button is-warning is-small"
              >
                Edit
              </Link>
              <button
                className="button is-danger is-small"
                onClick={handleDelete}
              >
                Delete
              </button>
            </div>
          )}
        </div>

        <p className="text-sm text-gray-400 mb-4">{createdAt}</p>

        {postTags.length > 0 && (
          <div className="tags mb-4">
            {postTags.map((tag, index) => (
              <span
                key={`${post.id}-${tag}-${index}`}
                className="tag is-success is-light is-rounded"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {post.image_url && (
          <figure className="image mb-4 rounded overflow-hidden">
            <img
              src={post.image_url}
              alt="Post image"
              className="rounded"
              style={{ maxHeight: '400px', objectFit: 'cover', width: '100%' }}
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          </figure>
        )}

        {post.content && (
          <div className="content text-gray-700 whitespace-pre-wrap mb-6">
            {post.content}
          </div>
        )}

        {hasEditedAt && (
          <p className="text-sm text-gray-500 mb-3 italic">
            Last edited: {editedAt}
          </p>
        )}

        {/* Upvote section */}
        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-100">
          <button
            className={`button is-danger is-outlined ${upvoting ? 'is-loading' : ''}`}
            onClick={handleUpvote}
            disabled={upvoting}
            title="Upvote this post"
          >
            ▲ Upvote
          </button>
          <span className="text-lg font-bold text-gray-700">
            {post.upvotes ?? 0} {post.upvotes === 1 ? 'vote' : 'votes'}
          </span>
        </div>
      </div>

      {/* Comments section */}
      <div className="box content-panel">
        <h2 className="title is-5 text-gray-800 mb-4">
          Comments ({comments.length})
        </h2>

        {comments.length === 0 ? (
          <p className="text-gray-400 mb-4">No comments yet. Start the conversation!</p>
        ) : (
          <div className="flex flex-col gap-3 mb-6">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="box content-panel-subtle p-3"
              >
                <p className="text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(comment.created_at).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Add comment form */}
        <form onSubmit={handleAddComment}>
          <div className="field">
            <label className="label">Leave a Comment</label>
            <div className="control">
              <textarea
                className="textarea"
                placeholder="Share your thoughts…"
                rows={3}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <div className="control">
              <button
                type="submit"
                className={`button is-success ${submittingComment ? 'is-loading' : ''}`}
                disabled={submittingComment || !commentText.trim()}
              >
                Post Comment
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
