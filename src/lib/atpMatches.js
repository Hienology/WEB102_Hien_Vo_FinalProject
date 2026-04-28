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

function getMatchEpoch(match) {
  const epoch = Number(match?.sortEpoch)
  return Number.isFinite(epoch) ? epoch : 0
}

function isScheduledLikeStatus(statusText) {
  const normalized = String(statusText || '').trim().toLowerCase()
  if (!normalized) return false

  return normalized.includes('scheduled')
    || normalized.includes('not started')
    || normalized.includes('to be decided')
    || normalized.includes('tbd')
    || /\b\d{1,2}\/\d{1,2}\b/.test(normalized)
    || /\b(am|pm)\b/.test(normalized)
}

function isLiveLikeStatus(statusText) {
  const normalized = String(statusText || '').trim().toLowerCase()
  if (!normalized || isCompletedLikeStatus(normalized) || isScheduledLikeStatus(normalized)) {
    return false
  }

  return normalized.includes('live')
    || normalized.includes('in progress')
    || normalized.includes('playing')
    || normalized.includes('set')
    || normalized.includes('serving')
    || normalized.includes('break')
    || normalized.includes('retired')
    || normalized.includes('walkover')
    || normalized.includes('suspended')
    || normalized.includes('delayed')
}

function createLocalDateWindow({ daysBack = 2, daysForward = 7, referenceTime = Date.now() } = {}) {
  const now = new Date(referenceTime)
  const earliestTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysBack).getTime()
  const latestTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysForward + 1).getTime() - 1

  return {
    earliestTime,
    latestTime,
  }
}

function normalizeMatchIdentityPart(rawText) {
  return String(rawText || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function buildMatchIdentityKey(match) {
  const epoch = getMatchEpoch(match)
  const epochBucket = epoch > 0 ? Math.round(epoch / (30 * 60 * 1000)) : 0
  const playerTokens = [
    normalizeMatchIdentityPart(match?.leftName),
    normalizeMatchIdentityPart(match?.rightName),
  ].sort()

  return [
    normalizeMatchIdentityPart(match?.tournamentName),
    normalizeMatchIdentityPart(match?.roundLabel),
    ...playerTokens,
    epochBucket,
  ].join('|')
}

function getMatchQualityScore(match, providerPriority = 0) {
  let score = providerPriority * 2

  if (hasFullMatchScore(match)) {
    score += 40
  } else if (hasScoreValue(match?.leftScore) || hasScoreValue(match?.rightScore)) {
    score += 12
  }

  score += Math.min((match?.setScores || []).length, 5) * 6

  if (match?.winnerSide) score += 4
  if (match?.leftName && match.leftName !== 'TBD') score += 2
  if (match?.rightName && match.rightName !== 'TBD') score += 2
  if (match?.roundLabel) score += 2
  if (match?.categoryLabel) score += 2
  if (match?.tournamentName) score += 2
  if (isLiveLikeStatus(match?.statusLabel)) score += 3
  if (match?.isCompleted) score += 1

  return score
}

function mergeProviderMatches(results) {
  const mergedMatchesByKey = new Map()

  results.forEach((result) => {
    result.matches.forEach((match) => {
      const key = buildMatchIdentityKey(match)
      const candidate = {
        ...match,
        providerName: match?.providerName || result.providerName,
        providerPriority: result.providerPriority,
      }
      const current = mergedMatchesByKey.get(key)

      if (!current) {
        mergedMatchesByKey.set(key, candidate)
        return
      }

      const candidateQuality = getMatchQualityScore(candidate, candidate.providerPriority)
      const currentQuality = getMatchQualityScore(current, current.providerPriority)

      if (candidateQuality > currentQuality) {
        mergedMatchesByKey.set(key, candidate)
        return
      }

      if (candidateQuality === currentQuality && getMatchEpoch(candidate) > getMatchEpoch(current)) {
        mergedMatchesByKey.set(key, candidate)
      }
    })
  })

  return [...mergedMatchesByKey.values()].map(({ providerPriority, ...match }) => match)
}

function getMatchDisplayBucket(match, referenceTime = Date.now()) {
  if (isLiveLikeStatus(match?.statusLabel)) return 0

  if (!match?.isCompleted) {
    return getMatchEpoch(match) >= referenceTime ? 1 : 2
  }

  return 3
}

function orderMatchesForTicker(matches, { referenceTime = Date.now() } = {}) {
  return [...matches].sort((left, right) => {
    const leftBucket = getMatchDisplayBucket(left, referenceTime)
    const rightBucket = getMatchDisplayBucket(right, referenceTime)

    if (leftBucket !== rightBucket) {
      return leftBucket - rightBucket
    }

    const leftEpoch = getMatchEpoch(left)
    const rightEpoch = getMatchEpoch(right)

    if (leftBucket === 3) {
      if (rightEpoch !== leftEpoch) {
        return rightEpoch - leftEpoch
      }
    } else if (leftEpoch !== rightEpoch) {
      return leftEpoch - rightEpoch
    }

    return String(left?.tournamentName || '').localeCompare(String(right?.tournamentName || ''))
      || String(left?.leftName || '').localeCompare(String(right?.leftName || ''))
      || String(left?.rightName || '').localeCompare(String(right?.rightName || ''))
  })
}

function keepLatestThenCompleted(matches, limit) {
  const sortedByDate = [...matches]
    .sort((a, b) => a.sortEpoch - b.sortEpoch)
    .reverse()

  const orderedMatches = [...sortedByDate].sort((left, right) => {
    if (left.isCompleted !== right.isCompleted) {
      return left.isCompleted ? -1 : 1
    }

    const leftHasScore = hasFullMatchScore(left)
    const rightHasScore = hasFullMatchScore(right)
    if (leftHasScore !== rightHasScore) {
      return leftHasScore ? -1 : 1
    }

    return right.sortEpoch - left.sortEpoch
  })

  return orderedMatches
    .slice(0, clampLimit(limit))
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
  const groupedCompetitions = (payload?.events || []).flatMap((event) => {
    const groupedFromGroupings = (event?.groupings || []).flatMap((group) => (
      (group?.competitions || []).map((competition) => ({
        competition,
        tournamentName: event?.shortName || event?.name || 'ATP Tour',
      }))
    ))

    if (groupedFromGroupings.length > 0) {
      return groupedFromGroupings
    }

    return (event?.competitions || []).map((competition) => ({
      competition,
      tournamentName: event?.shortName || event?.name || 'ATP Tour',
    }))
  })

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
    const score = status?.key]
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
      const score = latestPeriod?.key]
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
    winnerSide