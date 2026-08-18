import 'dotenv/config.js';
import http from 'http';
import app from './app.js';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import projectModel from './models/project.model.js';
import { generateResult } from './services/ai.service.js';
import Message from './models/message.model.js';

const port = process.env.PORT || 3001;



const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*'
    }
});


io.use(async (socket, next) => {

    try {

        const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.split(' ')[ 1 ];
        const projectId = socket.handshake.query.projectId;

        if (!mongoose.Types.ObjectId.isValid(projectId)) {
            return next(new Error('Invalid projectId'));
        }


        socket.project = await projectModel.findById(projectId);

        if (!socket.project) {
            return next(new Error('Project not found'));
        }

        if (!token) {
            return next(new Error('Authentication error'))
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (!decoded) {
            return next(new Error('Authentication error'))
        }


        socket.user = decoded;

        next();

    } catch (error) {
        next(error)
    }

})


io.on('connection', socket => {
    socket.roomId = socket.project._id.toString()

    console.log('a user connected');

    socket.join(socket.roomId);

socket.on('project-message', async data => {

    const message = data.message;

    try {

        // Save user message
        const savedMessage = await Message.create({
            project: socket.project._id,
            sender: socket.user._id,
            senderType: 'user',
            message: message
        });

        const messageData = {
            message: savedMessage.message,
            sender: {
                _id: socket.user._id,
                email: socket.user.email
            },
            senderType: 'user',
            createdAt: savedMessage.createdAt
        };

        // Send to everyone in project
        io.to(socket.roomId).emit(
            'project-message',
            messageData
        );


        // Check AI
        const aiIsPresentInMessage = message.includes('@ai');

        if (aiIsPresentInMessage) {

            const prompt = message.replace('@ai', '');

            try {

                const result = await generateResult(prompt);

                // Save AI message
                const aiMessage = await Message.create({
                    project: socket.project._id,
                    sender: null,
                    senderType: 'ai',
                    message: result
                });

                // Send AI message
                io.to(socket.roomId).emit(
                    'project-message',
                    {
                        message: aiMessage.message,
                        sender: {
                            _id: 'ai',
                            email: 'AI'
                        },
                        senderType: 'ai',
                        createdAt: aiMessage.createdAt
                    }
                );

            } catch (error) {

                console.error('AI ERROR:', error);

                io.to(socket.roomId).emit(
                    'project-message',
                    {
                        message: 'AI is temporarily unavailable. Please try again.',
                        sender: {
                            _id: 'ai',
                            email: 'AI'
                        },
                        senderType: 'ai'
                    }
                );
            }
        }

    } catch (error) {

        console.error('MESSAGE SAVE ERROR:', error);

    }

});
    socket.on('disconnect', () => {
        console.log('user disconnected');
        socket.leave(socket.roomId)
    });
});




server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})