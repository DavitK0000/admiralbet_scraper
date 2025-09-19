import axios from 'axios';
import { 
  LiveFeedResponse, 
  LiveHeader, 
  LiveBet, 
  ProcessedMatch, 
  ProcessedBet, 
  ReadableOdds,
  LiveFeedConfig,
  InitialStreamingResponse
} from '../types';
import { DataStorageService } from './DataStorageService';

export class LiveFeedService {
  private config: LiveFeedConfig;
  private currentStream?: any;
  private saveTimer?: NodeJS.Timeout;
  private dataStorageService: DataStorageService;
  private readonly INITIAL_STREAMING_URL = 'https://www.maxbet.rs/live/events/en';
  private readonly LIVE_FEED_URL = 'https://www.maxbet.rs/live/subscribe/sr?lastInitId=6352';
  private readonly ALLOWED_SPORTS = ['S', 'B', 'T']; // Football, Basketball, and Tennis
  private sportFilter: string = 'S'; // Default to football
  private readonly ALLOWED_OM_VALUES = [1, 2, 3, 4, 5, 6, 230, 229, 272, 273, 22, 278, 279, 23, 243, 244, 281, 379, 26, 50291, 50293, 50510, 50511, 50512, 50513]; // Football + Basketball + Tennis

  constructor() {
    console.log('[LiveFeedService] Initializing LiveFeedService...');
    
    this.config = {
      isRunning: false,
      collectionInterval: 1, // 1 second default (immediate)
      matches: new Map(),
      rawFeeds: [],
      isInitialStreaming: false
    };
    
    this.dataStorageService = new DataStorageService();
    this.initializeDataStorage();
    
    console.log('[LiveFeedService] Service initialized with config:', {
      collectionInterval: this.config.collectionInterval,
      sportFilter: this.sportFilter,
      allowedSports: this.ALLOWED_SPORTS,
      allowedOmValues: this.ALLOWED_OM_VALUES.length
    });
  }

  private async initializeDataStorage(): Promise<void> {
    try {
      console.log('[LiveFeedService] Initializing data storage service...');
      await this.dataStorageService.initialize();
      console.log('[LiveFeedService] Data storage service initialized successfully');
    } catch (error) {
      console.error('[LiveFeedService] Failed to initialize data storage service:', error);
    }
  }

  private isBpcForSelectedSport(bpc: number): boolean {
    // Sport-specific BPC filtering
    switch (this.sportFilter) {
      case 'S': // Football/Soccer
        // Football BPC values: 1, 2, 3, 4, 5, 6, 22, 23, 229, 230, 272, 273, 278, 279, 281, 379, 26, 243, 244
        const footballBpcs = [1, 2, 3, 4, 5, 6, 22, 23, 229, 230, 272, 273, 278, 279, 281, 379, 26, 243, 244];
        return footballBpcs.includes(bpc);

      case 'B': // Basketball
        // Basketball BPC values: 50291, 50293
        const basketballBpcs = [50291, 50293];
        return basketballBpcs.includes(bpc);

      case 'T': // Tennis
        // Tennis BPC values: 1, 3, 50510, 50511, 50512, 50513)
        const tennisBpcs = [1, 3, 50510, 50511, 50512, 50513];
        return tennisBpcs.includes(bpc);

      default:
        return true; // If we can't determine, include it
    }
  }


  private convertToReadableOdds(om: { [key: string]: { ov: number; bpc: number } }, specialValue: string, sport: string = 'S'): ReadableOdds {
    const readableOdds: ReadableOdds = {};

    for (const [key, value] of Object.entries(om)) {
      const omValue = parseInt(key);
      
      switch (omValue) {
        case 1:
          if (sport === 'T') {
            readableOdds.tennisHomeWins = { oddValue: value.ov, betPickCode: value.bpc };
          } else {
            readableOdds.fullTimeResultHomeWin = { oddValue: value.ov, betPickCode: value.bpc };
          }
          break;
        case 2:
          readableOdds.fullTimeResultDraw = { oddValue: value.ov, betPickCode: value.bpc };
          break;
        case 3:
          if (sport === 'T') {
            readableOdds.tennisAwayWins = { oddValue: value.ov, betPickCode: value.bpc };
          } else {
            readableOdds.fullTimeResultAwayWin = { oddValue: value.ov, betPickCode: value.bpc };
          }
          break;
        case 4:
          readableOdds.firstHalfResultHomeWin = { oddValue: value.ov, betPickCode: value.bpc };
          break;
        case 5:
          readableOdds.firstHalfResultDraw = { oddValue: value.ov, betPickCode: value.bpc };
          break;
        case 6:
          readableOdds.firstHalfResultAwayWin = { oddValue: value.ov, betPickCode: value.bpc };
          break;
        case 230:
          // Parse special value for first half under total
          const underTotalMatch = specialValue.match(/total=(\d+(?:\.\d+)?)/);
          const underTotalValue = underTotalMatch ? underTotalMatch[1] : specialValue;
          if (!readableOdds.firstHalfUnderTotal) {
            readableOdds.firstHalfUnderTotal = {};
          }
          readableOdds.firstHalfUnderTotal[underTotalValue] = { 
            oddValue: value.ov, 
            betPickCode: value.bpc
          };
          break;
        case 229:
          // Parse special value for first half over total
          const overTotalMatch = specialValue.match(/total=(\d+(?:\.\d+)?)/);
          const overTotalValue = overTotalMatch ? overTotalMatch[1] : specialValue;
          if (!readableOdds.firstHalfOverTotal) {
            readableOdds.firstHalfOverTotal = {};
          }
          readableOdds.firstHalfOverTotal[overTotalValue] = { 
            oddValue: value.ov, 
            betPickCode: value.bpc
          };
          break;
        case 272:
          readableOdds.bothTeamsToScore = { oddValue: value.ov, betPickCode: value.bpc };
          break;
        case 273:
          readableOdds.oneTeamNotToScore = { oddValue: value.ov, betPickCode: value.bpc };
          break;
        case 22:
          readableOdds.zeroToTwoGoals = { oddValue: value.ov, betPickCode: value.bpc };
          break;
        case 278:
          readableOdds.oneOrTwoGoals = { oddValue: value.ov, betPickCode: value.bpc };
          break;
        case 279:
          readableOdds.oneToThreeGoals = { oddValue: value.ov, betPickCode: value.bpc };
          break;
        case 23:
          readableOdds.twoOrThreeGoals = { oddValue: value.ov, betPickCode: value.bpc };
          break;
        case 243:
          readableOdds.twoToFourGoals = { oddValue: value.ov, betPickCode: value.bpc };
          break;
        case 244:
          readableOdds.threeToFourGoals = { oddValue: value.ov, betPickCode: value.bpc };
          break;
        case 281:
          readableOdds.threeToFiveGoals = { oddValue: value.ov, betPickCode: value.bpc };
          break;
        case 379:
          readableOdds.fourToFiveGoals = { oddValue: value.ov, betPickCode: value.bpc };
          break;
        case 26:
          readableOdds.fourToSixGoals = { oddValue: value.ov, betPickCode: value.bpc };
          break;
        case 50291:
          // Basketball FTOT1 (First Team Over Total 1)
          readableOdds.basketballFTOT1 = { oddValue: value.ov, betPickCode: value.bpc };
          break;
        case 50293:
          // Basketball FTOT2 (First Team Over Total 2)
          readableOdds.basketballFTOT2 = { oddValue: value.ov, betPickCode: value.bpc };
          break;
        case 50510:
          // Tennis Home Wins First Set
          readableOdds.tennisHomeWinsFirstSet = { oddValue: value.ov, betPickCode: value.bpc };
          break;
        case 50511:
          // Tennis Away Wins First Set
          readableOdds.tennisAwayWinsFirstSet = { oddValue: value.ov, betPickCode: value.bpc };
          break;
        case 50512:
          // Tennis Home Wins Second Set
          readableOdds.tennisHomeWinsSecondSet = { oddValue: value.ov, betPickCode: value.bpc };
          break;
        case 50513:
          // Tennis Away Wins Second Set
          readableOdds.tennisAwayWinsSecondSet = { oddValue: value.ov, betPickCode: value.bpc };
          break;
      }
    }

    return readableOdds;
  }

  public async startLiveFeed(collectionInterval: number = 1, sport: string = 'S'): Promise<void> {
    console.log(`[LiveFeedService] Starting live feed with interval: ${collectionInterval}s, sport: ${sport}`);
    
    if (this.config.isRunning) {
      console.log('[LiveFeedService] Live feed is already running, ignoring start request');
      return;
    }

    // Validate sport parameter
    if (!this.ALLOWED_SPORTS.includes(sport)) {
      const errorMsg = `Invalid sport: ${sport}. Allowed sports: ${this.ALLOWED_SPORTS.join(', ')}`;
      console.error(`[LiveFeedService] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    console.log('[LiveFeedService] Setting up configuration...');
    this.config.isRunning = true;
    this.config.collectionInterval = collectionInterval;
    this.sportFilter = sport;
    this.config.rawFeeds = [];
    this.config.matches.clear();
    this.config.isInitialStreaming = true;

    console.log('[LiveFeedService] Clearing previous data...');
    // Clear previous data from both files and Redis
    try {
      await this.dataStorageService.clearData();
      console.log('[LiveFeedService] Previous data cleared successfully');
    } catch (error) {
      console.error('[LiveFeedService] Error clearing previous data:', error);
      // Continue anyway - don't let clearing errors stop the feed
    }

    console.log('[LiveFeedService] Starting initial streaming...');
    // Start with initial streaming to get live_feed_url
    this.startInitialStreaming();
  }

  public async stopLiveFeed(): Promise<void> {
    console.log('[LiveFeedService] Stopping live feed...');
    
    if (!this.config.isRunning) {
      console.log('[LiveFeedService] Live feed is not running');
      return;
    }

    console.log('[LiveFeedService] Setting isRunning to false');
    this.config.isRunning = false;

    // Close the current stream
    if (this.currentStream) {
      console.log('[LiveFeedService] Closing current stream');
      this.currentStream.destroy();
      this.currentStream = undefined;
    }

    // Clear the save timer
    if (this.saveTimer) {
      console.log('[LiveFeedService] Clearing save timer');
      clearInterval(this.saveTimer);
      this.saveTimer = undefined;
    }

    // Save any remaining data before stopping
    console.log('[LiveFeedService] Saving remaining data before stopping...');
    await this.saveProcessedData();
    
    console.log('[LiveFeedService] Live feed stopped successfully');
  }

  private async startInitialStreaming(): Promise<void> {
    try {
      console.log('[LiveFeedService] Connecting to initial streaming URL:', this.INITIAL_STREAMING_URL);
      
      const response = await axios.get(this.INITIAL_STREAMING_URL, {
        timeout: 0, // No timeout for streaming
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        },
        responseType: 'stream'
      });

      console.log('[LiveFeedService] Initial streaming connection established');
      // Store the stream reference for cleanup
      this.currentStream = response.data;

      // Handle the streaming response
      let buffer = '';
      let initialData: InitialStreamingResponse = {};
      
      response.data.on('data', (chunk: Buffer) => {
        try {
          buffer += chunk.toString();
          
          // Split by newlines to process each line
          const lines = buffer.split('\n\n');
          
          // Keep the last incomplete line in buffer
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.trim()) {
              const parsedEvent = this.parseInitialStreamingLine(line);
              
              if (parsedEvent) {
                // Merge the parsed data
                if (parsedEvent.liveHeaders) {
                  initialData.liveHeaders = [...(initialData.liveHeaders || []), ...parsedEvent.liveHeaders];
                  console.log(`[LiveFeedService] Received ${parsedEvent.liveHeaders.length} live headers`);
                }
                if (parsedEvent.liveBets) {
                  initialData.liveBets = [...(initialData.liveBets || []), ...parsedEvent.liveBets];
                  console.log(`[LiveFeedService] Received ${parsedEvent.liveBets.length} live bets`);
                }
                if (parsedEvent.endTimestamp) {
                  initialData.endTimestamp = parsedEvent.endTimestamp;
                  console.log(`[LiveFeedService] Received end timestamp: ${parsedEvent.endTimestamp}`);
                }
              }
            }
          }
        } catch (parseError) {
          console.error('[LiveFeedService] Error parsing initial streaming data:', parseError);
        }
      });

      response.data.on('error', (error: Error) => {
        console.error('[LiveFeedService] Initial streaming error:', error);
        this.handleStreamingError();
      });

      response.data.on('end', () => {
        console.log('[LiveFeedService] Initial streaming completed');
        this.handleInitialStreamingComplete(initialData);
      });

    } catch (error) {
      console.error('[LiveFeedService] Error connecting to initial streaming:', error);
      this.handleStreamingError();
    }
  }

  private parseInitialStreamingLine(line: string): InitialStreamingResponse | null {
    try {
      // Handle SSE format with data: prefix
      if (line.startsWith('data:')) {
        const data = line.substring(5).trim();
        
        // Check for END with timestamp
        if (data.startsWith('END ')) {
          const timestampMatch = data.match(/END\s+(\d+)/);
          if (timestampMatch) {
            return {
              endTimestamp: parseInt(timestampMatch[1])
            };
          }
        }
        
        // Try to parse as JSON
        if (data && !data.startsWith('END ')) {
          try {
            const parsedData = JSON.parse(data);
            if (parsedData.liveHeaders) {
              return {
                liveHeaders: parsedData.liveHeaders,
                liveBets: parsedData.liveBets || []
              };
            }
          } catch (parseError) {
            // Not JSON, might be plain text with URL
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error parsing initial streaming line:', error);
      return null;
    }
  }

  private handleInitialStreamingComplete(initialData: InitialStreamingResponse): void {
    console.log('[LiveFeedService] Processing initial streaming data...');
    
    // Process initial data with sport filtering
    if (initialData.liveHeaders || initialData.liveBets) {
      const feedData: LiveFeedResponse = {
        liveHeaders: initialData.liveHeaders || [],
        liveBets: initialData.liveBets || [],
        liveResults: []
      };
      
      console.log(`[LiveFeedService] Processing initial data: ${feedData.liveHeaders.length} headers, ${feedData.liveBets.length} bets`);
      // Process the initial feed (no raw data storage)
      this.processFeed(feedData);
    }
    
    // Build the live feed URL using the end timestamp as lastInitId
    if (initialData.endTimestamp) {
      // Check if the end timestamp is recent (within last 5 minutes)
      const currentTime = Math.floor(Date.now() / 1000);
      const timeDiff = currentTime - initialData.endTimestamp;
      
      if (timeDiff > 300) { // More than 5 minutes old
        console.log(`[LiveFeedService] End timestamp is ${timeDiff}s old, using current timestamp`);
        this.config.liveFeedUrl = `https://www.maxbet.rs/live/subscribe/sr?lastInitId=${currentTime}`;
      } else {
        console.log(`[LiveFeedService] Using end timestamp: ${initialData.endTimestamp}`);
        this.config.liveFeedUrl = `https://www.maxbet.rs/live/subscribe/sr?lastInitId=${initialData.endTimestamp}`;
      }
    } else {
      console.warn('[LiveFeedService] No end timestamp found, using current timestamp');
      const currentTimestamp = Math.floor(Date.now() / 1000);
      this.config.liveFeedUrl = `https://www.maxbet.rs/live/subscribe/sr?lastInitId=${currentTimestamp}`;
    }
    
    console.log(`[LiveFeedService] Live feed URL: ${this.config.liveFeedUrl}`);
    
    // Switch to continuous streaming
    console.log('[LiveFeedService] Switching to continuous streaming...');
    this.config.isInitialStreaming = false;
    this.startCollection();
    this.startSaveTimer();
  }

  private handleStreamingError(): void {
    console.error('[LiveFeedService] Streaming error occurred');
    if (this.config.isRunning) {
      console.log('[LiveFeedService] Attempting to reconnect in 5 seconds...');
      // Clear the stored URL so reconnection uses current timestamp
      this.config.liveFeedUrl = undefined;
      setTimeout(() => {
        if (this.config.isInitialStreaming) {
          console.log('[LiveFeedService] Reconnecting to initial streaming...');
          this.startInitialStreaming();
        } else {
          console.log('[LiveFeedService] Reconnecting to live feed...');
          this.collectFeed();
        }
      }, 5000);
    }
  }

  private startCollection(): void {
    console.log('[LiveFeedService] Starting continuous collection...');
    // Start the continuous stream
    this.collectFeed();
  }

  private startSaveTimer(): void {
    console.log(`[LiveFeedService] Starting save timer with ${this.config.collectionInterval}s interval`);
    // Save data every collectionInterval seconds
    this.saveTimer = setInterval(() => {
      this.saveProcessedData();
    }, this.config.collectionInterval * 1000);
  }

  private async collectFeed(): Promise<void> {
    try {
      // Use the extracted live_feed_url if available, otherwise use current timestamp
      let feedUrl = this.config.liveFeedUrl;
      
      if (!feedUrl) {
        // Use current timestamp for reconnection
        const currentTimestamp = Math.floor(Date.now() / 1000);
        feedUrl = `https://www.maxbet.rs/live/subscribe/sr?lastInitId=${currentTimestamp}`;
        console.log(`[LiveFeedService] Using current timestamp for reconnection: ${currentTimestamp}`);
      } else {
        console.log(`[LiveFeedService] Using stored feed URL: ${feedUrl}`);
      }
      
      console.log('[LiveFeedService] Connecting to live feed...');
      const response = await axios.get(feedUrl, {
        timeout: 0, // No timeout for streaming
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        },
        responseType: 'stream'
      });

      console.log('[LiveFeedService] Live feed connection established');
      // Store the stream reference for cleanup
      this.currentStream = response.data;

      // Handle the streaming response
      let buffer = '';
      
      response.data.on('data', (chunk: Buffer) => {
        try {
          buffer += chunk.toString();
          
          // Process complete SSE events (separated by double newlines)
          const events = buffer.split('\n\n');
          
          // Keep the last incomplete event in buffer
          buffer = events.pop() || '';
          
          for (const event of events) {
            if (event.trim()) {
              this.parseSSEEvent(event);
            }
          }
        } catch (parseError) {
          console.error('[LiveFeedService] Error parsing feed data:', parseError);
        }
      });

      response.data.on('error', (error: Error) => {
        console.error('[LiveFeedService] Stream error:', error);
        this.handleStreamingError();
      });

      response.data.on('end', () => {
        console.log('[LiveFeedService] Live feed stream ended');
        // Clear the stored URL so reconnection uses current timestamp
        this.config.liveFeedUrl = undefined;
        // Attempt to reconnect if still running
        if (this.config.isRunning) {
          console.log('[LiveFeedService] Attempting to reconnect in 5 seconds...');
          setTimeout(() => {
            this.collectFeed();
          }, 5000);
        }
      });

    } catch (error) {
      console.error('[LiveFeedService] Error connecting to live feed:', error);
      this.handleStreamingError();
    }
  }

  private parseSSEEvent(event: string): void {
    try {
      const lines = event.split('\n');
      let eventType = '';
      let data = '';
      
      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventType = line.substring(6).trim();
        } else if (line.startsWith('data:')) {
          data += line.substring(5).trim();
        }
      }
      
      // Only process LIVE events
      if (eventType === 'LIVE' && data) {
        try {
          const feedData: LiveFeedResponse = JSON.parse(data);
          
          console.log(`[LiveFeedService] Processing LIVE event: ${feedData.liveHeaders?.length || 0} headers, ${feedData.liveBets?.length || 0} bets`);
          // Process the feed asynchronously without blocking (no raw data storage)
          setImmediate(() => {
            this.processFeed(feedData);
            this.config.lastProcessedTime = Date.now();
          });
        } catch (parseError) {
          console.error('[LiveFeedService] Error parsing JSON data:', parseError);
        }
      }
    } catch (error) {
      console.error('[LiveFeedService] Error parsing SSE event:', error);
    }
  }

  private processFeed(feed: LiveFeedResponse): void {
    console.log(`[LiveFeedService] Processing feed: ${feed.liveHeaders.length} headers, ${feed.liveBets.length} bets for sport: ${this.sportFilter}`);
    
    let processedHeaders = 0;
    let processedBets = 0;
    
    // Process liveHeaders - filter by sport
    for (const header of feed.liveHeaders) {
      // Only process matches for the selected sport
      if (header.s !== this.sportFilter) {
        continue;
      }

      processedHeaders++;

      // Check if match already exists
      if (this.config.matches.has(header.id)) {
        // Update existing match
        const existingMatch = this.config.matches.get(header.id)!;
        existingMatch.lastChangeTime = header.lct;
        existingMatch.liveStatus = header.ls;
        existingMatch.isLive = header.liv !== undefined ? header.liv : existingMatch.isLive;
        existingMatch.streamSource = header.ss;
        existingMatch.tvChannelInfo = header.tv;
        existingMatch.announcement = header.ann;
        existingMatch.bettingAllowed = header.ba !== undefined ? header.ba : existingMatch.bettingAllowed;
        existingMatch.topMatch = header.tm !== undefined ? header.tm : existingMatch.topMatch;
      } else {
        // Add new match
        const newMatch: ProcessedMatch = {
          id: header.id,
          matchCode: header.mc,
          home: header.h,
          away: header.a,
          league: header.lg,
          leagueShort: header.lsh,
          sport: header.s,
          sportName: header.sn,
          kickOffTime: header.kot,
          liveStatus: header.ls,
          streamSource: header.ss,
          tvChannelInfo: header.tv,
          isLive: header.liv !== undefined ? header.liv : false,
          announcement: header.ann,
          lastChangeTime: header.lct,
          bettingAllowed: header.ba !== undefined ? header.ba : false,
          topMatch: header.tm !== undefined ? header.tm : false,
          externalId: header.eid,
          leagueId: header.lid,
          bets: {
            odds: {}
          }
        };
        this.config.matches.set(header.id, newMatch);
        console.log(`[LiveFeedService] Added new match: ${header.h} vs ${header.a} (${header.sn})`);
      }
    }

    // Process liveBets - only football with filtered om values
    for (const bet of feed.liveBets) {
      // Check if match exists
      if (!this.config.matches.has(bet.mId)) {
        continue;
      }

      // Get the match to check its sport
      const match = this.config.matches.get(bet.mId)!;
      
      // Only process bets for the selected sport
      if (match.sport !== this.sportFilter) {
        continue;
      }
      
      processedBets++;
      
      // Filter om values - only save bets with allowed om values for the selected sport
      const filteredOm: { [key: string]: { ov: number; bpc: number } } = {};
      for (const [key, value] of Object.entries(bet.om)) {
        const omValue = parseInt(key);
        if (this.ALLOWED_OM_VALUES.includes(omValue) && this.isBpcForSelectedSport(omValue)) {
          filteredOm[key] = value;
        }
      }
      
      // Only process bet if it has allowed om values
      if (Object.keys(filteredOm).length === 0) {
        continue;
      }
      
      // Convert to readable odds format
      const readableOdds = this.convertToReadableOdds(filteredOm, bet.sv, this.sportFilter);
      
      // Merge odds into the existing bets object, considering special values for unique keys
      const existingOdds = match.bets.odds || {};
      const mergedOdds = { ...existingOdds };
      
      // For odds with special values, create unique keys that include the special value
      for (const [key, value] of Object.entries(readableOdds)) {
        if (!value) continue;
        
        let uniqueKey = key;
        
        // If this odd has a special value, create a descriptive key
        if (value.specialValue) {
          const specialValueMatch = value.specialValue.toString().match(/total=(\d+(?:\.\d+)?)/);
          if (specialValueMatch) {
            const totalValue = specialValueMatch[1];
            
            // Create descriptive keys based on the original key and special value
            if (key === 'firstHalfOverTotal') {
              uniqueKey = `firstHalfOver${totalValue}`;
            } else if (key === 'firstHalfUnderTotal') {
              uniqueKey = `firstHalfUnder${totalValue}`;
            } else {
              // For other odds with special values, append the value
              uniqueKey = `${key}_${totalValue}`;
            }
          }
        }
        
        mergedOdds[uniqueKey] = value;
      }
      
      // Update the single bets object for this match
      match.bets = {
        odds: mergedOdds
      };
    }
    
    console.log(`[LiveFeedService] Processed ${processedHeaders} headers and ${processedBets} bets for sport ${this.sportFilter}`);
  }

  private async saveProcessedData(): Promise<void> {
    if (this.config.matches.size === 0) {
      console.log('[LiveFeedService] No matches to save, skipping save operation');
      return;
    }

    try {
      const currentMatches = Array.from(this.config.matches.values());
      console.log(`[LiveFeedService] Saving ${currentMatches.length} matches to storage...`);
      
      const metadata = {
        lastUpdated: new Date().toISOString(),
        collectionInterval: this.config.collectionInterval,
        totalMatches: currentMatches.length
      };

      await this.dataStorageService.saveData(currentMatches, metadata);
      console.log('[LiveFeedService] Data saved successfully');
    } catch (error) {
      console.error('[LiveFeedService] Error saving processed data:', error);
    }
  }

  public getStatus(): any {
    const matches = Array.from(this.config.matches.values());
    const sportMatches = matches.filter(match => match.sport === this.sportFilter);
    const matchesWithOdds = sportMatches.filter(match => 
      Object.keys(match.bets.odds).length > 0
    );
    
    const status = {
      isRunning: this.config.isRunning,
      collectionInterval: this.config.collectionInterval,
      sportFilter: this.sportFilter,
      totalMatches: this.config.matches.size,
      sportMatches: {
        total: sportMatches.length,
        withDetailedOdds: matchesWithOdds.length
      },
      lastProcessedTime: this.config.lastProcessedTime,
      isInitialStreaming: this.config.isInitialStreaming,
      liveFeedUrl: this.config.liveFeedUrl,
      storageType: this.dataStorageService.getStorageType(),
      redisAvailable: this.dataStorageService.isRedisAvailable(),
      redisConnected: this.dataStorageService.isRedisConnected(),
      matches: matches.slice(0, 10) // Return first 10 matches for preview
    };
    
    console.log(`[LiveFeedService] Status requested - Running: ${status.isRunning}, Matches: ${status.totalMatches}, Sport Matches: ${status.sportMatches.total}, With Odds: ${status.sportMatches.withDetailedOdds}`);
    
    return status;
  }

  public getMatches(): ProcessedMatch[] {
    const matches = Array.from(this.config.matches.values());
    console.log(`[LiveFeedService] getMatches() called - returning ${matches.length} matches`);
    return matches;
  }

  public getMatchById(matchId: number): ProcessedMatch | undefined {
    const match = this.config.matches.get(matchId);
    console.log(`[LiveFeedService] getMatchById(${matchId}) called - ${match ? 'found' : 'not found'}`);
    return match;
  }
}
