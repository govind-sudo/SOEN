import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
    {
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'project',
            required: true
        },

        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'user',
            default: null
        },

        senderType: {
            type: String,
            enum: ['user', 'ai'],
            default: 'user'
        },

        message: {
            type: String,
            required: true,
            trim: true
        }
    },
    {
        timestamps: true
    }
);

const Message = mongoose.model('message', messageSchema);

export default Message;