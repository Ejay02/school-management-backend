import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Stripe from 'stripe';
import { InvoiceStatus, PaymentStatus } from '@prisma/client';
import { CreateFeeStructureInput } from './input/create.fee.structure.input';
import { PaginationParams } from 'src/shared/pagination/types/pagination.types';
import { PrismaQueryBuilder } from 'src/shared/pagination/utils/prisma.pagination';
import { FeeType } from './enum/fee.type';
import { UpdateFeeStructureInput } from './input/update.fee.structure.input';
import { Term } from './enum/term';
import { DeleteResponse } from 'src/shared/auth/response/delete.response';
import { ClassRevenueItem } from './types/class.revenue.item.type';

@Injectable()
export class PaymentService {
  private readonly stripe: Stripe;

  constructor(private readonly prisma: PrismaService) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-12-18.acacia',
    });
  }

  async getAllFeeStructures(params: PaginationParams) {
    try {
      const baseQuery = {
        include: {
          components: true,
          classes: true,
        },
        orderBy: { createdAt: 'desc' },
      };

      // Define searchable fields
      const searchFields = ['academicYear', 'term', 'type', 'description'];

      // If no limit is specified, set it to a higher value to fetch all fee structures
      const enhancedParams = {
        ...params,
        limit: params.limit || 100, // Use 100 as default limit instead of 10
      };

      const result = await PrismaQueryBuilder.paginateResponse(
        this.prisma.feeStructure,
        baseQuery,
        enhancedParams,
        searchFields,
      );

      return result;
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('Failed to fetch fee structures');
    }
  }

  async getFeeStructureById(feeStructureId: string) {
    const feeStructure = await this.prisma.feeStructure.findUnique({
      where: { id: feeStructureId },
      include: { components: true, classes: true },
    });

    if (!feeStructure) {
      throw new NotFoundException('Fee structure not found');
    }

    return feeStructure;
  }

  async createFeeStructure(input: CreateFeeStructureInput) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Handle both single classId and array of classIds
        let classIdsToUse: string[] = [];

        if (input.classId) {
          // If a single classId is provided, use it
          classIdsToUse = [input.classId];
        } else if (input.classIds?.length) {
          // If an array of classIds is provided, use them
          classIdsToUse = input.classIds;
        }

        if (classIdsToUse.length) {
          // Validate class fee structures
          await this.validateClassFeeStructures(
            tx,
            classIdsToUse,
            input.academicYear,
            input.type,
            input.term,
          );
        }

        // Validate components sum
        this.validateComponentSum(input.components, input.totalAmount);

        // Create fee structure
        const feeStructure = await this.createFeeStructureRecord(
          tx,
          input.academicYear,
          input.type,
          input.term,
          input.description,
          input.totalAmount,
          input.components,
        );

        if (classIdsToUse.length) {
          await this.updateClassFeeStructures(
            tx,
            classIdsToUse,
            feeStructure.id,
          );
        }

        return feeStructure;
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to create fee structure: ${error.message}`,
      );
    }
  }

  async updateFeeStructure(id: string, input: UpdateFeeStructureInput) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existingStructure = await tx.feeStructure.findUnique({
          where: { id },
          include: { components: true, classes: true },
        });

        if (!existingStructure) {
          throw new NotFoundException('Fee structure not found');
        }

        // Handle both single classId and array of classIds
        let classIdsToUse: string[] = [];

        if (input.classId) {
          // If a single classId is provided, use it
          classIdsToUse = [input.classId];
        } else if (input.classIds?.length) {
          // If an array of classIds is provided, use them
          classIdsToUse = input.classIds;
        } else if (existingStructure.classes?.length) {
          // If no new class IDs provided, use existing ones for validation
          classIdsToUse = existingStructure.classes.map((cls) => cls.id);
        }

        // Determine the values to use for validation (either new input or existing values)
        const academicYearToUse =
          input.academicYear || existingStructure.academicYear;
        const typeToUse = (input.type || existingStructure.type) as FeeType;
        const termToUse =
          typeToUse === FeeType.YEARLY
            ? null
            : ((input.term || existingStructure.term) as Term);

        // Check for duplicate fee structures only if we have classes to validate against
        if (classIdsToUse.length) {
          // Check if there are any other fee structures with the same critical fields
          // but exclude the current fee structure being updated
          const duplicateFeeStructure = await tx.feeStructure.findFirst({
            where: {
              id: { not: id }, // Exclude the current fee structure
              academicYear: academicYearToUse,
              type: typeToUse,
              term: termToUse,
              classes: {
                some: {
                  id: { in: classIdsToUse },
                },
              },
            },
            include: {
              classes: true,
            },
          });

          if (duplicateFeeStructure) {
            const duplicateClass = duplicateFeeStructure.classes.find((cls) =>
              classIdsToUse.includes(cls.id),
            );

            if (duplicateClass) {
              throw new BadRequestException(
                `Cannot update fee structure: Class ${duplicateClass.name} already has a ${typeToUse === FeeType.YEARLY ? 'yearly' : termToUse} fee structure for academic year ${academicYearToUse}`,
              );
            }
          }
        }

        // Validate components if updated
        if (input.components) {
          this.validateComponentSum(
            input.components,
            input.totalAmount || existingStructure.totalAmount,
          );
        }

        const updatedStructure = await tx.feeStructure.update({
          where: { id },
          data: {
            academicYear: input.academicYear,
            term: typeToUse === FeeType.YEARLY ? null : input.term,
            type: input.type,
            description: input.description,
            totalAmount: input.totalAmount,
            components: input.components
              ? {
                  deleteMany: {},
                  create: input.components.map((component) => ({
                    name: component.name,
                    description: component.description,
                    amount: component.amount,
                  })),
                }
              : undefined,
          },
          include: { components: true },
        });

        // Check if we need to update class associations
        if (classIdsToUse.length || input.classIds === null) {
          // Reset existing class associations
          await tx.class.updateMany({
            where: { feeStructureId: id },
            data: { feeStructureId: null },
          });

          // Set new class associations if provided
          if (classIdsToUse.length) {
            await this.updateClassFeeStructures(tx, classIdsToUse, id);
          }
        }

        return updatedStructure;
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(
        `Failed to update fee structure: ${error.message}`,
      );
    }
  }

  //  * Validates that classes don't have conflicting fee structures
  private async validateClassFeeStructures(
    tx: any,
    classIds: string[],
    academicYear: string,
    type: FeeType,
    term?: Term | null,
  ) {
    // Check existing fee structures for these classes
    const existingFeeStructures = await tx.class.findMany({
      where: {
        id: { in: classIds },
        feeStructure: {
          academicYear: academicYear,
        },
      },
      include: {
        feeStructure: true,
      },
    });

    // For YEARLY type, check if any class already has a yearly fee structure
    if (type === FeeType.YEARLY) {
      const classWithYearlyFee = existingFeeStructures.find(
        (cls) => cls.feeStructure?.type === FeeType.YEARLY,
      );

      if (classWithYearlyFee) {
        throw new BadRequestException(
          `Class ${classWithYearlyFee.name} already has a yearly fee structure for academic year ${academicYear}`,
        );
      }
    }

    // For TERM type, check if any class already has this specific term
    if (type === FeeType.TERM && term) {
      const classWithTermFee = existingFeeStructures.find(
        (cls) => cls.feeStructure?.term === term,
      );

      if (classWithTermFee) {
        throw new BadRequestException(
          `Class ${classWithTermFee.name} already has a fee structure for ${term} term in academic year ${academicYear}`,
        );
      }

      // Check if any class already has all three terms
      const classTermCounts = await tx.class.findMany({
        where: {
          id: { in: classIds },
        },
        select: {
          id: true,
          name: true,
          feeStructure: {
            where: {
              academicYear: academicYear,
              type: FeeType.TERM,
            },
            select: {
              term: true,
            },
          },
        },
      });

      // Check if any class has all three terms
      const classWithAllTerms = classTermCounts.find(
        (cls) =>
          Array.isArray(cls.feeStructure) && cls.feeStructure.length >= 3,
      );

      if (classWithAllTerms) {
        throw new BadRequestException(
          `Class ${classWithAllTerms.name} already has all three terms defined for academic year ${academicYear}`,
        );
      }
    }
  }

  // Validates that component amounts sum up to the total amount
  private validateComponentSum(
    components: Array<{ amount: number }>,
    totalAmount: number,
  ) {
    const componentSum = components.reduce((sum, comp) => sum + comp.amount, 0);

    if (Math.abs(componentSum - totalAmount) > 0.01) {
      throw new BadRequestException(
        'Total amount must equal sum of components',
      );
    }
  }

  //  * Creates a fee structure record in the database
  private async createFeeStructureRecord(
    tx: any,
    academicYear: string,
    type: FeeType,
    term: Term | null | undefined,
    description: any,
    totalAmount: number,
    components: Array<{ name: string; description?: string; amount: number }>,
  ) {
    return await tx.feeStructure.create({
      data: {
        academicYear: academicYear,
        term: type === FeeType.YEARLY ? null : term,
        type: type,
        description: description,
        totalAmount: totalAmount,
        components: {
          create: components.map((component) => ({
            name: component.name,
            description: component.description,
            amount: component.amount,
          })),
        },
      },
      include: {
        components: true,
      },
    });
  }

  //  * Updates class records to associate them with a fee structure
  private async updateClassFeeStructures(
    tx: any,
    classIds: string[],
    feeStructureId: string,
  ) {
    await tx.class.updateMany({
      where: { id: { in: classIds } },
      data: { feeStructureId: feeStructureId },
    });
  }

  async deleteFeeStructure(feeStructureId: string): Promise<DeleteResponse> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Check if fee structure exists
        const feeStructure = await tx.feeStructure.findUnique({
          where: { id: feeStructureId },
          include: {
            components: true,
            invoices: true,
            classes: true,
          },
        });

        if (!feeStructure) {
          throw new NotFoundException(
            `Fee structure with ID ${feeStructureId} not found`,
          );
        }

        // Check if there are any paid invoices associated with this fee structure
        const paidInvoices = feeStructure.invoices.filter(
          (invoice) =>
            invoice.status === InvoiceStatus.PAID ||
            invoice.status === InvoiceStatus.PARTIAL,
        );

        if (paidInvoices.length > 0) {
          throw new ForbiddenException(
            'Cannot delete fee structure with paid invoices. Please archive it instead.',
          );
        }

        // Update classes to remove the association with this fee structure
        if (feeStructure.classes.length > 0) {
          await tx.class.updateMany({
            where: { feeStructureId },
            data: { feeStructureId: null },
          });
        }

        // Delete associated invoices
        if (feeStructure.invoices.length > 0) {
          // First delete payments associated with these invoices
          await tx.payment.deleteMany({
            where: {
              invoiceId: {
                in: feeStructure.invoices.map((invoice) => invoice.id),
              },
            },
          });

          // Then delete the invoices
          await tx.invoice.deleteMany({
            where: { feeStructureId },
          });
        }

        // Delete fee components
        await tx.feeComponent.deleteMany({
          where: { feeStructureId },
        });

        // Finally delete the fee structure
        await tx.feeStructure.delete({
          where: { id: feeStructureId },
        });

        return {
          success: true,
          message: `Fee structure with ID ${feeStructureId} has been successfully deleted`,
        };
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to delete fee structure: ${error.message}`,
      );
    }
  }

  async generateInvoice(parentId: string, feeStructureId: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Check if parent exists

        const parent = await this.prisma.parent.findUnique({
          where: { id: parentId },
        });

        if (!parent) {
          throw new NotFoundException('Parent not found');
        }

        // Check if fee structure exists
        const feeStructure = await tx.feeStructure.findUnique({
          where: { id: feeStructureId },
          include: { components: true },
        });

        if (!feeStructure) {
          throw new NotFoundException('Fee structure not found');
        }

        // Check if an invoice already exists for this parent and fee structure
        const existingInvoice = await tx.invoice.findFirst({
          where: {
            parentId,
            feeStructureId,
            status: { not: InvoiceStatus.PAID }, // Adjust based on your requirements
          },
        });

        if (existingInvoice) {
          throw new ConflictException(
            'An invoice already exists for this parent and fee structure',
          );
        }

        // Generate unique invoice number
        const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        // Create invoice
        return await tx.invoice.create({
          data: {
            invoiceNumber,
            parentId,
            feeStructureId,
            totalAmount: feeStructure.totalAmount,
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            status: InvoiceStatus.PENDING,
          },
          include: {
            feeStructure: {
              include: {
                components: true,
              },
            },
            payments: true,
          },
        });
      });
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to generate invoice: ${error.message}`,
      );
    }
  }

  // get individual invoice[parent]
  async getMyInvoices(parentId: string, params?: PaginationParams) {
    // Verify parent exists and has access
    const parent = await this.prisma.parent.findUnique({
      where: { id: parentId },
    });

    if (!parent) {
      throw new NotFoundException('Parent not found');
    }

    const baseQuery = {
      where: { parentId },
      include: {
        feeStructure: {
          include: {
            components: true,
          },
        },
        payments: true,
      },
    };

    const searchFields = ['invoiceNumber', 'status', 'totalAmount'];

    return PrismaQueryBuilder.paginateResponse(
      this.prisma.invoice,
      baseQuery,
      params,
      searchFields,
    );
  }

  async getAllPayments(params?: PaginationParams, parentId?: string) {
    try {
      // Build the query based on provided filters
      // If parentId is not provided, it's an admin request - return all payments
      // If parentId is provided, filter by that parent
      const baseQuery = {
        where: parentId ? { parentId } : {},
        include: {
          parent: {
            include: {
              students: {
                include: {
                  class: true,
                },
              },
            },
          },
          invoice: {
            include: {
              feeStructure: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      };

      const searchFields = ['status', 'paymentMethod', 'description'];

      const result = await PrismaQueryBuilder.paginateResponse(
        this.prisma.payment,
        baseQuery,
        params || {},
        searchFields,
      );

      // Transform the data to include student information
      const transformedData = result.data.map((payment: any) => {
        // Get the first student of the parent
        const student = payment.parent?.students?.[0];

        return {
          id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          paymentMethod: payment.paymentMethod,
          stripePaymentId: payment.stripePaymentId,
          description: payment.description,
          invoiceId: payment.invoiceId,
          parentId: payment.parentId,
          studentName: student?.name ?? 'Unknown',
          studentSurname: student?.surname ?? 'Unknown',
          studentId: student?.id ?? '',
          studentImage: student?.image ?? null,
          classId: student?.class?.id ?? '',
          className: student?.class?.name ?? 'Unknown',
          feeType: payment.invoice?.feeStructure?.type ?? null,
          createdAt: payment.createdAt,
          updatedAt: payment.updatedAt,
        };
      });

      return {
        ...result,
        data: transformedData,
      };
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new InternalServerErrorException('Failed to fetch payments');
    }
  }

  async getPaymentById(paymentId: string) {
    try {
      const payment = await this.prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
          invoice: {
            include: {
              feeStructure: true,
            },
          },
        },
      });

      if (!payment) {
        throw new NotFoundException(`Payment with ID ${paymentId} not found`);
      }

      // Return the payment directly without transforming
      // The frontend already has the student data from the list view
      return payment;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        `Failed to fetch payment: ${error.message}`,
      );
    }
  }

  async initiatePayment(parentId: string, invoiceId: string, amount: number) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const invoice = await tx.invoice.findFirst({
          where: {
            id: invoiceId,
            parentId,
          },
          include: {
            parent: true,
            feeStructure: true,
          },
        });

        if (!invoice) {
          throw new NotFoundException('Invoice not found');
        }

        if (invoice.status === InvoiceStatus.PAID) {
          throw new BadRequestException('Invoice is already paid');
        }

        if (amount > invoice.totalAmount - invoice.paidAmount) {
          throw new BadRequestException(
            'Payment amount exceeds remaining balance',
          );
        }

        // Create Checkout Session with payment intent data
        const session = await this.stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          mode: 'payment',
          line_items: [
            {
              price_data: {
                currency: 'usd',
                unit_amount: Math.round(amount * 100),
                product_data: {
                  name: `Invoice ${invoice.invoiceNumber}`,
                  description: `Payment for ${invoice.feeStructure.type} fees`,
                },
              },
              quantity: 1,
            },
          ],
          customer_email: invoice.parent.email,
          metadata: {
            invoiceId,
            parentId: invoice.parentId,
            invoiceNumber: invoice.invoiceNumber,
          },
          success_url: `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
        });

        // Update invoice with session ID
        await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            checkoutSessionId: session.id,
          },
        });

        return session.url;
      });
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to create checkout session: ${error.message}`,
      );
    }
  }

  // TODO : NOT FIRING COZ OF LOCAL HOST DO THIS WHEN DONE WITH TASK

  async handlePaymentWebhook(signature: string, payload: Buffer) {
    try {
      // 1. Verify the webhook payload using Stripe's webhook secret.
      // This ensures the request came from Stripe and wasn't tampered with.
      const event = this.stripe.webhooks.constructEvent(
        payload, // The raw payload sent by Stripe
        signature, // The signature from Stripe's headers
        process.env.STRIPE_WEBHOOK_SECRET!,
      );

      // 2. Handle the different types of events sent by Stripe
      switch (event.type) {
        case 'checkout.session.completed': {
          // Retrieve the session with expanded payment intent
          const session = await this.stripe.checkout.sessions.retrieve(
            (event.data.object as Stripe.Checkout.Session).id,
            {
              expand: ['payment_intent'],
            },
          );
          await this.handleSuccessfulCheckoutSession(session);
          break;
        }
        case 'payment_intent.succeeded':
          await this.handleSuccessfulPayment(
            event.data.object as Stripe.PaymentIntent,
          );
          break;
        case 'payment_intent.payment_failed':
          await this.handleFailedPayment(
            event.data.object as Stripe.PaymentIntent,
          );
          break;
        case 'checkout.session.expired':
          await this.handleExpiredCheckoutSession(
            event.data.object as Stripe.Checkout.Session,
          );
          break;
      }

      // 3. Respond to Stripe to confirm the webhook was received successfully.
      // Stripe expects a 2xx HTTP status; otherwise, it retries sending the event.
      return { received: true };
    } catch (error) {
      throw new BadRequestException(
        `Invalid webhook payload: ${error.message}`,
      );
    }
  }

  private async handleSuccessfulCheckoutSession(
    session: Stripe.Checkout.Session,
  ) {
    const { invoiceId, parentId } = session.metadata;

    console.log('Webhook received for session:', session.id);
    console.log('Invoice ID:', invoiceId);
    console.log('Parent ID:', parentId);

    if (!invoiceId || !parentId) {
      throw new InternalServerErrorException(
        'Missing invoiceId or parentId in session metadata',
      );
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const invoice = await tx.invoice.findFirst({
          where: {
            id: invoiceId,
            parentId,
          },
        });

        if (!invoice) {
          console.log('Invoice not found for ID:', invoiceId);
          throw new NotFoundException('Invoice not found or access denied');
        }

        console.log('Invoice found:', invoice);

        // Get the payment intent ID from the expanded session
        const paymentIntentId =
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : (session.payment_intent as Stripe.PaymentIntent).id;

        console.log('Payment Intent ID:', paymentIntentId);

        // Create payment record
        const payment = await tx.payment.create({
          data: {
            amount: session.amount_total / 100,
            currency: session.currency,
            status: PaymentStatus.COMPLETED,
            stripePaymentId: paymentIntentId, // Use payment intent ID here
            paymentMethod: session.payment_method_types?.[0] || 'card',
            invoiceId,
            parentId,
            description: `Payment for invoice ${session.metadata.invoiceNumber}`,
          },
        });

        console.log('Payment created:', payment);

        // Update invoice status, paid amount, and payment intent ID
        const newPaidAmount = invoice.paidAmount + payment.amount;
        const newStatus =
          newPaidAmount >= invoice.totalAmount
            ? InvoiceStatus.PAID
            : InvoiceStatus.PARTIAL;

        await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            paidAmount: newPaidAmount,
            status: newStatus,
            checkoutSessionId: null, // Clear session ID after successful payment
            paymentIntentId, // Store the payment intent ID
          },
        });

        console.log('Invoice updated to status:', newStatus);
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to process successful checkout session',
      );
    }
  }

  private async handleExpiredCheckoutSession(session: Stripe.Checkout.Session) {
    const { invoiceId } = session.metadata;

    if (invoiceId) {
      await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          checkoutSessionId: null,
        },
      });
    }
  }

  private async handleSuccessfulPayment(paymentIntent: Stripe.PaymentIntent) {
    const { invoiceId, parentId } = paymentIntent.metadata;

    // Validate metadata
    if (!invoiceId || !parentId) {
      throw new InternalServerErrorException(
        'Missing invoiceId or parentId in payment metadata',
      );
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        // Validate that the invoice belongs to the parent
        const invoice = await tx.invoice.findFirst({
          where: {
            id: invoiceId,
            parentId,
          },
        });

        if (!invoice) {
          throw new NotFoundException('Invoice not found or access denied');
        }

        // Create payment record
        const payment = await tx.payment.create({
          data: {
            amount: paymentIntent.amount / 100,
            currency: paymentIntent.currency,
            status: PaymentStatus.COMPLETED,
            stripePaymentId: paymentIntent.id,
            paymentMethod: paymentIntent.payment_method_types[0],
            invoiceId,
            parentId,
            description: paymentIntent.description,
          },
        });

        const newPaidAmount = invoice.paidAmount + payment.amount;
        const newStatus =
          newPaidAmount >= invoice.totalAmount
            ? InvoiceStatus.PAID
            : InvoiceStatus.PARTIAL;

        await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            paidAmount: newPaidAmount,
            status: newStatus,
          },
        });
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to process successful payment',
      );
    }
  }

  private async handleFailedPayment(paymentIntent: Stripe.PaymentIntent) {
    const { invoiceId, parentId } = paymentIntent.metadata;

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.payment.create({
          data: {
            amount: paymentIntent.amount / 100,
            currency: paymentIntent.currency,
            status: PaymentStatus.FAILED,
            stripePaymentId: paymentIntent.id,
            paymentMethod: paymentIntent.payment_method_types[0],
            invoiceId,
            parentId,
            description: `Failed payment for invoice ${paymentIntent.metadata.invoiceNumber}`,
          },
        });
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to process failed payment',
      );
    }
  }

  // ... existing code ...
  async getBillingReportDashboard() {
    // Define academic year boundaries (September to July)
    const now = new Date();
    const currentYear = now.getFullYear();
    const isBeforeSeptember = now.getMonth() < 8; // 0-indexed: 8 = September
    const academicYearStart = new Date(
      isBeforeSeptember ? currentYear - 1 : currentYear,
      8,
      1,
    ); // September 1
    const academicYearEnd = new Date(
      isBeforeSeptember ? currentYear : currentYear + 1,
      7,
      31,
      23,
      59,
      59,
      999,
    ); // July 31

    // 1. Total Revenue (Paid + Partial)
    const totalRevenueResult = await this.prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: { in: ['COMPLETED'] },
        createdAt: { gte: academicYearStart, lte: academicYearEnd },
      },
    });
    const totalRevenue = totalRevenueResult._sum.amount || 0;

    // 2. Outstanding Payments
    const outstandingInvoices = await this.prisma.invoice.findMany({
      where: {
        status: { in: ['PENDING', 'PARTIAL'] },
        createdAt: { gte: academicYearStart, lte: academicYearEnd },
      },
      select: { id: true, totalAmount: true, dueDate: true, status: true },
    });
    const outstandingAmount = outstandingInvoices.reduce(
      (sum, inv) => sum + inv.totalAmount,
      0,
    );
    const overdueInvoices = outstandingInvoices.filter(
      (inv) => inv.dueDate < now && inv.status !== 'PAID',
    );
    const overdueCount = overdueInvoices.length;
    const overdueAmount = overdueInvoices.reduce(
      (sum, inv) => sum + inv.totalAmount,
      0,
    );
    const overduePercentage =
      outstandingAmount > 0
        ? Math.round((overdueAmount / outstandingAmount) * 100)
        : 0;

    // 3. Collection Rate
    const allInvoices = await this.prisma.invoice.findMany({
      where: { createdAt: { gte: academicYearStart, lte: academicYearEnd } },
      select: { totalAmount: true, status: true },
    });
    const totalInvoiceAmount = allInvoices.reduce(
      (sum, inv) => sum + inv.totalAmount,
      0,
    );
    const collectedAmount = allInvoices
      .filter((inv) => inv.status === 'PAID' || inv.status === 'PARTIAL')
      .reduce((sum, inv) => sum + inv.totalAmount, 0);
    const collectionRate =
      totalInvoiceAmount > 0
        ? Math.round((collectedAmount / totalInvoiceAmount) * 100)
        : 0;
    const targetRate = 95; // Example target rate

    // 4. Revenue Trend (Monthly, Sep-Jul)
    const months = [
      'Sep',
      'Oct',
      'Nov',
      'Dec',
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
    ];
    const revenueTrendData = Array(months.length).fill(0);
    const payments = await this.prisma.payment.findMany({
      where: {
        status: { in: ['COMPLETED'] },
        createdAt: { gte: academicYearStart, lte: academicYearEnd },
      },
      select: { amount: true, createdAt: true },
    });
    payments.forEach((payment) => {
      const date = payment.createdAt;
      let monthIndex = date.getMonth() - 8; // September is 8
      if (monthIndex < 0) monthIndex += 12;
      if (monthIndex >= 0 && monthIndex < months.length) {
        revenueTrendData[monthIndex] += payment.amount;
      }
    });

    // 5. Payment Status Distribution
    const statusCounts = { PAID: 0, PARTIAL: 0, PENDING: 0, OVERDUE: 0 };
    allInvoices.forEach((inv) => {
      if (inv.status === 'PAID') statusCounts.PAID++;
      else if (inv.status === 'PARTIAL') statusCounts.PARTIAL++;
      else if (inv.status === 'PENDING') statusCounts.PENDING++;
      // Overdue is determined by dueDate < now and not PAID
    });
    statusCounts.OVERDUE = overdueCount;
    const paymentStatusLabels = ['Paid', 'Partial', 'Pending', 'Overdue'];
    const paymentStatusData = [
      statusCounts.PAID,
      statusCounts.PARTIAL,
      statusCounts.PENDING,
      statusCounts.OVERDUE,
    ];

    // 6. Top Classes by Revenue
    const classRevenue: Record<string, ClassRevenueItem> = {};
    const paidPayments = await this.prisma.payment.findMany({
      where: {
        status: { in: ['COMPLETED'] },
        createdAt: { gte: academicYearStart, lte: academicYearEnd },
      },
      include: {
        invoice: {
          include: {
            feeStructure: {
              include: {
                classes: true,
              },
            },
          },
        },
      },
    });
    paidPayments.forEach((payment) => {
      const classes = payment.invoice?.feeStructure?.classes ?? [];
      classes.forEach((cls) => {
        if (!classRevenue[cls.id]) {
          classRevenue[cls.id] = { id: cls.id, name: cls.name, revenue: 0 };
        }
        classRevenue[cls.id].revenue += payment.amount;
      });
    });
    const topClassesByRevenue = Object.values(classRevenue)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // 7. Growth Percentage (compared to previous academic year)
    const prevAcademicYearStart = new Date(academicYearStart);
    prevAcademicYearStart.setFullYear(prevAcademicYearStart.getFullYear() - 1);
    const prevAcademicYearEnd = new Date(academicYearEnd);
    prevAcademicYearEnd.setFullYear(prevAcademicYearEnd.getFullYear() - 1);
    const prevRevenueResult = await this.prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: { in: ['COMPLETED'] },
        createdAt: { gte: prevAcademicYearStart, lte: prevAcademicYearEnd },
      },
    });
    const prevRevenue = prevRevenueResult._sum.amount || 0;
    const growthPercentage =
      prevRevenue > 0
        ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100)
        : 100;

    return {
      totalRevenue: {
        amount: totalRevenue,
        growthPercentage,
      },
      outstandingPayments: {
        amount: outstandingAmount,
        overdueCount,
        overduePercentage,
      },
      collectionRate: {
        rate: collectionRate,
        targetRate,
      },
      revenueTrend: {
        months,
        data: revenueTrendData,
      },
      paymentStatusDistribution: {
        labels: paymentStatusLabels,
        data: paymentStatusData,
      },
      topClassesByRevenue,
    };
  }
}
