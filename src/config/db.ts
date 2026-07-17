import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    const connString = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/documind';
    await mongoose.connect(connString);
    console.log(`MongoDB Connected successfully`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error}`);
    process.exit(1);
  }
};
