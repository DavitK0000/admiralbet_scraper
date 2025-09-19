import fs from 'fs';
import path from 'path';
import { ProcessedMatch, ProcessedPreGameMatch, ProcessedLiveFeedMatch } from '../types';
import { RedisService } from './RedisService';

export class DataStorageService {
  private redisService: RedisService;
  private storageType: string;
  private filePath: string;
  private redisAvailable: boolean = false;

  constructor() {
    this.redisService = new RedisService();
    this.storageType = 'file'; // Default to file, will be updated based on Redis availability
    this.filePath = process.env.DATA_FILE_PATH || 'data/football-live-feed-data.json';
    
    this.ensureOutputDirectory();
  }

  private ensureOutputDirectory(): void {
    if (this.storageType === 'file' || this.storageType === 'both') {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  public async initialize(): Promise<void> {
    try {
      await this.redisService.connect();
      this.redisAvailable = true;
      this.storageType = 'redis';
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn('Failed to initialize Redis service, falling back to file storage:', errorMessage);
      this.redisAvailable = false;
      this.storageType = 'file';
    }
  }

  public async saveData(matches: ProcessedMatch[], metadata: any): Promise<void> {
    try {
      if (this.redisAvailable && this.redisService.isRedisConnected()) {
        await this.saveToRedis(matches, metadata);
      } else {
        await this.saveToFile(matches, metadata);
      }
    } catch (error) {
      console.error('Error saving data:', error);
      throw error;
    }
  }

  public async savePreGamesData(matches: ProcessedPreGameMatch[], metadata: any): Promise<void> {
    try {
      if (this.redisAvailable && this.redisService.isRedisConnected()) {
        await this.savePreGamesToRedis(matches, metadata);
      } else {
        await this.savePreGamesToFile(matches, metadata);
      }
    } catch (error) {
      console.error('Error saving pre-games data:', error);
      throw error;
    }
  }

  public async saveLiveFeedData(matches: ProcessedLiveFeedMatch[], metadata: any): Promise<void> {
    try {
      if (this.redisAvailable && this.redisService.isRedisConnected()) {
        await this.saveLiveFeedToRedis(matches, metadata);
      } else {
        await this.saveLiveFeedToFile(matches, metadata);
      }
    } catch (error) {
      console.error('Error saving live feed data:', error);
      throw error;
    }
  }

  private async saveToFile(matches: ProcessedMatch[], metadata: any): Promise<void> {
    try {
      let existingData: any = {};
      
      // Read existing data if file exists
      if (fs.existsSync(this.filePath)) {
        try {
          const fileContent = fs.readFileSync(this.filePath, 'utf8');
          existingData = JSON.parse(fileContent);
        } catch (parseError) {
          console.warn('Error parsing existing data file, starting fresh:', parseError);
          existingData = {};
        }
      }

      // Update existing data with current matches
      for (const match of matches) {
        if (!existingData.matches) {
          existingData.matches = [];
        }
        
        // Find existing match by ID
        const existingMatchIndex = existingData.matches.findIndex((m: any) => m.id === match.id);
        
        if (existingMatchIndex >= 0) {
          // Update existing match with all its data including bets
          existingData.matches[existingMatchIndex] = match;
        } else {
          // Add new match with all its data including bets
          existingData.matches.push(match);
        }
      }

      // Update metadata
      existingData.lastUpdated = metadata.lastUpdated;
      existingData.collectionInterval = metadata.collectionInterval;
      existingData.totalMatches = existingData.matches.length;

      // Write updated data back to file
      fs.writeFileSync(this.filePath, JSON.stringify(existingData, null, 2));
    } catch (error) {
      console.error('Error saving data to file:', error);
      throw error;
    }
  }

  private async saveToRedis(matches: ProcessedMatch[], metadata: any): Promise<void> {
    try {
      await this.redisService.saveMatches(matches);
      await this.redisService.saveMetadata(metadata);
    } catch (error) {
      console.error('Error saving data to Redis:', error);
      throw error;
    }
  }

  public async getData(): Promise<{ matches: ProcessedMatch[], metadata: any } | null> {
    try {
      if (this.redisAvailable && this.redisService.isRedisConnected()) {
        return await this.getFromRedis();
      } else {
        return await this.getFromFile();
      }
    } catch (error) {
      console.error('Error getting data:', error);
      return null;
    }
  }

  private async getFromFile(): Promise<{ matches: ProcessedMatch[], metadata: any } | null> {
    try {
      if (!fs.existsSync(this.filePath)) {
        return null;
      }

      const fileContent = fs.readFileSync(this.filePath, 'utf8');
      const data = JSON.parse(fileContent);
      
      return {
        matches: data.matches || [],
        metadata: {
          lastUpdated: data.lastUpdated,
          collectionInterval: data.collectionInterval,
          totalMatches: data.totalMatches
        }
      };
    } catch (error) {
      console.error('Error reading data from file:', error);
      return null;
    }
  }

  private async getFromRedis(): Promise<{ matches: ProcessedMatch[], metadata: any } | null> {
    try {
      const matches = await this.redisService.getMatches();
      const metadata = await this.redisService.getMetadata();
      
      return {
        matches,
        metadata
      };
    } catch (error) {
      console.error('Error reading data from Redis:', error);
      return null;
    }
  }

  public async clearData(): Promise<void> {
    try {
      if (this.redisAvailable && this.redisService.isRedisConnected()) {
        await this.redisService.clearAllData();
      } else {
        await this.clearFileData();
      }
    } catch (error) {
      console.error('Error clearing data:', error);
      throw error;
    }
  }

  private async clearFileData(): Promise<void> {
    try {
      if (fs.existsSync(this.filePath)) {
        fs.unlinkSync(this.filePath);
      }
    } catch (error) {
      console.error('Error clearing file data:', error);
      throw error;
    }
  }

  public getStorageType(): string {
    return this.storageType;
  }

  public isRedisConnected(): boolean {
    return this.redisAvailable && this.redisService.isRedisConnected();
  }

  public isRedisAvailable(): boolean {
    return this.redisAvailable;
  }

  public async disconnect(): Promise<void> {
    if (this.redisService.isRedisConnected()) {
      await this.redisService.disconnect();
    }
  }

  private async savePreGamesToFile(matches: ProcessedPreGameMatch[], metadata: any): Promise<void> {
    try {
      const preGamesFilePath = path.join(process.cwd(), 'data', 'pre-games-data.json');
      let existingData: any = {};
      
      // Read existing data if file exists
      if (fs.existsSync(preGamesFilePath)) {
        try {
          const fileContent = fs.readFileSync(preGamesFilePath, 'utf8');
          existingData = JSON.parse(fileContent);
        } catch (parseError) {
          console.warn('Error parsing existing pre-games data file, starting fresh:', parseError);
          existingData = {};
        }
      }

      // Update existing data with current matches
      for (const match of matches) {
        if (!existingData.matches) {
          existingData.matches = [];
        }
        
        // Find existing match by ID
        const existingMatchIndex = existingData.matches.findIndex((m: any) => m.id === match.id);
        
        if (existingMatchIndex >= 0) {
          // Update existing match with all its data including bets
          existingData.matches[existingMatchIndex] = match;
        } else {
          // Add new match with all its data including bets
          existingData.matches.push(match);
        }
      }

      // Update metadata
      existingData.lastUpdated = metadata.lastUpdated;
      existingData.collectionInterval = metadata.collectionInterval;
      existingData.selectedSport = metadata.selectedSport;
      existingData.totalMatches = existingData.matches.length;
      existingData.totalLeagues = metadata.totalLeagues;

      // Write updated data back to file
      fs.writeFileSync(preGamesFilePath, JSON.stringify(existingData, null, 2));
    } catch (error) {
      console.error('Error saving pre-games data to file:', error);
      throw error;
    }
  }

  private async savePreGamesToRedis(matches: ProcessedPreGameMatch[], metadata: any): Promise<void> {
    try {
      await this.redisService.saveMatches(matches as any); // Type assertion for compatibility
      await this.redisService.saveMetadata(metadata);
    } catch (error) {
      console.error('Error saving pre-games data to Redis:', error);
      throw error;
    }
  }

  private async saveLiveFeedToFile(matches: ProcessedLiveFeedMatch[], metadata: any): Promise<void> {
    try {
      const liveFeedFilePath = path.join(process.cwd(), 'data', 'live-feed-data.json');
      let existingData: any = {};
      
      // Read existing data if file exists
      if (fs.existsSync(liveFeedFilePath)) {
        try {
          const fileContent = fs.readFileSync(liveFeedFilePath, 'utf8');
          existingData = JSON.parse(fileContent);
        } catch (parseError) {
          console.warn('Error parsing existing live feed data file, starting fresh:', parseError);
          existingData = {};
        }
      }

      // Update existing data with current matches
      for (const match of matches) {
        if (!existingData.matches) {
          existingData.matches = [];
        }
        
        // Find existing match by ID
        const existingMatchIndex = existingData.matches.findIndex((m: any) => m.id === match.id);
        
        if (existingMatchIndex >= 0) {
          // Update existing match with all its data including bets
          existingData.matches[existingMatchIndex] = match;
        } else {
          // Add new match with all its data including bets
          existingData.matches.push(match);
        }
      }

      // Update metadata
      existingData.lastUpdated = metadata.lastUpdated;
      existingData.collectionInterval = metadata.collectionInterval;
      existingData.selectedSport = metadata.selectedSport;
      existingData.totalMatches = existingData.matches.length;
      existingData.totalLeagues = metadata.totalLeagues;

      // Write updated data back to file
      fs.writeFileSync(liveFeedFilePath, JSON.stringify(existingData, null, 2));
    } catch (error) {
      console.error('Error saving live feed data to file:', error);
      throw error;
    }
  }

  private async saveLiveFeedToRedis(matches: ProcessedLiveFeedMatch[], metadata: any): Promise<void> {
    try {
      await this.redisService.saveMatches(matches as any); // Type assertion for compatibility
      await this.redisService.saveMetadata(metadata);
    } catch (error) {
      console.error('Error saving live feed data to Redis:', error);
      throw error;
    }
  }
}
