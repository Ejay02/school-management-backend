import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Admin } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { BaseLoginInput } from './input/login.input';
import { AuthResponse } from './response/auth.response';
import * as bcrypt from 'bcrypt';
import {
  AdminSignupInput,
  ParentSignupInput,
  StudentSignupInput,
  TeacherSignupInput,
} from './input/signup.input';
import { Roles } from '../enum/role';
import { v4 as uuidv4 } from 'uuid';
import { ClassService } from 'src/class/class.service';
import { SubjectService } from 'src/subject/subject.service';
import { LessonService } from 'src/lesson/lesson.service';
import { SecurityService } from '../security/security.service';
import { MailService } from 'src/mail/mail.service';
import { formatFirstName } from 'src/shared/utils/name.utils';

type SignupInputType =
  | AdminSignupInput
  | TeacherSignupInput
  | StudentSignupInput
  | ParentSignupInput;
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly classService: ClassService,
    private readonly lessonService: LessonService,
    private readonly subjectService: SubjectService,
    private readonly securityService: SecurityService,
    private readonly mailService: MailService,
  ) {}

  private escapeHtml(value: string) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  private escapeHtmlAttribute(value: string) {
    return this.escapeHtml(value);
  }

  private normalizePublicImageUrl(value: string | null | undefined) {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!raw) return null;

    const withProtocol = (() => {
      if (/^https?:\/\//i.test(raw)) return raw;
      if (raw.startsWith('//')) return `https:${raw}`;
      if (/^[a-z0-9.-]+\.[a-z]{2,}\//i.test(raw)) return `https://${raw}`;
      return null;
    })();

    if (!withProtocol) return null;

    try {
      const url = new URL(withProtocol);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
      return url.toString();
    } catch {
      return null;
    }
  }

  private roleLabel(role: Roles) {
    if (role === Roles.ADMIN || role === Roles.SUPER_ADMIN)
      return 'Administrator';
    if (role === Roles.TEACHER) return 'Teacher';
    if (role === Roles.STUDENT) return 'Student';
    if (role === Roles.PARENT) return 'Parent / Guardian';
    return 'User';
  }

  private toRole(value: string | null | undefined): Roles {
    switch (value) {
      case Roles.ADMIN:
        return Roles.ADMIN;
      case Roles.SUPER_ADMIN:
        return Roles.SUPER_ADMIN;
      case Roles.TEACHER:
        return Roles.TEACHER;
      case Roles.STUDENT:
        return Roles.STUDENT;
      case Roles.PARENT:
        return Roles.PARENT;
      default:
        return Roles.STUDENT;
    }
  }

  private isStudentSignupInput(
    input: SignupInputType,
  ): input is StudentSignupInput {
    const record = input as unknown as Record<string, unknown>;
    return (
      typeof record.parentId === 'string' &&
      record.parentId.trim().length > 0 &&
      'classId' in record
    );
  }

  private roleTheme(role: Roles) {
    if (role === Roles.ADMIN || role === Roles.SUPER_ADMIN) {
      return {
        headerBg: '#e7f7f1',
        badgeBg: '#c6f0df',
        text: '#0b3b2d',
        primary: '#0b6b4d',
        cardBg: '#f1fbf7',
      };
    }

    if (role === Roles.PARENT) {
      return {
        headerBg: '#fbf2e3',
        badgeBg: '#f5d7a6',
        text: '#3b2a12',
        primary: '#8a5a1e',
        cardBg: '#fff7ea',
      };
    }

    if (role === Roles.STUDENT) {
      return {
        headerBg: '#eaf4ff',
        badgeBg: '#cfe6ff',
        text: '#14284a',
        primary: '#1a5fb4',
        cardBg: '#f3f8ff',
      };
    }

    return {
      headerBg: '#efedff',
      badgeBg: '#dcd8ff',
      text: '#2a2457',
      primary: '#3b2fa3',
      cardBg: '#f8f7ff',
    };
  }

  private rolePath(role: Roles) {
    if (role === Roles.ADMIN || role === Roles.SUPER_ADMIN) return '/admin';
    if (role === Roles.PARENT) return '/parent';
    if (role === Roles.STUDENT) return '/student';
    return '/login';
  }

  private buildAppUrl(pathname: string) {
    const raw = process.env.FRONTEND_URL?.trim();
    if (!raw) return pathname;
    const base = raw.endsWith('/') ? raw.slice(0, -1) : raw;
    return `${base}${pathname}`;
  }

  private async buildWelcomeEmailHtml(params: {
    name?: string | null;
    role: Roles;
  }): Promise<{ subject: string; html: string; text: string }> {
    const state = await this.prisma.setupState.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
      select: { schoolName: true, schoolAddress: true, schoolLogo: true },
    });

    const schoolName =
      typeof state.schoolName === 'string' && state.schoolName.trim().length
        ? state.schoolName.trim()
        : 'your school';
    const schoolAddress =
      typeof state.schoolAddress === 'string' &&
      state.schoolAddress.trim().length
        ? state.schoolAddress.trim()
        : null;
    const schoolLogo = this.normalizePublicImageUrl(state.schoolLogo);

    const firstName = formatFirstName(params.name) || 'there';
    const safeFirstName = this.escapeHtml(firstName);
    const safeSchoolName = this.escapeHtml(schoolName);
    const safeSchoolAddress = schoolAddress
      ? this.escapeHtml(schoolAddress)
      : null;
    const safeLogoUrl = schoolLogo
      ? this.escapeHtmlAttribute(schoolLogo)
      : null;

    const theme = this.roleTheme(params.role);
    const roleLabel = this.roleLabel(params.role);
    const safeRoleLabel = this.escapeHtml(roleLabel);

    const ctaUrl = this.buildAppUrl(this.rolePath(params.role));
    const safeCtaUrl = this.escapeHtmlAttribute(ctaUrl);

    const headline =
      params.role === Roles.ADMIN || params.role === Roles.SUPER_ADMIN
        ? `Welcome aboard, ${firstName}!`
        : `Welcome to ${schoolName}, ${firstName}!`;

    const safeHeadline = this.escapeHtml(headline);

    const subhead = (() => {
      if (params.role === Roles.ADMIN || params.role === Roles.SUPER_ADMIN) {
        return `Your admin account is live. Your school's workspace is ready to configure.`;
      }
      if (params.role === Roles.TEACHER) {
        return `Your account is ready. Let's get your classroom set up.`;
      }
      if (params.role === Roles.STUDENT) {
        return `Your student account is ready. Time to start learning.`;
      }
      if (params.role === Roles.PARENT) {
        return `Your account is ready. Stay close to your child's education.`;
      }
      return `Your account is ready.`;
    })();

    const safeSubhead = this.escapeHtml(subhead);

    const steps = (() => {
      if (params.role === Roles.ADMIN || params.role === Roles.SUPER_ADMIN) {
        return [
          'Sign in & secure your account',
          'Configure school settings',
          'Invite teachers & parents',
          'Review your dashboard',
        ];
      }
      if (params.role === Roles.TEACHER) {
        return [
          'Sign in to your portal',
          'Complete your profile',
          'Set up your first class',
        ];
      }
      if (params.role === Roles.STUDENT) {
        return [
          'Log in for the first time',
          'Set up your profile',
          'Explore your classes',
        ];
      }
      if (params.role === Roles.PARENT) {
        return [
          'Sign in to your account',
          "Link your child's profile",
          'Turn on notifications',
        ];
      }
      return [
        'Sign in to your account',
        'Complete your profile',
        'Get started',
      ];
    })();

    const ctaText = (() => {
      if (params.role === Roles.ADMIN || params.role === Roles.SUPER_ADMIN)
        return 'Go to admin dashboard';
      if (params.role === Roles.TEACHER) return 'Go to my portal';
      if (params.role === Roles.STUDENT) return 'Go to my classes';
      if (params.role === Roles.PARENT) return 'Go to my account';
      return 'Go to my account';
    })();

    const safeCtaText = this.escapeHtml(ctaText);

    const frontendBase = (() => {
      const raw = process.env.FRONTEND_URL?.trim();
      if (!raw) return null;
      const base = raw.endsWith('/') ? raw.slice(0, -1) : raw;
      return base.length ? this.escapeHtmlAttribute(base) : null;
    })();

    const subject =
      params.role === Roles.ADMIN || params.role === Roles.SUPER_ADMIN
        ? `Welcome aboard — ${schoolName}`
        : `Welcome to ${schoolName}`;

    const text = [
      `Hi ${firstName},`,
      '',
      `Your ${roleLabel} account for ${schoolName} is ready.`,
      `Sign in: ${ctaUrl}`,
      ...(schoolAddress ? ['', schoolAddress] : []),
    ].join('\n');

    const html = `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="x-apple-disable-message-reformatting" />
          <title>${safeSchoolName}</title>
        </head>
        <body style="margin:0; padding:0; background-color:${theme.headerBg};">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:${theme.headerBg}; padding:24px 12px;">
            <tr>
              <td align="center">
                <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="width:600px; max-width:600px; background-color:#ffffff; border-radius:16px; overflow:hidden; border:1px solid rgba(0,0,0,0.06);">
                  <tr>
                    <td style="background-color:${theme.headerBg}; padding:22px 22px 18px; text-align:center;">
                      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td align="center" style="padding-bottom:10px;">
                            ${
                              safeLogoUrl
                                ? `<img src="${safeLogoUrl}" width="44" height="44" alt="${safeSchoolName}" style="display:block; width:44px; height:44px; border-radius:10px; object-fit:cover;" />`
                                : `<div style="width:44px; height:44px; border-radius:10px; background-color:${theme.primary}; display:inline-block;"></div>`
                            }
                          </td>
                        </tr>
                        <tr>
                          <td align="center" style="font-family: ui-sans-serif, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:${theme.text}; font-size:18px; font-weight:800;">
                            ${safeSchoolName}
                          </td>
                        </tr>
                        <tr>
                          <td align="center" style="padding-top:12px;">
                            <span style="display:inline-block; font-family: ui-sans-serif, -apple-system, Segoe UI, Roboto, Arial, sans-serif; font-size:12px; font-weight:700; color:${theme.text}; background-color:${theme.badgeBg}; padding:6px 10px; border-radius:999px;">
                              ${safeRoleLabel} account
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td align="center" style="padding-top:16px; font-family: ui-sans-serif, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#14121f; font-size:28px; line-height:34px; font-weight:900;">
                            ${safeHeadline}
                          </td>
                        </tr>
                        <tr>
                          <td align="center" style="padding-top:10px; font-family: ui-sans-serif, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#4b4675; font-size:15px; line-height:22px;">
                            ${safeSubhead}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:22px; font-family: ui-sans-serif, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#14121f; font-size:15px; line-height:22px;">
                      <p style="margin:0 0 12px; font-weight:800;">Hi ${safeFirstName},</p>
                      <p style="margin:0 0 16px; color:#2f2a5e;">
                        Your account has been created successfully. Use the button below to sign in and get started.
                      </p>

                      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 18px;">
                        ${steps
                          .map(
                            (label, index) => `
                              <tr>
                                <td style="padding:8px 0;">
                                  <div style="background-color:${theme.cardBg}; border:1px solid rgba(0,0,0,0.05); border-radius:14px; padding:14px 14px; color:#2f2a5e;">
                                    <span style="display:inline-block; width:28px; height:28px; border-radius:999px; background-color:${theme.primary}; color:#ffffff; text-align:center; line-height:28px; font-weight:800; margin-right:10px;">
                                      ${index + 1}
                                    </span>
                                    <span style="font-weight:800; color:#14121f;">${this.escapeHtml(label)}</span>
                                  </div>
                                </td>
                              </tr>
                            `,
                          )
                          .join('')}
                      </table>

                      <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 12px;">
                        <tr>
                          <td align="center" bgcolor="${theme.primary}" style="border-radius:12px;">
                            <a href="${safeCtaUrl}" style="display:inline-block; padding:14px 20px; font-family: ui-sans-serif, -apple-system, Segoe UI, Roboto, Arial, sans-serif; font-size:15px; font-weight:800; color:#ffffff; text-decoration:none; border-radius:12px;">
                              ${safeCtaText}
                            </a>
                          </td>
                        </tr>
                      </table>

                      <div style="border-top:1px solid rgba(0,0,0,0.06); margin:18px 0 14px;"></div>

                      <p style="margin:0 0 10px; color:#4b4675; font-size:13px; line-height:18px;">
                        Button not working? Copy and paste this link into your browser:
                      </p>
                      <p style="margin:0; font-size:13px; line-height:18px;">
                        <a href="${safeCtaUrl}" style="color:${theme.primary}; text-decoration:underline; word-break:break-word;">${this.escapeHtml(
                          ctaUrl,
                        )}</a>
                      </p>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:18px 22px 22px; background-color:#ffffff; border-top:1px solid rgba(0,0,0,0.06); text-align:center; font-family: ui-sans-serif, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#7a769a; font-size:12px; line-height:18px;">
                      ${
                        frontendBase
                          ? `<div style="margin:0 0 6px;">
                              <a href="${frontendBase}/privacy-policy" style="color:#7a769a; text-decoration:underline;">Privacy Policy</a>
                              <span style="padding:0 6px;">·</span>
                              <a href="${frontendBase}/unsubscribe" style="color:#7a769a; text-decoration:underline;">Unsubscribe</a>
                            </div>`
                          : ''
                      }
                      ${
                        safeSchoolAddress
                          ? `<div style="margin:0;">${safeSchoolAddress}</div>`
                          : `<div style="margin:0;">${safeSchoolName}</div>`
                      }
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `.trim();

    return { subject, html, text };
  }

  private async findUserById(userId: string) {
    const userPromises = [
      this.prisma.admin.findUnique({ where: { id: userId } }),
      this.prisma.teacher.findUnique({ where: { id: userId } }),
      this.prisma.student.findUnique({ where: { id: userId } }),
      this.prisma.parent.findUnique({ where: { id: userId } }),
    ];

    const users = await Promise.all(userPromises);
    return users.find((user) => user !== null);
  }

  private async findUserByUsername(
    username: string,
    role?: Roles,
    client: any = this.prisma,
  ) {
    if (
      !client?.admin?.findUnique ||
      !client?.teacher?.findUnique ||
      !client?.student?.findUnique ||
      !client?.parent?.findUnique
    ) {
      throw new InternalServerErrorException('Database client is not ready');
    }

    if (role) {
      switch (role) {
        case Roles.ADMIN:
        case Roles.SUPER_ADMIN:
          return client.admin.findUnique({ where: { username } });
        case Roles.TEACHER:
          return client.teacher.findUnique({ where: { username } });
        case Roles.STUDENT:
          return client.student.findUnique({ where: { username } });
        case Roles.PARENT:
          return client.parent.findUnique({ where: { username } });
      }
    }

    const userPromises = [
      client.admin.findUnique({ where: { username } }),
      client.teacher.findUnique({ where: { username } }),
      client.student.findUnique({ where: { username } }),
      client.parent.findUnique({ where: { username } }),
    ];

    const users = await Promise.all(userPromises);
    return users.find((user) => user !== null) ?? null;
  }

  private hasLoginRole(
    input: BaseLoginInput,
  ): input is BaseLoginInput & { role: Roles } {
    return 'role' in input;
  }

  private async validateForeignKeys(tx: any, input: StudentSignupInput) {
    // Validate that parent exists
    const parent = await tx.parent.findUnique({
      where: { id: input.parentId },
    });
    if (!parent) {
      throw new NotFoundException(
        `Parent with ID ${input.parentId} not found. Please verify the parent ID.`,
      );
    }

    // If linking to an existing student, validate that the student exists
    if (input.existingStudentId) {
      const student = await tx.student.findUnique({
        where: { id: input.existingStudentId },
      });

      if (!student) {
        throw new NotFoundException(
          `Student with ID ${input.existingStudentId} not found. Please verify the student ID.`,
        );
      }
      return;
    }

    // Validate that class exists and has capacity
    const targetClass = await tx.class.findUnique({
      where: { id: input.classId },
      include: {
        students: true,
      },
    });
    if (!targetClass) {
      throw new NotFoundException(
        `Class with ID ${input.classId} not found. Please verify the class ID.`,
      );
    }

    if (targetClass.students.length >= targetClass.capacity) {
      throw new BadRequestException(
        `Class ${targetClass.name} has reached its maximum capacity of ${targetClass.capacity} students.`,
      );
    }
  }

  private async linkStudentToParent(
    tx: any,
    studentId: string,
    parentId: string,
  ): Promise<boolean> {
    try {
      // Verify both the student and parent exist
      const student = await tx.student.findUnique({
        where: { id: studentId },
      });

      if (!student) {
        throw new NotFoundException(`Student with ID ${studentId} not found.`);
      }

      const parent = await this.prisma.parent.findUnique({
        where: { id: parentId },
      });

      if (!parent) {
        throw new NotFoundException(`Parent with ID ${parentId} not found.`);
      }

      // Create a record in a new "parentStudentLinks" table
      await tx.parentStudentLink.create({
        data: {
          studentId,
          parentId,
        },
      });

      return true;
    } catch (error) {
      throw new Error(`Failed to link student to parent: ${error.message}`);
    }
  }

  async signup(
    input: SignupInputType,
    ipAddress?: string,
  ): Promise<AuthResponse> {
    // Check if IP is blocked (if provided)
    if (ipAddress && this.securityService.isIPBlocked(ipAddress)) {
      throw new UnauthorizedException(
        'Access blocked due to suspicious activity',
      );
    }

    // Check if signup limit reached
    if (ipAddress && this.securityService.hasReachedSignupLimit(ipAddress)) {
      throw new UnauthorizedException(
        'Daily account creation limit reached. Please try again tomorrow.',
      );
    }

    try {
      // Track this signup attempt
      if (ipAddress) {
        this.securityService.trackSignupAttempt(ipAddress);
      }

      const result = await this.prisma.$transaction(async (tx) => {
        const { username, password, email, role } = input;

        // Check if the username already exists in the relevant model
        const existingUser = await this.findUserByUsername(username, role, tx);

        if (existingUser) {
          throw new ConflictException(
            `${role} with this username ${username} already exists`,
          );
        }

        // Handle SUPER_ADMIN creation (only allow the first SUPER_ADMIN)

        let effectiveRole = role;
        if (role === Roles.ADMIN) {
          const adminCount = await tx.admin.count();
          if (adminCount === 0) {
            // First admin should be SUPER_ADMIN
            effectiveRole = Roles.SUPER_ADMIN;

            // Generate classes/subject
            await this.classService.setDefaultClasses(tx);
            await this.subjectService.generateAllSubjects(tx);
            await this.lessonService.generateAllLessons(tx);
          }
        }

        // Hash the password before saving
        const hashedPassword = await bcrypt.hash(password, 10);

        const setupState = await tx.setupState.upsert({
          where: { id: 'default' },
          update: {},
          create: { id: 'default' },
        });
        const schoolDomain = this.normalizeSchoolDomain(
          setupState.schoolDomain,
        );

        // Create the user based on the role
        let newUser;
        switch (effectiveRole) {
          case Roles.ADMIN:
          case Roles.SUPER_ADMIN: {
            const adminId = await this.generateAdminId(tx);
            newUser = await tx.admin.create({
              data: {
                adminId,
                username,
                password: hashedPassword,
                email,
                role: effectiveRole,
                name: input.name,
                surname: input.surname,
              },
            });
            break;
          }

          case Roles.TEACHER: {
            const teacherId = await this.generateTeacherId(tx);
            const institutionalEmail = await this.generateInstitutionalEmail(
              tx,
              input.name,
              input.surname,
              schoolDomain,
            );
            newUser = await tx.teacher.create({
              data: {
                teacherId,
                username,
                password: hashedPassword,
                email,
                institutionalEmail,
                role: effectiveRole,
                name: input.name,
                surname: input.surname,
              },
            });
            break;
          }

          case Roles.STUDENT: {
            if (!this.isStudentSignupInput(input)) {
              throw new BadRequestException('Invalid signup input');
            }
            const studentInput = input;

            await this.validateForeignKeys(tx, studentInput);

            // Check if we're linking to an existing student

            if (studentInput.existingStudentId) {
              // First create the parent user
              const parentData = {
                username,
                password: hashedPassword,
                email,
                role,
                name: studentInput.name,
                surname: studentInput.surname,
                // Any other relevant parent fields
              };

              newUser = await tx.parent.create({
                data: parentData,
              });

              // Then link the parent to the existing student
              await this.linkStudentToParent(
                tx,
                studentInput.existingStudentId,
                newUser.id,
              );

              // Get the student details to return
              const existingStudent = await tx.student.findUnique({
                where: { id: studentInput.existingStudentId },
              });

              // Add student details to the response
              newUser = {
                ...newUser,
                studentId: existingStudent.id,
                name: existingStudent.name,
                surname: existingStudent.surname,
                // other student fields...
              };
            } else {
              // new student: Find the class ID using the enum value
              const classRecord = await tx.class.findFirst({
                where: {
                  name: studentInput.classId,
                },
              });

              const studentId = await this.generateStudentId(tx);
              const institutionalEmail = await this.generateInstitutionalEmail(
                tx,
                studentInput.name,
                studentInput.surname,
                schoolDomain,
              );
              newUser = await tx.student.create({
                data: {
                  studentId,
                  username,
                  password: hashedPassword,
                  email,
                  institutionalEmail,
                  role,
                  name: studentInput.name,
                  surname: studentInput.surname,

                  parentId: studentInput.parentId,
                  classId: classRecord.id,
                },
              });
            }
            break;
          }

          case Roles.PARENT: {
            newUser = await tx.parent.create({
              data: {
                username,
                password: hashedPassword,
                email,
                role,
                name: input.name,
                surname: input.surname,
              },
            });
            break;
          }
        }

        // Generate the token (if this fails, it should trigger rollback)
        const { token, refreshToken } = await this.issueTokens(
          newUser.id,
          effectiveRole,
        );

        // Build the response object with all fields
        const authResponse: AuthResponse = {
          token,
          refreshToken,
          userId: newUser.id,
          role: effectiveRole,
          username: newUser.username,
          name: newUser.name || null,
          surname: newUser.surname || null,
          email: newUser.email || null,
          // address: newUser.address || null,
          // phone: newUser.phone || null,
          // bloodType: newUser.bloodType || null,
          // sex: newUser.sex || null,
          parentId: newUser.parentId || null,
          classId: newUser.classId || null,
          ...this.buildRoleIdentifiers(newUser),
        };
        return authResponse;
      });

      if (result.email) {
        try {
          const welcome = await this.buildWelcomeEmailHtml({
            name: result.name,
            role: this.toRole(result.role),
          });
          await this.mailService.sendMail({
            to: result.email,
            subject: welcome.subject,
            mailType: 'onboarding',
            html: welcome.html,
            text: welcome.text,
          });
        } catch {
          // Email delivery should not fail signup.
        }
      }

      return result;
    } catch (error) {
      // Log signup failures with IP if available
      if (ipAddress && error instanceof UnauthorizedException) {
        await this.securityService.logFailedLoginAttempt(
          input.username,
          ipAddress,
        );
      }
      throw new Error(`Signup Error: ${error}`);
    }
  }

  private normalizeSchoolDomain(value: unknown): string | null {
    const base = typeof value === 'string' ? value : '';
    const trimmed = base.trim().toLowerCase().replace(/^@/, '');
    return trimmed.length ? trimmed : null;
  }

  private normalizeNamePart(value: unknown): string {
    const base = typeof value === 'string' ? value : '';
    return base
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  private buildRoleIdentifiers(user: any) {
    return {
      adminId: user?.adminId ?? null,
      teacherId: user?.teacherId ?? null,
      studentId: user?.studentId ?? null,
      institutionalEmail: user?.institutionalEmail ?? null,
    };
  }

  private async issueTokens(userId: string, role: string) {
    return {
      token: this.generateAccessToken(userId, role),
      refreshToken: await this.generateRefreshToken(userId),
    };
  }

  private async ensureAdminIdentifier(user: any) {
    if (
      !user ||
      (user.role !== Roles.ADMIN && user.role !== Roles.SUPER_ADMIN)
    ) {
      return user;
    }

    if (user.adminId) return user;

    return this.prisma.$transaction(async (tx) => {
      const currentAdmin = (await tx.admin.findUnique({
        where: { id: user.id },
      })) as (Admin & { adminId?: string | null }) | null;

      if (!currentAdmin || currentAdmin.adminId) {
        return currentAdmin ?? user;
      }

      const adminId = await this.generateAdminId(tx);

      return tx.admin.update({
        where: { id: user.id },
        data: { adminId } as Partial<Admin>,
      });
    });
  }

  private async claimNextSequence(
    tx: any,
    field: 'nextStudentSequence' | 'nextTeacherSequence' | 'nextAdminSequence',
  ): Promise<number> {
    const updated = await tx.setupState.update({
      where: { id: 'default' },
      data: { [field]: { increment: 1 } },
      select: { [field]: true } as any,
    });

    const value = Number(updated[field]);
    return value - 1;
  }

  private async generateStudentId(tx: any): Promise<string> {
    const year = new Date().getFullYear();
    const sequence = await this.claimNextSequence(tx, 'nextStudentSequence');
    return `STU-${year}-${String(sequence).padStart(4, '0')}`;
  }

  private async generateTeacherId(tx: any): Promise<string> {
    const year = new Date().getFullYear();
    const sequence = await this.claimNextSequence(tx, 'nextTeacherSequence');
    return `TCH-${year}-${String(sequence).padStart(4, '0')}`;
  }

  private async generateAdminId(tx: any): Promise<string> {
    const year = new Date().getFullYear();
    const sequence = await this.claimNextSequence(tx, 'nextAdminSequence');
    return `ADM-${year}-${String(sequence).padStart(4, '0')}`;
  }

  private async generateInstitutionalEmail(
    tx: any,
    name: string,
    surname: string,
    schoolDomain: string | null,
  ): Promise<string | null> {
    if (!schoolDomain) return null;

    const firstToken = String(name || '')
      .trim()
      .split(/\s+/)
      .find(Boolean);
    const lastToken = String(surname || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .pop();

    const firstInitial = this.normalizeNamePart(firstToken).slice(0, 1);
    const lastName = this.normalizeNamePart(lastToken);
    if (!firstInitial || !lastName) return null;

    const base = `${firstInitial}.${lastName}`;
    for (let n = 0; n < 1000; n++) {
      const suffix = n === 0 ? '' : String(n);
      const candidate = `${base}${suffix}@${schoolDomain}`;

      const [teacher, student] = await Promise.all([
        tx.teacher.findFirst({
          where: {
            OR: [{ institutionalEmail: candidate }, { email: candidate }],
          },
          select: { id: true },
        }),
        tx.student.findFirst({
          where: {
            OR: [{ institutionalEmail: candidate }, { email: candidate }],
          },
          select: { id: true },
        }),
      ]);

      if (!teacher && !student) return candidate;
    }

    throw new ConflictException('Unable to generate a unique email address');
  }

  async login(
    input: BaseLoginInput,
    ipAddress?: string,
  ): Promise<AuthResponse> {
    const { username, password } = input;

    // Only check IP blocking if ipAddress is provided
    if (ipAddress && this.securityService.isIPBlocked(ipAddress)) {
      throw new UnauthorizedException(
        'Access blocked due to suspicious activity',
      );
    }

    // Find user based on role if provided
    let user = await this.findUserByUsername(
      username,
      this.hasLoginRole(input) ? input.role : undefined,
    );

    if (!user || !(await bcrypt.compare(password, user.password))) {
      // Only log failed login attempt if ipAddress is provided
      if (ipAddress) {
        await this.securityService.logFailedLoginAttempt(username, ipAddress);
      }
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user?.isActive === false) {
      throw new UnauthorizedException(
        '⚠️Account has been suspended, contact your admin for more info',
      );
    }

    user = await this.ensureAdminIdentifier(user);

    const { token, refreshToken } = await this.issueTokens(user.id, user.role);

    const authResponse: AuthResponse = {
      token,
      refreshToken,
      userId: user.id,
      role: user.role,
      username: user.username,
      dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString() : null,
      image: user.image ?? null,
      name: user.name ?? null,
      surname: user.surname ?? null,
      email: user.email ?? null,
      address: user.address ?? null,
      phone: user.phone ?? null,
      bloodType: user.bloodType ?? null,
      sex: user.sex ?? null,
      parentId: user.parentId ?? null,
      classId: user.classId ?? null,
      ...this.buildRoleIdentifiers(user),
    };

    return authResponse;
  }

  private generateAccessToken(userId: string, role: string): string {
    return this.jwtService.sign(
      {
        sub: userId,
        role,
      },
      {
        secret: process.env.JWT_SECRET,
        expiresIn: '48h',
      },
    );
  }

  private async generateRefreshToken(userId: string): Promise<string> {
    // Delete any existing refresh tokens for this user
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });

    const token = uuidv4();
    const expires = new Date();
    expires.setDate(expires.getDate() + 7); // 7 days refresh token

    await this.prisma.refreshToken.create({
      data: {
        token,
        userId,
        expires,
      },
    });

    return token;
  }

  async refreshTokens(refreshToken: string) {
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      // include: { user: true },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (new Date() > storedToken.expires) {
      await this.prisma.refreshToken.delete({
        where: { token: refreshToken },
      });
      throw new UnauthorizedException('Refresh token expired');
    }

    // Get user
    const user = await this.findUserById(storedToken.userId);
    if (!user) {
      await this.prisma.refreshToken.delete({
        where: { token: refreshToken },
      });
      throw new UnauthorizedException('User no longer exists');
    }

    if (user.isActive === false) {
      await this.prisma.refreshToken.delete({
        where: { token: refreshToken },
      });
      throw new UnauthorizedException(
        '⚠️Account has been suspended, contact your admin for more info',
      );
    }

    // Generate new tokens
    const newAccessToken = this.generateAccessToken(user.id, user.role);
    const newRefreshToken = await this.generateRefreshToken(user.id);

    // Delete old refresh token
    await this.prisma.refreshToken.delete({
      where: { token: refreshToken },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.delete({
      where: { token: refreshToken },
    });
  }

  async resetPassword(
    username: string,
    newPassword: string,
    role?: Roles,
  ): Promise<AuthResponse> {
    // Find user based on username and role
    const user = await this.findUserByUsername(username, role);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password in the appropriate table
    let updatedUser = null;
    switch (user.role) {
      case Roles.ADMIN:
      case Roles.SUPER_ADMIN:
        updatedUser = await this.prisma.admin.update({
          where: { username },
          data: { password: hashedPassword },
        });
        break;
      case Roles.TEACHER:
        updatedUser = await this.prisma.teacher.update({
          where: { username },
          data: { password: hashedPassword },
        });
        break;
      case Roles.STUDENT:
        updatedUser = await this.prisma.student.update({
          where: { username },
          data: { password: hashedPassword },
        });
        break;
      case Roles.PARENT:
        updatedUser = await this.prisma.parent.update({
          where: { username },
          data: { password: hashedPassword },
        });
        break;
    }

    // Generate new tokens
    const { token, refreshToken } = await this.issueTokens(
      updatedUser.id,
      updatedUser.role,
    );

    return {
      token,
      refreshToken,
      userId: updatedUser.id,
      role: updatedUser.role,
      username: updatedUser.username,
      name: updatedUser.name ?? null,
      surname: updatedUser.surname ?? null,
      email: updatedUser.email ?? null,
      address: updatedUser.address ?? null,
      phone: updatedUser.phone ?? null,
      bloodType: updatedUser.bloodType ?? null,
      sex: updatedUser.sex ?? null,
      parentId: updatedUser.parentId ?? null,
      classId: updatedUser.classId ?? null,
    };
  }
}
