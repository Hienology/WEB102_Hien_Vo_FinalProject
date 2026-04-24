import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import PostCard from '../components/PostCard'
import Spinner from '../components/Spinner'

export default function HomePage({ searchQuery }) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('newest') // 'newest' | 'popular'

  useEffect(() => {
    async function fetchPosts() {
      setLoading(true)
      const { data, error } = await supabase
        .from('posts')
        .select('id, created_at, title, upvotes')
        .order(sortBy === 'newest' ? 'created_at' : 'upvotes', { ascending: false })

      if (error) {
        console.error('Error fetching posts:', error)
      } else {
        setPosts(data || [])
      }
      setLoading(false)
    }
    fetchPosts()
  }, [sortBy])

  const filteredPosts = searchQuery
    ? posts.filter((p) =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : posts

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="title is-3 text-gray-800">Latest Discussions</h1>
        <div className="flex gap-2">
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

      {loading ? (
        <Spinner />
      ) : filteredPosts.length === 0 ? (
        <div className="box text-center text-gray-500 py-12">
          {searchQuery
            ? `No posts match "${searchQuery}"`
            : 'No posts yet. Be the first to start a discussion!'}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}
