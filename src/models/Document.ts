import { Schema, model } from 'mongoose';

const documentSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    fileUrl: {
      type: String,
      default: '',
    },
    fileType: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      default: 'Document',
    },
    tags: {
      type: [String],
      default: [],
    },
    summary: {
      type: String,
      default: '',
    },
    filename: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    textContent: {
      type: String,
      default: '',
    },
    keyInfo: {
      type: Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    error: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

export const Document = model('Document', documentSchema);
export default Document;
