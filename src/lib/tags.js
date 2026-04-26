export const MAX_TAGS = 8

function normalizeTag(tag) {
  return tag.trim().replace(/^#+/, '').replace(/\s+/g, ' ').toLowerCase()
}

export function normalizeSearchText(rawText) {
  return (rawText || '').trim().replace(/\s+/g, ' ').toLowerCase()
}

export function parseTagInput(rawInput) {
  if (!rawInput) return []

  const tags = []
  const seen = new Set()

  for (const chunk of rawInput.split(/[\n,]/)) {
    const normalized = normalizeTag(chunk)
    if (!normalized || seen.has(normalized)) continue

    seen.add(normalized)
    tags.push(normalized)

    if (tags.length >= MAX_TAGS) break
  }

  return tags
}

export function formatTagsInput(tags) {
  if (!Array.isArray(tags) || tags.length === 0) return ''
  return tags.join(', ')
}

export function sanitizeSearchCriteria(criteria) {
  return {
    query: normalizeSearchText(criteria?.query),
    tags: Array.isArray(criteria?.tags)
      ? parseTagInput(criteria.tags.join(','))
      : [],
  }
}

export function hasActiveSearchCriteria(criteria) {
  const sanitized = sanitizeSearchCriteria(criteria)
  return Boolean(sanitized.query) || sanitized.tags.length > 0
}

export function postMatchesSearchCriteria(post, criteria) {
  const sanitized = sanitizeSearchCriteria(criteria)

  const matchesText = !sanitized.query
    || (post.title || '').toLowerCase().includes(sanitized.query)
    || (post.content || '').toLowerCase().includes(sanitized.query)

  const postTags = Array.isArray(post.tags)
    ? post.tags.map((tag) => normalizeTag(tag))
    : []

  const matchesTags = sanitized.tags.length === 0
    || sanitized.tags.some((tag) => postTags.includes(tag))

  return matchesText && matchesTags
}

export function getSearchSummary(criteria) {
  const sanitized = sanitizeSearchCriteria(criteria)
  return {
    query: sanitized.query,
    tags: sanitized.tags,
    hasActiveCriteria: Boolean(sanitized.query) || sanitized.tags.length > 0,
  }
}
