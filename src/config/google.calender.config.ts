import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleCalendarService {
  // private oauth2Client: OAuth2Client;
  private calendar;
  private readonly logger = new Logger(GoogleCalendarService.name);
  private jwtClient: JWT;

  constructor(private readonly configService: ConfigService) {
    this.initializeCalendar();
  }

  private async initializeCalendar() {
    try {
      this.jwtClient = new google.auth.JWT({
        email: this.configService.get('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
        key: this.configService
          .get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')
          .replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/calendar'],
      });

      await this.jwtClient.authorize();

      this.calendar = google.calendar({
        version: 'v3',
        auth: this.jwtClient,
      });
    } catch (error) {
      this.logger.error('Failed to initialize Google Calendar service:', error);
    }
  }

  async createCalendarEvent(eventData: any) {
    try {
      // Remove attendees from the event creation
      const { ...eventWithoutAttendees } = eventData;

      const event = {
        summary: eventWithoutAttendees.title,
        description: eventWithoutAttendees.description,
        start: {
          dateTime: eventWithoutAttendees.startTime.toISOString(),
          timeZone: 'UTC',
        },
        end: {
          dateTime: eventWithoutAttendees.endTime.toISOString(),
          timeZone: 'UTC',
        },
        location: eventWithoutAttendees.location,
      };

      const result = await this.calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
      });

      // console.log('Calendar event created:', result.data.htmlLink);
      return result.data;
    } catch (error) {
      throw new Error(`Failed to create calendar event: ${error.message}`);
    }
  }

  async updateCalendarEvent(
    eventId: string,
    event: {
      title: string;
      description: string;
      startTime: Date | string;
      endTime: Date | string;
      location?: string;
      attendees?: string[];
    },
  ) {
    try {
      const calendarEvent = {
        summary: event.title,
        description: event.description,
        start: {
          dateTime: new Date(event.startTime).toISOString(),
          timeZone: 'UTC',
        },
        end: {
          dateTime: new Date(event.endTime).toISOString(),
          timeZone: 'UTC',
        },
        location: event.location,
        attendees: event.attendees?.map((email) => ({ email })),
      };

      const response = await this.calendar.events.update({
        calendarId: 'primary',
        eventId: eventId,
        requestBody: calendarEvent,
        sendUpdates: 'all',
      });

      this.logger.log(`Calendar event updated: ${eventId}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to update calendar event ${eventId}:`, error);
      throw new Error(`Failed to update calendar event: ${error.message}`);
    }
  }

  async deleteCalendarEvent(eventId: string): Promise<void> {
    try {
      await this.calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
        sendUpdates: 'all',
      });

      this.logger.log(`Calendar event deleted: ${eventId}`);
    } catch (error) {
      this.logger.error(`Failed to delete calendar event ${eventId}:`, error);
      throw new Error(`Failed to delete calendar event: ${error.message}`);
    }
  }

  async getCalendarEvent(eventId: string) {
    try {
      const response = await this.calendar.events.get({
        calendarId: 'primary',
        eventId: eventId,
      });

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get calendar event ${eventId}:`, error);
      throw new Error(`Failed to get calendar event: ${error.message}`);
    }
  }
}
