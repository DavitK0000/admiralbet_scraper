export interface Sport {
  id: string;
  name: string;
  indices: string[];
}

export interface Market {
  id: string;
  name: string;
  sportId: string;
  categoryId?: string;
  count?: number;
  type?: string;
  imgUrl?: string;
  url?: string;
  priority?: number;
}

export interface BettingOdd {
  id: string;
  name: string;
  odds: number;
  market: string;
  sport: string;
  timestamp: Date;
}

export interface Match {
  id: number;
  matchCode: number;
  home: string;
  away: string;
  kickOffTime: number;
  status: number;
  blocked: boolean;
  favourite: boolean;
}


export interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export interface MaxBetCategory {
  id: string;
  name: string;
  imgUrl: string;
  url: string;
  count: number;
  type: string;
  children: any;
  priority: any;
  sport: any;
}

export interface MaxBetApiResponse {
  systemTime: string;
  elasticTook: number;
  nodeName: any;
  categories: MaxBetCategory[];
}

export interface MaxBetMatchesResponse {
  systemTime: string;
  elasticTook: number;
  id: string;
  name: string;
  description: string | null;
  type: string;
  esMatches: Match[];
}

export const SPORTS: Sport[] = [
  {
    id: 'soccer',
    name: 'Soccer',
    indices: ['S']
  },
  {
    id: 'basketball',
    name: 'Basketball',
    indices: ['B', 'SK']
  },
  {
    id: 'tennis',
    name: 'Tennis',
    indices: ['T', 'ST']
  },
  {
    id: 'football',
    name: 'Football (American)',
    indices: ['FB', 'SFB']
  }
];

export const BASE_URL = 'https://www.maxbet.rs/restapi/offer/sr/categories/sport';
export const API_VERSION = '1.11.1.3';

// Live feed types
export interface LiveHeader {
  id: number; // K.id
  r: number; // K.r - round
  mc: number; // K.mc - matchCode
  h: string; // K.h - home team
  a: string; // K.a - away team
  lg: string; // K.lg - leagueName
  lsv: string; // K.lsv - leagueSortValue
  s: string; // K.s - sport
  sn: string; // K.sn - sportName
  ssv: string; // K.ssv - sportSortValue
  kot: number; // K.kot - kickOffTime
  ls: string; // K.ls - liveStatus
  ss: string; // K.ss - streamSource
  tv: string; // K.tv - tvChannelInfo
  liv: boolean; // K.liv - showInLive
  ann: string; // K.ann - announcement
  ltms: number; // K.ltms - ltmstmp
  lct: number; // K.lct - lastChangeTime
  bri: number; // K.bri - brMatchId
  sti: string; // K.sti - imgStreamId
  lmt: boolean; // K.lmt - hasLmt
  eid: string; // K.eid - externalId
  inf: string; // K.inf - matchInfo
  ba: boolean; // K.ba - bettingAllowed
  mte: boolean; // K.mte
  lgi: string; // K.lgi - leagueInfo
  fd: string; // K.fd - feed
  lid: number; // K.lid - leagueId
  gr: string; // K.gr - leagueGroupToken
  grl: string; // K.grl - leagueGroupTokenList
  lsh: string; // K.lsh - leagueShort
  bd: boolean; // K.bd - bonusDisabled
  tvd: string; // K.tvd - tvDurationToken
  hbm: boolean; // K.hbm - hideBetMed
  fci: string; // K.fci - feedConstructId
  spi: string; // K.spi - statsPerformId
  ifs: string; // K.ifs - inFrontStreamId
  sis: string; // K.sis - sisCompetitionId
  flag: string; // K.flag - flagId
  tm: boolean; // K.tm - topMatch
}

export interface LiveBet {
  id: number; // K.id
  bc: number; // K.bc - liveBetCode
  mId: number; // K.mId - matchLiveId
  mc: number; // K.mc - matchCode
  sv: string; // K.sv - specialValue
  st: string; // K.st - liveBetStatus
  d: boolean; // K.d - disabled
  lct: number; // K.lct - lastChangeTime
  om: { [key: string]: { ov: number; bpc: number } }; // K.om - odds map
}

export interface LiveFeedResponse {
  liveHeaders: LiveHeader[];
  liveResults: any[]; // ignored as per requirements
  liveBets: LiveBet[];
}

export interface ProcessedMatch {
  id: number;
  matchCode: number;
  home: string;
  away: string;
  league: string;
  leagueShort: string;
  sport: string;
  sportName: string;
  kickOffTime: number;
  liveStatus: string;
  streamSource?: string;
  tvChannelInfo?: string;
  isLive: boolean;
  announcement?: string;
  lastChangeTime: number;
  bettingAllowed: boolean;
  topMatch: boolean;
  externalId?: string;
  leagueId: number;
  bets: ProcessedBet;
}

export interface ProcessedBet {
  odds: ReadableOdds;
}

export interface ReadableOdds {
  [key: string]: { oddValue: number; betPickCode: number; specialValue?: string } | { [specialValue: string]: { oddValue: number; betPickCode: number } } | undefined;
  fullTimeResultHomeWin?: { oddValue: number; betPickCode: number };
  fullTimeResultDraw?: { oddValue: number; betPickCode: number };
  fullTimeResultAwayWin?: { oddValue: number; betPickCode: number };
  firstHalfResultHomeWin?: { oddValue: number; betPickCode: number };
  firstHalfResultDraw?: { oddValue: number; betPickCode: number };
  firstHalfResultAwayWin?: { oddValue: number; betPickCode: number };
  firstHalfUnderTotal?: { [specialValue: string]: { oddValue: number; betPickCode: number } };
  firstHalfOverTotal?: { [specialValue: string]: { oddValue: number; betPickCode: number } };
  fullTimeUnderTotal?: { [specialValue: string]: { oddValue: number; betPickCode: number } };
  fullTimeOverTotal?: { [specialValue: string]: { oddValue: number; betPickCode: number } };
  bothTeamsToScore?: { oddValue: number; betPickCode: number };
  oneTeamNotToScore?: { oddValue: number; betPickCode: number };
  zeroToTwoGoals?: { oddValue: number; betPickCode: number };
  oneOrTwoGoals?: { oddValue: number; betPickCode: number };
  oneToThreeGoals?: { oddValue: number; betPickCode: number };
  twoOrThreeGoals?: { oddValue: number; betPickCode: number };
  twoToFourGoals?: { oddValue: number; betPickCode: number };
  threeToFourGoals?: { oddValue: number; betPickCode: number };
  threeToFiveGoals?: { oddValue: number; betPickCode: number };
  fourToFiveGoals?: { oddValue: number; betPickCode: number };
  fourToSixGoals?: { oddValue: number; betPickCode: number };
  basketballFTOT1?: { oddValue: number; betPickCode: number };
  basketballFTOT2?: { oddValue: number; betPickCode: number };
  tennisHomeWins?: { oddValue: number; betPickCode: number };
  tennisAwayWins?: { oddValue: number; betPickCode: number };
  tennisHomeWinsFirstSet?: { oddValue: number; betPickCode: number };
  tennisAwayWinsFirstSet?: { oddValue: number; betPickCode: number };
  tennisHomeWinsSecondSet?: { oddValue: number; betPickCode: number };
  tennisAwayWinsSecondSet?: { oddValue: number; betPickCode: number };
}

export interface LiveFeedConfig {
  isRunning: boolean;
  collectionInterval: number; // in seconds (30 or 60)
  lastProcessedTime?: number;
  matches: Map<number, ProcessedMatch>;
  rawFeeds: LiveFeedResponse[];
  liveFeedUrl?: string; // URL extracted from initial streaming
  isInitialStreaming: boolean; // Whether we're in initial streaming phase
}

export interface InitialStreamingResponse {
  liveHeaders?: LiveHeader[];
  liveBets?: LiveBet[];
  endTimestamp?: number;
}

// Pre-games types
export interface PreGameMatch {
  id: number;
  matchCode: number;
  home: string;
  away: string;
  kickOffTime: number;
  status: number;
  blocked: boolean;
  favourite: boolean;
  odds: { [key: string]: number };
}

export interface PreGameLeague {
  id: string;
  name: string;
  description: string | null;
  type: string;
  esMatches: PreGameMatch[];
}

export interface PreGameLeagueResponse {
  systemTime: string;
  elasticTook: number;
  id: string;
  name: string;
  description: string | null;
  type: string;
  esMatches: PreGameMatch[];
}

export interface PreGameCategoryResponse {
  systemTime: string;
  elasticTook: number;
  nodeName: any;
  categories: MaxBetCategory[];
}

export interface ProcessedPreGameMatch {
  id: number;
  matchCode: number;
  home: string;
  away: string;
  league: string;
  sport: string;
  kickOffTime: number;
  status: number;
  blocked: boolean;
  favourite: boolean;
  bets: ProcessedBet;
}

export interface PreGameConfig {
  isRunning: boolean;
  collectionInterval: number; // in seconds (15, 30, 60)
  selectedSport: string; // S, B, T
  lastProcessedTime?: number;
  matches: Map<number, ProcessedPreGameMatch>;
  leagues: Map<string, MaxBetCategory>;
}

// AdmiralBet API types
export interface AdmiralBetEvent {
  id: number;
  name: string;
  competitionId: number;
  regionId: number;
  sportId: number;
  systemStatus: number;
  feedStatus: number;
  isInOffer: boolean;
  isPlayable: boolean;
  cashBackEnabled: boolean;
  externalEventId: string;
  mappingTypeId: number;
  eventTypeId: number;
  isTopOffer: boolean;
  code: string;
  dateTime: string;
  status: number;
  playableBetsCount: number;
  siblingStandardEventId: number | null;
  betsCount: number;
  shortName: string;
  isLive: boolean;
  competitionName: string;
  regionName: string;
  sportName: string;
  betRadarEventId: number;
  playableBetOutcomesCount: number;
  sportMatchId: number;
  isEarlyPayoutPossible: boolean;
  bets: AdmiralBetBet[];
}

export interface AdmiralBetBet {
  id: number;
  eventId: number;
  competitionId: number;
  regionId: number;
  sportId: number;
  betTypeId: number;
  betTypeName?: string;
  sbv: string | null;
  betTypeValueType: number | null;
  feedStatus: boolean;
  systemStatus: boolean;
  hierarchyType: number;
  orderNo: number;
  betOutcomes: AdmiralBetBetOutcome[];
  isFinished: boolean;
  isMostBalanced: boolean;
  isLive: boolean;
  isInOffer: boolean;
  isPlayable: boolean;
  liveMessageNumber: number | null;
  cashBackEnabled: boolean | null;
  eventType: number;
  profitMargin: number;
  outrightTranslations: any;
  externalId: string | null;
  externalSpecifiers: any;
  parentId: number | null;
  state: number;
  dateCreated: string;
  dateUpdated: string;
  dateExpired: string;
}

export interface AdmiralBetBetOutcome {
  id: number;
  betId: number;
  eventId: number;
  competitionId: number;
  regionId: number;
  sportId: number;
  isPlayable: boolean;
  isInOffer: boolean;
  betTypeId: number;
  betTypeOutcomeId: number;
  betTypeName?: string;
  name: string;
  orderNo: number;
  odd: number;
  sbv: string | null;
  specialValue?: number;
  livePlay: boolean;
  active: boolean;
  resultStatus: number;
  useParticipiantName: number;
  isLive: boolean;
  feedStatus: boolean;
  systemStatus: boolean;
  controlOdd: number | null;
  oddsCalculationType: number;
  liveMessageNumber: number | null;
  cashBackEnabled: boolean | null;
  trueOdd: number | null;
  eventType: number;
  isEarlyPayoutPossible: boolean;
  externalId: string | null;
  parentId: number | null;
  state: number;
  dateCreated: string;
  dateUpdated: string;
  dateExpired: string;
}

export interface AdmiralBetApiResponse {
  success: boolean;
  data?: AdmiralBetEvent[];
  error?: string;
}

export interface AdmiralBetBetTypeSelection {
  id: number;
  betProductPageId: number;
  sportId: number;
  regionId: number | null;
  competitionId: number | null;
  betTypeId: number;
  betTypeName: string;
  hasSBV: boolean;
  orderNumber: number;
  sBVSelectionType: number | null;
  sBVExactValue: number | null;
  tBetTypeOutcomeSelections: AdmiralBetBetTypeOutcomeSelection[];
  templateId: number;
}

export interface AdmiralBetBetTypeOutcomeSelection {
  tBetTypeSelectionId: number;
  betTypeId: number;
  betTypeOutcomeId: number;
  includedInSelection: boolean;
  visibilityTypeId: number;
  betTypeOutcomeName?: string;
  specialValue?: number;
}

// Football-specific bet type interfaces
export interface FootballBetTypes {
  konacanIshod: {
    betTypeId: number | null;
    outcomeIds: number[];
  };
  firstHalf1X2: {
    betTypeId: number | null;
    outcomeIds: number[];
  };
  brojGolova: {
    betTypeId: number | null;
    outcomes: Array<{
      outcomeId: number;
      name: string;
      specialValue?: number;
    }>;
  };
  obaTimaDajuGol: {
    betTypeId: number | null;
    outcomeIds: number[];
  };
  firstHalfUkupnoGolova: {
    betTypeId: number | null;
    outcomes: Array<{
      outcomeId: number;
      name: string;
      specialValue?: number;
    }>;
  };
  ukupnoGolova: {
    betTypeId: number | null;
    outcomes: Array<{
      outcomeId: number;
      name: string;
      specialValue?: number;
    }>;
  };
}

// Cache Changes API Response Types
export interface CacheChangedEvent {
  bT: any[];
  id: number[]; // [eventId, sportId, regionId, competitionId, ...]
  n: number[];
  b: number[];
  t: string[];
}

export interface CacheChangedBet {
  bO: any[];
  iD: number[]; // [betId, sportId, regionId, competitionId, eventId, ...]
  n: number[];
  b: number[];
  t: string[];
}

export interface CacheChangedBetOutcome {
  id: number[]; // [outcomeId, sportId, regionId, competitionId, eventId, betId, ...]
  n: number[];
  b: number[];
  t: string[];
}

export interface CacheChangesResponse {
  cacheTime: string;
  deltaCacheNumbers: number[];
  maxDeltaCacheNumberAsString: string;
  changedEvents: CacheChangedEvent[];
  changedBets: CacheChangedBet[];
  changedBetOutcomes: CacheChangedBetOutcome[];
  changedResults: any[];
  changedEventResults: any[];
}