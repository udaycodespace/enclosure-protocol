import { Test, TestingModule } from '@nestjs/testing';
import { RazorpayPaymentFailedWebhookController } from './razorpay-payment-failed-webhook.controller';

describe('RazorpayPaymentFailedWebhookController', () => {
  let controller: RazorpayPaymentFailedWebhookController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RazorpayPaymentFailedWebhookController],
    }).compile();

    controller = module.get<RazorpayPaymentFailedWebhookController>(RazorpayPaymentFailedWebhookController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
