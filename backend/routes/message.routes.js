import express from 'express';
import Message from '../models/message.model.js';

const router = express.Router();

router.get('/:projectId', async (req, res) => {

    try {

        const messages = await Message
            .find({
                project: req.params.projectId
            })
            .populate('sender', 'email')
            .sort({ createdAt: 1 });

        res.status(200).json(messages);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: 'Failed to fetch messages'
        });
    }

});

export default router;