import { useEffect, useRef, useState } from 'react'
import { useBeforeUnload, useNavigate } from 'react-router-dom'
import MediaFilePicker from '../components/MediaFilePicker'
import { supabase } from '../lib/supabaseClient'
import { getUserId } from '../lib/auth'
import { MAX_TAGS, parseTagInput } from '../lib/tags'
import {
  getMediaTypeFromUrl,
  deleteMediaFile,
  isSupabaseMediaUrl,
  uploadMediaFile,
  getQuarterMediaSize,
  validateMediaFile,
} from '../lib/media'

export default function CreatePostPage({ onDraftStateChange }) {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [content, setContent] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imageCaption, setImageCaption] = useState('')
  const [selectedMediaFileName, setSelectedMediaFileName] = useState('')
  const [mediaType, setMediaType] = useState(null)
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState('')
  const [mediaPreviewSize, setMediaPreviewSize] = useState(null)
  const [isPreparingMedia, setIsPreparingMedia] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [isLeaveDraftModalOpen, setIsLeaveDraftModalOpen] = useState(false)
  const [error, setError] = useState(null)
  const isAllowingBackNavigationRef = useRef(false)
  const hasDraftContent = Boolean(
    title.trim() || tagsInput.trim() || content.trim() || imageUrl.trim() || imageCaption.trim() || isPreparingMedia,
  )
  const shouldBlockNavigation = hasDraftContent && !submitting
  const selectedMediaType = mediaType || getMediaTypeFromUrl(imageUrl)

  useEffect(() => () => {
    if (mediaPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(mediaPreviewUrl)
    }
  }, [mediaPreviewUrl])

  useEffect(() => {
    setMediaPreviewSize(null)
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
    onDraftStateChange?.(hasDraftContent)
  }, [hasDraftContent, onDraftStateChange])

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

    const authorId = getUserId()

    const { data, error: insertError } = await supabase
      .from('posts')
      .insert({
        title: title.trim(),
        tags: parseTagInput(tagsInput),
        content: content.trim() || null,
        image_url: imageUrl.trim() || null,
        image_caption: imageCaption.trim() || null,
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

  function handleMediaUrlChange(e) {
    const nextValue = e.target.value
    setImageUrl(nextValue)
    setMediaType(getMediaTypeFromUrl(nextValue))
    setMediaPreviewUrl(nextValue)
    setMediaPreviewSize(null)
    setSelectedMediaFileName('')
    setError(null)
  }

  function handleMediaLoad(event) {
    const nextSize = getQuarterMediaSize(event.currentTarget)
    if (nextSize) {
      setMediaPreviewSize(nextSize)
    }
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
    setMediaPreviewSize(null)

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
      setMediaPreviewSize(null)
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

    if (currentMediaUrl && isSupabaseMediaUrl(currentMediaUrl)) {
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
    await handleClearMedia()
    isAllowingBackNavigationRef.current = true
    setIsLeaveDraftModalOpen(false)
    onDraftStateChange?.(false)
    window.history.back()
  }

  async function handleCancel() {
    await handleClearMedia()
    navigate('/')
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
              <p className="help">Images up to 25MB, videos up to 50MB.</p>

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
                      onLoadedMetadata={handleMediaLoad}
                      style={mediaPreviewSize ? {
                        width: `${mediaPreviewSize.width}px`,
                        height: `${mediaPreviewSize.height}px`,
                        maxWidth: 'none',
                        maxHeight: 'none',
                      } : undefined}
                      className="media-preview-frame"
                    />
                  ) : (
                    <img
                      src={mediaPreviewUrl}
                      alt="Uploaded post media preview"
                      onLoad={handleMediaLoad}
                      style={mediaPreviewSize ? {
                        width: `${mediaPreviewSize.width}px`,
                        height: `${mediaPreviewSize.height}px`,
                        maxWidth: 'none',
                        maxHeight: 'none',
                      } : undefined}
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
                  Publish Post
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
