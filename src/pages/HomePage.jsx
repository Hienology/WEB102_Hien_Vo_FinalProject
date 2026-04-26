import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import {
  getSearchSummary,
  postMatchesSearchCriteria,
  sanitizeSearchCriteria,
} from '../lib/tags'
import PostCard from '../components/PostCard'
import Spinner from '../components/Spinner'

export default function HomePage({
  searchCriteria,
  onRefineSearchCriteria,
  onClearAllFilters,
}) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('newest') // 'newest' | 'popular'
  const searchSummary = getSearchSummary(searchCriteria)

  function handleRemoveTag(tagToRemove) {
    const remainingTags = searchSummary.tags.filter((tag) => tag !== tagToRemove)
    onRefineSearchCriteria({
      query: searchSummary.query,
      tags: remainingTags,
    })
  }

  function handleClearAllFiltersClick() {
    onClearAllFilters()
  }

  useEffect(() => {
    async function fetchPosts() {
      setLoading(true)
      const criteria = sanitizeSearchCriteria(searchCriteria)

      const { data: sqlData, error: sqlError } = await supabase.rpc('search_posts', {
        p_query: criteria.query,
        p_tags: criteria.tags,
        p_sort: sortBy,
      })

      if (!sqlError) {
        setPosts(sqlData || [])
        setLoading(false)
        return
      }

      console.warn('search_posts() RPC unavailable, using client-side fallback:', sqlError)

      const { data: fallbackData, error: fallbackError } = await supabase
        .from('posts')
        .select('id, created_at, title, content, tags, image_url, upvotes')
        .order(sortBy === 'newest' ? 'created_at' : 'upvotes', { ascending: false })

      if (fallbackError) {
        console.error('Error fetching posts:', fallbackError)
        setPosts([])
      } else {
        setPosts((fallbackData || []).filter((post) => postMatchesSearchCriteria(post, criteria)))
      }
      setLoading(false)
    }
    fetchPosts()
  }, [sortBy, searchCriteria])

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex justify-between items-center mb-6 home-toolbar">
        <h1 className="title is-3 page-heading">Latest Discussions</h1>
        <div className="flex gap-2 home-sort-controls">
          <button
            className={`button is-small ${sortBy === 'newest' ? 'is-success' : 'is-light'}`}
            onClick={() => setSortBy('newest')}
          >
            Newest
          </button>
          <button
            className={`button is-small ${sortBy === 'popular' ? 'is-danger' : 'is-light'}`}
            onClick={() => setSortBy('popular')}
          >
            Most Popular
          </button>
        </div>
      </div>

      {searchSummary.hasActiveCriteria && (
        <div className="box content-panel mb-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <p className="text-sm text-gray-700 font-semibold mb-0">Active search criteria:</p>
            <button
              type="button"
              className="button is-small is-warning is-light"
              onClick={handleClearAllFiltersClick}
            >
              Clear all filters
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {searchSummary.query && (
              <span className="tag is-info is-light is-rounded">
                Words: "{searchSummary.query}"
              </span>
            )}
            {searchSummary.tags.map((tag) => (
              <span key={tag} className="tag is-success is-light is-rounded pr-1">
                <span>#{tag}</span>
                <button
                  type="button"
                  className="tag-clear-button"
                  aria-label={`Remove tag ${tag}`}
                  onClick={() => handleRemoveTag(tag)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : posts.length === 0 ? (
        <div className="box content-panel text-center text-gray-500 py-12">
          {searchSummary.hasActiveCriteria
            ? 'No posts match your combined words/tags criteria.'
            : 'No posts yet. Be the first to start a discussion!'}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}
