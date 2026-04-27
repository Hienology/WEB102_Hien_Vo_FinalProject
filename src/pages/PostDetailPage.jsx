import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import MediaFilePicker from '../components/MediaFilePicker'
import { supabase } from '../lib/supabaseClient'
import { getUserId } from '../lib/auth'
import Spinner from '../components/Spinner'
import {
  buildCommentUpsertData,
  deleteMediaFile,
  getMediaTypeFromUrl,
  isSupabaseMediaUrl,
  parseCommentRecord,
  uploadMediaFile,
  validateMediaFile,
} from '../lib/media'

function createCommentDraft() {
  return {
    text: '',
    mediaUrl: '',
    mediaType: null,
    previewUrl: '',
    fileName: '',
  }
}

async function uploadMediaToDraft({
  file,
  ownerId,
  folder,
  setMediaUrl,
  setMediaType,
  setPreviewUrl,
  setFileName,
  setPreparing,
  setError,
}) {
  const { mediaType, error: validationError } = validateMediaFile(file)
  if (validationError) {
    setError(validationError)
    setFileName?.('')
    return false
  }

  setFileName?.(file.name)
  const nextPreviewUrl = URL.createObjectURL(file)
  setMediaType(mediaType)
  setPreviewUrl(nextPreviewUrl)
  setPreparing(true)
  setError(null)

  try {
    const { publicUrl } = await uploadMediaFile(file, {
      folder,
      ownerId,
    })

    setMediaUrl(publicUrl)
    setPreviewUrl(publicUrl)
    return true
  } catch (uploadError) {
    setError(uploadError.message || 'Unable to process the selected media file.')
    setMediaUrl('')
    setPreviewUrl('')
    setMediaType(null)
    setFileName?.('')
    return false
  } finally {
    setPreparing(false)
  }
}

export default function PostDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const userId = getUserId()

  const [post, setPost] = useState(null)
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [commentDraft, setCommentDraft] = useState(createCommentDraft())
  const [isPreparingCommentMedia, setIsPreparingCommentMedia] = useState(false)
  const [editingCommentId, setEditingCommentId] = useState(null)
  const [editingCommentDraft, setEditingCommentDraft] = useState(null)
  const [isPreparingEditingCommentMedia, setIsPreparingEditingCommentMedia] = useState(false)
  const [submittingComment, setSubmittingComment] = useState(false)
  const [savingCommentId, setSavingCommentId] = useState(null)
  const [deletingCommentId, setDeletingCommentId] = useState(null)
  const [upvotingCommentId, setUpvotingCommentId] = useState(null)
  const [upvoting, setUpvoting] = useState(false)
  const [error, setError] = useState(null)
  const [postMediaSize, setPostMediaSize] = useState(null)

  useEffect(() => () => {
    if (commentDraft.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(commentDraft.previewUrl)
    }
  }, [commentDraft.previewUrl])

  useEffect(() => () => {
    if (editingCommentDraft?.previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(editingCommentDraft.previewUrl)
    }
  }, [editingCommentDraft?.previewUrl])

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setPostMediaSize(null)

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
    if (isPreparingCommentMedia) return

    const nextCommentContent = buildCommentUpsertData({
      textValue: commentDraft.text,
      mediaUrlValue: commentDraft.mediaUrl,
    })

    if (!nextCommentContent.content && !nextCommentContent.media_url) return

    setSubmittingComment(true)

    const { data, error: commentError } = await supabase
      .from('comments')
      .insert({
        post_id: id,
        ...nextCommentContent,
        author_id: userId,
          upvotes: 0,
      })
      .select('*')
      .single()

    if (!commentError && data) {
      setComments((prev) => [...prev, data])
      setCommentDraft(createCommentDraft())
    }
    setSubmittingComment(false)
  }

  function handleNewCommentTextChange(e) {
    setCommentDraft((prev) => ({ ...prev, text: e.target.value }))
  }

  function handleNewCommentMediaUrlChange(e) {
    const nextValue = e.target.value
    setCommentDraft((prev) => ({
      ...prev,
      mediaUrl: nextValue,
      mediaType: getMediaTypeFromUrl(nextValue),
      previewUrl: nextValue,
      fileName: '',
    }))
  }

  async function handleNewCommentMediaUploadChange(e) {
    const nextFile = e.target.files?.[0]
    if (!nextFile) return

    await uploadMediaToDraft({
      file: nextFile,
      ownerId: userId,
      folder: 'comments',
      setMediaUrl: (value) => setCommentDraft((prev) => ({ ...prev, mediaUrl: value })),
      setMediaType: (value) => setCommentDraft((prev) => ({ ...prev, mediaType: value })),
      setPreviewUrl: (value) => setCommentDraft((prev) => ({ ...prev, previewUrl: value })),
      setFileName: (value) => setCommentDraft((prev) => ({ ...prev, fileName: value })),
      setPreparing: setIsPreparingCommentMedia,
      setError,
    })

    e.target.value = ''
  }

  function handleClearCommentMedia() {
    setCommentDraft((prev) => ({
      ...prev,
      mediaUrl: '',
      mediaType: null,
      previewUrl: '',
      fileName: '',
    }))
  }

  function startEditingComment(comment) {
    const parsedComment = parseCommentRecord(comment)
    setEditingCommentId(comment.id)
    setEditingCommentDraft({
      text: parsedComment.text,
      mediaUrl: parsedComment.mediaUrl,
      mediaType: parsedComment.mediaType,
      previewUrl: parsedComment.mediaUrl,
      fileName: '',
    })
  }

  function handleEditingCommentTextChange(e) {
    setEditingCommentDraft((prev) => (prev ? { ...prev, text: e.target.value } : prev))
  }

  function handleEditingCommentMediaUrlChange(e) {
    const nextValue = e.target.value
    setEditingCommentDraft((prev) => (prev ? {
      ...prev,
      mediaUrl: nextValue,
      mediaType: getMediaTypeFromUrl(nextValue),
      previewUrl: nextValue,
      fileName: '',
    } : prev))
  }

  async function handleEditingCommentMediaUploadChange(e) {
    const nextFile = e.target.files?.[0]
    if (!nextFile || !editingCommentDraft) return

    await uploadMediaToDraft({
      file: nextFile,
      ownerId: userId,
      folder: 'comments',
      setMediaUrl: (value) => setEditingCommentDraft((prev) => (prev ? { ...prev, mediaUrl: value } : prev)),
      setMediaType: (value) => setEditingCommentDraft((prev) => (prev ? { ...prev, mediaType: value } : prev)),
      setPreviewUrl: (value) => setEditingCommentDraft((prev) => (prev ? { ...prev, previewUrl: value } : prev)),
      setFileName: (value) => setEditingCommentDraft((prev) => (prev ? { ...prev, fileName: value } : prev)),
      setPreparing: setIsPreparingEditingCommentMedia,
      setError,
    })

    e.target.value = ''
  }

  function handleClearEditingCommentMedia() {
    setEditingCommentDraft((prev) => (prev ? {
      ...prev,
      mediaUrl: '',
      mediaType: null,
      previewUrl: '',
      fileName: '',
    } : prev))
  }

  async function handleSaveCommentEdit(comment) {
    if (!editingCommentDraft || isPreparingEditingCommentMedia) return

    const nextCommentContent = buildCommentUpsertData({
      textValue: editingCommentDraft.text,
      mediaUrlValue: editingCommentDraft.mediaUrl,
    })

    if (!nextCommentContent.content && !nextCommentContent.media_url) {
      setError('Comment text or media is required.')
      return
    }

    setSavingCommentId(comment.id)
    setError(null)

    const parsedComment = parseCommentRecord(comment)
    const previousMediaUrl = parsedComment.mediaUrl

    const { data, error: updateError } = await supabase
      .from('comments')
      .update(nextCommentContent)
      .eq('id', comment.id)
      .select('*')
      .single()

    setSavingCommentId(null)

    if (updateError) {
      setError(updateError.message)
      return
    }

    if (previousMediaUrl && previousMediaUrl !== nextCommentContent.media_url && isSupabaseMediaUrl(previousMediaUrl)) {
      try {
        await deleteMediaFile(previousMediaUrl)
      } catch (cleanupError) {
        console.warn('Unable to clean up replaced comment media:', cleanupError)
      }
    }

    if (data) {
      setComments((prev) => prev.map((entry) => (entry.id === comment.id ? data : entry)))
    }

    setEditingCommentId(null)
    setEditingCommentDraft(null)
  }

  function handleCancelCommentEdit() {
    setEditingCommentId(null)
    setEditingCommentDraft(null)
    setIsPreparingEditingCommentMedia(false)
  }

  function handlePostMediaLoad(event) {
    const target = event.currentTarget
    const naturalWidth = target instanceof HTMLVideoElement ? target.videoWidth : target.naturalWidth
    const naturalHeight = target instanceof HTMLVideoElement ? target.videoHeight : target.naturalHeight

    if (naturalWidth > 0 && naturalHeight > 0) {
      setPostMediaSize({
        width: Math.max(1, Math.round(naturalWidth / 4)),
        height: Math.max(1, Math.round(naturalHeight / 4)),
      })
    }
  }

  async function handleDeleteComment(comment) {
    if (!window.confirm('Delete this comment?')) return

    setDeletingCommentId(comment.id)

    const parsedComment = parseCommentRecord(comment)
    const { error: deleteError } = await supabase
      .from('comments')
      .delete()
      .eq('id', comment.id)

    setDeletingCommentId(null)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    setComments((prev) => prev.filter((entry) => entry.id !== comment.id))

    if (editingCommentId === comment.id) {
      setEditingCommentId(null)
      setEditingCommentDraft(null)
    }

    if (parsedComment.mediaUrl && isSupabaseMediaUrl(parsedComment.mediaUrl)) {
      try {
        await deleteMediaFile(parsedComment.mediaUrl)
      } catch (cleanupError) {
        console.warn('Unable to clean up deleted comment media:', cleanupError)
      }
    }
  }

  async function handleUpvoteComment(comment) {
    if (!comment || savingCommentId === comment.id || deletingCommentId === comment.id || upvotingCommentId === comment.id) return

    const nextUpvotes = Number(comment.upvotes ?? 0) + 1

    setUpvotingCommentId(comment.id)

    const { data, error: updateError } = await supabase
      .from('comments')
      .update({ upvotes: nextUpvotes })
      .eq('id', comment.id)
      .select('upvotes')
      .single()

    if (updateError) {
      setError(updateError.message)
      setUpvotingCommentId(null)
      return
    }

    if (data) {
      setComments((prev) => prev.map((entry) => (
        entry.id === comment.id ? { ...entry, upvotes: data.upvotes } : entry
      )))
    }

    setUpvotingCommentId(null)
  }

  async function handleDelete() {
    if (!window.confirm('Are you sure you want to delete this post? All comments will also be deleted.')) return

    const commentMediaUrls = comments
      .map((comment) => parseCommentRecord(comment).mediaUrl)
      .filter((mediaUrl) => mediaUrl && isSupabaseMediaUrl(mediaUrl))

    const { error: deleteError } = await supabase
      .from('posts')
      .delete()
      .eq('id', id)

    if (deleteError) {
      alert('Failed to delete post: ' + deleteError.message)
    } else {
      if (post?.image_url && isSupabaseMediaUrl(post.image_url)) {
        deleteMediaFile(post.image_url).catch((cleanupError) => {
          console.warn('Unable to clean up deleted post media:', cleanupError)
        })
      }

      commentMediaUrls.forEach((mediaUrl) => {
        deleteMediaFile(mediaUrl).catch((cleanupError) => {
          console.warn('Unable to clean up deleted comment media:', cleanupError)
        })
      })

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
  const postMediaType = getMediaTypeFromUrl(post.image_url)
  const postCaption = typeof post.image_caption === 'string' ? post.image_caption.trim() : ''
  const newCommentFileName = commentDraft.fileName || ''
  const editingCommentFileName = editingCommentDraft?.fileName || ''

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Back link */}
      <Link to="/" className="button is-light is-small mb-6">
        ← Back to Home
      </Link>

      {/* Post card */}
      <div className="box content-panel mb-6 border-l-4 border-emerald-500">
        <div className="flex justify-between items-start gap-4 mb-4 post-detail-header">
          <h1 className="title is-3 text-gray-800 mb-0">{post.title}</h1>
          {isAuthor && (
            <div className="flex gap-2 shrink-0 post-detail-actions">
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
          <figure className="image mb-4 rounded overflow-hidden post-detail-media-shell">
            {postMediaType === 'video' ? (
              <video
                src={post.image_url}
                controls
                preload="metadata"
                onLoadedMetadata={handlePostMediaLoad}
                style={postMediaSize ? {
                  width: `${postMediaSize.width}px`,
                } : undefined}
                className="rounded post-detail-media"
              />
            ) : (
              <img
                src={post.image_url}
                alt="Post media"
                onLoad={handlePostMediaLoad}
                style={postMediaSize ? {
                  width: `${postMediaSize.width}px`,
                } : undefined}
                className="rounded post-detail-media"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
            )}
            {postCaption && (
              <figcaption className="post-detail-caption mt-2 text-sm text-gray-600 italic">
                {postCaption}
              </figcaption>
            )}
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
        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-100 post-detail-vote-row">
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
            {comments.map((comment) => {
              const parsedComment = parseCommentRecord(comment)
              const isCommentAuthor = comment.author_id === userId
              const isEditingThisComment = editingCommentId === comment.id && editingCommentDraft
              const isSavingThisComment = savingCommentId === comment.id
              const isDeletingThisComment = deletingCommentId === comment.id
              const commentUpvotes = Number(comment.upvotes ?? 0)
              const commentEditedAt = comment.edited_at
                ? new Date(comment.edited_at).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
                : ''

              return (
                <div
                  key={comment.id}
                  className="box content-panel-subtle p-3"
                >
                  {isEditingThisComment ? (
                    <div className="flex flex-col gap-3">
                      <div className="field">
                        <label className="label">Edit Comment</label>
                        <div className="control">
                          <textarea
                            className="textarea"
                            placeholder="Share your thoughts…"
                            rows={3}
                            value={editingCommentDraft.text}
                            onChange={handleEditingCommentTextChange}
                          />
                        </div>
                        <p className="help">Text is optional if you attach media.</p>
                      </div>

                      <div className="field">
                        <label className="label">Comment Media URL (Image or Video)</label>
                        <div className="control">
                          <input
                            className="input"
                            type="url"
                            placeholder="https://example.com/photo.jpg or clip.mp4"
                            value={editingCommentDraft.mediaUrl}
                            onChange={handleEditingCommentMediaUrlChange}
                          />
                        </div>
                      </div>

                      <div className="field">
                        <label className="label">Upload Comment Media From Device</label>
                        <div className="control">
                          <MediaFilePicker
                            accept="image/*,video/*"
                            disabled={isSavingThisComment || isPreparingEditingCommentMedia}
                            fileName={editingCommentFileName}
                            label="Choose Files"
                            onFileSelect={(selectedFile, event) => {
                              if (!selectedFile) return
                              handleEditingCommentMediaUploadChange(event)
                            }}
                          />
                        </div>

                        {isPreparingEditingCommentMedia && (
                          <div className="inline-loading-row" role="status" aria-live="polite">
                            <span className="spinner spinner-inline spinner-sm" aria-hidden="true"></span>
                            <span>Preparing comment media...</span>
                          </div>
                        )}

                        {editingCommentDraft.previewUrl && (
                          <div className="media-preview-shell mt-3">
                            {editingCommentDraft.mediaType === 'video' ? (
                              <video
                                src={editingCommentDraft.previewUrl}
                                controls
                                preload="metadata"
                                className="media-preview-frame"
                              />
                            ) : (
                              <img
                                src={editingCommentDraft.previewUrl}
                                alt="Comment media preview"
                                className="media-preview-frame"
                              />
                            )}

                            <button
                              type="button"
                              className="button is-small is-light mt-2"
                              onClick={handleClearEditingCommentMedia}
                            >
                              Remove media
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="field is-grouped is-grouped-right">
                        <p className="control">
                          <button
                            type="button"
                            className="button is-light"
                            onClick={handleCancelCommentEdit}
                            disabled={isSavingThisComment}
                          >
                            Cancel
                          </button>
                        </p>
                        <p className="control">
                          <button
                            type="button"
                            className={`button is-success ${isSavingThisComment ? 'is-loading' : ''}`}
                            onClick={() => handleSaveCommentEdit(comment)}
                            disabled={isSavingThisComment || isPreparingEditingCommentMedia}
                          >
                            Save
                          </button>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {parsedComment.text && (
                        <p className="text-gray-700 whitespace-pre-wrap">{parsedComment.text}</p>
                      )}

                      {parsedComment.mediaUrl && (
                        <div className="comment-media-shell mt-2">
                          {parsedComment.mediaType === 'video' ? (
                            <video
                              src={parsedComment.mediaUrl}
                              controls
                              preload="metadata"
                              className="comment-media"
                            />
                          ) : (
                            <img
                              src={parsedComment.mediaUrl}
                              alt="Comment media"
                              className="comment-media"
                            />
                          )}
                        </div>
                      )}

                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          className={`button is-small is-light ${upvotingCommentId === comment.id ? 'is-loading' : ''}`}
                          onClick={() => handleUpvoteComment(comment)}
                          disabled={upvotingCommentId === comment.id || isSavingThisComment || isDeletingThisComment}
                        >
                          ▲ Upvote
                        </button>
                        <span className="text-sm font-semibold text-gray-700">
                          {commentUpvotes} {commentUpvotes === 1 ? 'vote' : 'votes'}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-3">
                        <div className="flex flex-col gap-1">
                          <p className="text-xs text-gray-400">
                            {new Date(comment.created_at).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                          {commentEditedAt && (
                            <p className="text-xs text-gray-500 italic">
                              Last edited: {commentEditedAt}
                            </p>
                          )}
                        </div>

                        {isCommentAuthor && (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="button is-small is-light"
                              onClick={() => startEditingComment(comment)}
                              disabled={isSavingThisComment || isDeletingThisComment}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className={`button is-small is-danger is-light ${isDeletingThisComment ? 'is-loading' : ''}`}
                              onClick={() => handleDeleteComment(comment)}
                              disabled={isSavingThisComment || isDeletingThisComment}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
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
                value={commentDraft.text}
                onChange={handleNewCommentTextChange}
              />
            </div>
            <p className="help">Text is optional if you attach media.</p>
          </div>

          <div className="field">
            <label className="label">Comment Media URL (Image or Video)</label>
            <div className="control">
              <input
                className="input"
                type="url"
                placeholder="https://example.com/photo.jpg or clip.mp4"
                value={commentDraft.mediaUrl}
                onChange={handleNewCommentMediaUrlChange}
              />
            </div>
          </div>

          <div className="field">
            <label className="label">Upload Comment Media From Device</label>
            <div className="control">
              <MediaFilePicker
                accept="image/*,video/*"
                disabled={submittingComment || isPreparingCommentMedia}
                fileName={newCommentFileName}
                label="Choose Files"
                onFileSelect={(selectedFile, event) => {
                  if (!selectedFile) return
                  handleNewCommentMediaUploadChange(event)
                }}
              />
            </div>
            <p className="help">Images up to 10MB, videos up to 25MB.</p>

            {isPreparingCommentMedia && (
              <div className="inline-loading-row" role="status" aria-live="polite">
                <span className="spinner spinner-inline spinner-sm" aria-hidden="true"></span>
                <span>Preparing comment media...</span>
              </div>
            )}

            {commentDraft.previewUrl && (
              <div className="media-preview-shell mt-3">
                {commentDraft.mediaType === 'video' ? (
                  <video
                    src={commentDraft.previewUrl}
                    controls
                    preload="metadata"
                    className="media-preview-frame"
                  />
                ) : (
                  <img
                    src={commentDraft.previewUrl}
                    alt="Comment media preview"
                    className="media-preview-frame"
                  />
                )}

                <button
                  type="button"
                  className="button is-small is-light mt-2"
                  onClick={handleClearCommentMedia}
                >
                  Remove media
                </button>
              </div>
            )}
          </div>

          <div className="field">
            <div className="control">
              <button
                type="submit"
                className={`button is-success ${submittingComment ? 'is-loading' : ''}`}
                disabled={
                  submittingComment
                  || isPreparingCommentMedia
                  || (!commentDraft.text.trim() && !commentDraft.mediaUrl.trim())
                }
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
