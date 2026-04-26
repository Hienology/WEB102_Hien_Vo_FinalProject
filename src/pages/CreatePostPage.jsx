import { useEffect, useRef, useState } from 'react'
import { useBeforeUnload, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { getUserId } from '../lib/auth'
import { MAX_TAGS, parseTagInput } from '../lib/tags'

export default function CreatePostPage({ onDraftStateChange }) {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [content, setContent] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [isLeaveDraftModalOpen, setIsLeaveDraftModalOpen] = useState(false)
  const [error, setError] = useState(null)
  const isAllowingBackNavigationRef = useRef(false)
  const hasDraftContent = Boolean(
    title.trim() || tagsInput.trim() || content.trim() || imageUrl.trim(),
  )
  const shouldBlockNavigation = hasDraftContent && !submitting

  useBeforeUnload((event) => {
    if (!shouldBlockNavigation) return
    event.preventDefault()
    event.returnValue = ''
  })

  useEffect(() => {
    if (!shouldBlockNavigation) return

    function handlePopState() {
      if (isAllowingBackNavigationRef.current) {
        isAllowingBackNavigationRef.current = false
        return
      }

      window.history.go(1)
      setIsLeaveDraftModalOpen(true)
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [shouldBlockNavigation])

  useEffect(() => {
    onDraftStateChange?.(hasDraftContent)
  }, [hasDraftContent, onDraftStateChange])

  useEffect(() => () => {
    onDraftStateChange?.(false)
  }, [onDraftStateChange])

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
      onDraftStateChange?.(false)
      navigate(`/post/${data.id}`)
    }
  }

  function handleStayOnDraft() {
    setIsLeaveDraftModalOpen(false)
  }

  function handleLeaveDraft() {
    isAllowingBackNavigationRef.current = true
    setIsLeaveDraftModalOpen(false)
    onDraftStateChange?.(false)
    window.history.back()
  }

  return (
    <>
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

            <div className="field is-grouped mt-6 form-action-row">
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

      {isLeaveDraftModalOpen && (
        <div
          className="search-modal-overlay"
          role="presentation"
          onClick={handleStayOnDraft}
        >
          <div
            className="search-modal-panel content-panel"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="create-leave-draft-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="create-leave-draft-title" className="title is-4 mb-2">Leave without saving?</h2>
            <p className="text-sm text-gray-700 mb-4">
              If you continue, your draft post will be cleared.
            </p>
            <div className="field is-grouped is-grouped-right mt-5">
              <p className="control">
                <button
                  type="button"
                  className="button is-light"
                  onClick={handleStayOnDraft}
                >
                  Stay here
                </button>
              </p>
              <p className="control">
                <button
                  type="button"
                  className="button is-danger"
                  onClick={handleLeaveDraft}
                >
                  Leave and clear
                </button>
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
