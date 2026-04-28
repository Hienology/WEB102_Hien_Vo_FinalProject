import { supabase } from './supabaseClient'

const COMMENT_MEDIA_PREFIX = '__GSH_MEDIA_V1__'

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.avif']
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov', '.m4v', '.mkv']

export const SUPABASE_MEDIA_BUCKET = import.meta.env.VITE_SUPABASE_MEDIA_BUCKET || 'grand-slam-media'
export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024
export const MAX_VIDEO_UPLOAD_BYTES = 25 * 1024 * 1024
export const MAX_COMMENT_GIF_UPLOAD_BYTES = 25 * 1024 * 1024
export const MAX_COMMENT_GIF_DURATION_SECONDS = 60

function normalizeMediaUrl(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function formatBytes(bytes) {
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(0)}MB`
}

function removeQueryAndHash(url) {
  return url.split('#')[0].split('?')[0]
}

function sanitizePathSegment(value) {
  return String(value || 'anonymous')
    .trim()
    .replace(/[^a-z0-9_-]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '') || 'anonymous'
}

function getFileExtension(file) {
  const fileName = String(file?.name || '')
  const extensionMatch = fileName.match(/\.[a-z0-9]+$/i)
  if (extensionMatch) {
    return extensionMatch[0].toLowerCase()
  }

  const mediaType = getMediaTypeFromFile(file)
  if (mediaType === 'video') return '.mp4'
  if (mediaType === 'image') return '.jpg'
  return ''
}

function buildMediaStoragePath(file, { folder = 'uploads', ownerId = 'anonymous' } = {}) {
  const safeFolder = String(folder || 'uploads').trim().replace(/^\/+|\/+$/g, '') || 'uploads'
  const safeOwnerId = sanitizePathSegment(ownerId)
  const extension = getFileExtension(file)
  const uniqueId = typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

  return `${safeFolder}/${safeOwnerId}/${Date.now()}-${uniqueId}${extension}`
}

function extractStoragePathFromPublicUrl(mediaUrl) {
  const normalizedUrl = normalizeMediaUrl(mediaUrl)
  if (!normalizedUrl) return ''

  try {
    const parsedUrl = new URL(normalizedUrl)
    const publicPrefix = `/storage/v1/object/public/${SUPABASE_MEDIA_BUCKET}/`
    if (!parsedUrl.pathname.startsWith(publicPrefix)) {
      return ''
    }

    return decodeURIComponent(parsedUrl.pathname.slice(publicPrefix.length))
  } catch {
    return ''
  }
}

export function isSupabaseMediaUrl(mediaUrl) {
  return Boolean(extractStoragePathFromPublicUrl(mediaUrl))
}

export async function uploadMediaFile(file, { folder = 'uploads', ownerId = 'anonymous' } = {}) {
  const storagePath = buildMediaStoragePath(file, { folder, ownerId })
  const { error: uploadError } = await supabase.storage
    .from(SUPABASE_MEDIA_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    throw new Error(uploadError.message)
  }

  const { data } = supabase.storage
    .from(SUPABASE_MEDIA_BUCKET)
    .getPublicUrl(storagePath)

  const publicUrl = data?.publicUrl || ''
  if (!publicUrl) {
    throw new Error('Unable to resolve the uploaded media URL.')
  }

  return {
    storagePath,
    publicUrl,
  }
}

export async function deleteMediaFile(mediaUrl) {
  const storagePath = extractStoragePathFromPublicUrl(mediaUrl)
  if (!storagePath) return

  const { error } = await supabase.storage
    .from(SUPABASE_MEDIA_BUCKET)
    .remove([storagePath])

  if (error) {
    throw new Error(error.message)
  }
}

export function getMediaTypeFromUrl(urlValue) {
  const mediaUrl = normalizeMediaUrl(urlValue)
  if (!mediaUrl) return null

  const lowerValue = mediaUrl.toLowerCase()
  if (lowerValue.startsWith('data:image/')) return 'image'
  if (lowerValue.startsWith('data:video/')) return 'video'

  const sanitized = removeQueryAndHash(lowerValue)
  if (VIDEO_EXTENSIONS.some((extension) => sanitized.endsWith(extension))) {
    return 'video'
  }
  if (IMAGE_EXTENSIONS.some((extension) => sanitized.endsWith(extension))) {
    return 'image'
  }

  return 'image'
}

export function getMediaTypeFromFile(file) {
  if (!file || typeof file.type !== 'string') return null
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  return null
}

export function getMediaUploadLimitBytes(mediaType) {
  return mediaType === 'video' ? MAX_VIDEO_UPLOAD_BYTES : MAX_IMAGE_UPLOAD_BYTES
}

function isGifFile(file) {
  const fileName = String(file?.name || '').toLowerCase()
  return file?.type === 'image/gif' || fileName.endsWith('.gif')
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result)
      } else {
        reject(new Error('Unable to read the selected file.'))
      }
    }

    reader.onerror = () => {
      reject(new Error('Unable to read the selected file.'))
    }

    reader.readAsArrayBuffer(file)
  })
}

function readUint16LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8)
}

function skipSubBlocks(bytes, offset) {
  while (offset < bytes.length) {
    const blockSize = bytes[offset]
    offset += 1

    if (blockSize === 0) {
      return offset
    }

    if (offset + blockSize > bytes.length) {
      return -1
    }

    offset += blockSize
  }

  return -1
}

async function getGifDurationSeconds(file) {
  const arrayBuffer = await readFileAsArrayBuffer(file)
  const bytes = new Uint8Array(arrayBuffer)

  if (bytes.length < 13) return null

  const signature = String.fromCharCode(...bytes.subarray(0, 6))
  if (signature !== 'GIF87a' && signature !== 'GIF89a') return null

  let offset = 13
  const packedFields = bytes[10]

  if (packedFields & 0x80) {
    const globalColorTableSize = 3 * (2 ** ((packedFields & 0x07) + 1))
    offset += globalColorTableSize

    if (offset > bytes.length) return null
  }

  let totalDelayCentiseconds = 0
  let pendingDelayCentiseconds = 10
  let hasFrame = false

  while (offset < bytes.length) {
    const blockId = bytes[offset]
    offset += 1

    if (blockId === 0x3B) break

    if (blockId === 0x21) {
      if (offset >= bytes.length) return null

      const label = bytes[offset]
      offset += 1

      if (label === 0xF9) {
        if (offset >= bytes.length) return null

        const blockSize = bytes[offset]
        offset += 1

        if (blockSize !== 4 || offset + 4 > bytes.length) return null

        const delayCentiseconds = readUint16LE(bytes, offset + 1)
        pendingDelayCentiseconds = delayCentiseconds > 0 ? delayCentiseconds : 1
        offset += 4

        if (offset >= bytes.length || bytes[offset] !== 0x00) return null
        offset += 1
      } else {
        offset = skipSubBlocks(bytes, offset)
        if (offset < 0) return null
      }

      continue
    }

    if (blockId === 0x2C) {
      if (offset + 9 > bytes.length) return null

      const imageDescriptorPacked = bytes[offset + 8]
      offset += 9

      if (imageDescriptorPacked & 0x80) {
        const localColorTableSize = 3 * (2 ** ((imageDescriptorPacked & 0x07) + 1))
        offset += localColorTableSize

        if (offset > bytes.length) return null
      }

      if (offset >= bytes.length) return null

      offset += 1
      offset = skipSubBlocks(bytes, offset)

      if (offset < 0) return null

      totalDelayCentiseconds += pendingDelayCentiseconds
      pendingDelayCentiseconds = 10
      hasFrame = true
      continue
    }

    return null
  }

  if (!hasFrame) return null

  return totalDelayCentiseconds / 100
}

export function validateMediaFile(file) {
  const mediaType = getMediaTypeFromFile(file)
  if (!mediaType) {
    return {
      mediaType: null,
      error: 'Please choose an image or video file.',
    }
  }

  const uploadLimit = getMediaUploadLimitBytes(mediaType)
  if (file.size > uploadLimit) {
    return {
      mediaType,
      error: `${mediaType === 'video' ? 'Video' : 'Image'} is too large. Max size is ${formatBytes(uploadLimit)}.`,
    }
  }

  return {
    mediaType,
    error: null,
  }
}

export function getQuarterMediaSize(target) {
  const naturalWidth = target instanceof HTMLVideoElement ? target.videoWidth : target.naturalWidth
  const naturalHeight = target instanceof HTMLVideoElement ? target.videoHeight : target.naturalHeight

  if (naturalWidth > 0 && naturalHeight > 0) {
    return {
      width: Math.max(1, Math.round(naturalWidth / 4)),
      height: Math.max(1, Math.round(naturalHeight / 4)),
    }
  }

  return null
}

export async function validateCommentMediaFile(file) {
  const mediaType = getMediaTypeFromFile(file)
  if (!mediaType) {
    return {
      mediaType: null,
      error: 'Please choose an image or video file.',
    }
  }

  const isAnimatedGif = isGifFile(file)
  const mediaLabel = isAnimatedGif ? 'GIF' : (mediaType === 'video' ? 'Video' : 'Image')

  if (isAnimatedGif) {
    if (file.size > MAX_COMMENT_GIF_UPLOAD_BYTES) {
      return {
        mediaType,
        error: `GIF is too large. Max size is ${formatBytes(MAX_COMMENT_GIF_UPLOAD_BYTES)}.`,
      }
    }

    const durationSeconds = await getGifDurationSeconds(file)
    if (durationSeconds !== null && durationSeconds > MAX_COMMENT_GIF_DURATION_SECONDS) {
      return {
        mediaType,
        error: `GIF is too long. Max length is ${MAX_COMMENT_GIF_DURATION_SECONDS} seconds.`,
      }
    }
  }

  const uploadLimit = isAnimatedGif ? MAX_COMMENT_GIF_UPLOAD_BYTES : getMediaUploadLimitBytes(mediaType)
  if (file.size > uploadLimit) {
    return {
      mediaType,
      error: `${mediaLabel} is too large. Max size is ${formatBytes(uploadLimit)}.`,
    }
  }

  return {
    mediaType,
    error: null,
  }
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Unable to read the selected file.'))
      }
    }

    reader.onerror = () => {
      reject(new Error('Unable to read the selected file.'))
    }

    reader.readAsDataURL(file)
  })
}

export function buildCommentUpsertData({ textValue, mediaUrlValue } = {}) {
  const text = typeof textValue === 'string' ? textValue.trim() : ''
  const mediaUrl = normalizeMediaUrl(mediaUrlValue)

  return {
    content: text || '',
    media_url: mediaUrl || null,
  }
}

export function parseCommentRecord(comment) {
  const text = typeof comment?.content === 'string' ? comment.content : ''
  const mediaUrl = normalizeMediaUrl(comment?.media_url)

  if (mediaUrl) {
    return {
      text,
      mediaUrl,
      mediaType: getMediaTypeFromUrl(mediaUrl),
      isLegacyPayload: false,
    }
  }

  return {
    ...parseCommentContent(text),
    isLegacyPayload: Boolean(text.startsWith(COMMENT_MEDIA_PREFIX)),
  }
}

export function serializeCommentContent(textValue, mediaUrlValue) {
  const text = typeof textValue === 'string' ? textValue.trim() : ''
  const mediaUrl = normalizeMediaUrl(mediaUrlValue)

  if (!mediaUrl) return text

  return `${COMMENT_MEDIA_PREFIX}${JSON.stringify({ text, mediaUrl })}`
}

export function parseCommentContent(rawContent) {
  const content = typeof rawContent === 'string' ? rawContent : ''

  if (!content.startsWith(COMMENT_MEDIA_PREFIX)) {
    return {
      text: content,
      mediaUrl: '',
      mediaType: null,
    }
  }

  try {
    const parsedPayload = JSON.parse(content.slice(COMMENT_MEDIA_PREFIX.length))
    const text = typeof parsedPayload?.text === 'string' ? parsedPayload.text : ''
    const mediaUrl = normalizeMediaUrl(parsedPayload?.mediaUrl)

    return {
      text,
      mediaUrl,
      mediaType: getMediaTypeFromUrl(mediaUrl),
    }
  } catch {
    return {
      text: content,
      mediaUrl: '',
      mediaType: null,
    }
  }
}
