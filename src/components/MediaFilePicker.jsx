import { useId, useRef } from 'react'

export default function MediaFilePicker({
  accept = 'image/*,video/*',
  disabled = false,
  fileName = '',
  label = 'Choose Files',
  onFileSelect,
}) {
  const inputRef = useRef(null)
  const fallbackId = useId()
  const inputId = `media-file-picker-${fallbackId}`

  function handleButtonClick() {
    if (disabled) return
    inputRef.current?.click()
  }

  function handleChange(event) {
    const selectedFile = event.target.files?.[0] || null
    onFileSelect?.(selectedFile, event)
  }

  return (
    <div className="media-file-picker">
      <input
        ref={inputRef}
        id={inputId}
        className="media-file-picker-input"
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={handleChange}
      />
      <button
        type="button"
        className="button is-light media-file-picker-button"
        disabled={disabled}
        onClick={handleButtonClick}
      >
        {label}
      </button>
      <span className="media-file-picker-name" aria-live="polite">
        {fileName || 'No files chosen'}
      </span>
    </div>
  )
}