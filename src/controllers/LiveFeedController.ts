import { Request, Response } from 'express';
import { LiveFeedService } from '../services/LiveFeedService';

export class LiveFeedController {
  private liveFeedService: LiveFeedService;

  constructor() {
    this.liveFeedService = new LiveFeedService();
  }

  public startLiveFeed = async (req: Request, res: Response): Promise<void> => {
    try {
      const { collectionInterval = 30, sport = 'S' } = req.body;

      // Validate interval
      if (![1, 15, 30, 60, 120].includes(collectionInterval)) {
        res.status(400).json({
          success: false,
          error: 'Collection interval must be 1, 15, 30, 60, or 120 seconds'
        });
        return;
      }

      // Validate sport - basketball, tennis, and football allowed for AdmiralBet
      if (!['B', 'T', 'S'].includes(sport)) {
        res.status(400).json({
          success: false,
          error: 'Invalid sport. Only basketball (B), tennis (T), and football (S) are supported for AdmiralBet'
        });
        return;
      }

      // Stop any running collection first
      if (this.liveFeedService.getStatus().isRunning) {
        await this.liveFeedService.stopLiveFeed();
      }

      await this.liveFeedService.startLiveFeed(collectionInterval, sport);

      const sportName = sport === 'B' ? 'basketball' : sport === 'T' ? 'tennis' : 'football';
      res.json({
        success: true,
        message: `AdmiralBet ${sportName} live feed collection started successfully`,
        data: {
          collectionInterval,
          sportFilter: sport
        }
      });
    } catch (error) {
      console.error('Error starting live feed collection:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start live feed collection'
      });
    }
  };

  public stopLiveFeed = async (req: Request, res: Response): Promise<void> => {
    try {
      await this.liveFeedService.stopLiveFeed();

      res.json({
        success: true,
        message: 'Live feed collection stopped successfully'
      });
    } catch (error) {
      console.error('Error stopping live feed collection:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to stop live feed collection'
      });
    }
  };

  public getStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const status = this.liveFeedService.getStatus();

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      console.error('Error getting live feed status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get live feed status'
      });
    }
  };

  public getMatches = async (req: Request, res: Response): Promise<void> => {
    try {
      const matches = this.liveFeedService.getMatches();

      res.json({
        success: true,
        data: matches
      });
    } catch (error) {
      console.error('Error getting live feed matches:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get live feed matches'
      });
    }
  };

  public getMatchById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { matchId } = req.params;
      const matchIdNum = parseInt(matchId);

      if (isNaN(matchIdNum)) {
        res.status(400).json({
          success: false,
          error: 'Invalid match ID'
        });
        return;
      }

      const match = this.liveFeedService.getMatchById(matchIdNum);

      if (!match) {
        res.status(404).json({
          success: false,
          error: 'Match not found'
        });
        return;
      }

      res.json({
        success: true,
        data: match
      });
    } catch (error) {
      console.error('Error getting live feed match by ID:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get live feed match'
      });
    }
  };
}