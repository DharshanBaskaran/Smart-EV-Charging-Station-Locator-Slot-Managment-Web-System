const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  roomId: { type: String, required: true, index: true },
  userId: { type: String, required: true },
  username: { type: String, required: true },
  messages: [{
    sender: { type: String, enum: ['user', 'support', 'bot'], default: 'user' },
    senderName: String,
    text: String,
    timestamp: { type: Date, default: Date.now },
  }],
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
}, { timestamps: true });

module.exports = mongoose.model('Chat', chatSchema);
