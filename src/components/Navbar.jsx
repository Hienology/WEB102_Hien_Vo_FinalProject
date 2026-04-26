import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { formatTagsInput, parseTagInput } from '../lib/tags'

export default function Navbar({
  searchCriteria,
  onApplySearch,
  onHomeReset,
  hasUnsavedCreateDraft,
  hasUnsavedEditDraft,
  onDiscardCreateDraft,
  onDiscardEditDraft,
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
  const [isLeaveDraftModalOpen, setIsLeaveDraftModalOpen] = useState(false)
  const [keywordInput, setKeywordInput] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [searchError, setSearchError] = useState('')
  const isOnCreatePage = location.pathname === '/create'
  const isOnEditPage = location.pathname.startsWith('/edit/')
  const shouldWarnBeforeGoingHome = (isOnCreatePage && hasUnsavedCreateDraft)
    || (isOnEditPage && hasUnsavedEditDraft)

  const hasActiveSearch = Boolean((searchCriteria?.query || '').trim())
    || (Array.isArray(searchCriteria?.tags) && searchCriteria.tags.length > 0)

  function openSearchModal() {
    setKeywordInput(searchCriteria?.query || '')
    setTagsInput(formatTagsInput(searchCriteria?.tags))
    setSearchError('')
    setIsSearchModalOpen(true)
  }

  function closeSearchModal() {
    setSearchError('')
    setIsSearchModalOpen(false)
  }

  function handleSearchSubmit(e) {
    e.preventDefault()
    const query = keywordInput.trim()
    const tags = parseTagInput(tagsInput)

    if (!query && tags.length === 0) {
      setSearchError('Please enter keywords or at least one tag.')
      return
    }

    onApplySearch({ query, tags })
    closeSearchModal()
    navigate('/')
  }

  function handleClearSearch() {
    setKeywordInput('')
    setTagsInput('')
    setSearchError('')
  }

  function handleTitleClick(e) {
    // Keep hover/click styling on the title without navigating away.
    e.preventDefault()
  }

  function handleHomeClick(e) {
    if (shouldWarnBeforeGoingHome) {
      e.preventDefault()
      setIsLeaveDraftModalOpen(true)
      return
    }

    onHomeReset()
  }

  function closeLeaveDraftModal() {
    setIsLeaveDraftModalOpen(false)
  }

  function handleLeaveDraftAndGoHome() {
    onDiscardCreateDraft?.()
    onDiscardEditDraft?.()
    onHomeReset()
    closeLeaveDraftModal()
    navigate('/')
  }

  return (
    <>
      <nav className="navbar is-success app-navbar" role="navigation" aria-label="main navigation">
        <div className="navbar-brand app-navbar-brand">
          <Link to="/" className="navbar-item navbar-strong-link" onClick={handleTitleClick}>
            <span className="navbar-title-text">
              🎾 Grand Slam Hub
            </span>
          </Link>
        </div>

        <div className="navbar-menu is-active app-navbar-menu">
          <div className="navbar-start app-navbar-start">
            <Link to="/" className="navbar-item navbar-strong-link" onClick={handleHomeClick}>
              Home
            </Link>
            <Link to="/create" className="navbar-item navbar-strong-link">
              New Post
            </Link>
          </div>

          <div className="navbar-end app-navbar-end">
            <div className="navbar-item app-navbar-search-item flex items-center gap-2">
              {hasActiveSearch && <span className="tag is-warning is-light is-rounded">Filtered</span>}
              <button
                type="button"
                className="button is-light is-small navbar-search-trigger"
                onClick={openSearchModal}
              >
                Search
              </button>
            </div>
          </div>
        </div>
      </nav>

      {isSearchModalOpen && (
        <div
          className="search-modal-overlay"
          role="presentation"
          onClick={closeSearchModal}
        >
          <div
            className="search-modal-panel content-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="search-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start gap-3 mb-3">
              <div>
                <h2 id="search-modal-title" className="title is-4 mb-1">Search Posts</h2>
                <p className="text-sm text-gray-600">
                  Search by words in title/content, tags, or both combined.
                </p>
              </div>
              <button
                type="button"
                className="delete"
                aria-label="Close search"
                onClick={closeSearchModal}
              />
            </div>

            <form onSubmit={handleSearchSubmit}>
              <div className="field">
                <label className="label">Words</label>
                <div className="control">
                  <input
                    className="input"
                    type="text"
                    placeholder="federer backhand, clay strategy..."
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                  />
                </div>
              </div>

              <div className="field">
                <label className="label">Tags</label>
                <div className="control">
                  <input
                    className="input"
                    type="text"
                    placeholder="wimbledon, grand-slam"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                  />
                </div>
                <p className="help">Use commas to separate tags.</p>
              </div>

              {searchError && (
                <div className="notification is-danger is-light py-2 mb-3">
                  {searchError}
                </div>
              )}

              <div className="field is-grouped is-grouped-right mt-5">
                <p className="control">
                  <button
                    type="button"
                    className="button is-light"
                    onClick={closeSearchModal}
                  >
                    Cancel
                  </button>
                </p>
                <p className="control">
                  <button
                    type="button"
                    className="button is-warning is-light"
                    onClick={handleClearSearch}
                  >
                    Clear
                  </button>
                </p>
                <p className="control">
                  <button type="submit" className="button is-success">
                    Search
                  </button>
                </p>
              </div>
            </form>
          </div>
        </div>
      )}

      {isLeaveDraftModalOpen && (
        <div
          className="search-modal-overlay"
          role="presentation"
          onClick={closeLeaveDraftModal}
        >
          <div
            className="search-modal-panel content-panel"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="leave-draft-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="leave-draft-title" className="title is-4 mb-2">Leave without saving?</h2>
            <p className="text-sm text-gray-700 mb-4">
              If you return to Home now, your unsaved changes will be cleared.
            </p>
            <div className="field is-grouped is-grouped-right mt-5">
              <p className="control">
                <button
                  type="button"
                  className="button is-light"
                  onClick={closeLeaveDraftModal}
                >
                  Stay here
                </button>
              </p>
              <p className="control">
                <button
                  type="button"
                  className="button is-danger"
                  onClick={handleLeaveDraftAndGoHome}
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
