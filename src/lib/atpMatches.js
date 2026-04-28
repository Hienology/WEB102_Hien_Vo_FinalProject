export const ESPN_ATP_SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard'
export const SPORTRADAR_ATP_PROXY_URL = '/api/sportsradar/tennis/atp-live'
export const API_TENNIS_PROXY_URL = '/api/api-tennis/atp-live'
export const DEFAULT_ATP_MATCH_LIMIT = 48
export const DEFAULT_ATP_PROVIDER = 'auto'
const RECENT_MATCH_DETAIL_WINDOW = 12

const CATEGORY_LABEL_PATTERN = /\b((?:Men|Women|Mixed)(?:['’]s)?\s+(?:Singles|Doubles))\b/i
const SMALL_TITLE_WORDS = new Set(['of', 'and', 'the', 'to', 'in', 'on', 'at', 'for', 'vs', 'v'])
const UPPERCASE_WORDS = new Set(['atp', 'wta', 'us', 'uk', 'usa'])

function normalizeSpacing(rawText) {
  return String(rawText || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function toTitleWord(word, index, { lowercaseSmallWords = false } = {}) {
  const lower = String(word || '').toLowerCase()

  if (/^\d+$/.test(word)) return word
  if (UPPERCASE_WORDS.has(lower)) return lower.toUpperCase()
  if (lower === 'vs') return 'vs'
  if (lowercaseSmallWords && index > 0 && SMALL_TITLE_WORDS.has(lower)) return lower

  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

function normalizeTitleLabel(rawText) {
  const text = normalizeSpacing(rawText)
  if (!text) return ''

  return text.split(' ').map((word, index) => toTitleWord(word, index)).join(' ')
}

function normalizeCategoryLabel(rawText) {
  const text = normalizeSpacing(rawText)
  if (!text) return ''

  const match = text.match(CATEGORY_LABEL_PATTERN)
  if (!match) return ''

  return normalizeTitleLabel(match[1])
}

function splitTournamentAndCategoryLabel(rawText) {
  const text = normalizeSpacing(rawText)
  if (!text) {
    return {
      tournamentName: '',
      categoryLabel: '',
    }
  }

  const match = text.match(CATEGORY_LABEL_PATTERN)
  if (!match) {
    return {
      tournamentName: text,
      categoryLabel: '',
    }
  }

  const tournamentName = text.slice(0, match.index).replace(/[\s,|/-]+$/, '').trim()
  return {
    tournamentName: tournamentName || text,
    categoryLabel: normalizeTitleLabel(match[1]),
  }
}

function normalizeRoundLabel(rawText) {
  const text = normalizeSpacing(rawText)
  if (!text) return ''

  return text.split(' ').map((word, index) => toTitleWord(word, index, { lowercaseSmallWords: true })).join(' ')
}

function isAtpFamilyDescriptor(rawText) {
  const normalized = String(rawText || '').toLowerCase()

  if (!normalized) return false
  if (hasWtaMarker(normalized)) return false

  return /\batp\b|\bgrand slam\b|\bgrand-slam\b|\bchallenger\b|\bmen\b|\bmens\b|\bsingles\b|\bdoubles\b/.test(normalized)
}

function getCompetitorName(competitor) {
  if (!competitor) return 'TBD'

  return competitor.athlete?.displayName
    || competitor.athlete?.fullName
    || competitor.athlete?.shortName
    || competitor.athlete?.name
    || competitor.roster?.displayName
    || competitor.roster?.shortDisplayName
    || competitor.roster?.name
    || 'TBD'
}

function getCompetitorScore(competitor) {
  const rawScore = competitor?.score

  if (rawScore === undefined || rawScore === null || rawScore === '') {
    return '-'
  }

  return String(rawScore)
}

function normalizeScoreTextValue(score) {
  const normalizedScore = String(score ?? '').trim()
  return normalizedScore === '' || normalizedScore === '-' ? '' : normalizedScore
}

function chooseTiebreakDisplayValue({ leftTiebreak, rightTiebreak, winnerSide } = {}) {
  const normalizedLeftTiebreak = normalizeScoreTextValue(leftTiebreak)
  const normalizedRightTiebreak = normalizeScoreTextValue(rightTiebreak)

  if (winnerSide === 'left') {
    return normalizedRightTiebreak || normalizedLeftTiebreak
  }

  if (winnerSide === 'right') {
    return normalizedLeftTiebreak || normalizedRightTiebreak
  }

  return normalizedLeftTiebreak || normalizedRightTiebreak
}

function formatSetScoreDisplay({
  leftScore,
  rightScore,
  leftTiebreak,
  rightTiebreak,
  winnerSide,
} = {}) {
  const normalizedLeftScore = normalizeScoreTextValue(leftScore)
  const normalizedRightScore = normalizeScoreTextValue(rightScore)

  if (!normalizedLeftScore || !normalizedRightScore) return ''

  const displayValue = `${normalizedLeftScore}-${normalizedRightScore}`
  const tiebreakValue = chooseTiebreakDisplayValue({ leftTiebreak, rightTiebreak, winnerSide })

  return tiebreakValue ? `${displayValue}(${tiebreakValue})` : displayValue
}

function extractSetScoresFromText(rawText) {
  const normalizedText = String(rawText || '')
    .replace(/[–—]/g, '-')
    .trim()

  if (!normalizedText) return []

  return [...normalizedText.matchAll(/(\d+)\s*[-:]\s*(\d+)(?:\s*\((\d+)\))?/g)]
    .map((match, index) => {
      const leftScore = match[1]
      const rightScore = match[2]
      const tiebreakValue = match[3] || ''
      const winnerSide = getWinnerSideByScore(leftScore, rightScore)

      return {
        index,
        leftScore,
        rightScore,
        winnerSide,
        display: formatSetScoreDisplay({
          leftScore,
          rightScore,
          leftTiebreak: tiebreakValue,
          rightTiebreak: tiebreakValue,
          winnerSide,
        }),
      }
    })
    .filter((entry) => hasScoreValue(entry.leftScore) && hasScoreValue(entry.rightScore))
}

function countSetWins(setScores) {
  return (Array.isArray(setScores) ? setScores : []).reduce((counts, setScore) => {
    const winnerSide = setScore?.winnerSide || getWinnerSideByScore(setScore?.leftScore, setScore?.rightScore)

    if (winnerSide === 'left') {
      counts.left += 1
    } else if (winnerSide === 'right') {
      counts.right += 1
    }

    return counts
  }, {
    left: 0,
    right: 0,
  })
}

function deriveAggregateScoreFromSetScores(setScores) {
  const counts = countSetWins(setScores)

  if (counts.left === 0 && counts.right === 0) {
    return null
  }

  return {
    leftScore: String(counts.left),
    rightScore: String(counts.right),
    winnerSide: getWinnerSideByScore(counts.left, counts.right),
  }
}

function buildSetScoreText(setScores) {
  return (Array.isArray(setScores) ? setScores : [])
    .map((setScore) => normalizeScoreTextValue(setScore?.display) || formatSetScoreDisplay(setScore))
    .filter(Boolean)
    .join(', ')
}

function extractEspnSetScores(leftCompetitor, rightCompetitor) {
  const leftLinescores = Array.isArray(leftCompetitor?.linescores) ? leftCompetitor.linescores : []
  const rightLinescores = Array.isArray(rightCompetitor?.linescores) ? rightCompetitor.linescores : []
  const setCount = Math.max(leftLinescores.length, rightLinescores.length)

  return Array.from({ length: setCount }, (_, index) => {
    const leftSet = leftLinescores[index] || {}
    const rightSet = rightLinescores[index] || {}
    const leftScore = normalizeScoreTextValue(leftSet?.value ?? leftSet?.score ?? leftSet?.displayValue)
    const rightScore = normalizeScoreTextValue(rightSet?.value ?? rightSet?.score ?? rightSet?.displayValue)

    if (!leftScore && !rightScore) return null

    const winnerSide = leftSet?.winner === true
      ? 'left'
      : rightSet?.winner === true
        ? 'right'
        : getWinnerSideByScore(leftScore, rightScore)

    const leftTiebreak = normalizeScoreTextValue(leftSet?.tiebreak ?? leftSet?.tiebreakScore ?? leftSet?.tiebreak_value)
    const rightTiebreak = normalizeScoreTextValue(rightSet?.tiebreak ?? rightSet?.tiebreakScore ?? rightSet?.tiebreak_value)

    return {
      index,
      leftScore,
      rightScore,
      winnerSide,
      display: formatSetScoreDisplay({
        leftScore,
        rightScore,
        leftTiebreak,
        rightTiebreak,
        winnerSide,
      }),
    }
  }).filter(Boolean)
}

function toEpoch(dateValue) {
  const parsed = Date.parse(dateValue || '')
  return Number.isNaN(parsed) ? 0 : parsed
}

function toDateLabel(dateValue) {
  if (!dateValue) return ''

  const parsed = Date.parse(dateValue)
  if (Number.isNaN(parsed)) return ''

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(parsed)
}

function toStatusLabel(rawStatus, fallbackLabel = 'Scheduled') {
  if (!rawStatus) return fallbackLabel

  return String(rawStatus)
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function hasWtaMarker(rawText) {
  const normalized = String(rawText || '').toLowerCase()
  return /\bwta\b|\bwomen\b|\bwomens\b|\bfemale\b/.test(normalized)
}

function hasChallengerMarker(rawText) {
  const normalized = String(rawText || '').toLowerCase()
  return /\bchallenger\b/.test(normalized)
}

function clampLimit(limit) {
  return Number.isFinite(limit) && limit > 0
    ? Math.floor(limit)
    : DEFAULT_ATP_MATCH_LIMIT
}

function hasScoreValue(score) {
  const normalizedScore = String(score ?? '').trim()
  return normalizedScore !== '' && normalizedScore !== '-'
}

function hasFullMatchScore(match) {
  return hasScoreValue(match?.leftScore) && hasScoreValue(match?.rightScore)
}

function getRecentDetailScore(matches) {
  return matches.slice(0, RECENT_MATCH_DETAIL_WINDOW).length
}

function keepLatestThenCompleted(matches, limit) {
  const sortedByDate = [...matches]
    .sort((a, b) => a.sortEpoch - b.sortEpoch)
    .reverse()

  const scoredMatches = sortedByDate.filter((match) => hasFullMatchScore(match))
  const orderedMatches = [...scoredMatches].sort((left, right) => {
    if (left.isCompleted !== right.isCompleted) {
      return left.isCompleted ? -1 : 1
    }

    return right.sortEpoch - left.sortEpoch
  })

  function stripInternalFields(match) {
    const sanitizedMatch = { ...match }
    delete sanitizedMatch.sortEpoch
    delete sanitizedMatch.isCompleted
    delete sanitizedMatch.atpHint
    delete sanitizedMatch.competitionGender
    delete sanitizedMatch.tourCode
    return sanitizedMatch
  }

  return orderedMatches
    .slice(0, clampLimit(limit))
    .map((match) => stripInternalFields(match))
}

function mapEspnCompetitionToTickerItem(competition, tournamentName) {
  const competitors = [...(competition?.competitors || [])]
    .sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0))

  const leftCompetitor = competitors[0] || null
  const rightCompetitor = competitors[1] || null
  const { tournamentName: normalizedTournamentName, categoryLabel } = splitTournamentAndCategoryLabel(tournamentName)
  const setScores = competitors.length >= 2
    ? (leftCompetitor?.linescores || rightCompetitor?.linescores)
      ? extractEspnSetScores(leftCompetitor, rightCompetitor)
      : []
    : []
  const aggregateScore = deriveAggregateScoreFromSetScores(setScores)
  const leftScore = normalizeScoreTextValue(getCompetitorScore(leftCompetitor)) || aggregateScore?.leftScore || '-'
  const rightScore = normalizeScoreTextValue(getCompetitorScore(rightCompetitor)) || aggregateScore?.rightScore || '-'
  const winnerSide = leftCompetitor?.winner
    ? 'left'
    : rightCompetitor?.winner
      ? 'right'
      : aggregateScore?.winnerSide || ''

  return {
    id: competition?.id || competition?.uid || `${tournamentName}-${competition?.date || 'match'}`,
    tournamentName: normalizeTitleLabel(normalizedTournamentName || tournamentName),
    categoryLabel,
    roundLabel: normalizeRoundLabel(competition?.round?.displayName || competition?.type?.text || competition?.type?.abbreviation || ''),
    statusLabel: toStatusLabel(
      competition?.status?.type?.shortDetail
        || competition?.status?.type?.description
        || 'Scheduled',
    ),
    dateLabel: toDateLabel(competition?.date),
    leftName: getCompetitorName(leftCompetitor),
    rightName: getCompetitorName(rightCompetitor),
    leftScore,
    rightScore,
    setScores,
    setScoreText: buildSetScoreText(setScores),
    winnerSide,
    sortEpoch: toEpoch(competition?.date),
    isCompleted: Boolean(competition?.status?.type?.completed),
  }
}

export function parseEspnAtpMatches(payload, { limit = DEFAULT_ATP_MATCH_LIMIT } = {}) {
  const groupedCompetitions = (payload?.events || []).flatMap((event) => (
    (event?.groupings || []).flatMap((group) => (
      (group?.competitions || []).map((competition) => ({
        competition,
        tournamentName: event?.shortName || event?.name || 'ATP Tour',
      }))
    ))
  ))

  const eligibleCompetitions = groupedCompetitions.filter(({ competition, tournamentName }) => {
    const descriptor = [
      tournamentName,
      competition?.type?.slug,
      competition?.type?.text,
      competition?.type?.abbreviation,
    ].filter(Boolean).join(' ')

    return isAtpFamilyDescriptor(descriptor)
  })

  const mappedMatches = eligibleCompetitions.map(({ competition, tournamentName }) => (
    mapEspnCompetitionToTickerItem(competition, tournamentName)
  ))

  return keepLatestThenCompleted(mappedMatches, limit)
}

function getSportsradarCompetitorName(competitor) {
  return competitor?.name
    || competitor?.full_name
    || competitor?.abbreviation
    || 'TBD'
}

function getSportsradarCompetitors(summary) {
  const sportEvent = summary?.sport_event || summary?.event || {}
  const competitors = [...(sportEvent?.competitors || summary?.competitors || [])]

  if (competitors.length <= 1) return competitors

  const homeCompetitor = competitors.find((competitor) => competitor?.qualifier === 'home')
  const awayCompetitor = competitors.find((competitor) => competitor?.qualifier === 'away')

  if (homeCompetitor || awayCompetitor) {
    return [homeCompetitor, awayCompetitor].filter(Boolean)
  }

  return competitors
}

function getSportsradarScore(status, competitor, side) {
  const statusKeys = side === 'left'
    ? ['home_score', 'competitor1_score', 'score1']
    : ['away_score', 'competitor2_score', 'score2']

  for (const key of statusKeys) {
    const score = status?.[key]
    if (score !== undefined && score !== null && score !== '') {
      return String(score)
    }
  }

  const periodScores = status?.period_scores || []
  if (periodScores.length > 0) {
    const latestPeriod = periodScores[periodScores.length - 1]
    const periodKeys = side === 'left'
      ? ['home_score', 'competitor1_score']
      : ['away_score', 'competitor2_score']

    for (const key of periodKeys) {
      const score = latestPeriod?.[key]
      if (score !== undefined && score !== null && score !== '') {
        return String(score)
      }
    }
  }

  return getCompetitorScore(competitor)
}

function extractSportsradarSetScores(status) {
  const periodScores = Array.isArray(status?.period_scores) ? status.period_scores : []

  return periodScores
    .map((periodScore, index) => {
      const leftScore = normalizeScoreTextValue(
        periodScore?.home_score
        ?? periodScore?.competitor1_score
        ?? periodScore?.score1
        ?? periodScore?.home
        ?? periodScore?.competitor1,
      )
      const rightScore = normalizeScoreTextValue(
        periodScore?.away_score
        ?? periodScore?.competitor2_score
        ?? periodScore?.score2
        ?? periodScore?.away
        ?? periodScore?.competitor2,
      )

      if (!leftScore && !rightScore) return null

      const leftTiebreak = normalizeScoreTextValue(
        periodScore?.home_tiebreak_score
        ?? periodScore?.competitor1_tiebreak_score
        ?? periodScore?.home_tiebreak
        ?? periodScore?.competitor1_tiebreak,
      )
      const rightTiebreak = normalizeScoreTextValue(
        periodScore?.away_tiebreak_score
        ?? periodScore?.competitor2_tiebreak_score
        ?? periodScore?.away_tiebreak
        ?? periodScore?.competitor2_tiebreak,
      )

      const winnerSide = periodScore?.winner === 'home'
        ? 'left'
        : periodScore?.winner === 'away'
          ? 'right'
          : getWinnerSideByScore(leftScore, rightScore)

      return {
        index,
        leftScore,
        rightScore,
        winnerSide,
        display: formatSetScoreDisplay({
          leftScore,
          rightScore,
          leftTiebreak,
          rightTiebreak,
          winnerSide,
        }),
      }
    })
    .filter(Boolean)
}

function isSportsradarCompletedStatus(status) {
  const normalizedStatus = String(status?.status || '').toLowerCase()
  const normalizedMatchStatus = String(status?.match_status || '').toLowerCase()

  return normalizedStatus === 'closed'
    || normalizedStatus === 'ended'
    || normalizedStatus === 'finished'
    || normalizedStatus === 'complete'
    || normalizedStatus === 'completed'
    || normalizedMatchStatus.includes('ended')
    || normalizedMatchStatus.includes('finished')
    || normalizedMatchStatus.includes('final')
}

function mapSportsradarSummaryToTickerItem(summary) {
  const sportEvent = summary?.sport_event || summary?.event || {}
  const context = sportEvent?.sport_event_context || sportEvent?.context || {}
  const competition = context?.competition || sportEvent?.competition || {}
  const round = context?.round || sportEvent?.round || {}
  const category = context?.category || {}
  const status = summary?.sport_event_status || summary?.status || {}

  const competitors = getSportsradarCompetitors(summary)
  const leftCompetitor = competitors[0] || null
  const rightCompetitor = competitors[1] || null
  const winnerId = status?.winner_id || sportEvent?.winner_id || ''
  const rawTournamentName = competition?.name || category?.name || 'ATP Tour'
  const { tournamentName: normalizedTournamentName, categoryLabel: parsedCategoryLabel } = splitTournamentAndCategoryLabel(rawTournamentName)
  const categoryLabel = normalizeCategoryLabel(category?.name) || parsedCategoryLabel
  const setScores = extractSportsradarSetScores(status)
  const aggregateScore = deriveAggregateScoreFromSetScores(setScores)

  const winnerSide = winnerId
    ? leftCompetitor?.id === winnerId
      ? 'left'
      : rightCompetitor?.id === winnerId
        ? 'right'
        : ''
    : aggregateScore?.winnerSide || ''

  const startTime = sportEvent?.start_time || summary?.scheduled || ''
  const roundLabel = normalizeRoundLabel(round?.name || round?.type || (
    round?.number ? `Round ${round.number}` : ''
  ))
  const competitionGender = String(competition?.gender || '').trim().toLowerCase()
  const atpHint = `${normalizedTournamentName || rawTournamentName} ${categoryLabel || ''} ${roundLabel || ''} ${competitionGender || ''}`

  return {
    id: sportEvent?.id || summary?.id || `${competition?.name || 'atp'}-${startTime || 'match'}`,
    tournamentName: normalizeTitleLabel(normalizedTournamentName || rawTournamentName),
    categoryLabel,
    roundLabel,
    statusLabel: toStatusLabel(status?.match_status || status?.status),
    dateLabel: toDateLabel(startTime),
    leftName: getSportsradarCompetitorName(leftCompetitor),
    rightName: getSportsradarCompetitorName(rightCompetitor),
    leftScore: normalizeScoreTextValue(getSportsradarScore(status, leftCompetitor, 'left')) || aggregateScore?.leftScore || '-',
    rightScore: normalizeScoreTextValue(getSportsradarScore(status, rightCompetitor, 'right')) || aggregateScore?.rightScore || '-',
    setScores,
    setScoreText: buildSetScoreText(setScores),
    winnerSide,
    sortEpoch: toEpoch(startTime),
    isCompleted: isSportsradarCompletedStatus(status),
    competitionGender,
    atpHint,
  }
}

function isSportsradarAtpMatch(match) {
  const hintText = String(match?.atpHint || '').toLowerCase()
  const gender = String(match?.competitionGender || '').toLowerCase()

  if (hasWtaMarker(hintText)) return false

  if (gender && gender !== 'men') return false

  return isAtpFamilyDescriptor(`${hintText} ${gender}`)
}

export function parseSportsradarAtpMatches(payload, { limit = DEFAULT_ATP_MATCH_LIMIT } = {}) {
  const summaries = payload?.summaries || payload?.results || []
  const mappedMatches = summaries
    .map((summary) => mapSportsradarSummaryToTickerItem(summary))
    .filter(Boolean)

  const atpMatches = mappedMatches.filter((match) => isSportsradarAtpMatch(match))

  return keepLatestThenCompleted(atpMatches, limit)
}

function parseScorePairFromText(rawText) {
  const text = String(rawText || '').trim()
  if (!text) return null

  const directPair = text.match(/(\d+)\s*[-:]\s*(\d+)/)
  if (!directPair) return null

  return {
    leftScore: directPair[1],
    rightScore: directPair[2],
  }
}

function extractApiTennisSetScores(fixture) {
  const textCandidates = [
    fixture?.event_final_result,
    fixture?.event_result,
    fixture?.event_game_result,
    fixture?.event_status,
  ]

  for (const candidate of textCandidates) {
    const setScores = extractSetScoresFromText(candidate)
    if (setScores.length > 0) {
      return setScores
    }
  }

  const scorePair = parseScorePairFromText(
    fixture?.event_final_result
    || fixture?.event_result
    || fixture?.event_game_result
    || fixture?.event_status,
  )

  if (!scorePair) {
    return []
  }

  return [{
    index: 0,
    leftScore: scorePair.leftScore,
    rightScore: scorePair.rightScore,
    winnerSide: getWinnerSideByScore(scorePair.leftScore, scorePair.rightScore),
    display: formatSetScoreDisplay(scorePair),
  }]
}

function normalizeApiTennisName(rawName) {
  const normalizedName = String(rawName || '').trim()
  return normalizedName || 'TBD'
}

function getWinnerSideByScore(leftScore, rightScore) {
  const leftValue = Number.parseInt(leftScore, 10)
  const rightValue = Number.parseInt(rightScore, 10)

  if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue) || leftValue === rightValue) {
    return ''
  }

  return leftValue > rightValue ? 'left' : 'right'
}

function buildApiTennisDateTime(rawDate, rawTime) {
  const dateText = String(rawDate || '').trim()
  const timeText = String(rawTime || '').trim()

  if (!dateText) return ''
  if (dateText.includes('T')) return dateText

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateText)) {
    const [day, month, year] = dateText.split('/')
    const safeTime = /^\d{2}:\d{2}/.test(timeText) ? `${timeText}:00` : '00:00:00'
    return `${year}-${month}-${day}T${safeTime}Z`
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    const safeTime = /^\d{2}:\d{2}/.test(timeText) ? `${timeText}:00` : '00:00:00'
    return `${dateText}T${safeTime}Z`
  }

  return dateText
}

function isCompletedLikeStatus(statusText) {
  const normalized = String(statusText || '').trim().toLowerCase()
  if (!normalized) return false

  return normalized.includes('final')
    || normalized.includes('finished')
    || normalized.includes('ended')
    || normalized.includes('closed')
    || normalized.includes('complete')
    || normalized === 'ft'
}

function mapApiTennisClassicFixtureToTickerItem(fixture) {
  const startTime = buildApiTennisDateTime(fixture?.event_date, fixture?.event_time)
  const rawTournamentName = fixture?.tournament_name
    || fixture?.league_name
    || fixture?.event_tournament
    || 'ATP Tour'
  const { tournamentName: normalizedTournamentName, categoryLabel: parsedCategoryLabel } = splitTournamentAndCategoryLabel(rawTournamentName)
  const categoryLabel = normalizeCategoryLabel(fixture?.event_category || fixture?.event_type_type) || parsedCategoryLabel
  const setScores = extractApiTennisSetScores(fixture)
  const aggregateScore = setScores.length > 1 ? deriveAggregateScoreFromSetScores(setScores) : null
  const explicitLeftScore = normalizeScoreTextValue(fixture?.first_player_score ?? fixture?.event_first_player_result)
  const explicitRightScore = normalizeScoreTextValue(fixture?.second_player_score ?? fixture?.event_second_player_result)
  const fallbackScorePair = parseScorePairFromText(
    fixture?.event_final_result
    || fixture?.event_result
    || fixture?.event_game_result
    || fixture?.event_status,
  )

  const leftScore = explicitLeftScore
    || aggregateScore?.leftScore
    || (setScores.length <= 1 ? normalizeScoreTextValue(fallbackScorePair?.leftScore) : '')
    || '-'

  const rightScore = explicitRightScore
    || aggregateScore?.rightScore
    || (setScores.length <= 1 ? normalizeScoreTextValue(fallbackScorePair?.rightScore) : '')
    || '-'

  const winnerSide = getWinnerSideByScore(leftScore, rightScore) || aggregateScore?.winnerSide || ''
  const statusLabel = toStatusLabel(fixture?.event_status || fixture?.event_live || fixture?.status)
  const atpHint = [
    normalizedTournamentName || rawTournamentName,
    categoryLabel,
    fixture?.event_type_type,
    fixture?.event_round,
    fixture?.event_category,
  ].filter(Boolean).join(' ')

  return {
    id: fixture?.event_key
      || fixture?.event_id
      || `${rawTournamentName}-${startTime || fixture?.event_date || 'match'}`,
    tournamentName: normalizeTitleLabel(normalizedTournamentName || rawTournamentName),
    categoryLabel,
    roundLabel: normalizeRoundLabel(fixture?.event_round || fixture?.round || ''),
    statusLabel,
    dateLabel: toDateLabel(startTime),
    leftName: normalizeApiTennisName(fixture?.event_first_player || fixture?.first_player),
    rightName: normalizeApiTennisName(fixture?.event_second_player || fixture?.second_player),
    leftScore,
    rightScore,
    setScores,
    setScoreText: buildSetScoreText(setScores),
    winnerSide,
    sortEpoch: toEpoch(startTime),
    isCompleted: isCompletedLikeStatus(statusLabel),
    atpHint,
    tourCode: String(fixture?.event_tour || fixture?.tour || '').trim().toLowerCase(),
  }
}

function pickApiSportsPlayers(fixture) {
  if (Array.isArray(fixture?.players) && fixture.players.length >= 2) {
    return fixture.players
  }

  if (fixture?.players?.home && fixture?.players?.away) {
    return [fixture.players.home, fixture.players.away]
  }

  if (Array.isArray(fixture?.competitors) && fixture.competitors.length >= 2) {
    return fixture.competitors
  }

  return []
}

function getApiSportsSideScore(rawScores, side) {
  const scoreKeys = side === 'left'
    ? ['home', 'player_1', 'first', 'left', 'team1']
    : ['away', 'player_2', 'second', 'right', 'team2']

  if (rawScores && typeof rawScores === 'object' && !Array.isArray(rawScores)) {
    for (const key of scoreKeys) {
      const score = rawScores[key]
      if (score !== undefined && score !== null && score !== '') {
        return String(score)
      }
    }
  }

  if (Array.isArray(rawScores) && rawScores.length >= 2) {
    const score = side === 'left' ? rawScores[0] : rawScores[1]
    if (score !== undefined && score !== null && score !== '') {
      return String(score)
    }
  }

  return '-'
}

function mapApiSportsFixtureToTickerItem(fixture) {
  const players = pickApiSportsPlayers(fixture)
  const leftPlayer = players[0] || null
  const rightPlayer = players[1] || null
  const statusLabel = toStatusLabel(fixture?.status?.long || fixture?.status?.short || fixture?.status)
  const rawTournamentName = fixture?.league?.name
    || fixture?.tournament?.name
    || fixture?.competition?.name
    || 'ATP Tour'
  const { tournamentName: normalizedTournamentName, categoryLabel: parsedCategoryLabel } = splitTournamentAndCategoryLabel(rawTournamentName)
  const categoryLabel = normalizeCategoryLabel(fixture?.league?.type || fixture?.competition?.type) || parsedCategoryLabel
  const rawScores = fixture?.scores || fixture?.score || fixture?.result
  const leftScore = getApiSportsSideScore(rawScores, 'left')
  const rightScore = getApiSportsSideScore(rawScores, 'right')

  return {
    id: fixture?.id || fixture?.fixture?.id || `${rawTournamentName}-${fixture?.date || 'match'}`,
    tournamentName: normalizeTitleLabel(normalizedTournamentName || rawTournamentName),
    categoryLabel,
    roundLabel: normalizeRoundLabel(fixture?.round || fixture?.fixture?.round || ''),
    statusLabel,
    dateLabel: toDateLabel(fixture?.date),
    leftName: normalizeApiTennisName(leftPlayer?.name || leftPlayer?.player?.name),
    rightName: normalizeApiTennisName(rightPlayer?.name || rightPlayer?.player?.name),
    leftScore,
    rightScore,
    winnerSide: leftPlayer?.winner
      ? 'left'
      : rightPlayer?.winner
        ? 'right'
        : getWinnerSideByScore(leftScore, rightScore),
    sortEpoch: toEpoch(fixture?.date || fixture?.fixture?.date),
    isCompleted: Boolean(fixture?.status?.finished) || isCompletedLikeStatus(statusLabel),
    atpHint: [
      normalizedTournamentName || rawTournamentName,
      categoryLabel,
      fixture?.league?.type,
      fixture?.round,
    ].filter(Boolean).join(' '),
    tourCode: String(fixture?.tour || fixture?.league?.name || '').trim().toLowerCase(),
  }
}

function isApiTennisAtpMatch(match) {
  const hintText = String(match?.atpHint || '').toLowerCase()
  const tourCode = String(match?.tourCode || '').toLowerCase()

  if (hasWtaMarker(hintText) || hasWtaMarker(tourCode)) return false

  return isAtpFamilyDescriptor(`${hintText} ${tourCode}`)
}

export function parseApiTennisAtpMatches(payload, { limit = DEFAULT_ATP_MATCH_LIMIT } = {}) {
  const fixtures = Array.isArray(payload?.result)
    ? payload.result
    : Array.isArray(payload?.response)
      ? payload.response
      : Array.isArray(payload?.fixtures)
        ? payload.fixtures
        : []

  const mappedMatches = fixtures.map((fixture) => {
    if (fixture?.event_first_player || fixture?.event_second_player) {
      return mapApiTennisClassicFixtureToTickerItem(fixture)
    }

    return mapApiSportsFixtureToTickerItem(fixture)
  })

  const atpMatches = mappedMatches.filter((match) => isApiTennisAtpMatch(match))
  return keepLatestThenCompleted(atpMatches, limit)
}

function resolveAtpProvider() {
  const rawProvider = String(import.meta.env.VITE_ATP_PROVIDER || DEFAULT_ATP_PROVIDER)
    .trim()
    .toLowerCase()

  if (rawProvider === 'sportsradar' || rawProvider === 'apitennis' || rawProvider === 'espn') {
    return rawProvider
  }

  return DEFAULT_ATP_PROVIDER
}

function resolveApiTennisProxyUrl() {
  const rawUrl = String(import.meta.env.VITE_API_TENNIS_PROXY_URL || API_TENNIS_PROXY_URL)
    .trim()

  return rawUrl || API_TENNIS_PROXY_URL
}

function resolveSportsradarProxyUrl() {
  const rawUrl = String(import.meta.env.VITE_SPORTRADAR_PROXY_URL || SPORTRADAR_ATP_PROXY_URL)
    .trim()

  return rawUrl || SPORTRADAR_ATP_PROXY_URL
}

async function requestJson(url, { signal } = {}) {
  const response = await fetch(url, {
    signal,
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Failed request ${url} with status ${response.status}`)
  }

  return response.json()
}

export async function fetchAtpMatches({ signal } = {}) {
  const provider = resolveAtpProvider()

  if (provider === 'sportsradar') {
    const sportsradarPayload = await requestJson(resolveSportsradarProxyUrl(), { signal })
    return parseSportsradarAtpMatches(sportsradarPayload)
  }

  if (provider === 'apitennis') {
    const apiTennisPayload = await requestJson(resolveApiTennisProxyUrl(), { signal })
    return parseApiTennisAtpMatches(apiTennisPayload)
  }

  if (provider === 'espn') {
    const espnPayload = await requestJson(ESPN_ATP_SCOREBOARD_URL, { signal })
    return parseEspnAtpMatches(espnPayload)
  }

  let sportsradarError = null
  let apiTennisError = null
  let espnError = null
  let sportsradarMatches = []
  let apiTennisMatches = []
  let espnMatches = []

  try {
    const sportsradarPayload = await requestJson(resolveSportsradarProxyUrl(), { signal })
    sportsradarMatches = parseSportsradarAtpMatches(sportsradarPayload)
  } catch (error) {
    sportsradarError = error
  }

  try {
    const apiTennisPayload = await requestJson(resolveApiTennisProxyUrl(), { signal })
    apiTennisMatches = parseApiTennisAtpMatches(apiTennisPayload)
  } catch (error) {
    apiTennisError = error
  }

  try {
    const espnPayload = await requestJson(ESPN_ATP_SCOREBOARD_URL, { signal })
    espnMatches = parseEspnAtpMatches(espnPayload)
  } catch (error) {
    espnError = error
  }

  const rankedResults = [
    {
      providerName: 'sportsradar',
      providerPriority: 3,
      detailScore: getRecentDetailScore(sportsradarMatches),
      matches: sportsradarMatches,
    },
    {
      providerName: 'apitennis',
      providerPriority: 2,
      detailScore: getRecentDetailScore(apiTennisMatches),
      matches: apiTennisMatches,
    },
    {
      providerName: 'espn',
      providerPriority: 1,
      detailScore: getRecentDetailScore(espnMatches),
      matches: espnMatches,
    },
  ]
    .filter((result) => result.matches.length > 0)
    .sort((left, right) => {
      if (right.detailScore !== left.detailScore) {
        return right.detailScore - left.detailScore
      }

      return right.providerPriority - left.providerPriority
    })

  if (rankedResults.length > 0) {
    return rankedResults[0].matches
  }

  if (sportsradarError && apiTennisError && espnError) {
    throw new Error('Sportsradar, API-Tennis, and ESPN ATP feeds are unavailable.')
  }

  return []
}

export function parseAtpMatches(payload, options = {}) {
  return parseEspnAtpMatches(payload, options)
}