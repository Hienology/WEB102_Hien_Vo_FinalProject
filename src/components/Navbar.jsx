import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { fetchAtpMatches } from '../lib/atpMatches'
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
  const [isAtpLoading, setIsAtpLoading] = useState(true)
  const [atpMatches, setAtpMatches] = useState([])
  const [atpMatchIndex, setAtpMatchIndex] = useState(0)
  const [atpError, setAtpError] = useState('')
  const isOnCreatePage = location.pathname === '/create'
  const isOnEditPage = location.pathname.startsWith('/edit/')
  const shouldWarnBeforeGoingHome = (isOnCreatePage && hasUnsavedCreateDraft)
    || (isOnEditPage && hasUnsavedEditDraft)

  const hasActiveSearch = Boolean((searchCriteria?.query || '').trim())
    || (Array.isArray(searchCriteria?.tags) && searchCriteria.tags.length > 0)
  const activeAtpMatch = atpMatches[atpMatchIndex] || null
  const atpMetaText = activeAtpMatch
    ? [
      activeAtpMatch.tournamentName,
      activeAtpMatch.categoryLabel,
      activeAtpMatch.roundLabel,
      activeAtpMatch.statusLabel,
      activeAtpMatch.dateLabel,
    ].filter(Boolean).join(' | ')
    : ''

  useEffect(() => {
    let isMounted = true

    async function loadAtpMatches() {
      try {
        const nextMatches = await fetchAtpMatches()
        if (!isMounted) return

        setAtpMatches(nextMatches)
        setAtpMatchIndex((current) => {
          if (nextMatches.length === 0) return 0
          return Math.min(current, nextMatches.length - 1)
        })
        setAtpError('')
      } catch {
        if (!isMounted) return
        setAtpMatches([])
        setAtpMatchIndex(0)
        setAtpError('ATP feed unavailable right now.')
      } finally {
        if (isMounted) {
          setIsAtpLoading(false)
        }
      }
    }

    loadAtpMatches()
    const intervalId = window.setInterval(loadAtpMatches, 5 * 60 * 1000)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    function handleBrowserRevert() {
      onHomeReset()
    }

    window.addEventListener('popstate', handleBrowserRevert)
    return () => {
      window.removeEventListener('popstate', handleBrowserRevert)
    }
  }, [onHomeReset])

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

  function handleNewPostClick() {
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

  function handlePreviousAtpMatch() {
    if (atpMatches.length <= 1) return

    setAtpMatchIndex((current) => {
      if (current === 0) return atpMatches.length - 1
      return current - 1
    })
  }

  function handleNextAtpMatch() {
    if (atpMatches.length <= 1) return

    setAtpMatchIndex((current) => (current + 1) % atpMatches.length)
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
            <Link to="/create" className="navbar-item navbar-strong-link" onClick={handleNewPostClick}>
              New Post
            </Link>
          </div>

          <div className="app-navbar-center">
            <div className="navbar-item atp-ticker-item" aria-live="polite">
              <span className="atp-ticker-label">ATP</span>

              {isAtpLoading && (
                <span className="atp-loading-row" role="status" aria-live="polite">
                  <span className="spinner spinner-inline spinner-xs" aria-hidden="true"></span>
                  <span className="atp-ticker-message">Loading latest matches...</span>
                </span>
              )}

              {!isAtpLoading && atpError && (
                <span className="atp-ticker-message">{atpError}</span>
              )}

              {!isAtpLoading && !atpError && !activeAtpMatch && (
                <span className="atp-ticker-message">No ATP matches with scores yet.</span>
              )}

              {!isAtpLoading && !atpError && activeAtpMatch && (
                <div className="atp-ticker-content">
                  <button
                    type="button"
                    className="atp-arrow-button"
                    onClick={handlePreviousAtpMatch}
                    aria-label="Show previous ATP match"
                    disabled={atpMatches.length <= 1}
                  >
                    {'<'}
                  </button>

                  <div className="atp-match-window">
                    <p className="atp-match-line">
                      <span className={`atp-player ${activeAtpMatch.winnerSide === 'left' ? 'is-winner' : ''}`}>
                        {activeAtpMatch.leftName}
                      </span>
                      <span className="atp-score">{activeAtpMatch.leftScore}</span>
                      <span className="atp-versus">vs</span>
                      <span className={`atp-player ${activeAtpMatch.winnerSide === 'right' ? 'is-winner' : ''}`}>
                        {activeAtpMatch.rightName}
                      </span>
                      <span className="atp-score">{activeAtpMatch.rightScore}</span>
                    </p>
                    <p className="atp-meta-line">{atpMetaText}</p>
                  </div>

                  <button
                    type="button"
                    className="atp-arrow-button"
                    onClick={handleNextAtpMatch}
                    aria-label="Show next ATP match"
                    disabled={atpMatches.length <= 1}
                  >
                    {'>'}
                  </button>

                  <span className="atp-match-counter" aria-label="Current ATP match index">
                    {atpMatchIndex + 1}/{atpMatches.length}
                  </span>
                </div>
              )}
            </div>
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
