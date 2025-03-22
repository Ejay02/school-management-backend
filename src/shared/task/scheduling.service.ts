import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || true,
    credentials: true,
  },
})
export class SchedulingService
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(SchedulingService.name);

  @WebSocketServer()
  private readonly server: Server;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {
    this.logger.log(
      '=== Scheduling service initialized at: ' +
        new Date().toISOString() +
        ' ===',
    );
  }

  // Handle new connections with authentication
  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth.token ||
        client.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        this.logger.warn(
          `Client ${client.id} attempted connection without token`,
        );
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      // Verify the token
      try {
        // Make sure we're using the same JWT secret as in your auth module
        const payload = this.jwtService.verify(token, {
          secret: process.env.JWT_SECRET,
        });

        // Store user info in socket data
        client.data.user = payload;
        this.logger.log(
          `Client ${client.id} connected: ${payload.email || payload.username || payload.sub}`,
        );

        // Send successful connection event
        client.emit('connected', {
          message: 'Successfully connected to real-time updates',
          userId: payload.sub,
        });
      } catch (tokenError) {
        this.logger.warn(
          `Client ${client.id} provided invalid token: ${tokenError.message}`,
        );
        client.emit('error', { message: 'Invalid authentication token' });
        client.disconnect();
      }
    } catch (error) {
      this.logger.error(`Socket connection error: ${error.message}`);
      client.emit('error', { message: 'Connection error' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Run every hour instead of just at midnight to ensure we don't miss any events
  @Cron(CronExpression.EVERY_HOUR)
  async runDailyTasks() {
    const timestamp = new Date().toISOString();

    this.logger.log(`Hourly scheduled tasks starting at: ${timestamp}`);
    this.logger.log('================================================');

    try {
      // Run tasks sequentially to avoid any potential race conditions
      await this.markCompletedEvents();
      await this.archiveOldAnnouncements(30); // First archive announcements older than 30 days
      await this.deleteOldAnnouncements(60); // Then delete announcements older than 60 days that are already archived

      this.logger.log(
        `All scheduled tasks completed at: ${new Date().toISOString()}`,
      );
      this.logger.log('================================================');

      // Removed the scheduledTasksCompleted event since it's not needed on the frontend
    } catch (error) {
      this.logger.error('Error running scheduled tasks:', error.stack);
    }
  }

  private async markCompletedEvents() {
    this.logger.log('Running task to mark completed events');

    try {
      const now = new Date();

      // Find all events that have ended and are still marked as SCHEDULED
      const completedEvents = await this.prisma.event.findMany({
        where: {
          endTime: { lt: now },
          status: 'SCHEDULED',
        },
      });

      this.logger.log(
        `Found ${completedEvents.length} events to mark as completed`,
      );

      // Update all events at once
      if (completedEvents.length > 0) {
        const updatedEvents = await this.prisma.event.updateMany({
          where: {
            endTime: { lt: now },
            status: 'SCHEDULED',
          },
          data: {
            status: 'COMPLETED',
          },
        });

        this.logger.log(
          `Updated ${updatedEvents.count} events to COMPLETED status`,
        );

        // Emit socket event to notify clients about the updates
        this.server.emit('eventsUpdated', {
          // Changed from 'eventUpdated' to 'eventsUpdated'
          message: 'Events have been marked as completed',
          events: completedEvents.map((event) => ({
            ...event,
            status: 'COMPLETED',
          })),
          timestamp: new Date().toISOString(),
        });

        // Removed the scheduledTaskUpdate event since it's not needed on the frontend
      }
    } catch (error) {
      this.logger.error('Error marking events as completed', error);
    }
  }

  /**
   * Deletes old announcements
   * @param daysOld Number of days after which to delete announcements
   */
  private async deleteOldAnnouncements(daysOld: number = 30) {
    this.logger.log(
      `Running task to delete announcements older than ${daysOld} days`,
    );

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      // Find announcements older than the cutoff date
      const oldAnnouncements = await this.prisma.announcement.findMany({
        where: {
          createdAt: { lt: cutoffDate },
          isArchived: true, // Only delete announcements that were already archived
        },
      });

      this.logger.log(
        `Found ${oldAnnouncements.length} old announcements to delete`,
      );

      // Delete all old announcements at once
      if (oldAnnouncements.length > 0) {
        const deletedAnnouncements = await this.prisma.announcement.deleteMany({
          where: {
            createdAt: { lt: cutoffDate },
            isArchived: true,
          },
        });

        this.logger.log(
          `Deleted ${deletedAnnouncements.count} old announcements`,
        );

        // Emit individual deletion events for each announcement
        oldAnnouncements.forEach((announcement) => {
          this.server.emit('announcementDeleted', {
            message: 'An announcement has been permanently deleted',
            announcementId: announcement.id,
            timestamp: new Date().toISOString(),
          });
        });

        // Remove the scheduledTaskUpdate emission since it's not needed on the frontend
      }
    } catch (error) {
      this.logger.error('Error deleting old announcements', error);
    }
  }

  private async archiveOldAnnouncements(daysOld: number = 30) {
    this.logger.log(
      `Running task to archive announcements older than ${daysOld} days`,
    );

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      // Find announcements older than the cutoff date that aren't already archived
      const oldAnnouncements = await this.prisma.announcement.findMany({
        where: {
          createdAt: { lt: cutoffDate },
          isArchived: false,
        },
      });

      this.logger.log(
        `Found ${oldAnnouncements.length} announcements to archive`,
      );

      // Archive all old announcements at once
      if (oldAnnouncements.length > 0) {
        const archivedAnnouncements = await this.prisma.announcement.updateMany(
          {
            where: {
              createdAt: { lt: cutoffDate },
              isArchived: false,
            },
            data: {
              isArchived: true,
              archivedAt: new Date(),
            },
          },
        );

        this.logger.log(
          `Archived ${archivedAnnouncements.count} announcements`,
        );

        // Emit socket events for each archived announcement
        oldAnnouncements.forEach((announcement) => {
          this.server.emit('announcementArchived', {
            message: 'An announcement has been automatically archived',
            announcementId: announcement.id,
            timestamp: new Date().toISOString(),
          });
        });

        // Removed the scheduledTaskUpdate event since it's not needed on the frontend
      }
    } catch (error) {
      this.logger.error('Error archiving old announcements', error);
    }
  }

  // Public methods to manually trigger tasks if needed (useful for testing)

  /**
   * Manually trigger the event completion check
   * Useful for testing or one-time operations
   */
  public async manuallyMarkCompletedEvents() {
    await this.markCompletedEvents();
  }

  /**
   * Manually trigger announcement archiving
   * @param daysOld Number of days after which to archive announcements
   */
  public async manuallyArchiveOldAnnouncements(daysOld: number = 30) {
    await this.archiveOldAnnouncements(daysOld);
  }

  /**
   * Manually trigger announcement deletion
   * @param daysOld Number of days after which to delete announcements
   */
  public async manuallyDeleteOldAnnouncements(daysOld: number = 60) {
    await this.deleteOldAnnouncements(daysOld);
  }
}
