// payment/payment.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Stripe from 'stripe';
import { InvoiceStatus, PaymentStatus } from '@prisma/client';
import { CreateFeeStructureInput } from './input/create.fee.structure.input';
import { PaginationParams } from 'src/shared/pagination/types/pagination.types';
import { PrismaQueryBuilder } from 'src/shared/pagination/utils/prisma.pagination';
import { FeeType } from './enum/fee.type';

@Injectable()
export class PaymentService {
  private readonly stripe: Stripe;

  constructor(private readonly prisma: PrismaService) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-12-18.acacia',
    });
  }

  async getFeeStructure(id: string) {
    const feeStructure = await this.prisma.feeStructure.findUnique({
      where: { id },
      include: { components: true },
    });

    if (!feeStructure) {
      throw new NotFoundException('Fee structure not found');
    }

    return feeStructure;
  }

  async createFeeStructure(input: CreateFeeStructureInput) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (input.classIds?.length) {
          // Check existing fee structures for these classes
          const existingFeeStructures = await tx.class.findMany({
            where: {
              id: { in: input.classIds },
              feeStructure: {
                academicYear: input.academicYear,
              },
            },
            include: {
              feeStructure: true,
            },
          });

          // For YEARLY type, check if any class already has a yearly fee structure
          if (input.type === FeeType.YEARLY) {
            const classWithYearlyFee = existingFeeStructures.find(
              (cls) => cls.feeStructure?.type === FeeType.YEARLY,
            );

            if (classWithYearlyFee) {
              throw new BadRequestException(
                `Class ${classWithYearlyFee.name} already has a yearly fee structure for academic year ${input.academicYear}`,
              );
            }
          }

          // For TERM type, check if any class already has this specific term
          if (input.type === FeeType.TERM && input.term) {
            const classWithTermFee = existingFeeStructures.find(
              (cls) => cls.feeStructure?.term === input.term,
            );

            if (classWithTermFee) {
              throw new BadRequestException(
                `Class ${classWithTermFee.name} already has a fee structure for ${input.term} term in academic year ${input.academicYear}`,
              );
            }

            // Check if any class already has all three terms
            const classTermCounts = await tx.class.findMany({
              where: {
                id: { in: input.classIds },
              },
              select: {
                id: true,
                name: true,
                feeStructure: {
                  where: {
                    academicYear: input.academicYear,
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
                `Class ${classWithAllTerms.name} already has all three terms defined for academic year ${input.academicYear}`,
              );
            }
          }
        }

        // Validate components sum
        const componentSum = input.components.reduce(
          (sum, comp) => sum + comp.amount,
          0,
        );
        if (Math.abs(componentSum - input.totalAmount) > 0.01) {
          throw new BadRequestException(
            'Total amount must equal sum of components',
          );
        }

        // Create fee structure
        const feeStructure = await tx.feeStructure.create({
          data: {
            academicYear: input.academicYear,
            term: input.type === FeeType.YEARLY ? null : input.term,
            type: input.type,
            totalAmount: input.totalAmount,
            components: {
              create: input.components.map((component) => ({
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

        if (input.classIds?.length) {
          await tx.class.updateMany({
            where: { id: { in: input.classIds } },
            data: { feeStructureId: feeStructure.id },
          });
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

  async initiatePayment(parentId: string, invoiceId: string, amount: number) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const invoice = await tx.invoice.findFirst({
          where: {
            id: invoiceId,
            parentId, // Ensure invoice belongs to the parent
          },
          include: {
            feeStructure: true,
          },

          // include: { parent: true },
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

        // Check for an existing payment intent and return or skip if expired/non existent
        if (invoice.paymentIntentId) {
          const existingPaymentIntent =
            await this.stripe.paymentIntents.retrieve(invoice.paymentIntentId);

          if (
            existingPaymentIntent &&
            existingPaymentIntent.status !== 'canceled' &&
            existingPaymentIntent.amount === Math.round(amount * 100)
          ) {
            return existingPaymentIntent.client_secret;
          }
        }

        const paymentIntent = await this.stripe.paymentIntents.create({
          amount: Math.round(amount * 100), // Convert to cents
          currency: 'usd',
          metadata: {
            invoiceId,
            parentId: invoice.parentId,
            invoiceNumber: invoice.invoiceNumber,
          },
          description: `Payment for invoice ${invoice.invoiceNumber}`,
        });

        // Update the invoice with the new payment intent ID
        await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            paymentIntentId: paymentIntent.id, // Store the payment intent ID
          },
        });

        return paymentIntent.client_secret;
      });
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to create payment intent: ${error.message}`,
      );
    }
  }

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
        default:
          throw new Error(`Unhandled event type: ${event.type}`);
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
}
