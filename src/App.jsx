import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import HomePage from './pages/HomePage'
import CreatePostPage from './pages/CreatePostPage'
import PostDetailPage from './pages/PostDetailPage'
import EditPostPage from './pages/EditPostPage'
import NotFoundPage from './pages/NotFoundPage'

function createEmptySearchCriteria() {
  return { query: '', tags: [] }
}

export default function App() {
  const [activeSearchCriteria, setActiveSearchCriteria] = useState(createEmptySearchCriteria)
  const [searchDraftCriteria, setSearchDraftCriteria] = useState(createEmptySearchCriteria)

  function handleApplySearch(nextCriteria) {
    setActiveSearchCriteria(nextCriteria)
    setSearchDraftCriteria(nextCriteria)
  }

  function handleRefineActiveSearch(nextCriteria) {
    setActiveSearchCriteria(nextCriteria)
    setSearchDraftCriteria(nextCriteria)
  }

  function handleHomeReset() {
    setActiveSearchCriteria(createEmptySearchCriteria())
  }

  function handleClearAllFilters() {
    setActiveSearchCriteria(createEmptySearchCriteria())
    setSearchDraftCriteria(createEmptySearchCriteria())
  }

  return (
    <BrowserRouter>
      <div className="app-shell">
        <Navbar
          searchCriteria={searchDraftCriteria}
          onApplySearch={handleApplySearch}
          onHomeReset={handleHomeReset}
        />
        <main>
          <Routes>
            <Route
              path="/"
              element={(
                <HomePage
                  searchCriteria={activeSearchCriteria}
                  onRefineSearchCriteria={handleRefineActiveSearch}
                  onClearAllFilters={handleClearAllFilters}
                />
              )}
            />
            <Route path="/create" element={<CreatePostPage />} />
            <Route path="/post/:id" element={<PostDetailPage />} />
            <Route path="/edit/:id" element={<EditPostPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
