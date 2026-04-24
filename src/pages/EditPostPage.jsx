import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { getUserId } from '../lib/auth'
import Spinner from '../components/Spinner'

export default function EditPostPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchPost() {
      const { data, error: fetchError } = await supabase
        .from('posts')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchError || !data) {
        setError('Post not found.')
        setLoading(false)
        return
      }

      const userId = getUserId()
      if (data.author_id !== userId) {
        navigate(`/post/${id}`)
        return
      }

      setTitle(data.title)
      setContent(data.content || '')
      setImageUrl(data.image_url || '')
      setLoading(false)
    }
    fetchPost()
  }, [id, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) {
      setError('Post title is required.')
      return
    }
    setSubmitting(true)
    setError(null)

    const { error: updateError } = await supabase
      .from('posts')
      .update({
        title: title.trim(),
        content: content.trim() || null,
        image_url: imageUrl.trim() || null,
      })
      .eq('id', id)

    setSubmitting(false)

    if (updateError) {
      setError(updateError.message)
    } else {
      navigate(`/post/${id}`)
    }
  }

  if (loading) return <Spinner />

  return (
    <div className="container mx-auto px-4 py-8 max-w-xl">
      <h1 className="title is-3 text-gray-800 mb-6">Edit Post</h1>

      <div className="box">
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="notification is-danger is-light mb-4">
              {error}
            </div>
          )}

          <div className="field">
            <label className="label">
              Title <span className="text-rose-500">*</span>
            </label>
            <div className="control">
              <input
                className="input"
                type="text"
                placeholder="Post title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
              />
            </div>
          </div>

          <div className="field">
            <label className="label">Content</label>
            <div className="control">
              <textarea
                className="textarea"
                placeholder="Post content…"
                rows={5}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label className="label">Image URL</label>
            <div className="control">
              <input
                className="input"
                type="url"
                placeholder="https://example.com/image.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />
            </div>
          </div>

          <div className="field is-grouped mt-6">
            <div className="control">
              <button
                type="submit"
                className={`button is-success ${submitting ? 'is-loading' : ''}`}
                disabled={submitting}
              >
                Save Changes
              </button>
            </div>
            <div className="control">
              <button
                type="button"
                className="button is-light"
                onClick={() => navigate(`/post/${id}`)}
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
