import { Field, InputType } from '@nestjs/graphql';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Term } from 'src/payment/enum/term';

@InputType()
export class UpdateSetupStateInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  schoolName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  schoolDomain?: string;

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
  schoolLogo?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  schoolContactName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  schoolTimezone?: string;

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

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  weeklyDigestEnabled?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  weeklyDigestDayOfWeek?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  weeklyDigestSendHour?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(59)
  weeklyDigestSendMinute?: number;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  attendanceReasonCodes?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  reportExamWeight?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  reportAssessmentWeight?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  reportAttendanceWeight?: number;
}
