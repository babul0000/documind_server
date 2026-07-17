import { Schema, model } from 'mongoose';

const aiReportSchema = new Schema({
  documentId: {
    type: Schema.Types.ObjectId,
    ref: 'Document',
    required: true,
    index: true,
  },
  analysis: {
    type: String,
    required: true,
  },
  insights: {
    type: Schema.Types.Mixed,
    default: {},
  },
  generatedAt: {
    type: Date,
    default: Date.now,
  },
});

export const AIReport = model('AIReport', aiReportSchema);
export default AIReport;
