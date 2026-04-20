import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { Term } from 'src/payment/enum/term';

@InputType()
export class UpdateSetupStateInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  schoolName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsEmail()
  schoolEmail?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  schoolPhone?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  schoolAddress?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  academicYearCurrent?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  academicYearNext?: string;

  @Field(() => Term, { nullable: true })
  @IsOptional()
  @IsEnum(Term)
  currentTerm?: Term;
}

