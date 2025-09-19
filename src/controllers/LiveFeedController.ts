import { Request, Response } from 'express';
import { LiveFeedService } from '../services/LiveFeedService';

export class LiveFeedController {
  private liveFeedService: LiveFeedService;

  constructor() {
    this.liveFeedService = new LiveFeedService();
  }

  public startLiveFeed = async (req: Request, res: Response): Promise<void> => {
    try {
      const { collectionInterval = 1, sport = 'S' } = req.body;

      // Validate interval
      if (collectionInterval < 1 || collectionInterval > 300) {
        res.status(400).json({
          success: false,
          error: 'Collection interval must be between 1 and 300 seconds'
        });
        return;
      }

      // Validate sport
      if (!['S', 'B', 'T'].includes(sport)) {
        res.status(400).json({
          success: false,
          error: 'Invalid sport. Allowed values: S (Football), B (Basketball), T (Tennis)'
        });
        return;
      }

      await this.liveFeedService.startLiveFeed(collectionInterval, sport);

      const sportName = sport === 'S' ? 'Football' : sport === 'B' ? 'Basketball' : 'Tennis';
      res.json({
        success: true,
        message: `${sportName} live feed started successfully`,
        data: {
          collectionInterval,
          sportFilter: sport
        }
      });
    } catch (error) {
      console.error('Error starting live feed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start live feed'
      });
    }
  };

  public stopLiveFeed = async (req: Request, res: Response): Promise<void> => {
    try {
      await this.liveFeedService.stopLiveFeed();

      res.json({
        success: true,
        message: 'Live feed stopped successfully'
      });
    } catch (error) {
      console.error('Error stopping live feed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to stop live feed'
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
      console.error('Error getting matches:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get matches'
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
      console.error('Error getting match by ID:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get match'
      });
    }
  };
}
