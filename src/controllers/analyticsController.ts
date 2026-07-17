import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Document } from '../models/Document';
import mongoose from 'mongoose';

/**
 * Controller to compile analytics statistics via DB aggregation pipelines.
 */
export const getAnalytics = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized request' });
      return;
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);

    // 1. General Metrics
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

    // 2. MIME Type distribution
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
      'application/pdf': 'PDF Documents',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word (DOCX)',
      'application/msword': 'Word (DOC)',
      'text/plain': 'Plain Text (TXT)',
    };

    const typeDistribution = fileTypes.map((item) => ({
      name: friendlyNames[item._id] || 'Other Files',
      value: item.count,
    }));

    // 3. Document Analysis Status
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

    // 4. Seven Days Activity Timeline
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

    // Create continuous timeline mapping
    const activityChart = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      const dateStr = day.toISOString().split('T')[0] || '';
      
      const record = uploadsOverTime.find((u) => u._id === dateStr);
      activityChart.push({
        date: dateStr,
        uploads: record ? record.uploads : 0,
      });
    }

    res.status(200).json({
      totalDocuments,
      totalSize,
      typeDistribution,
      statusDistribution,
      activityChart,
    });
  } catch (error) {
    next(error);
  }
};
