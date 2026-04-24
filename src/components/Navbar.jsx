import { Link, useNavigate } from 'react-router-dom'

export default function Navbar({ searchQuery, onSearchChange }) {
  const navigate = useNavigate()

  function handleSearchSubmit(e) {
    e.preventDefault()
    navigate('/')
  }

  return (
    <nav className="navbar is-success" role="navigation" aria-label="main navigation">
      <div className="navbar-brand">
        <Link to="/" className="navbar-item">
          <span className="text-white font-bold text-xl tracking-wide">
            🎾 Grand Slam Hub
          </span>
        </Link>
      </div>

      <div className="navbar-menu is-active">
        <div className="navbar-start">
          <Link to="/" className="navbar-item text-white hover:text-emerald-100">
            Home
          </Link>
          <Link to="/create" className="navbar-item text-white hover:text-emerald-100">
            New Post
          </Link>
        </div>

        <div className="navbar-end">
          <div className="navbar-item">
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <input
                className="input"
                type="text"
                placeholder="Search posts…"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                style={{ width: '220px' }}
              />
            </form>
          </div>
        </div>
      </div>
    </nav>
  )
}
