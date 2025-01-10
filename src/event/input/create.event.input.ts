import { InputType, Field } from '@nestjs/graphql';

import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { EventVisibility } from '../enum/eventVisibility';
import { Roles } from 'src/shared/enum/role';

@InputType()
export class CreateEventInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  title: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  description: string;

  @Field(() => Date)
  startTime: Date;

  @Field(() => Date)
  endTime: Date;

  @Field()
  @IsString()
  @IsNotEmpty()
  location: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @IsEnum(EventVisibility)
  visibility: EventVisibility;

  @Field(() => [Roles])
  @IsEnum(Roles)
  targetRoles: Roles[];

  @Field()
  @IsOptional()
  classId?: string;
}
