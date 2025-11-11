# Nya.chat Backend

A powerful WhatsApp Web API backend built with Node.js, Express, TypeScript, and whatsapp-web.js.

## Features

- 🔐 JWT-based authentication
- 📱 Multi-session WhatsApp Web support
- 💬 Real-time messaging via WebSocket
- 🔄 Automatic session restoration (no QR code after restart)
- 📊 Message history and chat synchronization
- 🗄️ MongoDB for data persistence
- 🎯 TypeScript for type safety
- 📝 Comprehensive logging with Winston

## Prerequisites

- Node.js 18.x or higher
- MongoDB 5.x or higher
- npm or yarn

## Installation

1. Clone the repository:
```
cd server
npm install
```

2. Create a `.env` file in the server directory:
```
# Server
NODE_ENV=development
PORT=3080
API_VERSION=v1

# Database
MONGO_URI=mongodb://admin:nya-chat-admin-password-2024@localhost:27011/nya-chat?authSource=admin

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# WhatsApp
MAX_SESSIONS_PER_USER=3

# CORS
CORS_ORIGIN=http://localhost:5173
```

3. Build the TypeScript code:
```
npm run build
```

## Running the Server

### Development Mode
```
npm run dev
```

### Production Mode
```
npm start
```

## Project Structure

```
server/
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # Route controllers
│   ├── middleware/      # Express middleware
│   ├── models/          # Mongoose models
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   │   ├── auth/        # Authentication services
│   │   ├── socket/      # WebSocket manager
│   │   └── whatsapp/    # WhatsApp session manager
│   ├── types/           # TypeScript types
│   ├── utils/           # Utility functions
│   ├── app.ts           # Express app setup
│   └── server.ts        # Server entry point
├── .env                 # Environment variables
├── package.json
└── tsconfig.json
```

## API Endpoints

### Authentication
- `POST /v1/auth/register` - Register new user
- `POST /v1/auth/login` - Login user
- `GET /v1/auth/me` - Get current user

### WhatsApp Sessions
- `POST /v1/whatsapp/sessions` - Create new session
- `GET /v1/whatsapp/sessions` - Get all sessions
- `DELETE /v1/whatsapp/sessions/:sessionId` - Delete session

### Chats
- `GET /v1/chats/:sessionId` - Get all chats

### Messages
- `GET /v1/messages/:sessionId/chat/:chatId` - Get messages
- `POST /v1/messages/:sessionId/send` - Send message
- `POST /v1/messages/:sessionId/chat/:chatId/read` - Mark as read

## WebSocket Events

### Client → Server
- `join_session` - Join a session room
- `leave_session` - Leave a session room

### Server → Client
- `qr_code` - QR code for authentication
- `session_status` - Session status updates
- `sync_progress` - Chat synchronization progress
- `message_received` - New message received
- `message_ack` - Message acknowledgment

## Session Restoration

WhatsApp sessions are automatically restored on server restart using LocalAuth. Authentication data is stored in `.wwebjs_auth/` directory. No QR code scanning is required after initial setup.

## Logging

Logs are written to:
- Console (development)
- `logs/combined.log` (all logs)
- `logs/error.log` (errors only)

## Technologies Used

- **Express.js** - Web framework
- **TypeScript** - Type safety
- **MongoDB** - Database
- **Socket.IO** - WebSocket communication
- **whatsapp-web.js** - WhatsApp Web API
- **Winston** - Logging
- **JWT** - Authentication
- **Puppeteer** - Browser automation (for WhatsApp)

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.
