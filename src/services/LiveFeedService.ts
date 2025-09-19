import axios from 'axios';
import {
  ProcessedLiveFeedMatch,
  ProcessedBet,
  ReadableOdds,
  LiveFeedConfig,
  LiveFeedSport,
  LiveFeedEvent,
  LiveFeedResults,
  CacheChangesResponse,
  CacheChangedEvent,
  CacheChangedBetOutcome
} from '../types';
import { DataStorageService } from './DataStorageService';

export class LiveFeedService {
  private config: LiveFeedConfig;
  private cacheUpdateTimer?: NodeJS.Timeout;
  private dataStorageService: DataStorageService;
  private readonly ALLOWED_SPORTS = ['B', 'T', 'S']; // Basketball, Tennis, and Football (Soccer) for AdmiralBet
  private lastDeltaCacheNumber: string | null = null;

  constructor() {
    this.config = {
      isRunning: false,
      collectionInterval: 30, // 30 seconds default
      selectedSport: 'S', // Default to football
      matches: new Map(),
      leagues: new Map(),
      lastDeltaCacheNumber: null
    };

    this.dataStorageService = new DataStorageService();
    this.initializeDataStorage();
  }

  private async initializeDataStorage(): Promise<void> {
    try {
      await this.dataStorageService.initialize();
    } catch (error) {
      console.error('Failed to initialize data storage service:', error);
    }
  }

  public async startLiveFeed(collectionInterval: number = 30, sport: string = 'S'): Promise<void> {
    if (this.config.isRunning) {
      return;
    }

    // Validate sport parameter - basketball, tennis, and football allowed
    if (!['B', 'T', 'S'].includes(sport)) {
      throw new Error(`Invalid sport: ${sport}. Only basketball (B), tennis (T), and football (S) are supported for AdmiralBet`);
    }

    // Validate collection interval
    if (![1, 15, 30, 60, 120].includes(collectionInterval)) {
      throw new Error(`Invalid collection interval: ${collectionInterval}. Allowed intervals: 1, 15, 30, 60, 120 seconds`);
    }

    this.config.isRunning = true;
    this.config.collectionInterval = collectionInterval;
    this.config.selectedSport = sport;
    this.config.matches.clear();
    this.config.leagues.clear();

    const sportName = sport === 'B' ? 'basketball' : sport === 'T' ? 'tennis' : 'football';
    console.log(`Starting AdmiralBet ${sportName} live feed collection`);

    // Clear previous data from both files and Redis
    try {
      await this.dataStorageService.clearData();
    } catch (error) {
      console.error('Error clearing previous data:', error);
      // Continue anyway - don't let clearing errors stop the collection
    }

    // Run the initial collection only once, then start cache updates
    this.collectLiveFeedData();
  }

  public async stopLiveFeed(): Promise<void> {
    if (!this.config.isRunning) {
      console.log('Live feed collection is not running');
      return;
    }

    this.config.isRunning = false;

    // Clear the cache update timer
    if (this.cacheUpdateTimer) {
      clearInterval(this.cacheUpdateTimer);
      this.cacheUpdateTimer = undefined;
    }

    // Reset cache number
    this.lastDeltaCacheNumber = null;

    // Save any remaining data before stopping
    await this.saveProcessedData();
  }

  private startCacheUpdates(): void {
    // Only start if not already running
    if (this.cacheUpdateTimer) {
      return;
    }

    // Set up interval for cache updates based on collection interval
    let cacheUpdateInterval = 5000; // Default 5 seconds

    if (this.config.collectionInterval === 1) {
      cacheUpdateInterval = 1000; // 1 second for immediate collection
    } else if (this.config.collectionInterval <= 15) {
      cacheUpdateInterval = 2000; // 2 seconds for 15s collection
    } else if (this.config.collectionInterval <= 30) {
      cacheUpdateInterval = 5000; // 5 seconds for 30s collection
    } else {
      cacheUpdateInterval = 10000; // 10 seconds for 60s+ collection
    }

    this.cacheUpdateTimer = setInterval(() => {
      this.updateCacheChanges();
    }, cacheUpdateInterval);
  }

  private async collectLiveFeedData(): Promise<void> {
    try {
      const sportName = this.config.selectedSport === 'B' ? 'basketball' : this.config.selectedSport === 'T' ? 'tennis' : 'football';
      console.log(`Collecting AdmiralBet ${sportName} live feed data...`);

      // Step 1: Get live tree data
      const liveTreeData = await this.fetchLiveTreeData();

      if (liveTreeData.length === 0) {
        console.log('No live events found');
        return;
      }

      // Step 2: Extract event IDs for the selected sport
      const eventIds = this.extractEventIds(liveTreeData);

      if (eventIds.length === 0) {
        console.log(`No live events found for sport ${this.config.selectedSport}`);
        return;
      }

      console.log(`Found ${eventIds.length} live events for ${sportName}`);

      // Step 3: Get live results
      const liveResults = await this.fetchLiveResults(eventIds);

      // Step 4: Process events with live data
      await this.processLiveEvents(liveTreeData, liveResults);

      // After initial collection is completed, start cache updates
      console.log('Initial live feed data collection completed. Starting cache updates...');
      this.startCacheUpdates();

    } catch (error) {
      console.error('Error collecting live feed data:', error);
    }
  }

  private async fetchLiveTreeData(): Promise<LiveFeedSport[]> {
    try {
      const response = await axios.get<LiveFeedSport[]>(
        'https://srboffer.admiralbet.rs/api/offer/livetree/5/null/true/true/false',
        {
          timeout: 30000,
          headers: {
            'Host': 'srboffer.admiralbet.rs',
            'language': 'sr-Latn',
            'officeid': '138',
            'origin': 'https://admiralbet.rs',
            'referer': 'https://admiralbet.rs/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          }
        }
      );

      return response.data || [];
    } catch (error) {
      console.error('Error fetching live tree data:', error);
      return [];
    }
  }

  private extractEventIds(liveTreeData: LiveFeedSport[]): number[] {
    const eventIds: number[] = [];
    const sportMapping: { [key: number]: string } = { 1: 'S', 2: 'B', 3: 'T' };

    for (const sport of liveTreeData) {
      if (sportMapping[sport.id] !== this.config.selectedSport) {
        continue;
      }

      for (const region of sport.regions) {
        for (const competition of region.competitions) {
          for (const event of competition.events) {
            if (event.isLive && event.isPlayable) {
              eventIds.push(event.id);
            }
          }
        }
      }
    }

    return eventIds;
  }

  private async fetchLiveResults(eventIds: number[]): Promise<LiveFeedResults> {
    try {
      const response = await axios.post<LiveFeedResults>(
        'https://srboffer.admiralbet.rs/api/offer/GetLiveResults',
        eventIds,
        {
          timeout: 30000,
          headers: {
            'Host': 'srboffer.admiralbet.rs',
            'language': 'sr-Latn',
            'officeid': '138',
            'origin': 'https://admiralbet.rs',
            'referer': 'https://admiralbet.rs/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          }
        }
      );

      return response.data || {};
    } catch (error) {
      console.error('Error fetching live results:', error);
      return {};
    }
  }

  private async processLiveEvents(liveTreeData: LiveFeedSport[], liveResults: LiveFeedResults): Promise<void> {
    const sportMapping: { [key: number]: string } = { 1: 'S', 2: 'B', 3: 'T' };

    for (const sport of liveTreeData) {
      if (sportMapping[sport.id] !== this.config.selectedSport) {
        continue;
      }

      for (const region of sport.regions) {
        for (const competition of region.competitions) {
          for (const event of competition.events) {
            if (event.isLive && event.isPlayable) {
              await this.processLiveEvent(event, liveResults[event.id.toString()]);
            }
          }
        }
      }
    }

    // Save processed data
    await this.saveProcessedData();
  }

  private async processLiveEvent(event: LiveFeedEvent, liveResult?: any): Promise<void> {
    try {
      // Process bets from event data
      const readableOdds: ReadableOdds = {};

      for (const bet of event.bets) {
        this.processBetOutcomes(bet, readableOdds);
      }

      // Parse team names from event name (assuming format: "Team1 - Team2")
      const teamNames = event.name.split(' - ');
      const homeTeam = teamNames[0]?.trim() || 'Home Team';
      const awayTeam = teamNames[1]?.trim() || 'Away Team';

      // Create processed match
      const processedMatch: ProcessedLiveFeedMatch = {
        id: event.id,
        matchCode: event.sportMatchId,
        home: homeTeam,
        away: awayTeam,
        league: event.competitionName,
        sport: this.config.selectedSport,
        sportName: this.config.selectedSport === 'B' ? 'Basketball' : this.config.selectedSport === 'T' ? 'Tennis' : 'Football',
        kickOffTime: new Date(event.dateTime).getTime(),
        status: event.status,
        blocked: !event.isPlayable,
        favourite: event.isTopOffer,
        isLive: true,
        liveScore: liveResult?.score || '0:0',
        liveTime: liveResult?.matchTime || '0',
        liveStatus: liveResult?.status || '1p',
        bets: {
          odds: readableOdds
        }
      };

      // Store the match
      this.config.matches.set(event.id, processedMatch);

      console.log(`Processed live match: ${homeTeam} vs ${awayTeam} (${event.competitionName}) - Score: ${processedMatch.liveScore}`);

    } catch (error) {
      console.error(`Error processing live event ${event.id}:`, error);
    }
  }

  private processBetOutcomes(bet: any, readableOdds: ReadableOdds): void {
    for (const outcome of bet.betOutcomes) {
      const betTypeId = bet.betTypeId;
      const outcomeName = outcome.name;
      const specialValue = outcome.sBV;

      // Handle different bet types based on sport
      if (this.config.selectedSport === 'S') {
        // Football
        if (betTypeId === 56) { // Konacan ishod
          if (outcomeName === '1') {
            readableOdds.fullTimeResultHomeWin = {
              oddValue: outcome.odd,
              betPickCode: outcome.betTypeOutcomeId
            };
          } else if (outcomeName === 'X') {
            readableOdds.fullTimeResultDraw = {
              oddValue: outcome.odd,
              betPickCode: outcome.betTypeOutcomeId
            };
          } else if (outcomeName === '2') {
            readableOdds.fullTimeResultAwayWin = {
              oddValue: outcome.odd,
              betPickCode: outcome.betTypeOutcomeId
            };
          }
        } else if (betTypeId === 6) { // 1.pol - 1X2
          if (outcomeName === '1') {
            readableOdds.firstHalfResultHomeWin = {
              oddValue: outcome.odd,
              betPickCode: outcome.betTypeOutcomeId
            };
          } else if (outcomeName === 'X') {
            readableOdds.firstHalfResultDraw = {
              oddValue: outcome.odd,
              betPickCode: outcome.betTypeOutcomeId
            };
          } else if (outcomeName === '2') {
            readableOdds.firstHalfResultAwayWin = {
              oddValue: outcome.odd,
              betPickCode: outcome.betTypeOutcomeId
            };
          }
        } else if (betTypeId === 22) { // Ukupno golova
          if (specialValue) {
            if (outcomeName?.toLowerCase().includes('manje')) {
              if (!readableOdds.fullTimeUnderTotal) {
                readableOdds.fullTimeUnderTotal = {};
              }
              readableOdds.fullTimeUnderTotal[`FT_${specialValue}`] = {
                oddValue: outcome.odd,
                betPickCode: outcome.betTypeOutcomeId
              };
            } else if (outcomeName?.toLowerCase().includes('vise')) {
              if (!readableOdds.fullTimeOverTotal) {
                readableOdds.fullTimeOverTotal = {};
              }
              readableOdds.fullTimeOverTotal[`FT_${specialValue}`] = {
                oddValue: outcome.odd,
                betPickCode: outcome.betTypeOutcomeId
              };
            }
          }
        } else if (bet.betTypeName === '1.pol - Ukupno') { // First half total goals
          if (specialValue) {
            if (outcomeName?.toLowerCase().includes('manje')) {
              if (!readableOdds.firstHalfUnderTotal) {
                readableOdds.firstHalfUnderTotal = {};
              }
              readableOdds.firstHalfUnderTotal[`1H_${specialValue}`] = {
                oddValue: outcome.odd,
                betPickCode: outcome.betTypeOutcomeId
              };
            } else if (outcomeName?.toLowerCase().includes('vise')) {
              if (!readableOdds.firstHalfOverTotal) {
                readableOdds.firstHalfOverTotal = {};
              }
              readableOdds.firstHalfOverTotal[`1H_${specialValue}`] = {
                oddValue: outcome.odd,
                betPickCode: outcome.betTypeOutcomeId
              };
            }
          }
        } else if (bet.betTypeName === 'Oba tima daju gol') { // Both teams to score
          if (outcomeName === 'GG' || outcomeName?.toLowerCase().includes('da')) {
            readableOdds.bothTeamsToScore = {
              oddValue: outcome.odd,
              betPickCode: outcome.betTypeOutcomeId
            };
          } else if (outcomeName === 'NG' || outcomeName?.toLowerCase().includes('ne')) {
            readableOdds.oneTeamNotToScore = {
              oddValue: outcome.odd,
              betPickCode: outcome.betTypeOutcomeId
            };
          }
        }
      } else if (this.config.selectedSport === 'B') {
        // Basketball
        if (betTypeId === 56) { // Pobednik
          if (outcomeName === '1') {
            readableOdds.basketballFTOT1 = {
              oddValue: outcome.odd,
              betPickCode: outcome.betTypeOutcomeId
            };
          } else if (outcomeName === '2') {
            readableOdds.basketballFTOT2 = {
              oddValue: outcome.odd,
              betPickCode: outcome.betTypeOutcomeId
            };
          }
        }
      } else if (this.config.selectedSport === 'T') {
        // Tennis
        if (betTypeId === 56) { // Pobednik
          if (outcomeName === '1') {
            readableOdds.tennisHomeWins = {
              oddValue: outcome.odd,
              betPickCode: outcome.betTypeOutcomeId
            };
          } else if (outcomeName === '2') {
            readableOdds.tennisAwayWins = {
              oddValue: outcome.odd,
              betPickCode: outcome.betTypeOutcomeId
            };
          }
        } else if (bet.betTypeName === 'Pobednik seta') { // Set winner
          if (specialValue === '1') {
            if (outcomeName === '1') {
              readableOdds.tennisHomeWinsFirstSet = {
                oddValue: outcome.odd,
                betPickCode: outcome.betTypeOutcomeId
              };
            } else if (outcomeName === '2') {
              readableOdds.tennisAwayWinsFirstSet = {
                oddValue: outcome.odd,
                betPickCode: outcome.betTypeOutcomeId
              };
            }
          } else if (specialValue === '2') {
            if (outcomeName === '1') {
              readableOdds.tennisHomeWinsSecondSet = {
                oddValue: outcome.odd,
                betPickCode: outcome.betTypeOutcomeId
              };
            } else if (outcomeName === '2') {
              readableOdds.tennisAwayWinsSecondSet = {
                oddValue: outcome.odd,
                betPickCode: outcome.betTypeOutcomeId
              };
            }
          }
        }
      }
    }
  }

  private async updateCacheChanges(): Promise<void> {
    if (!this.config.isRunning) {
      return;
    }

    try {
      const payload = {
        lastDeltaCacheNumber: this.lastDeltaCacheNumber,
        pageId: 35,
        ignoreBetTypesFilterOnEventIds: [],
        competitionIds: [],
        sportIds: [],
        isLiveFilter: true // This is the key difference for live feed
      };

      const response = await axios.post<CacheChangesResponse>(
        'https://srboffer.admiralbet.rs/api/offer/CacheChangesMinimalByNumberAsStringAndFilterFromLocalCache',
        payload,
        {
          timeout: 10000,
          headers: {
            'Host': 'srboffer.admiralbet.rs',
            'language': 'sr-Latn',
            'officeid': '138',
            'origin': 'https://admiralbet.rs',
            'referer': 'https://admiralbet.rs/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          }
        }
      );

      if (response.data) {
        // Update the last delta cache number
        if (response.data.maxDeltaCacheNumberAsString) {
          this.lastDeltaCacheNumber = response.data.maxDeltaCacheNumberAsString;
        }

        // Process changed events (new live events that might appear)
        if (response.data.changedEvents && response.data.changedEvents.length > 0) {
          await this.processChangedEvents(response.data.changedEvents);
        }

        // Process changed bet outcomes
        if (response.data.changedBetOutcomes && response.data.changedBetOutcomes.length > 0) {
          await this.processChangedBetOutcomes(response.data.changedBetOutcomes);
        }
      }
    } catch (error) {
      console.error('Error updating cache changes:', error);
    }
  }

  private async processChangedEvents(changedEvents: CacheChangedEvent[]): Promise<void> {
    try {
      for (const event of changedEvents) {
        // Validate event structure
        if (!event || !event.id || event.id.length < 4 || !event.n || event.n.length < 7 || !event.b || event.b.length < 6 || !event.t || event.t.length < 7) {
          console.warn('Invalid event structure:', event);
          continue;
        }

        const eventId = event.id[0]; // Event ID is at index 0
        const sportId = event.id[1]; // Sport ID is at index 1
        const regionId = event.id[2]; // Region ID is at index 2
        const competitionId = event.id[3]; // Competition ID is at index 3

        // Only process if it's for the selected sport
        const sportMapping: { [key: number]: string } = { 1: 'S', 2: 'B', 3: 'T' };
        if (sportMapping[sportId] !== this.config.selectedSport) {
          continue;
        }

        // Check if this is a new live event we don't have yet
        if (!this.config.matches.has(eventId)) {
          console.log(`New live event detected: ${eventId}, fetching detailed odds...`);

          // Fetch detailed odds for this new event
          const detailedOdds = await this.fetchDetailedOddsForMatch(sportId, regionId, competitionId, eventId);

          // Create a complete LiveFeedEvent object
          const liveFeedEvent: LiveFeedEvent = {
            id: eventId,
            name: event.t[3], // Event name
            competitionId: competitionId,
            regionId: regionId,
            sportId: sportId,
            systemStatus: event.n[1] || 0,
            feedStatus: event.n[2] || 0,
            isInOffer: event.b[0] === 1,
            isPlayable: event.b[1] === 1,
            cashBackEnabled: event.b[2] === 1,
            externalEventId: event.t[0],
            mappingTypeId: event.n[3] || 0,
            eventTypeId: event.n[4] || 0,
            isTopOffer: event.b[3] === 1,
            code: event.t[0],
            dateTime: event.t[1],
            status: event.n[0],
            playableBetsCount: event.n[5] || 0,
            siblingStandardEventId: event.n[6] || null,
            betsCount: 0,
            shortName: event.t[4] || event.t[3],
            isLive: true, // Live events are live
            competitionName: event.t[2],
            regionName: '',
            sportName: sportId === 1 ? 'Football' : sportId === 2 ? 'Basketball' : 'Tennis',
            betRadarEventId: 0,
            playableBetOutcomesCount: 0,
            sportMatchId: parseInt(event.t[0]) || 0,
            isEarlyPayoutPossible: false,
            bets: []
          };

          // Process the live event
          await this.processLiveEvent(liveFeedEvent);
        }
      }

      // Save updated data if we added new events
      if (changedEvents.length > 0) {
        await this.saveProcessedData();
      }
    } catch (error) {
      console.error('Error processing changed events:', error);
    }
  }

  private async processChangedBetOutcomes(changedBetOutcomes: CacheChangedBetOutcome[]): Promise<void> {
    try {
      for (const outcome of changedBetOutcomes) {
        // Validate outcome structure
        if (!outcome || !outcome.id || outcome.id.length < 5 || !outcome.n || outcome.n.length < 3 || !outcome.t) {
          console.warn('Invalid bet outcome structure:', outcome);
          continue;
        }

        const eventId = outcome.id[4]; // Event ID is at index 4
        const sportId = outcome.id[1]; // Sport ID is at index 1
        const betTypeId = outcome.n[0]; // Bet type ID is at index 0
        const betTypeOutcomeId = outcome.n[1]; // Bet type outcome ID is at index 1
        const newValue = outcome.n[2]; // New value is at index 2
        const betTypeName = outcome.t[0] || ''; // Bet type name is at index 0
        const outcomeName = outcome.t[1] || ''; // Outcome name is at index 1
        const specialValue = outcome.t[2] || null; // Special value is at index 2

        // Only process if it's for the selected sport
        const sportMapping: { [key: number]: string } = { 1: 'S', 2: 'B', 3: 'T' };
        if (sportMapping[sportId] !== this.config.selectedSport) {
          continue;
        }

        // Find the match and update the odds
        const match = this.config.matches.get(eventId);
        if (match) {
          this.updateMatchOdds(match, betTypeName, outcomeName, specialValue, newValue, betTypeOutcomeId);
          console.log(`Updated live odds for match ${eventId}: ${betTypeName} ${outcomeName} = ${newValue}`);
        }
      }

      // Save updated data
      await this.saveProcessedData();
    } catch (error) {
      console.error('Error processing changed bet outcomes:', error);
    }
  }

  private updateMatchOdds(match: ProcessedLiveFeedMatch, betTypeName: string, outcomeName: string, specialValue: string | null, newValue: number, betTypeOutcomeId: number): void {
    if (!match.bets.odds) {
      match.bets.odds = {};
    }

    const odds = match.bets.odds;

    // Handle different bet types based on sport
    if (match.sport === 'B') {
      // Basketball
      if (betTypeName === 'Pobednik') {
        if (outcomeName === '1') {
          odds.basketballFTOT1 = {
            oddValue: newValue,
            betPickCode: betTypeOutcomeId
          };
        } else if (outcomeName === '2') {
          odds.basketballFTOT2 = {
            oddValue: newValue,
            betPickCode: betTypeOutcomeId
          };
        }
      }
    } else if (match.sport === 'T') {
      // Tennis
      if (betTypeName === 'Pobednik') {
        if (outcomeName === '1') {
          odds.tennisHomeWins = {
            oddValue: newValue,
            betPickCode: betTypeOutcomeId
          };
        } else if (outcomeName === '2') {
          odds.tennisAwayWins = {
            oddValue: newValue,
            betPickCode: betTypeOutcomeId
          };
        }
      } else if (betTypeName === 'Pobednik seta') { // Set winner
        if (specialValue === '1') {
          if (outcomeName === '1') {
            odds.tennisHomeWinsFirstSet = {
              oddValue: newValue,
              betPickCode: betTypeOutcomeId
            };
          } else if (outcomeName === '2') {
            odds.tennisAwayWinsFirstSet = {
              oddValue: newValue,
              betPickCode: betTypeOutcomeId
            };
          }
        } else if (specialValue === '2') {
          if (outcomeName === '1') {
            odds.tennisHomeWinsSecondSet = {
              oddValue: newValue,
              betPickCode: betTypeOutcomeId
            };
          } else if (outcomeName === '2') {
            odds.tennisAwayWinsSecondSet = {
              oddValue: newValue,
              betPickCode: betTypeOutcomeId
            };
          }
        }
      }
    } else if (match.sport === 'S') {
      // Football
      if (betTypeName === 'Konacan ishod') {
        if (outcomeName === '1') {
          odds.fullTimeResultHomeWin = {
            oddValue: newValue,
            betPickCode: betTypeOutcomeId
          };
        } else if (outcomeName === 'X') {
          odds.fullTimeResultDraw = {
            oddValue: newValue,
            betPickCode: betTypeOutcomeId
          };
        } else if (outcomeName === '2') {
          odds.fullTimeResultAwayWin = {
            oddValue: newValue,
            betPickCode: betTypeOutcomeId
          };
        }
      } else if (betTypeName === '1.pol - 1X2') {
        if (outcomeName === '1') {
          odds.firstHalfResultHomeWin = {
            oddValue: newValue,
            betPickCode: betTypeOutcomeId
          };
        } else if (outcomeName === 'X') {
          odds.firstHalfResultDraw = {
            oddValue: newValue,
            betPickCode: betTypeOutcomeId
          };
        } else if (outcomeName === '2') {
          odds.firstHalfResultAwayWin = {
            oddValue: newValue,
            betPickCode: betTypeOutcomeId
          };
        }
      } else if (betTypeName === 'Ukupno golova') {
        if (specialValue) {
          if (outcomeName?.toLowerCase().includes('manje')) {
            if (!odds.fullTimeUnderTotal) {
              odds.fullTimeUnderTotal = {};
            }
            odds.fullTimeUnderTotal[`FT_${specialValue}`] = {
              oddValue: newValue,
              betPickCode: betTypeOutcomeId
            };
          } else if (outcomeName?.toLowerCase().includes('vise')) {
            if (!odds.fullTimeOverTotal) {
              odds.fullTimeOverTotal = {};
            }
            odds.fullTimeOverTotal[`FT_${specialValue}`] = {
              oddValue: newValue,
              betPickCode: betTypeOutcomeId
            };
          }
        }
      } else if (betTypeName === '1.p - Ukupno') {
        if (specialValue) {
          if (outcomeName?.toLowerCase().includes('manje')) {
            if (!odds.firstHalfUnderTotal) {
              odds.firstHalfUnderTotal = {};
            }
            odds.firstHalfUnderTotal[`1H_${specialValue}`] = {
              oddValue: newValue,
              betPickCode: betTypeOutcomeId
            };
          } else if (outcomeName?.toLowerCase().includes('vise')) {
            if (!odds.firstHalfOverTotal) {
              odds.firstHalfOverTotal = {};
            }
            odds.firstHalfOverTotal[`1H_${specialValue}`] = {
              oddValue: newValue,
              betPickCode: betTypeOutcomeId
            };
          }
        }
      } else if (betTypeName === 'Oba tima daju gol') { // Both teams to score
        if (outcomeName === 'GG' || outcomeName?.toLowerCase().includes('da')) {
          odds.bothTeamsToScore = {
            oddValue: newValue,
            betPickCode: betTypeOutcomeId
          };
        } else if (outcomeName === 'NG' || outcomeName?.toLowerCase().includes('ne')) {
          odds.oneTeamNotToScore = {
            oddValue: newValue,
            betPickCode: betTypeOutcomeId
          };
        }
      }
    }
  }

  private async fetchDetailedOddsForMatch(sportId: number, regionId: number, competitionId: number, matchId: number): Promise<any> {
    try {
      const url = `https://srboffer.admiralbet.rs/api/offer/betsAndGroups/${sportId}/${regionId}/${competitionId}/${matchId}`;

      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'Host': 'srboffer.admiralbet.rs',
          'language': 'sr-Latn',
          'officeid': '138',
          'origin': 'https://admiralbet.rs',
          'referer': 'https://admiralbet.rs/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });

      return response.data;
    } catch (error) {
      console.error(`Error fetching detailed odds for match ${matchId}:`, error);
      return null;
    }
  }

  private async saveProcessedData(): Promise<void> {
    if (this.config.matches.size === 0) {
      return;
    }

    try {
      const currentMatches = Array.from(this.config.matches.values());

      const metadata = {
        lastUpdated: new Date().toISOString(),
        collectionInterval: this.config.collectionInterval,
        selectedSport: this.config.selectedSport,
        totalMatches: currentMatches.length,
        totalLeagues: this.config.leagues.size
      };

      await this.dataStorageService.saveLiveFeedData(currentMatches, metadata);
    } catch (error) {
      console.error('Error saving processed live feed data:', error);
    }
  }

  public getStatus(): any {
    const basketballMatches = Array.from(this.config.matches.values()).filter(match => match.sport === 'B');
    const tennisMatches = Array.from(this.config.matches.values()).filter(match => match.sport === 'T');
    const footballMatches = Array.from(this.config.matches.values()).filter(match => match.sport === 'S');

    return {
      isRunning: this.config.isRunning,
      collectionInterval: this.config.collectionInterval,
      selectedSport: this.config.selectedSport,
      totalMatches: this.config.matches.size,
      totalLeagues: this.config.leagues.size,
      lastProcessedTime: this.config.lastProcessedTime,
      storageType: this.dataStorageService.getStorageType(),
      redisAvailable: this.dataStorageService.isRedisAvailable(),
      redisConnected: this.dataStorageService.isRedisConnected(),
      basketballMatches: {
        total: basketballMatches.length,
        withFTOTOdds: basketballMatches.filter(match =>
          match.bets.odds.basketballFTOT1 ||
          match.bets.odds.basketballFTOT2
        ).length
      },
      tennisMatches: {
        total: tennisMatches.length,
        withDetailedOdds: tennisMatches.filter(match =>
          match.bets.odds.tennisHomeWins ||
          match.bets.odds.tennisAwayWins
        ).length
      },
      footballMatches: {
        total: footballMatches.length,
        withDetailedOdds: footballMatches.filter(match =>
          match.bets.odds.fullTimeResultHomeWin ||
          match.bets.odds.fullTimeResultDraw ||
          match.bets.odds.fullTimeResultAwayWin ||
          match.bets.odds.firstHalfResultHomeWin ||
          match.bets.odds.firstHalfResultDraw ||
          match.bets.odds.firstHalfResultAwayWin
        ).length
      },
      matches: Array.from(this.config.matches.values()).slice(0, 10) // Return first 10 matches for preview
    };
  }

  public getMatches(): ProcessedLiveFeedMatch[] {
    return Array.from(this.config.matches.values());
  }

  public getMatchById(matchId: number): ProcessedLiveFeedMatch | undefined {
    return this.config.matches.get(matchId);
  }
}
