import express from 'express';
import dotenv from 'dotenv';
const result = dotenv.config();
console.log('Dotenv Load Result:', result);
console.log('Process CWD:', process.cwd());
console.log('GEMINI_API_KEY from env:', process.env.GEMINI_API_KEY);

import cors from 'cors';
import mongoose from 'mongoose';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth';
import documentRoutes from './routes/documents';
import chatRoutes from './routes/chats';
import analyticsRoutes from './routes/analytics';
import aiRoutes from './routes/ai';
import recommendationRoutes from './routes/recommendations';

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS allowing credentials-based communication dynamically
app.use(cors({
  origin: (origin, callback) => {
    callback(null, true);
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Base Route check
app.get('/', (req, res) => {
  res.send('DocuMind AI Server API is operational!');
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/recommendations', recommendationRoutes);

// Apply Centralized Error Handler Middleware (placed after routes)
app.use(errorHandler as any);

// Connect using MONGO_URI (with fallback to MONGODB_URI)
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/documind';

mongoose.connect(mongoUri)
  .then(() => {
    console.log("Connected to MongoDB successfully");
    app.listen(PORT, () => {
      console.log(`Server is listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB Connection Error:", err);
    process.exit(1);
  });
