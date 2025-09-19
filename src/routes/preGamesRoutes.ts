import { Router } from 'express';
import { PreGamesController } from '../controllers/PreGamesController';

const router = Router();
const preGamesController = new PreGamesController();

// Pre-games routes
router.post('/start', preGamesController.startPreGames);
router.post('/stop', preGamesController.stopPreGames);
router.get('/status', preGamesController.getStatus);
router.get('/matches', preGamesController.getMatches);
router.get('/matches/:matchId', preGamesController.getMatchById);

export default router;
