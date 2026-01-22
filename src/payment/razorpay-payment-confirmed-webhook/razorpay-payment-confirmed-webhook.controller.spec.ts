import { Test, TestingModule } from '@nestjs/testing';
import { RazorpayPaymentConfirmedWebhookController } from './razorpay-payment-confirmed-webhook.controller';

describe('RazorpayPaymentConfirmedWebhookController', () => {
  let controller: RazorpayPaymentConfirmedWebhookController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RazorpayPaymentConfirmedWebhookController],
    }).compile();

    controller = module.get<RazorpayPaymentConfirmedWebhookController>(RazorpayPaymentConfirmedWebhookController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
