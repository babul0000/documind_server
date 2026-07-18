import { Schema, model } from 'mongoose';

const recommendationSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    userRefinement: {
      type: String,
      default: '',
    },
    recommendations: {
      relatedDocuments: [
        {
          documentId: { type: Schema.Types.ObjectId, ref: 'Document' },
          title: { type: String, required: true },
          reason: { type: String, required: true },
        }
      ],
      similarTopics: [
        {
          topic: { type: String, required: true },
          description: { type: String, required: true },
        }
      ],
      learningResources: [
        {
          title: { type: String, required: true },
          description: { type: String, required: true },
          searchQuery: { type: String, required: true }, // Search query for external resource lookup
        }
      ],
      nextToRead: [
        {
          documentId: { type: Schema.Types.ObjectId, ref: 'Document' },
          title: { type: String, required: true },
          reason: { type: String, required: true },
        }
      ]
    },
    rawAIResponse: {
      type: String,
      default: '',
    }
  },
  {
    timestamps: true,
    collection: 'recommendation',
  }
);

export const Recommendation = model('Recommendation', recommendationSchema);
export default Recommendation;
