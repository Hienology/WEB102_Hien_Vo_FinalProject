import { useEffect, useRef, useState } from 'react'
import { useBeforeUnload, useNavigate, useParams } from 'react-router-dom'
import MediaFilePicker from '../components/MediaFilePicker'
import { supabase } from '../lib/supabaseClient'
import { getUserId } from '../lib/auth'
import { formatTagsInput, MAX_TAGS, parseTagInput } from '../lib/tags'
import Spinner from '../components/Spinner'
import {
  getMediaTypeFromUrl,
  deleteMediaFile,
  isSupabaseMediaUrl,
  uploadMediaFile,
  validateMediaFile,
} from '../lib/media'

export default function EditPostPage({ onDraftStateChange }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [content, setContent] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imageCaption, setImageCaption] = useState('')
  const [selectedMediaFileName, setSelectedMediaFileName] = useState('')
  const [mediaType, setMediaType] = useState(null)
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState('')
  const [isPreparingMedia, setIsPreparingMedia] = useState(false)
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
    || imageCaption !== initialValues.imageCaption
  )
  const shouldBlockNavigation = (hasDraftChanges || isPreparingMedia) && !submitting
  const selectedMediaType = mediaType || getMediaTypeFromUrl(imageUrl)

  useEffect(() => () => {
    if (mediaPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(mediaPreviewUrl)
    }
  }, [mediaPreviewUrl])

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
      const nextImageCaption = data.image_caption || ''

      setTagsInput(nextTagsInput)
      setContent(nextContent)
      setImageUrl(nextImageUrl)
      setImageCaption(nextImageCaption)
      setMediaType(getMediaTypeFromUrl(nextImageUrl))
      setMediaPreviewUrl(nextImageUrl)
      setInitialValues({
        title: data.title,
        tagsInput: nextTagsInput,
        content: nextContent,
        imageUrl: nextImageUrl,
        imageCaption: nextImageCaption,
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

    onDraftStateChange?.(hasDraftChanges || isPreparingMedia)
  }, [hasDraftChanges, initialValues, isPreparingMedia, onDraftStateChange])

  useEffect(() => () => {
    onDraftStateChange?.(false)
  }, [onDraftStateChange])

  async function handleSubmit(e) {
    e.preventDefault()
    if (isPreparingMedia) return

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
        image_caption: imageCaption.trim() || null,
      })
      .eq('id', id)

    setSubmitting(false)

    if (updateError) {
      setError(updateError.message)
    } else {
      if (initialValues?.imageUrl && initialValues.imageUrl !== imageUrl && isSupabaseMediaUrl(initialValues.imageUrl)) {
        deleteMediaFile(initialValues.imageUrl).catch((cleanupError) => {
          console.warn('Unable to clean up replaced post media:', cleanupError)
        })
      }

      onDraftStateChange?.(false)
      navigate(`/post/${id}`)
    }
  }

  async function cleanupEditedMediaIfNeeded() {
    const currentMediaUrl = imageUrl.trim()
    if (currentMediaUrl && currentMediaUrl !== initialValues?.imageUrl && isSupabaseMediaUrl(currentMediaUrl)) {
      try {
        await deleteMediaFile(currentMediaUrl)
      } catch (cleanupError) {
        console.warn('Unable to clean up discarded post media:', cleanupError)
      }
    }
  }

  function handleMediaUrlChange(e) {
    const nextValue = e.target.value
    setImageUrl(nextValue)
    setMediaType(getMediaTypeFromUrl(nextValue))
    setMediaPreviewUrl(nextValue)
    setSelectedMediaFileName('')
    setError(null)
  }

  async function handleMediaUploadChange(e) {
    const nextFile = e.target.files?.[0]
    if (!nextFile) return

    const { mediaType: nextMediaType, error: validationError } = validateMediaFile(nextFile)
    if (validationError) {
      setError(validationError)
      e.target.value = ''
      return
    }

    setError(null)
    setIsPreparingMedia(true)
    setSelectedMediaFileName(nextFile.name)
    const nextPreviewUrl = URL.createObjectURL(nextFile)
    setMediaPreviewUrl(nextPreviewUrl)
    setMediaType(nextMediaType)

    try {
      const authorId = getUserId()
      const { publicUrl } = await uploadMediaFile(nextFile, {
        folder: 'posts',
        ownerId: authorId,
      })

      setImageUrl(publicUrl)
      setMediaPreviewUrl(publicUrl)
    } catch (uploadError) {
      setError(uploadError.message || 'Unable to process the selected file.')
      setImageUrl('')
      setMediaPreviewUrl('')
      setMediaType(null)
      setSelectedMediaFileName('')
    } finally {
      setIsPreparingMedia(false)
      e.target.value = ''
    }
  }

  async function handleClearMedia() {
    const currentMediaUrl = imageUrl.trim()
    setImageUrl('')
    setImageCaption('')
    setSelectedMediaFileName('')
    setMediaType(null)
    setMediaPreviewUrl('')

    if (currentMediaUrl && currentMediaUrl !== initialValues?.imageUrl && isSupabaseMediaUrl(currentMediaUrl)) {
      try {
        await deleteMediaFile(currentMediaUrl)
      } catch (cleanupError) {
        console.warn('Unable to clean up cleared post media:', cleanupError)
      }
    }
  }

  function handleStayOnDraft() {
    setIsLeaveDraftModalOpen(false)
  }

  async function handleLeaveDraft() {
    await cleanupEditedMediaIfNeeded()

    isAllowingBackNavigationRef.current = true
    setIsLeaveDraftModalOpen(false)
    onDraftStateChange?.(false)
    window.history.back()
  }

  async function handleCancel() {
    await cleanupEditedMediaIfNeeded()
    navigate(`/post/${id}`)
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
              <label className="label">Cover Caption</label>
              <div className="control">
                <input
                  className="input"
                  type="text"
                  placeholder="Optional caption for the cover media"
                  value={imageCaption}
                  onChange={(e) => setImageCaption(e.target.value)}
                  maxLength={200}
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
              <label className="label">Media URL (Image or Video)</label>
              <div className="control">
                <input
                  className="input"
                  type="url"
                  placeholder="https://example.com/photo.jpg or clip.mp4"
                  value={imageUrl}
                  onChange={handleMediaUrlChange}
                />
              </div>
              <p className="help">Paste a direct image/video URL, or upload from your device below.</p>
            </div>

            <div className="field">
              <label className="label">Upload Media From Device</label>
              <div className="control">
                <MediaFilePicker
                  accept="image/*,video/*"
                  disabled={submitting || isPreparingMedia}
                  fileName={selectedMediaFileName}
                  label="Choose Files"
                  onFileSelect={(selectedFile, event) => {
                    if (!selectedFile) return
                    handleMediaUploadChange(event)
                  }}
                />
              </div>
              <p className="help">Images up to 10MB, videos up to 25MB.</p>

              {isPreparingMedia && (
                <div className="inline-loading-row" role="status" aria-live="polite">
                  <span className="spinner spinner-inline spinner-sm" aria-hidden="true"></span>
                  <span>Preparing media preview...</span>
                </div>
              )}

              {mediaPreviewUrl.trim() && (
                <div className="media-preview-shell mt-3">
                  {selectedMediaType === 'video' ? (
                    <video
                      src={mediaPreviewUrl}
                      controls
                      preload="metadata"
                      className="media-preview-frame"
                    />
                  ) : (
                    <img
                      src={mediaPreviewUrl}
                      alt="Uploaded post media preview"
                      className="media-preview-frame"
                    />
                  )}

                  {imageCaption.trim() && (
                    <p className="mt-2 text-sm text-gray-600 italic">{imageCaption.trim()}</p>
                  )}

                  <button
                    type="button"
                    className="button is-small is-light mt-2"
                    onClick={handleClearMedia}
                  >
                    Remove media
                  </button>
                </div>
              )}
            </div>

            <div className="field is-grouped mt-6 form-action-row">
              <div className="control">
                <button
                  type="submit"
                  className={`button is-success ${submitting ? 'is-loading' : ''}`}
                  disabled={submitting || isPreparingMedia}
                >
                  Save Changes
                </button>
              </div>
              <div className="control">
                <button
                  type="button"
                  className="button is-light"
                  onClick={handleCancel}
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
