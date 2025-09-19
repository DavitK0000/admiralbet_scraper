import axios from 'axios';
import {
  ProcessedPreGameMatch,
  ProcessedBet,
  ReadableOdds,
  PreGameConfig,
  AdmiralBetEvent,
  AdmiralBetBetTypeSelection,
  FootballBetTypes
} from '../types';
import { DataStorageService } from './DataStorageService';

export class PreGamesService {
  private config: PreGameConfig;
  private collectionTimer?: NodeJS.Timeout;
  private dataStorageService: DataStorageService;
  private readonly ALLOWED_SPORTS = ['B', 'T', 'S']; // Basketball, Tennis, and Football (Soccer) for AdmiralBet
  private basketballBetTypeId: number | null = null;
  private basketballBetTypeOutcomeIds: number[] = [];
  private tennisBetTypeId: number | null = null;
  private tennisBetTypeOutcomeIds: number[] = [];
  private tennisFirstSetBetTypeId: number | null = null;
  private tennisFirstSetBetTypeOutcomeIds: number[] = [];
  private footballBetTypes: FootballBetTypes = {
    konacanIshod: { betTypeId: null, outcomeIds: [] },
    firstHalf1X2: { betTypeId: null, outcomeIds: [] },
    brojGolova: { betTypeId: null, outcomes: [] },
    obaTimaDajuGol: { betTypeId: null, outcomeIds: [] },
    firstHalfUkupnoGolova: { betTypeId: null, outcomes: [] },
    ukupnoGolova: { betTypeId: null, outcomes: [] }
  };

  constructor() {
    this.config = {
      isRunning: false,
      collectionInterval: 120, // 120 seconds default
      selectedSport: 'B', // Default to basketball
      matches: new Map(),
      leagues: new Map()
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


  public async startPreGames(collectionInterval: number = 120, sport: string = 'B'): Promise<void> {
    if (this.config.isRunning) {
      return;
    }

    // Validate sport parameter - basketball, tennis, and football allowed
    if (!['B', 'T', 'S'].includes(sport)) {
      throw new Error(`Invalid sport: ${sport}. Only basketball (B), tennis (T), and football (S) are supported for AdmiralBet`);
    }

    // Validate collection interval
    if (![120].includes(collectionInterval)) {
      throw new Error(`Invalid collection interval: ${collectionInterval}. Allowed intervals: 120 seconds`);
    }

    this.config.isRunning = true;
    this.config.collectionInterval = collectionInterval;
    this.config.selectedSport = sport;
    this.config.matches.clear();
    this.config.leagues.clear();

    const sportName = sport === 'B' ? 'basketball' : sport === 'T' ? 'tennis' : 'football';
    console.log(`Starting AdmiralBet ${sportName} collection`);

    // Clear previous data from both files and Redis
    try {
      await this.dataStorageService.clearData();
    } catch (error) {
      console.error('Error clearing previous data:', error);
      // Continue anyway - don't let clearing errors stop the collection
    }

    // Start collection immediately and then at specified intervals
    this.startCollection();
    
    // Run the first collection immediately
    this.collectPreGamesData();
  }

  public async stopPreGames(): Promise<void> {
    if (!this.config.isRunning) {
      console.log('Pre-games collection is not running');
      return;
    }

    this.config.isRunning = false;

    // Clear the collection timer
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = undefined;
    }

    // Save any remaining data before stopping
    await this.saveProcessedData();
  }

  private startCollection(): void {
    // Set up interval for collection (no immediate collection)
    this.collectionTimer = setInterval(() => {
      this.collectPreGamesData();
    }, this.config.collectionInterval * 1000);
  }

  private async collectPreGamesData(): Promise<void> {
    try {
      const sportName = this.config.selectedSport === 'B' ? 'basketball' : this.config.selectedSport === 'T' ? 'tennis' : 'football';
      console.log(`Collecting AdmiralBet ${sportName} data...`);
      
      if (this.config.selectedSport === 'B') {
        await this.collectAdmiralBetBasketballData();
      } else if (this.config.selectedSport === 'T') {
        await this.collectAdmiralBetTennisData();
      } else if (this.config.selectedSport === 'S') {
        await this.collectAdmiralBetFootballData();
      }

    } catch (error) {
      console.error('Error collecting pre-games data:', error);
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

      await this.dataStorageService.savePreGamesData(currentMatches, metadata);
    } catch (error) {
      console.error('Error saving processed pre-games data:', error);
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
      basketballBetType: {
        betTypeId: this.basketballBetTypeId,
        outcomeIds: this.basketballBetTypeOutcomeIds
      },
      tennisBetType: {
        betTypeId: this.tennisBetTypeId,
        outcomeIds: this.tennisBetTypeOutcomeIds
      },
      tennisFirstSetBetType: {
        betTypeId: this.tennisFirstSetBetTypeId,
        outcomeIds: this.tennisFirstSetBetTypeOutcomeIds
      },
      footballBetTypes: this.footballBetTypes,
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
          match.bets.odds.tennisAwayWins ||
          match.bets.odds.tennisHomeWinsFirstSet ||
          match.bets.odds.tennisAwayWinsFirstSet
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
          match.bets.odds.firstHalfResultAwayWin ||
          match.bets.odds.bothTeamsToScore ||
          match.bets.odds.oneTeamNotToScore
        ).length
      },
      matches: Array.from(this.config.matches.values()).slice(0, 10) // Return first 10 matches for preview
    };
  }

  public getMatches(): ProcessedPreGameMatch[] {
    return Array.from(this.config.matches.values());
  }

  public getMatchById(matchId: number): ProcessedPreGameMatch | undefined {
    return this.config.matches.get(matchId);
  }


  private async collectAdmiralBetBasketballData(): Promise<void> {
    try {
      const events = await this.fetchAdmiralBetBasketballEvents();
      
      if (events.length === 0) {
        console.log('No basketball events found');
        return;
      }

      console.log(`Found ${events.length} basketball events, processing with batch concurrency...`);

      // Create batch processor for detailed odds fetching
      const detailedOddsProcessor = async (event: AdmiralBetEvent) => {
        const detailedOdds = await this.fetchDetailedOddsForMatch(2, event.regionId, event.competitionId, event.id);
        return { event, detailedOdds };
      };

      // Process events in batches with concurrency control
      const batchResults = await this.processBatchWithConcurrency(events, detailedOddsProcessor, 35);

      // Process each event with its detailed odds
      for (const { event, detailedOdds } of batchResults) {
        await this.processAdmiralBetEvent(event, detailedOdds);
      }

      // Save processed data
      await this.saveProcessedData();

      this.config.lastProcessedTime = Date.now();
      console.log(`AdmiralBet basketball collection completed. Total matches: ${this.config.matches.size}`);

    } catch (error) {
      console.error('Error collecting AdmiralBet basketball data:', error);
    }
  }

  private async collectAdmiralBetTennisData(): Promise<void> {
    try {
      const events = await this.fetchAdmiralBetTennisEvents();
      
      if (events.length === 0) {
        console.log('No tennis events found');
        return;
      }

      console.log(`Found ${events.length} tennis events, processing with batch concurrency...`);

      // Create batch processor for detailed odds fetching
      const detailedOddsProcessor = async (event: AdmiralBetEvent) => {
        const detailedOdds = await this.fetchDetailedOddsForMatch(3, event.regionId, event.competitionId, event.id);
        return { event, detailedOdds };
      };

      // Process events in batches with concurrency control
      const batchResults = await this.processBatchWithConcurrency(events, detailedOddsProcessor, 35);

      // Process each event with its detailed odds
      for (const { event, detailedOdds } of batchResults) {
        await this.processAdmiralBetTennisEvent(event, detailedOdds);
      }

      // Save processed data
      await this.saveProcessedData();

      this.config.lastProcessedTime = Date.now();
      console.log(`AdmiralBet tennis collection completed. Total matches: ${this.config.matches.size}`);

    } catch (error) {
      console.error('Error collecting AdmiralBet tennis data:', error);
    }
  }

  private async collectAdmiralBetFootballData(): Promise<void> {
    try {
      const events = await this.fetchAdmiralBetFootballEvents();
      
      if (events.length === 0) {
        console.log('No football events found');
        return;
      }

      console.log(`Found ${events.length} football events, processing with batch concurrency...`);

      // Create batch processor for detailed odds fetching
      const detailedOddsProcessor = async (event: AdmiralBetEvent) => {
        const detailedOdds = await this.fetchDetailedOddsForMatch(1, event.regionId, event.competitionId, event.id);
        return { event, detailedOdds };
      };

      // Process events in batches with concurrency control
      const batchResults = await this.processBatchWithConcurrency(events, detailedOddsProcessor, 35);

      // Process each event with its detailed odds
      for (const { event, detailedOdds } of batchResults) {
        await this.processAdmiralBetFootballEvent(event, detailedOdds);
      }

      // Save processed data
      await this.saveProcessedData();

      this.config.lastProcessedTime = Date.now();
      console.log(`AdmiralBet football collection completed. Total matches: ${this.config.matches.size}`);

    } catch (error) {
      console.error('Error collecting AdmiralBet football data:', error);
    }
  }

  private async fetchAdmiralBetFootballEvents(): Promise<AdmiralBetEvent[]> {
    try {
      console.log('Fetching football events with concurrent pagination...');
      
      // First estimate total pages
      const totalPages = await this.estimateTotalPages(1, 30);
      console.log(`Estimated ${totalPages} pages for football events`);
      
      // Fetch all pages concurrently
      const allEvents = await this.fetchPagesConcurrently(1, totalPages, 30, 5);
      
      console.log(`Fetched total ${allEvents.length} football events from AdmiralBet`);
      return allEvents;
    } catch (error) {
      console.error('Error fetching AdmiralBet football events:', error);
      return [];
    }
  }


  private async processAdmiralBetFootballEvent(event: AdmiralBetEvent, detailedOdds?: any): Promise<void> {
    try {
      // Process football bets from detailed odds data if available, otherwise from event data
      let footballBets = event.bets || [];
      
      // If detailed odds are available, use them instead
      if (detailedOdds && detailedOdds.bets) {
        footballBets = detailedOdds.bets;
        console.log(`Using detailed odds data for football event ${event.id}`);
      }
      
      console.log(`Found ${footballBets.length} football bets for event ${event.id}`);
      
      if (footballBets.length === 0) {
        console.log(`Processing event ${event.id} with no football bets found - will show "-" for odds`);
      }

      // Extract outcomes by looking for specific bet type names
      const readableOdds: ReadableOdds = {};
      
      for (const bet of footballBets) {
        // Handle "Konacan ishod" bet type (Full Time 1X2)
        if (bet.betTypeName === 'Konacan ishod') {
          for (const outcome of bet.betOutcomes) {
            if (outcome.name === '1' || outcome.name?.toLowerCase().includes('home')) {
              readableOdds.fullTimeResultHomeWin = {
                oddValue: outcome.odd,
                betPickCode: outcome.betTypeOutcomeId
              };
            } else if (outcome.name === 'X' || outcome.name?.toLowerCase().includes('draw')) {
              readableOdds.fullTimeResultDraw = {
                oddValue: outcome.odd,
                betPickCode: outcome.betTypeOutcomeId
              };
            } else if (outcome.name === '2' || outcome.name?.toLowerCase().includes('away')) {
              readableOdds.fullTimeResultAwayWin = {
                oddValue: outcome.odd,
                betPickCode: outcome.betTypeOutcomeId
              };
            }
          }
        }
        
        // Handle "1.pol - 1X2" bet type (First Half 1X2)
        if (bet.betTypeName === '1.pol - 1X2') {
          for (const outcome of bet.betOutcomes) {
            if (outcome.name === '1' || outcome.name?.toLowerCase().includes('home')) {
              readableOdds.firstHalfResultHomeWin = {
                oddValue: outcome.odd,
                betPickCode: outcome.betTypeOutcomeId
              };
            } else if (outcome.name === 'X' || outcome.name?.toLowerCase().includes('draw')) {
              readableOdds.firstHalfResultDraw = {
                oddValue: outcome.odd,
                betPickCode: outcome.betTypeOutcomeId
              };
            } else if (outcome.name === '2' || outcome.name?.toLowerCase().includes('away')) {
              readableOdds.firstHalfResultAwayWin = {
                oddValue: outcome.odd,
                betPickCode: outcome.betTypeOutcomeId
              };
            }
          }
        }

        // Handle "Broj golova" bet type (Total goals 90')
        if (bet.betTypeName === 'Broj golova') {
          for (const outcome of bet.betOutcomes) {
            const name = outcome.name?.toLowerCase() || '';
            if (name.includes('1-2')) {
              readableOdds.oneToTwoGoals = {
                oddValue: outcome.odd,
                betPickCode: outcome.betTypeOutcomeId
              };
            } else if (name.includes('1-3')) {
              readableOdds.oneToThreeGoals = {
                oddValue: outcome.odd,
                betPickCode: outcome.betTypeOutcomeId
              };
            } else if (name.includes('1-4')) {
              readableOdds.oneToFourGoals = {
                oddValue: outcome.odd,
                betPickCode: outcome.betTypeOutcomeId
              };
            } else if (name.includes('2-3')) {
              readableOdds.twoOrThreeGoals = {
                oddValue: outcome.odd,
                betPickCode: outcome.betTypeOutcomeId
              };
            } else if (name.includes('2-4')) {
              readableOdds.twoToFourGoals = {
                oddValue: outcome.odd,
                betPickCode: outcome.betTypeOutcomeId
              };
            } else if (name.includes('3-4')) {
              readableOdds.threeToFourGoals = {
                oddValue: outcome.odd,
                betPickCode: outcome.betTypeOutcomeId
              };
            } else if (name.includes('3-5')) {
              readableOdds.threeToFiveGoals = {
                oddValue: outcome.odd,
                betPickCode: outcome.betTypeOutcomeId
              };
            } else if (name.includes('4-5')) {
              readableOdds.fourToFiveGoals = {
                oddValue: outcome.odd,
                betPickCode: outcome.betTypeOutcomeId
              };
            } else if (name.includes('4-6')) {
              readableOdds.fourToSixGoals = {
                oddValue: outcome.odd,
                betPickCode: outcome.betTypeOutcomeId
              };
            } else if (name.includes('0-2')) {
              readableOdds.zeroToTwoGoals = {
                oddValue: outcome.odd,
                betPickCode: outcome.betTypeOutcomeId
              };
            }
          }
        }

        // Handle "Oba tima daju gol" bet type (Both teams to score)
        if (bet.betTypeName === 'Oba tima daju gol') {
          for (const outcome of bet.betOutcomes) {
            if (outcome.name === 'GG' || outcome.name?.toLowerCase().includes('da')) {
              readableOdds.bothTeamsToScore = {
                oddValue: outcome.odd,
                betPickCode: outcome.betTypeOutcomeId
              };
            } else if (outcome.name === 'NG' || outcome.name?.toLowerCase().includes('ne')) {
              readableOdds.oneTeamNotToScore = {
                oddValue: outcome.odd,
                betPickCode: outcome.betTypeOutcomeId
              };
            }
          }
        }

        // Handle "1.pol - Ukupno golova" bet type (First half total goals)
        if (bet.betTypeName === '1.pol - Ukupno golova') {
          for (const outcome of bet.betOutcomes) {
            const name = outcome.name?.toLowerCase() || '';
            if (name.includes('manje')) {
              readableOdds.firstHalfUnderTotal = {
                oddValue: outcome.odd,
                betPickCode: outcome.betTypeOutcomeId,
                specialValue: outcome.specialValue?.toString() || '0.5'
              };
            } else if (name.includes('vise')) {
              readableOdds.firstHalfOverTotal = {
                oddValue: outcome.odd,
                betPickCode: outcome.betTypeOutcomeId,
                specialValue: outcome.specialValue?.toString() || '0.5'
              };
            }
          }
        }

        // Handle "Ukupno golova" bet type (Total goals)
        if (bet.betTypeName === 'Ukupno golova') {
          for (const outcome of bet.betOutcomes) {
            const name = outcome.name?.toLowerCase() || '';
            if (name.includes('manje')) {
              readableOdds.underTotal = {
                oddValue: outcome.odd,
                betPickCode: outcome.betTypeOutcomeId,
                specialValue: outcome.specialValue?.toString() || '2.5'
              };
            } else if (name.includes('vise')) {
              readableOdds.overTotal = {
                oddValue: outcome.odd,
                betPickCode: outcome.betTypeOutcomeId,
                specialValue: outcome.specialValue?.toString() || '2.5'
              };
            }
          }
        }
      }

      // Process event even if no valid odds found - will show "-" for missing odds
      if (Object.keys(readableOdds).length === 0) {
        console.log(`Processing event ${event.id} with no valid football odds - will show "-"`);
      }

      // Parse team names from event name (assuming format: "Team1 - Team2")
      const teamNames = event.name.split(' - ');
      const homeTeam = teamNames[0]?.trim() || 'Home Team';
      const awayTeam = teamNames[1]?.trim() || 'Away Team';

      // Create processed match
      const processedMatch: ProcessedPreGameMatch = {
        id: event.id,
        matchCode: event.sportMatchId,
        home: homeTeam,
        away: awayTeam,
        league: event.competitionName,
        sport: 'S', // Football (Soccer)
        kickOffTime: new Date(event.dateTime).getTime(),
        status: event.status,
        blocked: !event.isPlayable,
        favourite: event.isTopOffer,
        bets: {
          odds: readableOdds
        }
      };

      // Store the match
      this.config.matches.set(event.id, processedMatch);
      
      console.log(`Processed football match: ${homeTeam} vs ${awayTeam} (${event.competitionName})`);

    } catch (error) {
      console.error(`Error processing AdmiralBet football event ${event.id}:`, error);
    }
  }

  private async fetchAdmiralBetBasketballEvents(): Promise<AdmiralBetEvent[]> {
    try {
      console.log('Fetching basketball events with concurrent pagination...');
      
      // First estimate total pages
      const totalPages = await this.estimateTotalPages(2, 30);
      console.log(`Estimated ${totalPages} pages for basketball events`);
      
      // Fetch all pages concurrently
      const allEvents = await this.fetchPagesConcurrently(2, totalPages, 30, 5);
      
      console.log(`Fetched total ${allEvents.length} basketball events from AdmiralBet`);
      return allEvents;
    } catch (error) {
      console.error('Error fetching AdmiralBet basketball events:', error);
      return [];
    }
  }

  private async fetchAdmiralBetTennisEvents(): Promise<AdmiralBetEvent[]> {
    try {
      console.log('Fetching tennis events with concurrent pagination...');
      
      // First estimate total pages
      const totalPages = await this.estimateTotalPages(3, 30);
      console.log(`Estimated ${totalPages} pages for tennis events`);
      
      // Fetch all pages concurrently
      const allEvents = await this.fetchPagesConcurrently(3, totalPages, 30, 5);
      
      console.log(`Fetched total ${allEvents.length} tennis events from AdmiralBet`);
      return allEvents;
    } catch (error) {
      console.error('Error fetching AdmiralBet tennis events:', error);
      return [];
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

  private async processBatchWithConcurrency<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    concurrency: number = 35
  ): Promise<R[]> {
    const results: R[] = [];
    
    for (let i = 0; i < items.length; i += concurrency) {
      const batch = items.slice(i, i + concurrency);
      console.log(`Processing batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(items.length / concurrency)} (${batch.length} items)`);
      
      const batchPromises = batch.map(processor);
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Extract successful results
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error(`Error processing item ${i + index}:`, result.reason);
        }
      });
      
      // Small delay between batches to avoid overwhelming the server
      if (i + concurrency < items.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }

  private async estimateTotalPages(sportId: number, topN: number = 30): Promise<number> {
    try {
      const currentTime = new Date();
      const currentTimestamp = currentTime.toISOString();
      const futureTimestamp = new Date(currentTime.getTime() + 5 * 365 * 24 * 60 * 60 * 1000).toISOString();
      
      // Fetch first page to estimate total
      const url = `https://srboffer.admiralbet.rs/api/offer/getEventsStartingSoonFilterSelections/?sportId=${sportId}&topN=${topN}&skipN=0&isLive=false&dateFrom=${currentTimestamp}&dateTo=${futureTimestamp}&eventMappingTypes=1,2,3,4,5&pageId=35`;

      const response = await axios.get<AdmiralBetEvent[]>(url, {
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

      if (response.data && Array.isArray(response.data)) {
        const firstPageCount = response.data.length;
        console.log(`First page returned ${firstPageCount} events`);
        
        // If first page is full, estimate more pages exist
        if (firstPageCount === topN) {
          // Start with a higher estimate since there could be 50+ pages
          // We'll use early termination to stop when we hit empty pages
          return 100; // High estimate, early termination will handle the actual end
        } else {
          // If first page is not full, we likely have only 1 page
          return 1;
        }
      }
      
      return 1;
    } catch (error) {
      console.error('Error estimating total pages:', error);
      return 1;
    }
  }

  private async fetchPagesConcurrently(
    sportId: number,
    totalPages: number,
    topN: number = 30,
    concurrency: number = 5
  ): Promise<AdmiralBetEvent[]> {
    const allEvents: AdmiralBetEvent[] = [];
    
    // Create page fetcher function
    const pageFetcher = async (pageNumber: number): Promise<AdmiralBetEvent[]> => {
      const skipN = pageNumber * topN;
      const currentTime = new Date();
      const currentTimestamp = currentTime.toISOString();
      const futureTimestamp = new Date(currentTime.getTime() + 5 * 365 * 24 * 60 * 60 * 1000).toISOString();
      
      const url = `https://srboffer.admiralbet.rs/api/offer/getEventsStartingSoonFilterSelections/?sportId=${sportId}&topN=${topN}&skipN=${skipN}&isLive=false&dateFrom=${currentTimestamp}&dateTo=${futureTimestamp}&eventMappingTypes=1,2,3,4,5&pageId=35`;

      try {
        const response = await axios.get<AdmiralBetEvent[]>(url, {
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

        if (response.data && Array.isArray(response.data)) {
          console.log(`Fetched page ${pageNumber + 1} with ${response.data.length} events`);
          return response.data;
        }
        return [];
      } catch (error) {
        console.error(`Error fetching page ${pageNumber + 1}:`, error);
        return [];
      }
    };

    // Process pages in batches with early termination
    let currentPage = 0;
    let hasMoreData = true;
    
    while (hasMoreData && currentPage < totalPages) {
      // Calculate how many pages to fetch in this batch
      const remainingPages = totalPages - currentPage;
      const batchSize = Math.min(concurrency, remainingPages);
      
      // Create page numbers for this batch
      const pageNumbers = Array.from({ length: batchSize }, (_, i) => currentPage + i);
      
      console.log(`Fetching batch: pages ${currentPage + 1} to ${currentPage + batchSize}`);
      
      // Fetch this batch concurrently
      const batchPromises = pageNumbers.map(pageFetcher);
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Process results and check for early termination
      let foundEmptyPage = false;
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const events = result.value;
          allEvents.push(...events);
          
          // If any page returns 0 events, we've reached the end
          if (events.length === 0) {
            foundEmptyPage = true;
            console.log(`Page ${currentPage + index + 1} returned 0 events - stopping pagination`);
          }
        } else {
          console.error(`Error processing page ${currentPage + index + 1}:`, result.reason);
        }
      });
      
      // If we found an empty page, stop fetching more pages
      if (foundEmptyPage) {
        hasMoreData = false;
        console.log('Early termination: Found empty page, stopping pagination');
      } else {
        currentPage += batchSize;
        // Small delay between batches to avoid overwhelming the server
        if (currentPage < totalPages) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }

    console.log(`Fetched total ${allEvents.length} events from ${currentPage} pages`);
    return allEvents;
  }


  private async processAdmiralBetTennisEvent(event: AdmiralBetEvent, detailedOdds?: any): Promise<void> {
    try {
      // Process tennis bets from detailed odds data if available, otherwise from event data
      let tennisBets = event.bets || [];
      
      // If detailed odds are available, use them instead
      if (detailedOdds && detailedOdds.bets) {
        tennisBets = detailedOdds.bets;
        console.log(`Using detailed odds data for tennis event ${event.id}`);
      }
      
      console.log(`Found ${tennisBets.length} tennis bets for event ${event.id}`);
      
      if (tennisBets.length === 0) {
        console.log(`Processing event ${event.id} with no tennis bets found - will show "-" for odds`);
      }

      // Extract outcomes by looking for specific bet type names
      const readableOdds: ReadableOdds = {};
      
      for (const bet of tennisBets) {
        // Look for "Pobednik" bet type (match winner)
        if (bet.betTypeName === 'Pobednik') {
          for (const outcome of bet.betOutcomes) {
            if (outcome.name === '1' || outcome.name?.toLowerCase().includes('home')) {
              readableOdds.tennisHomeWins = {
                oddValue: outcome.odd,
                betPickCode: outcome.betTypeOutcomeId
              };
            } else if (outcome.name === '2' || outcome.name?.toLowerCase().includes('away')) {
              readableOdds.tennisAwayWins = {
                oddValue: outcome.odd,
                betPickCode: outcome.betTypeOutcomeId
              };
            }
          }
        }
        
        // Look for "1.set - Pobednik" bet type (first set winner)
        if (bet.betTypeName === '1.set - Pobednik') {
          for (const outcome of bet.betOutcomes) {
            if (outcome.name === '1' || outcome.name?.toLowerCase().includes('home')) {
              readableOdds.tennisHomeWinsFirstSet = {
                oddValue: outcome.odd,
                betPickCode: outcome.betTypeOutcomeId
              };
            } else if (outcome.name === '2' || outcome.name?.toLowerCase().includes('away')) {
              readableOdds.tennisAwayWinsFirstSet = {
                oddValue: outcome.odd,
                betPickCode: outcome.betTypeOutcomeId
              };
            }
          }
        }
      }

      // Process event even if no valid odds found - will show "-" for missing odds
      if (Object.keys(readableOdds).length === 0) {
        console.log(`Processing event ${event.id} with no valid tennis odds - will show "-"`);
      }

      // Parse player names from event name (assuming format: "Player1 - Player2")
      const playerNames = event.name.split(' - ');
      const homePlayer = playerNames[0]?.trim() || 'Home Player';
      const awayPlayer = playerNames[1]?.trim() || 'Away Player';

      // Create processed match
      const processedMatch: ProcessedPreGameMatch = {
        id: event.id,
        matchCode: event.sportMatchId,
        home: homePlayer,
        away: awayPlayer,
        league: event.competitionName,
        sport: 'T', // Tennis
        kickOffTime: new Date(event.dateTime).getTime(),
        status: event.status,
        blocked: !event.isPlayable,
        favourite: event.isTopOffer,
        bets: {
          odds: readableOdds
        }
      };

      // Store the match
      this.config.matches.set(event.id, processedMatch);
      
      console.log(`Processed tennis match: ${homePlayer} vs ${awayPlayer} (${event.competitionName})`);

    } catch (error) {
      console.error(`Error processing AdmiralBet tennis event ${event.id}:`, error);
    }
  }

  private async processAdmiralBetEvent(event: AdmiralBetEvent, detailedOdds?: any): Promise<void> {
    try {
      // Process basketball bets from detailed odds data if available, otherwise from event data
      let basketballBets = event.bets || [];
      
      // If detailed odds are available, use them instead
      if (detailedOdds && detailedOdds.bets) {
        basketballBets = detailedOdds.bets;
        console.log(`Using detailed odds data for basketball event ${event.id}`);
      }
      
      console.log(`Found ${basketballBets.length} basketball bets for event ${event.id}`);
      
      if (basketballBets.length === 0) {
        console.log(`Processing event ${event.id} with no basketball bets found - will show "-" for odds`);
      }

      // Extract outcomes by looking for "Pobednik" bet type
      const readableOdds: ReadableOdds = {};
      
      for (const bet of basketballBets) {
        // Look for "Pobednik" bet type (match winner)
        if (bet.betTypeName === 'Pobednik') {
          for (const outcome of bet.betOutcomes) {
            if (outcome.name === '1' || outcome.name?.toLowerCase().includes('home')) {
              readableOdds.basketballFTOT1 = {
                oddValue: outcome.odd,
                betPickCode: outcome.betTypeOutcomeId
              };
            } else if (outcome.name === '2' || outcome.name?.toLowerCase().includes('away')) {
              readableOdds.basketballFTOT2 = {
                oddValue: outcome.odd,
                betPickCode: outcome.betTypeOutcomeId
              };
            }
          }
        }
      }

      // Process event even if no valid odds found - will show "-" for missing odds
      if (Object.keys(readableOdds).length === 0) {
        console.log(`Processing event ${event.id} with no valid basketball odds - will show "-"`);
      }

      // Parse team names from event name (assuming format: "Team1 - Team2")
      const teamNames = event.name.split(' - ');
      const homeTeam = teamNames[0]?.trim() || 'Home Team';
      const awayTeam = teamNames[1]?.trim() || 'Away Team';

      // Create processed match
      const processedMatch: ProcessedPreGameMatch = {
        id: event.id,
        matchCode: event.sportMatchId,
        home: homeTeam,
        away: awayTeam,
        league: event.competitionName,
        sport: 'B', // Basketball
        kickOffTime: new Date(event.dateTime).getTime(),
        status: event.status,
        blocked: !event.isPlayable,
        favourite: event.isTopOffer,
        bets: {
          odds: readableOdds
        }
      };

      // Store the match
      this.config.matches.set(event.id, processedMatch);
      
      console.log(`Processed basketball match: ${homeTeam} vs ${awayTeam} (${event.competitionName})`);

    } catch (error) {
      console.error(`Error processing AdmiralBet event ${event.id}:`, error);
    }
  }
}
