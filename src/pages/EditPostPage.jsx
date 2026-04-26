import { useEffect, useRef, useState } from 'react'
import { useBeforeUnload, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { getUserId } from '../lib/auth'
import { formatTagsInput, MAX_TAGS, parseTagInput } from '../lib/tags'
import Spinner from '../components/Spinner'

export default function EditPostPage({ onDraftStateChange }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [content, setContent] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [initialValues, setInitialValues] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [isLeaveDraftModalOpen, setIsLeaveDraftModalOpen] = useState(false)
  const [error, setError] = useState(null)
  const isAllowingBackNavigationRef = useRef(false)
  const hasDraftChanges = Boolean(initialValues) && (
    title !== initialValues.title
    || tagsInput !== initialValues.tagsInput
    || content !== initialValues.content
    || imageUrl !== initialValues.imageUrl
  )
  const shouldBlockNavigation = hasDraftChanges && !submitting

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
      const nextTagsInput = formatTagsInput(data.tags)
      const nextContent = data.content || ''
      const nextImageUrl = data.image_url || ''

      setTagsInput(nextTagsInput)
      setContent(nextContent)
      setImageUrl(nextImageUrl)
      setInitialValues({
        title: data.title,
        tagsInput: nextTagsInput,
        content: nextContent,
        imageUrl: nextImageUrl,
      })
      setLoading(false)
    }
    fetchPost()
  }, [id, navigate])

  useEffect(() => {
    if (!initialValues) {
      onDraftStateChange?.(false)
      return
    }

    onDraftStateChange?.(hasDraftChanges)
  }, [hasDraftChanges, initialValues, onDraftStateChange])

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

    const { error: updateError } = await supabase
      .from('posts')
      .update({
        title: title.trim(),
        tags: parseTagInput(tagsInput),
        content: content.trim() || null,
        image_url: imageUrl.trim() || null,
      })
      .eq('id', id)

    setSubmitting(false)

    if (updateError) {
      setError(updateError.message)
    } else {
      onDraftStateChange?.(false)
      navigate(`/post/${id}`)
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

  if (loading) return <Spinner />

  return (
    <>
      <div className="container mx-auto px-4 py-8 max-w-xl">
        <h1 className="title is-3 page-heading mb-6">Edit Post</h1>

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
            aria-labelledby="edit-leave-draft-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="edit-leave-draft-title" className="title is-4 mb-2">Leave without saving?</h2>
            <p className="text-sm text-gray-700 mb-4">
              If you continue, your unsaved edits will be cleared.
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
