import { Body, Controller, Headers, Post, Req } from '@nestjs/common';
import { PaymentService } from './payment.service';

@Controller('webhook')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  async handleStripeWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() request: any,
    @Body() _body: unknown,
  ) {
    return this.paymentService.handlePaymentWebhook(signature, request.body);
  }
}
