import { Router } from 'express';
import { LiveFeedController } from '../controllers/LiveFeedController';

const router = Router();
const liveFeedController = new LiveFeedController();

// Live feed routes
router.post('/start', liveFeedController.startLiveFeed);
router.post('/stop', liveFeedController.stopLiveFeed);
router.get('/status', liveFeedController.getStatus);
router.get('/matches', liveFeedController.getMatches);
router.get('/matches/:matchId', liveFeedController.getMatchById);

export default router;