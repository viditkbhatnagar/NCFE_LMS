import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import User from '@/models/User';
import Qualification from '@/models/Qualification';
import Enrolment from '@/models/Enrolment';
import AuditLog from '@/models/AuditLog';

export async function GET() {
  const { error } = await withAuth(['admin']);
  if (error) return error;

  await dbConnect();

  const [
    totalUsers,
    totalCourses,
    totalEnrolments,
    studentCount,
    assessorCount,
    iqaCount,
    activeEnrolments,
    recentAuditLogs,
  ] = await Promise.all([
    User.countDocuments(),
    Qualification.countDocuments({ status: 'active' }),
    Enrolment.countDocuments(),
    User.countDocuments({ role: 'student', status: 'active' }),
    User.countDocuments({ role: 'assessor', status: 'active' }),
    User.countDocuments({ role: 'iqa', status: 'active' }),
    Enrolment.countDocuments({ status: { $in: ['enrolled', 'in_progress'] } }),
    AuditLog.find()
      .sort({ timestamp: -1 })
      .limit(10)
      .lean(),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      totalUsers,
      totalCourses,
      totalEnrolments,
      studentCount,
      assessorCount,
      iqaCount,
      activeEnrolments,
      recentAuditLogs: recentAuditLogs.map((log) => ({
        _id: String(log._id),
        userId: log.userId ? String(log.userId) : null,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId ? String(log.entityId) : null,
        timestamp: log.timestamp,
      })),
    },
  });
}
