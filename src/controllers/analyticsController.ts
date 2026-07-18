import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Document } from '../models/Document';
import { Conversation } from '../models/Conversation';
import mongoose from 'mongoose';

/**
 * Controller to compile real-time analytics statistics via DB aggregation pipelines.
 */
export const getAnalytics = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized request' });
      return;
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);

    // 1. Total Documents Count & Storage Size
    const generalStats = await Document.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          totalDocuments: { $sum: 1 },
          totalBytes: { $sum: '$size' },
        },
      },
    ]);

    const totalDocuments = generalStats[0]?.totalDocuments || 0;
    const totalSize = generalStats[0]?.totalBytes || 0;

    // 2. Total AI Requests
    // Calculated as: (1 Summary + 1 Extract per Document) + (All AI chat responses)
    const conversations = await Conversation.find({ userId });
    const aiChatCount = conversations.reduce(
      (acc, conv) => acc + (conv.messages?.filter((m) => msgSenderIsAI(m.sender)).length || 0),
      0
    );
    const totalAIRequests = (totalDocuments * 2) + aiChatCount;

    // Helper helper to avoid TypeScript issues on message schema mapping
    function msgSenderIsAI(sender: string) {
      return sender === 'ai' || sender === 'model';
    }

    // 3. MIME Type Distribution (PDF, DOCX, TXT)
    const fileTypes = await Document.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: '$mimeType',
          count: { $sum: 1 },
        },
      },
    ]);

    const friendlyNames: Record<string, string> = {
      'application/pdf': 'PDF',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
      'application/msword': 'DOC',
      'text/plain': 'TXT',
    };

    const typeDistribution = fileTypes.map((item) => ({
      name: friendlyNames[item._id] || 'Other',
      value: item.count,
    }));

    // 4. Documents By Category
    const categoryStats = await Document.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const documentsByCategory = categoryStats.map((item) => ({
      name: item._id || 'General',
      value: item.count,
    }));

    // 5. Monthly Uploads (Past 6 Months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const monthlyStats = await Document.aggregate([
      {
        $match: {
          userId,
          createdAt: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const monthlyUploads = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthStr = d.toISOString().substring(0, 7); // "YYYY-MM"
      const record = monthlyStats.find((m) => m._id === monthStr);
      monthlyUploads.push({
        month: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        uploads: record ? record.count : 0,
      });
    }

    // 6. Past 7 Days Upload Timeline (Activity Chart)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const uploadsOverTime = await Document.aggregate([
      {
        $match: {
          userId,
          createdAt: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          uploads: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const activityChart = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      const dateStr = day.toISOString().split('T')[0] || '';
      const record = uploadsOverTime.find((u) => u._id === dateStr);
      
      activityChart.push({
        date: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        uploads: record ? record.uploads : 0,
      });
    }

    // 7. Status distribution stats
    const statusStats = await Document.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const statusDistribution = statusStats.map((item) => ({
      status: item._id,
      count: item.count,
    }));

    res.status(200).json({
      totalDocuments,
      totalSize,
      totalAIRequests,
      documentsByCategory,
      monthlyUploads,
      typeDistribution,
      activityChart,
      statusDistribution,
    });
  } catch (error) {
    next(error);
  }
};
