import { ObjectType, Field } from '@nestjs/graphql';

import { PublicClass } from 'src/class/types/public.class.types';
import { PublicSubject } from 'src/subject/types/public.subject.types';

@ObjectType()
export class PublicTeacherResponse {
  @Field()
  id: string;

  @Field()
  name: string;

  @Field()
  surname: string;

  @Field({ nullable: true })
  img?: string;

  @Field(() => [PublicSubject], { nullable: 'itemsAndList' })
  subjects: PublicSubject[];

  @Field(() => [PublicClass], { nullable: 'itemsAndList' })
  classes: PublicClass[];
}
