import { createClient } from 'redis';
import { ProcessedMatch } from '../types';

export class RedisService {
  private client: ReturnType<typeof createClient>;
  private isConnected: boolean = false;
  private connectionFailed: boolean = false;

  constructor() {
    const redisUrl = `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`;
    
    this.client = createClient({
      url: redisUrl,
      password: process.env.REDIS_PASSWORD || undefined,
      database: parseInt(process.env.REDIS_DB || '0'),
      socket: {
        reconnectStrategy: false // Disable automatic reconnection
      }
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      this.isConnected = true;
      this.connectionFailed = false;
    });

    this.client.on('error', (error) => {
      if (!this.connectionFailed) {
        console.error('Redis client error:', error);
        this.connectionFailed = true;
        this.isConnected = false;
      }
    });

    this.client.on('disconnect', () => {
      this.isConnected = false;
    });
  }

  public async connect(): Promise<void> {
    if (this.connectionFailed) {
      throw new Error('Redis connection previously failed, not attempting to reconnect');
    }

    try {
      await this.client.connect();
    } catch (error) {
      this.connectionFailed = true;
      console.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.client.disconnect();
    } catch (error) {
      console.error('Error disconnecting from Redis:', error);
    }
  }

  public isRedisConnected(): boolean {
    return this.isConnected && !this.connectionFailed;
  }

  public hasConnectionFailed(): boolean {
    return this.connectionFailed;
  }

  // Helper function to safely convert any value to string
  private safeToString(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'boolean') {
      return value.toString();
    }
    if (typeof value === 'string') {
      return value;
    }
    return String(value);
  }

  // Save matches data to Redis
  public async saveMatches(matches: ProcessedMatch[]): Promise<void> {
    if (this.connectionFailed) {
      throw new Error('Redis connection has failed, cannot save data');
    }
    
    if (!this.isConnected) {
      throw new Error('Redis client is not connected');
    }

    try {
      console.log(`[RedisService] Saving ${matches.length} matches to Redis...`);
      const matchesKey = process.env.REDIS_MATCHES_KEY || 'maxbet:football:matches';
      
      // Save each match as a separate hash
      for (const match of matches) {
        const matchKey = `${matchesKey}:${match.id}`;
        // Prepare hash data, ensuring all values are strings and not undefined
        const hashData: Record<string, string> = {
          id: this.safeToString(match.id || 0),
          matchCode: this.safeToString(match.matchCode || 0),
          home: this.safeToString(match.home),
          away: this.safeToString(match.away),
          league: this.safeToString(match.league),
          leagueShort: this.safeToString(match.leagueShort),
          sport: this.safeToString(match.sport),
          sportName: this.safeToString(match.sportName),
          kickOffTime: this.safeToString(match.kickOffTime || 0),
          liveStatus: this.safeToString(match.liveStatus),
          streamSource: this.safeToString(match.streamSource),
          tvChannelInfo: this.safeToString(match.tvChannelInfo),
          isLive: this.safeToString(match.isLive !== undefined ? match.isLive : false),
          announcement: this.safeToString(match.announcement !== undefined ? match.announcement : false),
          lastChangeTime: this.safeToString(match.lastChangeTime || 0),
          bettingAllowed: this.safeToString(match.bettingAllowed !== undefined ? match.bettingAllowed : false),
          topMatch: this.safeToString(match.topMatch !== undefined ? match.topMatch : false),
          externalId: this.safeToString(match.externalId),
          leagueId: this.safeToString(match.leagueId || 0),
          bets: JSON.stringify(match.bets || { odds: {} })
        };

        // Debug: Check for undefined values and log data types
        for (const [key, value] of Object.entries(hashData)) {
          if (value === undefined) {
            console.error(`Found undefined value for key: ${key} in match ${match.id}`);
          }
          if (typeof value !== 'string') {
            console.error(`Found non-string value for key: ${key} in match ${match.id}, type: ${typeof value}, value: ${value}`);
          }
        }

        try {
          await this.client.hSet(matchKey, hashData);
          console.log(`[RedisService] Successfully saved match ${match.id} to Redis`);
        } catch (error) {
          console.error(`[RedisService] Error saving match ${match.id} to Redis:`, error);
          console.error('[RedisService] Hash data:', hashData);
          throw error;
        }

        // Set expiration for match data (24 hours)
        await this.client.expire(matchKey, 86400);
      }

      // Update matches index
      const matchIds = matches.map(match => match.id.toString());
      await this.client.sAdd(`${matchesKey}:index`, matchIds);
      
      console.log(`[RedisService] Successfully saved ${matches.length} matches to Redis`);
    } catch (error) {
      console.error('[RedisService] Error saving matches to Redis:', error);
      throw error;
    }
  }

  // Save metadata to Redis
  public async saveMetadata(metadata: any): Promise<void> {
    if (this.connectionFailed) {
      throw new Error('Redis connection has failed, cannot save data');
    }
    
    if (!this.isConnected) {
      throw new Error('Redis client is not connected');
    }

    try {
      const metadataKey = process.env.REDIS_METADATA_KEY || 'maxbet:football:metadata';
      
      // Prepare metadata hash data, ensuring all values are strings and not undefined
      const metadataHashData: Record<string, string> = {
        lastUpdated: metadata.lastUpdated || new Date().toISOString(),
        collectionInterval: (metadata.collectionInterval || 0).toString(),
        totalMatches: (metadata.totalMatches || 0).toString(),
        timestamp: new Date().toISOString()
      };

      await this.client.hSet(metadataKey, metadataHashData);

      // Set expiration for metadata (24 hours)
      await this.client.expire(metadataKey, 86400);
      
    } catch (error) {
      console.error('Error saving metadata to Redis:', error);
      throw error;
    }
  }

  // Get all matches from Redis
  public async getMatches(): Promise<ProcessedMatch[]> {
    if (this.connectionFailed) {
      throw new Error('Redis connection has failed, cannot get data');
    }
    
    if (!this.isConnected) {
      throw new Error('Redis client is not connected');
    }

    try {
      const matchesKey = process.env.REDIS_MATCHES_KEY || 'maxbet:football:matches';
      const indexKey = `${matchesKey}:index`;
      
      // Get all match IDs from index
      const matchIds = await this.client.sMembers(indexKey);
      
      const matches: ProcessedMatch[] = [];
      
      for (const matchId of matchIds) {
        const matchKey = `${matchesKey}:${matchId}`;
        const matchData = await this.client.hGetAll(matchKey);
        
        if (matchData && Object.keys(matchData).length > 0) {
          const match: ProcessedMatch = {
            id: parseInt(matchData.id),
            matchCode: parseInt(matchData.matchCode),
            home: matchData.home,
            away: matchData.away,
            league: matchData.league,
            leagueShort: matchData.leagueShort,
            sport: matchData.sport,
            sportName: matchData.sportName,
            kickOffTime: parseInt(matchData.kickOffTime),
            liveStatus: matchData.liveStatus,
            streamSource: matchData.streamSource,
            tvChannelInfo: matchData.tvChannelInfo,
            isLive: matchData.isLive === 'true',
            announcement: matchData.announcement,
            lastChangeTime: parseInt(matchData.lastChangeTime),
            bettingAllowed: matchData.bettingAllowed === 'true',
            topMatch: matchData.topMatch === 'true',
            externalId: matchData.externalId,
            leagueId: parseInt(matchData.leagueId),
            bets: JSON.parse(matchData.bets)
          };
          
          matches.push(match);
        }
      }
      
      console.log(`Retrieved ${matches.length} matches from Redis`);
      return matches;
    } catch (error) {
      console.error('Error getting matches from Redis:', error);
      throw error;
    }
  }

  // Get metadata from Redis
  public async getMetadata(): Promise<any> {
    if (this.connectionFailed) {
      throw new Error('Redis connection has failed, cannot get data');
    }
    
    if (!this.isConnected) {
      throw new Error('Redis client is not connected');
    }

    try {
      const metadataKey = process.env.REDIS_METADATA_KEY || 'maxbet:football:metadata';
      const metadata = await this.client.hGetAll(metadataKey);
      
      if (metadata && Object.keys(metadata).length > 0) {
        return {
          lastUpdated: metadata.lastUpdated,
          collectionInterval: parseInt(metadata.collectionInterval),
          totalMatches: parseInt(metadata.totalMatches),
          timestamp: metadata.timestamp
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting metadata from Redis:', error);
      throw error;
    }
  }

  // Clear all data from Redis
  public async clearAllData(): Promise<void> {
    if (this.connectionFailed) {
      throw new Error('Redis connection has failed, cannot clear data');
    }
    
    if (!this.isConnected) {
      throw new Error('Redis client is not connected');
    }

    try {
      const matchesKey = process.env.REDIS_MATCHES_KEY || 'maxbet:football:matches';
      const metadataKey = process.env.REDIS_METADATA_KEY || 'maxbet:football:metadata';
      
      // Get all match keys
      const matchKeys = await this.client.keys(`${matchesKey}:*`);
      
      // Delete all match keys
      if (matchKeys.length > 0) {
        await this.client.del(matchKeys);
      }
      
      // Delete metadata
      await this.client.del(metadataKey);
      
      console.log('Cleared all data from Redis');
    } catch (error) {
      console.error('Error clearing data from Redis:', error);
      throw error;
    }
  }
}
