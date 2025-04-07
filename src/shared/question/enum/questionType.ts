import { registerEnumType } from '@nestjs/graphql';

export enum QuestionType {
  MCQ = 'MCQ',
  ESSAY = 'ESSAY',
  SHORT_ANSWER = 'SHORT_ANSWER',
  TRUE_FALSE = 'TRUE_FALSE',
  MATCHING = 'MATCHING',
}

registerEnumType(QuestionType, {
  name: 'QuestionType',
  description: 'The type of question (MCQ, ESSAY, etc.)',
});
