import { Request, Response } from 'express';
import { PreGamesService } from '../services/PreGamesService';

export class PreGamesController {
  private preGamesService: PreGamesService;

  constructor() {
    this.preGamesService = new PreGamesService();
  }

  public startPreGames = async (req: Request, res: Response): Promise<void> => {
    try {
      const { collectionInterval = 120, sport = 'B' } = req.body;

      // Validate interval
      if (![120].includes(collectionInterval)) {
        res.status(400).json({
          success: false,
          error: 'Collection interval must be 120 seconds'
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
      if (this.preGamesService.getStatus().isRunning) {
        await this.preGamesService.stopPreGames();
      }

      await this.preGamesService.startPreGames(collectionInterval, sport);

      const sportName = sport === 'B' ? 'basketball' : sport === 'T' ? 'tennis' : 'football';
      res.json({
        success: true,
        message: `AdmiralBet ${sportName} pre-games collection started successfully`,
        data: {
          collectionInterval,
          sportFilter: sport
        }
      });
    } catch (error) {
      console.error('Error starting pre-games collection:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start pre-games collection'
      });
    }
  };

  public stopPreGames = async (req: Request, res: Response): Promise<void> => {
    try {
      await this.preGamesService.stopPreGames();

      res.json({
        success: true,
        message: 'Pre-games collection stopped successfully'
      });
    } catch (error) {
      console.error('Error stopping pre-games collection:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to stop pre-games collection'
      });
    }
  };

  public getStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const status = this.preGamesService.getStatus();

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      console.error('Error getting pre-games status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get pre-games status'
      });
    }
  };

  public getMatches = async (req: Request, res: Response): Promise<void> => {
    try {
      const matches = this.preGamesService.getMatches();

      res.json({
        success: true,
        data: matches
      });
    } catch (error) {
      console.error('Error getting pre-games matches:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get pre-games matches'
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

      const match = this.preGamesService.getMatchById(matchIdNum);

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
      console.error('Error getting pre-games match by ID:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get pre-games match'
      });
    }
  };

}
