import { registerEnumType } from '@nestjs/graphql';

export enum TermReportStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
}

registerEnumType(TermReportStatus, {
  name: 'TermReportStatus',
});
