import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { getUserId } from '../lib/auth'
import { MAX_TAGS, parseTagInput } from '../lib/tags'

export default function CreatePostPage() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [content, setContent] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) {
      setError('Post title is required.')
      return
    }
    setSubmitting(true)
    setError(null)

    const authorId = getUserId()

    const { data, error: insertError } = await supabase
      .from('posts')
      .insert({
        title: title.trim(),
        tags: parseTagInput(tagsInput),
        content: content.trim() || null,
        image_url: imageUrl.trim() || null,
        author_id: authorId,
        upvotes: 0,
      })
      .select('id')
      .single()

    setSubmitting(false)

    if (insertError) {
      setError(insertError.message)
    } else {
      navigate(`/post/${data.id}`)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-xl">
      <h1 className="title is-3 page-heading mb-6">Create a New Post</h1>

      <div className="box content-panel">
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
                placeholder="What would you like to discuss?"
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
                placeholder="Share your thoughts, analysis, or questions…"
                rows={5}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label className="label">Tags</label>
            <div className="control">
              <input
                className="input"
                type="text"
                placeholder="grand-slam, wimbledon, analysis"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
              />
            </div>
            <p className="help">Use commas to separate tags. Up to {MAX_TAGS} tags.</p>
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
                Publish Post
              </button>
            </div>
            <div className="control">
              <button
                type="button"
                className="button is-light"
                onClick={() => navigate('/')}
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
